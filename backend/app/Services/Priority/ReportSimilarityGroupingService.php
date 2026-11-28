<?php

namespace App\Services\Priority;

use App\Models\Laporan;
use App\Models\LaporanGroup;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Orkestrator deteksi laporan serupa (Hybrid: Pre-filter DB Lokal + Verifikasi AI Multimodal),
 * pengelompokan tiket ke tabel laporan_groups, dan eskalasi prioritas otomatis (>= 3 pelapor unik).
 */
class ReportSimilarityGroupingService
{
    private LocationDetailNormalizer $locationNormalizer;
    private GeminiSimilarityVerifier $geminiVerifier;
    private PriorityScoringService $scoringService;

    public function __construct(
        ?LocationDetailNormalizer $locationNormalizer = null,
        ?GeminiSimilarityVerifier $geminiVerifier = null,
        ?PriorityScoringService $scoringService = null
    ) {
        $this->locationNormalizer = $locationNormalizer ?? new LocationDetailNormalizer();
        $this->geminiVerifier = $geminiVerifier ?? new GeminiSimilarityVerifier();
        $this->scoringService = $scoringService ?? app(PriorityScoringService::class);
    }

    /**
     * Periksa apakah skema grouping tersedia pada database aktif.
     */
    public function hasGroupingSchema(): bool
    {
        try {
            return Schema::hasTable('laporan_groups') && Schema::hasColumn('laporan', 'group_id');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Jalankan deteksi hybrid untuk laporan baru setelah transaksi pembuatan laporan commit.
     * Tidak pernah melempar exception agar pengiriman laporan pelapor tetap berhasil.
     */
    public function processNewLaporan(Laporan $newLaporan): ?LaporanGroup
    {
        try {
            if (! $this->hasGroupingSchema()) {
                return null;
            }

            if ($newLaporan->group_id !== null) {
                return LaporanGroup::find($newLaporan->group_id);
            }

            // Tahap 1 — Pre-filter lokal di database (tanpa AI)
            $representatives = $this->findStageOneRepresentatives($newLaporan);
            if ($representatives->isEmpty()) {
                return null;
            }

            // Tahap 2 — Verifikasi kemiripan via AI Multimodal (Gemini)
            $threshold = (float) config('services.gemini.similarity_threshold', 0.75);

            foreach ($representatives as $candidate) {
                $verification = $this->geminiVerifier->verifySimilarity($newLaporan, $candidate);

                // Fallback wajib: jika API AI gagal / timeout / rate limit / belum dikonfigurasi,
                // hentikan verifikasi tanpa menggagalkan penyimpanan laporan.
                if ($verification === null) {
                    return null;
                }

                if ($verification['is_similar'] === true && $verification['confidence'] >= $threshold) {
                    return $this->attachToGroup(
                        $newLaporan,
                        $candidate,
                        $verification['confidence'],
                        $verification['reason']
                    );
                }
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('Hybrid similarity grouping failed safely; report kept ungrouped.', [
                'id_laporan' => $newLaporan->id_laporan ?? null,
                'error'      => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Tahap 1 — Pre-filter lokal di database (tanpa memanggil AI).
     * Kriteria kandidat:
     * 1. Status belum selesai (bukan Selesai & bukan Ditolak).
     * 2. Kategori laporan sama.
     * 3. Lokasi kampus sama.
     * 4. Detail lokasi / ruangan sama (pencocokan ketat ternormalisasi).
     * 5. Pelapor berbeda (nim berbeda).
     * 6. Jika kandidat berada dalam grup, ambil hanya 1 tiket representatif (tiket utama) per grup.
     *
     * @return Collection<int, Laporan>
     */
    public function findStageOneRepresentatives(Laporan $newLaporan): Collection
    {
        $targetCampus = Laporan::normalizeCampus($newLaporan->lokasi_kampus)
            ?? Laporan::inferCampusFromLokasi($newLaporan->lokasi, null);

        $query = Laporan::query()
            ->where('laporan.id_laporan', '<>', $newLaporan->id_laporan)
            ->whereRaw('LOWER(laporan.kategori_laporan) = ?', [strtolower((string) $newLaporan->kategori_laporan)])
            ->where('laporan.nim', '<>', (string) $newLaporan->nim)
            ->whereRaw(
                "LOWER(COALESCE((SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1), 'Terkirim')) NOT IN ('selesai', 'ditolak')"
            )
            ->orderBy('laporan.tanggal_buat', 'asc')
            ->orderBy('laporan.id_laporan', 'asc');

        if ($targetCampus !== null) {
            $query->where('laporan.lokasi_kampus', $targetCampus);
        }

        $candidates = $query->get();
        if ($candidates->isEmpty()) {
            return collect();
        }

        // Filter detail lokasi/ruangan secara ketat
        $locationMatched = $candidates->filter(
            fn (Laporan $candidate): bool => $this->locationNormalizer->isMatch($candidate->lokasi, $newLaporan->lokasi)
        );

        if ($locationMatched->isEmpty()) {
            return collect();
        }

        // Deduplikasi kandidat per grup: 1 tiket representatif (primary_laporan_id) per grup
        $groupIds = $locationMatched->pluck('group_id')->filter()->unique()->values();
        $groupsMap = $groupIds->isNotEmpty()
            ? LaporanGroup::whereIn('id', $groupIds)->get()->keyBy('id')
            : collect();

        $primaryIdsToFetch = [];
        foreach ($groupsMap as $group) {
            if ($group->primary_laporan_id !== null) {
                $primaryIdsToFetch[] = (int) $group->primary_laporan_id;
            }
        }

        $primaryLaporansMap = $primaryIdsToFetch !== []
            ? Laporan::whereIn('id_laporan', array_values(array_unique($primaryIdsToFetch)))
                ->get()
                ->keyBy('id_laporan')
            : collect();

        $representatives = collect();
        $seenGroupIds = [];
        $seenLaporanIds = [];
        $maxCandidates = max(1, (int) config('services.gemini.max_candidates', 5));

        foreach ($locationMatched as $candidate) {
            if ($representatives->count() >= $maxCandidates) {
                break;
            }

            if ($candidate->group_id !== null) {
                $gid = (int) $candidate->group_id;
                if (isset($seenGroupIds[$gid])) {
                    continue;
                }
                $seenGroupIds[$gid] = true;

                $group = $groupsMap->get($gid);
                $primary = ($group && $group->primary_laporan_id)
                    ? $primaryLaporansMap->get((int) $group->primary_laporan_id)
                    : null;

                $rep = $primary ?? $candidate;
                if (! isset($seenLaporanIds[$rep->id_laporan])) {
                    $seenLaporanIds[$rep->id_laporan] = true;
                    $representatives->push($rep);
                }

                continue;
            }

            if (! isset($seenLaporanIds[$candidate->id_laporan])) {
                $seenLaporanIds[$candidate->id_laporan] = true;
                $representatives->push($candidate);
            }
        }

        return $representatives;
    }

    /**
     * Gabungkan laporan baru ke grup kandidat (atau buat grup baru) lalu hitung ulang eskalasi prioritas.
     */
    public function attachToGroup(
        Laporan $newLaporan,
        Laporan $matchedCandidate,
        float $confidence,
        string $reason
    ): LaporanGroup {
        $group = DB::transaction(function () use ($newLaporan, $matchedCandidate, $confidence, $reason): LaporanGroup {
            $freshCandidate = Laporan::findOrFail($matchedCandidate->id_laporan);
            $freshNew = Laporan::findOrFail($newLaporan->id_laporan);

            $group = null;
            if ($freshCandidate->group_id !== null) {
                $group = LaporanGroup::lockForUpdate()->find($freshCandidate->group_id);
            }

            if (! $group) {
                $campus = Laporan::normalizeCampus($freshCandidate->lokasi_kampus)
                    ?? Laporan::inferCampusFromLokasi($freshCandidate->lokasi, null);

                $group = LaporanGroup::create([
                    'primary_laporan_id'    => $freshCandidate->id_laporan,
                    'kategori_laporan'      => $freshCandidate->kategori_laporan,
                    'lokasi_kampus'         => $campus,
                    'normalized_location'   => $this->locationNormalizer->normalize($freshCandidate->lokasi),
                    'unique_reporter_count' => 1,
                    'total_laporan_count'   => 1,
                    'is_escalated'          => false,
                    'similarity_confidence' => $confidence,
                    'similarity_reason'     => $reason,
                ]);

                $freshCandidate->group_id = $group->id;
                $freshCandidate->saveQuietly();
            }

            $freshNew->group_id = $group->id;
            $freshNew->similarity_confidence = $confidence;
            $freshNew->similarity_reason = $reason;
            $freshNew->saveQuietly();

            return $this->refreshGroupMetrics($group, $confidence, $reason);
        });

        // Sinkronkan skor & status eskalasi prioritas ke seluruh laporan anggota grup
        $this->scoringService->syncGroupPriority($group);

        // Perbarui instance model in-memory milik pemanggil
        $newLaporan->group_id = $group->id;
        $newLaporan->similarity_confidence = $confidence;
        $newLaporan->similarity_reason = $reason;

        return $group;
    }

    /**
     * Hitung ulang metrik grup setelah ada anggota yang dihapus atau dipindahkan kategorinya.
     */
    public function recomputeGroupAfterMemberChange(?int $groupId): void
    {
        if ($groupId === null || ! $this->hasGroupingSchema()) {
            return;
        }

        $detachedSingle = null;
        $updatedGroup = null;

        DB::transaction(function () use ($groupId, &$detachedSingle, &$updatedGroup): void {
            $group = LaporanGroup::lockForUpdate()->find($groupId);
            if (! $group) {
                return;
            }

            $members = Laporan::query()
                ->where('group_id', $group->id)
                ->orderBy('tanggal_buat', 'asc')
                ->orderBy('id_laporan', 'asc')
                ->get();

            if ($members->isEmpty()) {
                $group->delete();

                return;
            }

            if ($members->count() === 1) {
                $remaining = $members->first();
                $remaining->group_id = null;
                $remaining->similarity_confidence = null;
                $remaining->similarity_reason = null;
                $remaining->saveQuietly();

                $group->delete();
                $detachedSingle = $remaining;

                return;
            }

            $updatedGroup = $this->refreshGroupMetrics($group);
        });

        if ($detachedSingle instanceof Laporan) {
            $this->scoringService->assessAndSave($detachedSingle, true);
        } elseif ($updatedGroup instanceof LaporanGroup) {
            $this->scoringService->syncGroupPriority($updatedGroup);
        }
    }

    /**
     * Perbarui primary_laporan_id (tiket paling awal), COUNT(DISTINCT nim), total anggota,
     * dan status eskalasi grup di dalam transaksi aktif.
     */
    private function refreshGroupMetrics(
        LaporanGroup $group,
        ?float $confidence = null,
        ?string $reason = null
    ): LaporanGroup {
        $members = Laporan::query()
            ->where('group_id', $group->id)
            ->orderBy('tanggal_buat', 'asc')
            ->orderBy('id_laporan', 'asc')
            ->get(['id_laporan', 'nim', 'tanggal_buat']);

        $primaryLaporan = $members->first();
        $totalCount = $members->count();
        $uniqueReporterCount = $members
            ->pluck('nim')
            ->filter(static fn ($nim): bool => is_string($nim) && trim($nim) !== '')
            ->map(static fn (string $nim): string => trim($nim))
            ->unique()
            ->count();

        $minReporters = max(2, (int) config('priority.group_escalation.min_unique_reporters', 3));
        $isEscalated = $uniqueReporterCount >= $minReporters;

        $group->primary_laporan_id = $primaryLaporan?->id_laporan;
        $group->total_laporan_count = $totalCount;
        $group->unique_reporter_count = max(1, $uniqueReporterCount);
        $group->is_escalated = $isEscalated;
        $group->escalated_at = $isEscalated
            ? ($group->escalated_at ?? now())
            : null;

        if ($confidence !== null) {
            $group->similarity_confidence = $confidence;
        }
        if ($reason !== null) {
            $group->similarity_reason = $reason;
        }

        $group->save();

        return $group;
    }
}

