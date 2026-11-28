<?php

namespace App\Http\Controllers\Priority;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\Laporan;
use App\Models\LaporanGroup;
use App\Services\Priority\PriorityScoringService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PriorityDashboardController extends Controller
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 100;

    private PriorityScoringService $scoringService;

    public function __construct(PriorityScoringService $scoringService)
    {
        $this->scoringService = $scoringService;
    }

    private function resolvePerPage(Request $request): int
    {
        $perPage = (int) $request->input('per_page', self::DEFAULT_PER_PAGE);

        return min(self::MAX_PER_PAGE, max(1, $perPage > 0 ? $perPage : self::DEFAULT_PER_PAGE));
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
    }

    /**
     * @return array<int, mixed>
     */
    private function decodeJsonArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    /**
     * Periksa apakah skema pengelompokan laporan (laporan_groups & laporan.group_id) tersedia.
     */
    private function hasGroupingSchema(): bool
    {
        try {
            return Schema::hasTable('laporan_groups') && Schema::hasColumn('laporan', 'group_id');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Kecualikan laporan berstatus terbaru "Ditolak" dari tabel & ringkasan Dashboard Prioritas.
     */
    private function applyNotRejectedFilter(object $query): object
    {
        return $query->whereRaw(
            "LOWER(COALESCE((SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1), 'Terkirim')) <> 'ditolak'"
        );
    }

    /**
     * Tampilkan hanya 1 baris representatif (tiket utama / paling awal) untuk setiap grup laporan,
     * sementara laporan tunggal (group_id IS NULL) tetap ditampilkan seperti biasa.
     */
    private function applyGroupRepresentativeFilter(object $query, bool $hasGroupingSchema, string $groupAlias = 'lg'): object
    {
        if (! $hasGroupingSchema) {
            return $query;
        }

        return $query->where(function ($q) use ($groupAlias) {
            $q->whereNull('laporan.group_id')
                ->orWhereNull("{$groupAlias}.id")
                ->orWhereColumn('laporan.id_laporan', "{$groupAlias}.primary_laporan_id");
        });
    }

    /**
     * Muat daftar ID anggota per group_id dalam satu query ringan (tanpa N+1).
     *
     * @param  array<int, int>  $groupIds
     * @return array<int, array<int, int>>
     */
    private function loadGroupMemberIdsMap(array $groupIds): array
    {
        $uniqueIds = array_values(array_unique(array_filter($groupIds, static fn ($id): bool => (int) $id > 0)));
        if ($uniqueIds === []) {
            return [];
        }

        $rows = DB::table('laporan')
            ->select(['id_laporan', 'group_id'])
            ->whereIn('group_id', $uniqueIds)
            ->orderBy('tanggal_buat', 'asc')
            ->orderBy('id_laporan', 'asc')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $gid = (int) $row->group_id;
            $map[$gid][] = (int) $row->id_laporan;
        }

        return $map;
    }

    private function hasMissingAssessments(?Admin $admin): bool
    {
        $query = Laporan::query()
            ->leftJoin('priority_assessments', 'priority_assessments.id_laporan', '=', 'laporan.id_laporan')
            ->visibleToAdmin($admin)
            ->whereNull('priority_assessments.id');

        $this->applyNotRejectedFilter($query);

        return $query->exists();
    }

    /**
     * Hitung ringkasan statistik prioritas langsung di SQL (tanpa memuat seluruh tabel ke memori PHP).
     *
     * @return array<string, int|float>
     */
    private function buildSummaryFromSql(?Admin $admin, bool $hasGroupingSchema = false): array
    {
        $needsReviewCond = DB::connection()->getDriverName() === 'pgsql'
            ? 'pa.needs_review IS TRUE'
            : 'pa.needs_review = 1';

        $query = DB::table('laporan')
            ->join('priority_assessments as pa', 'pa.id_laporan', '=', 'laporan.id_laporan')
            ->selectRaw("
                COUNT(*) AS total_laporan,
                COALESCE(SUM(CASE WHEN pa.severity_level = 'berat' OR pa.priority_level = 'kritis' THEN 1 ELSE 0 END), 0) AS kritis_berat,
                COALESCE(SUM(CASE WHEN NOT (pa.severity_level = 'berat' OR pa.priority_level = 'kritis') AND pa.priority_level = 'tinggi' THEN 1 ELSE 0 END), 0) AS tinggi,
                COALESCE(SUM(CASE WHEN NOT (pa.severity_level = 'berat' OR pa.priority_level = 'kritis') AND pa.priority_level = 'sedang' THEN 1 ELSE 0 END), 0) AS sedang,
                COALESCE(SUM(CASE WHEN NOT (pa.severity_level = 'berat' OR pa.priority_level = 'kritis') AND (pa.priority_level IS NULL OR pa.priority_level NOT IN ('tinggi', 'sedang')) THEN 1 ELSE 0 END), 0) AS rendah,
                COALESCE(SUM(CASE WHEN {$needsReviewCond} THEN 1 ELSE 0 END), 0) AS perlu_konfirmasi,
                COALESCE(SUM(pa.priority_score), 0) AS sum_scores
            ");

        if ($hasGroupingSchema) {
            $query->leftJoin('laporan_groups as lg', 'lg.id', '=', 'laporan.group_id');
            $this->applyGroupRepresentativeFilter($query, true, 'lg');
        }

        $this->applyNotRejectedFilter($query);

        if ($admin) {
            if ($campus = $admin->resolvedCampus()) {
                $query->where('laporan.lokasi_kampus', $campus);
            }
            if ($kategori = $admin->allowedKategoriLaporan()) {
                $query->where('laporan.kategori_laporan', $kategori);
            }
        }

        $row = $query->first();
        $total = (int) ($row->total_laporan ?? 0);
        $sumScores = (int) ($row->sum_scores ?? 0);

        return [
            'total_laporan'       => $total,
            'kritis_berat'        => (int) ($row->kritis_berat ?? 0),
            'tinggi'              => (int) ($row->tinggi ?? 0),
            'sedang'              => (int) ($row->sedang ?? 0),
            'rendah'              => (int) ($row->rendah ?? 0),
            'perlu_konfirmasi'    => (int) ($row->perlu_konfirmasi ?? 0),
            'rata_skor_prioritas' => $total > 0 ? round($sumScores / $total, 1) : 0,
        ];
    }

    /**
     * Kolom ringan tabel laporan tanpa kolom longText `foto` agar tidak menarik
     * payload gambar base64 berukuran megabyte dari database jarak jauh.
     *
     * @return array<int, mixed>
     */
    private function lightweightLaporanColumns(bool $hasGroupingSchema = false): array
    {
        $columns = [
            'laporan.id_laporan',
            'laporan.nim',
            'laporan.kategori_laporan',
            'laporan.deskripsi',
            'laporan.tanggal_buat',
            'laporan.tanggal_kejadian',
            'laporan.lokasi_kampus',
            'laporan.lokasi',
            'laporan.kategori_lokasi',
            'laporan.tingkat_keparahan',
            'laporan.skala_keparahan',
        ];

        if ($hasGroupingSchema) {
            $columns[] = 'laporan.group_id';
        }

        $columns[] = DB::raw("CASE WHEN laporan.foto IS NOT NULL AND laporan.foto <> '' THEN 1 ELSE 0 END AS has_foto");

        return $columns;
    }

    /**
     * Hitung metrik kartu ringkasan dari kumpulan penilaian prioritas.
     *
     * @param  iterable<int|string, mixed>  $assessments
     * @return array<string, int|float>
     */
    private function buildSummaryFromAssessments(iterable $assessments): array
    {
        $countKritis = 0;
        $countTinggi = 0;
        $countSedang = 0;
        $countRendah = 0;
        $countNeedsReview = 0;
        $totalScores = 0;
        $total = 0;

        foreach ($assessments as $item) {
            $total++;
            if ($item->needs_review) {
                $countNeedsReview++;
            }

            $totalScores += (int) $item->priority_score;

            if ($item->severity_level === 'berat' || $item->priority_level === 'kritis') {
                $countKritis++;
            } elseif ($item->priority_level === 'tinggi') {
                $countTinggi++;
            } elseif ($item->priority_level === 'sedang') {
                $countSedang++;
            } else {
                $countRendah++;
            }
        }

        return [
            'total_laporan'       => $total,
            'kritis_berat'        => $countKritis,
            'tinggi'              => $countTinggi,
            'sedang'              => $countSedang,
            'rendah'              => $countRendah,
            'perlu_konfirmasi'    => $countNeedsReview,
            'rata_skor_prioritas' => $total > 0 ? round($totalScores / $total, 1) : 0,
        ];
    }

    /**
     * GET /api/admin/priority/reports
     * Mengambil daftar laporan terurut skor prioritas (murni read-only, tanpa write-on-read)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;

            // Siapkan parameter filter satu kali di luar iterasi
            $katFilter = ($request->filled('kategori') && $request->kategori !== 'Semua')
                ? strtolower((string) $request->kategori)
                : null;
            $sevFilter = ($request->filled('severity') && $request->severity !== 'Semua')
                ? strtolower((string) $request->severity)
                : null;
            $plFilter = ($request->filled('priority_level') && $request->priority_level !== 'Semua')
                ? strtolower((string) $request->priority_level)
                : null;
            $stFilter = ($request->filled('status') && $request->status !== 'Semua')
                ? strtolower((string) $request->status)
                : null;
            $needsReviewFilter = $request->boolean('needs_review');
            $searchQuery = $request->filled('search') ? strtolower((string) $request->search) : null;

            $perPage = $this->resolvePerPage($request);
            $page = max(1, (int) $request->input('page', 1));
            $now = now();

            $hasTable = $this->scoringService->hasAssessmentTable();
            $hasGroupingSchema = $this->hasGroupingSchema();
            $isPgsql = DB::connection()->getDriverName() === 'pgsql';

            // Jalur cepat SQL: filtering, sorting, summary, dan pagination dieksekusi langsung di database
            // apabila seluruh laporan pada cakupan admin sudah memiliki baris priority_assessments.
            if ($hasTable && ! $this->hasMissingAssessments($admin)) {
                $summaryData = $this->buildSummaryFromSql($admin, $hasGroupingSchema);

                $baseQuery = Laporan::query()
                    ->join('priority_assessments as pa', 'pa.id_laporan', '=', 'laporan.id_laporan')
                    ->leftJoin('pelapor', 'pelapor.nomor_identitas', '=', 'laporan.nim')
                    ->leftJoin('user_mahasiswa', 'user_mahasiswa.nim', '=', 'pelapor.nomor_identitas')
                    ->leftJoin('user_pegawai', 'user_pegawai.nomor_identitas', '=', 'pelapor.nomor_identitas')
                    ->visibleToAdmin($admin);

                if ($hasGroupingSchema) {
                    $baseQuery->leftJoin('laporan_groups as lg', 'lg.id', '=', 'laporan.group_id');
                    $this->applyGroupRepresentativeFilter($baseQuery, true, 'lg');
                }

                $this->applyNotRejectedFilter($baseQuery);

                if ($katFilter !== null) {
                    $baseQuery->whereRaw('LOWER(laporan.kategori_laporan) = ?', [$katFilter]);
                }
                if ($sevFilter !== null) {
                    $baseQuery->whereRaw('LOWER(pa.severity_level) = ?', [$sevFilter]);
                }
                if ($plFilter !== null) {
                    $baseQuery->whereRaw('LOWER(pa.priority_level) = ?', [$plFilter]);
                }
                if ($stFilter !== null) {
                    $baseQuery->whereRaw(
                        "LOWER(COALESCE((SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1), 'Terkirim')) = ?",
                        [$stFilter]
                    );
                }
                if ($needsReviewFilter) {
                    $baseQuery->where('pa.needs_review', true);
                }
                if ($searchQuery !== null) {
                    $like = '%' . $this->escapeLike($searchQuery) . '%';
                    $baseQuery->where(function ($q) use ($like, $hasGroupingSchema) {
                        $q->whereRaw("LOWER(laporan.deskripsi) LIKE ? ESCAPE '!'", [$like])
                            ->orWhereRaw("LOWER(laporan.lokasi) LIKE ? ESCAPE '!'", [$like])
                            ->orWhereRaw("LOWER(COALESCE(laporan.lokasi_kampus, '')) LIKE ? ESCAPE '!'", [$like])
                            ->orWhereRaw("LOWER(COALESCE(user_mahasiswa.nama, user_pegawai.nama, 'Civitas USD')) LIKE ? ESCAPE '!'", [$like])
                            ->orWhereRaw("LOWER(COALESCE(laporan.nim, '')) LIKE ? ESCAPE '!'", [$like])
                            ->orWhereRaw("CAST(laporan.id_laporan AS TEXT) LIKE ? ESCAPE '!'", [$like]);

                        if ($hasGroupingSchema) {
                            $q->orWhereRaw(
                                "laporan.group_id IS NOT NULL AND EXISTS (
                                    SELECT 1 FROM laporan gm
                                    LEFT JOIN pelapor gp ON gp.nomor_identitas = gm.nim
                                    LEFT JOIN user_mahasiswa gmu ON gmu.nim = gp.nomor_identitas
                                    LEFT JOIN user_pegawai gpu ON gpu.nomor_identitas = gp.nomor_identitas
                                    WHERE gm.group_id = laporan.group_id
                                      AND (
                                          LOWER(gm.deskripsi) LIKE ? ESCAPE '!'
                                          OR LOWER(COALESCE(gmu.nama, gpu.nama, '')) LIKE ? ESCAPE '!'
                                          OR LOWER(COALESCE(gm.nim, '')) LIKE ? ESCAPE '!'
                                          OR CAST(gm.id_laporan AS TEXT) LIKE ? ESCAPE '!'
                                      )
                                )",
                                [$like, $like, $like, $like]
                            );
                        }
                    });
                }

                $total = (clone $baseQuery)->count();
                $lastPage = (int) max(1, ceil($total / $perPage));

                $selectColumns = array_merge($this->lightweightLaporanColumns($hasGroupingSchema), [
                    DB::raw('COALESCE(user_mahasiswa.nama, user_pegawai.nama) AS pelapor_nama'),
                    'pelapor.tipe_user AS pelapor_tipe_user',
                    DB::raw('(SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1) AS latest_status'),
                    'pa.kategori_lokasi AS pa_kategori_lokasi',
                    'pa.tingkat_keparahan_lokasi AS pa_tingkat_keparahan_lokasi',
                    'pa.skala_keparahan_lokasi AS pa_skala_keparahan_lokasi',
                    'pa.priority_score AS pa_priority_score',
                    'pa.priority_level AS pa_priority_level',
                    'pa.severity_level AS pa_severity_level',
                    'pa.severity_source AS pa_severity_source',
                    'pa.ai_suggested_severity AS pa_ai_suggested_severity',
                    'pa.admin_severity AS pa_admin_severity',
                    'pa.confidence AS pa_confidence',
                    'pa.needs_review AS pa_needs_review',
                    'pa.reasons AS pa_reasons',
                    'pa.safety_flags AS pa_safety_flags',
                    'pa.admin_notes AS pa_admin_notes',
                    'pa.reviewed_at AS pa_reviewed_at',
                ]);

                if ($hasGroupingSchema) {
                    $selectColumns = array_merge($selectColumns, [
                        'lg.total_laporan_count AS lg_total_laporan_count',
                        'lg.unique_reporter_count AS lg_unique_reporter_count',
                        'lg.is_escalated AS lg_is_escalated',
                        'lg.escalated_at AS lg_escalated_at',
                    ]);
                }

                $rowsQuery = $baseQuery
                    ->select($selectColumns)
                    ->orderByDesc('pa.priority_score');

                if ($hasGroupingSchema) {
                    $escalatedSortExpr = $isPgsql
                        ? 'CASE WHEN lg.is_escalated IS TRUE THEN 1 ELSE 0 END'
                        : 'CASE WHEN lg.is_escalated = 1 THEN 1 ELSE 0 END';
                    $rowsQuery->orderByRaw("{$escalatedSortExpr} DESC");
                }

                $rowsQuery->orderBy('laporan.tanggal_buat', 'asc');

                $rows = $request->has('page')
                    ? $rowsQuery->forPage($page, $perPage)->get()
                    : $rowsQuery->get();

                $groupMemberIdsMap = $hasGroupingSchema
                    ? $this->loadGroupMemberIdsMap($rows->pluck('group_id')->filter()->map(fn ($id) => (int) $id)->all())
                    : [];

                $pagedItems = $rows->map(function ($row) use ($now, $hasGroupingSchema, $groupMemberIdsMap) {
                    $statusName = $row->latest_status ?? 'Terkirim';
                    $createdAt = $row->tanggal_buat ? Carbon::parse($row->tanggal_buat) : $now;
                    $diffDays = (int) $createdAt->diffInDays($now);
                    $diffHours = (int) $createdAt->diffInHours($now);
                    $lamaMenunggu = $diffDays > 0 ? "{$diffDays} hari lalu" : ($diffHours > 0 ? "{$diffHours} jam lalu" : 'Baru saja');

                    $reasons = $this->decodeJsonArray($row->pa_reasons);
                    $safetyFlags = $this->decodeJsonArray($row->pa_safety_flags);
                    $reviewedAt = $row->pa_reviewed_at ? Carbon::parse($row->pa_reviewed_at)->toIso8601String() : null;

                    $groupId = $hasGroupingSchema && ! empty($row->group_id) ? (int) $row->group_id : null;
                    $memberIds = $groupId !== null
                        ? ($groupMemberIdsMap[$groupId] ?? [(int) $row->id_laporan])
                        : [(int) $row->id_laporan];
                    $memberCount = $groupId !== null
                        ? max(count($memberIds), (int) ($row->lg_total_laporan_count ?? 1))
                        : 1;
                    $uniqueReporters = $groupId !== null
                        ? max(1, (int) ($row->lg_unique_reporter_count ?? 1))
                        : 1;
                    $isGroupEscalated = $groupId !== null && (bool) ($row->lg_is_escalated ?? false);
                    $groupEscalatedAt = ($groupId !== null && ! empty($row->lg_escalated_at))
                        ? Carbon::parse($row->lg_escalated_at)->toIso8601String()
                        : null;

                    return [
                        'id_laporan'               => $row->id_laporan,
                        'nim'                      => $row->nim,
                        'nama_pelapor'             => $row->pelapor_nama ?? 'Civitas USD',
                        'tipe_user'                => $row->pelapor_tipe_user,
                        'kategori_laporan'         => $row->kategori_laporan,
                        'deskripsi'                => $row->deskripsi,
                        'tanggal_buat'             => $row->tanggal_buat,
                        'tanggal_kejadian'         => $row->tanggal_kejadian,
                        'lokasi_kampus'            => $row->lokasi_kampus,
                        'lokasi'                   => $row->lokasi,
                        'kategori_lokasi'          => $row->pa_kategori_lokasi ?? $row->kategori_lokasi ?? 'Tidak Diketahui',
                        'tingkat_keparahan_lokasi' => $row->pa_tingkat_keparahan_lokasi ?? $row->tingkat_keparahan ?? 'Sedang',
                        'skala_keparahan_lokasi'   => (int) ($row->pa_skala_keparahan_lokasi ?? $row->skala_keparahan ?? 2),
                        'foto'                     => null,
                        'has_foto'                 => (bool) ($row->has_foto ?? false),
                        'status_terkini'           => $statusName,
                        'lama_menunggu'            => $lamaMenunggu,
                        'lama_menunggu_hari'       => $diffDays,

                        // Prioritas & Penilaian
                        'priority_score'           => (int) ($row->pa_priority_score ?? 0),
                        'priority_level'           => $row->pa_priority_level ?? 'sedang',
                        'severity_level'           => $row->pa_severity_level ?? 'sedang',
                        'severity_source'          => $row->pa_severity_source ?? 'ai',
                        'ai_suggested_severity'    => $row->pa_ai_suggested_severity ?? 'sedang',
                        'admin_severity'           => $row->pa_admin_severity,
                        'confidence'               => $row->pa_confidence !== null ? (float) $row->pa_confidence : 0.8,
                        'needs_review'             => $row->pa_needs_review !== null ? (bool) $row->pa_needs_review : true,
                        'reasons'                  => $reasons,
                        'ringkasan_alasan'         => ! empty($reasons) ? $reasons[0] : '-',
                        'safety_flags'             => $safetyFlags,
                        'admin_notes'              => $row->pa_admin_notes,
                        'reviewed_at'              => $reviewedAt,

                        // Metadata Grouping & Eskalasi
                        'group_id'                 => $groupId,
                        'is_grouped'               => $memberCount > 1,
                        'group_member_count'       => $memberCount,
                        'group_unique_reporters'   => $uniqueReporters,
                        'is_group_escalated'       => $isGroupEscalated,
                        'group_escalated_at'       => $groupEscalatedAt,
                        'group_member_ids'         => $memberIds,
                    ];
                })->values();

                return response()->json([
                    'status'       => 'success',
                    'message'      => 'Data dashboard prioritas berhasil dimuat.',
                    'total'        => $total,
                    'per_page'     => $perPage,
                    'current_page' => $page,
                    'last_page'    => $lastPage,
                    'data'         => $pagedItems,
                    'summary'      => $summaryData,
                ]);
            }

            // Fallback murni read-only untuk data legacy yang belum dibackfill ke priority_assessments
            // (tanpa write-on-read ke database).
            $fallbackSelect = array_merge($this->lightweightLaporanColumns($hasGroupingSchema), [
                DB::raw('COALESCE(user_mahasiswa.nama, user_pegawai.nama) AS pelapor_nama'),
                'pelapor.tipe_user AS pelapor_tipe_user',
                DB::raw('(SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1) AS latest_status'),
            ]);

            if ($hasGroupingSchema) {
                $fallbackSelect = array_merge($fallbackSelect, [
                    'lg.total_laporan_count AS lg_total_laporan_count',
                    'lg.unique_reporter_count AS lg_unique_reporter_count',
                    'lg.is_escalated AS lg_is_escalated',
                    'lg.escalated_at AS lg_escalated_at',
                ]);
            }

            $laporansQuery = Laporan::query()
                ->select($fallbackSelect)
                ->leftJoin('pelapor', 'pelapor.nomor_identitas', '=', 'laporan.nim')
                ->leftJoin('user_mahasiswa', 'user_mahasiswa.nim', '=', 'pelapor.nomor_identitas')
                ->leftJoin('user_pegawai', 'user_pegawai.nomor_identitas', '=', 'pelapor.nomor_identitas')
                ->visibleToAdmin($admin);

            if ($hasGroupingSchema) {
                $laporansQuery->leftJoin('laporan_groups as lg', 'lg.id', '=', 'laporan.group_id');
                $this->applyGroupRepresentativeFilter($laporansQuery, true, 'lg');
            }

            $this->applyNotRejectedFilter($laporansQuery);

            $laporans = $laporansQuery->get();

            $assessments = $this->scoringService->assessReadOnlyMany($laporans);
            $summaryData = $this->buildSummaryFromAssessments($assessments);

            $groupMemberIdsMap = $hasGroupingSchema
                ? $this->loadGroupMemberIdsMap($laporans->pluck('group_id')->filter()->map(fn ($id) => (int) $id)->all())
                : [];

            $items = $laporans->map(function ($laporan) use ($assessments, $now, $hasGroupingSchema, $groupMemberIdsMap) {
                $assessment = $assessments->get($laporan->id_laporan);
                $statusName = $laporan->latest_status ?? 'Terkirim';

                $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : $now;
                $diffDays = (int) $createdAt->diffInDays($now);
                $diffHours = (int) $createdAt->diffInHours($now);

                $lamaMenunggu = $diffDays > 0 ? "{$diffDays} hari lalu" : ($diffHours > 0 ? "{$diffHours} jam lalu" : 'Baru saja');

                $groupId = $hasGroupingSchema && ! empty($laporan->group_id) ? (int) $laporan->group_id : null;
                $memberIds = $groupId !== null
                    ? ($groupMemberIdsMap[$groupId] ?? [(int) $laporan->id_laporan])
                    : [(int) $laporan->id_laporan];
                $memberCount = $groupId !== null
                    ? max(count($memberIds), (int) ($laporan->lg_total_laporan_count ?? 1))
                    : 1;
                $uniqueReporters = $groupId !== null
                    ? max(1, (int) ($laporan->lg_unique_reporter_count ?? 1))
                    : 1;
                $isGroupEscalated = $groupId !== null && (bool) ($laporan->lg_is_escalated ?? $assessment?->is_group_escalated ?? false);
                $groupEscalatedAt = ($groupId !== null && ! empty($laporan->lg_escalated_at))
                    ? Carbon::parse($laporan->lg_escalated_at)->toIso8601String()
                    : null;

                return [
                    'id_laporan'               => $laporan->id_laporan,
                    'nim'                      => $laporan->nim,
                    'nama_pelapor'             => $laporan->pelapor_nama ?? 'Civitas USD',
                    'tipe_user'                => $laporan->pelapor_tipe_user,
                    'kategori_laporan'         => $laporan->kategori_laporan,
                    'deskripsi'                => $laporan->deskripsi,
                    'tanggal_buat'             => $laporan->tanggal_buat,
                    'tanggal_kejadian'         => $laporan->tanggal_kejadian,
                    'lokasi_kampus'            => $laporan->lokasi_kampus,
                    'lokasi'                   => $laporan->lokasi,
                    'kategori_lokasi'          => $assessment?->kategori_lokasi ?? $laporan->kategori_lokasi ?? 'Tidak Diketahui',
                    'tingkat_keparahan_lokasi' => $assessment?->tingkat_keparahan_lokasi ?? $laporan->tingkat_keparahan ?? 'Sedang',
                    'skala_keparahan_lokasi'   => (int) ($assessment?->skala_keparahan_lokasi ?? $laporan->skala_keparahan ?? 2),
                    'foto'                     => null,
                    'has_foto'                 => (bool) ($laporan->has_foto ?? false),
                    'status_terkini'           => $statusName,
                    'lama_menunggu'            => $lamaMenunggu,
                    'lama_menunggu_hari'       => $diffDays,

                    // Prioritas & Penilaian
                    'priority_score'           => $assessment?->priority_score ?? 0,
                    'priority_level'           => $assessment?->priority_level ?? 'sedang',
                    'severity_level'           => $assessment?->severity_level ?? 'sedang',
                    'severity_source'          => $assessment?->severity_source ?? 'ai',
                    'ai_suggested_severity'    => $assessment?->ai_suggested_severity ?? 'sedang',
                    'admin_severity'           => $assessment?->admin_severity,
                    'confidence'               => $assessment?->confidence ?? 0.8,
                    'needs_review'             => $assessment?->needs_review ?? true,
                    'reasons'                  => $assessment?->reasons ?? [],
                    'ringkasan_alasan'         => ! empty($assessment?->reasons) ? $assessment->reasons[0] : '-',
                    'safety_flags'             => $assessment?->safety_flags ?? [],
                    'admin_notes'              => $assessment?->admin_notes,
                    'reviewed_at'              => $assessment?->reviewed_at?->toIso8601String(),

                    // Metadata Grouping & Eskalasi
                    'group_id'                 => $groupId,
                    'is_grouped'               => $memberCount > 1,
                    'group_member_count'       => $memberCount,
                    'group_unique_reporters'   => $uniqueReporters,
                    'is_group_escalated'       => $isGroupEscalated,
                    'group_escalated_at'       => $groupEscalatedAt,
                    'group_member_ids'         => $memberIds,
                ];
            });

            if ($katFilter !== null || $sevFilter !== null || $plFilter !== null || $stFilter !== null || $needsReviewFilter || $searchQuery !== null) {
                $items = $items->filter(function ($it) use ($katFilter, $sevFilter, $plFilter, $stFilter, $needsReviewFilter, $searchQuery) {
                    if ($katFilter !== null && strtolower($it['kategori_laporan']) !== $katFilter) {
                        return false;
                    }
                    if ($sevFilter !== null && strtolower($it['severity_level']) !== $sevFilter) {
                        return false;
                    }
                    if ($plFilter !== null && strtolower($it['priority_level']) !== $plFilter) {
                        return false;
                    }
                    if ($stFilter !== null && strtolower($it['status_terkini']) !== $stFilter) {
                        return false;
                    }
                    if ($needsReviewFilter && $it['needs_review'] !== true) {
                        return false;
                    }
                    if ($searchQuery !== null) {
                        $memberIdsStr = implode(' ', $it['group_member_ids'] ?? []);

                        return str_contains(strtolower($it['deskripsi']), $searchQuery)
                            || str_contains(strtolower($it['lokasi']), $searchQuery)
                            || str_contains(strtolower((string) ($it['lokasi_kampus'] ?? '')), $searchQuery)
                            || str_contains(strtolower($it['nama_pelapor']), $searchQuery)
                            || str_contains(strtolower((string) ($it['nim'] ?? '')), $searchQuery)
                            || str_contains((string) $it['id_laporan'], $searchQuery)
                            || str_contains($memberIdsStr, $searchQuery);
                    }

                    return true;
                });
            }

            $sortedItems = $items->sort(function ($a, $b) {
                if ($a['priority_score'] !== $b['priority_score']) {
                    return $b['priority_score'] <=> $a['priority_score'];
                }
                if (($a['is_group_escalated'] ?? false) !== ($b['is_group_escalated'] ?? false)) {
                    return ($b['is_group_escalated'] ? 1 : 0) <=> ($a['is_group_escalated'] ? 1 : 0);
                }

                return strcmp((string) $a['tanggal_buat'], (string) $b['tanggal_buat']);
            })->values();

            $total = $sortedItems->count();
            $lastPage = (int) max(1, ceil($total / $perPage));

            if ($request->has('page')) {
                $pagedItems = $sortedItems->forPage($page, $perPage)->values();
            } else {
                $pagedItems = $sortedItems;
            }

            return response()->json([
                'status'       => 'success',
                'message'      => 'Data dashboard prioritas berhasil dimuat.',
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => $lastPage,
                'data'         => $pagedItems,
                'summary'      => $summaryData,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil data dashboard prioritas: '.$e->getMessage(),
                'data'    => [],
            ], 500);
        }
    }

    /**
     * GET /api/admin/priority/reports/{id}
     * Ambil rincian penilaian prioritas sebuah laporan (murni read-only)
     */
    public function show(Request $request, $id): JsonResponse
    {
        try {
            $laporan = Laporan::with([
                'statuses' => function ($query) {
                    $query->orderBy('tanggal_merubah', 'desc');
                    $query->orderBy('id_status', 'desc');
                },
                'pelapor.mahasiswa',
                'pelapor.pegawai',
            ])->findOrFail($id);
            $admin = $request->attributes->get('admin_session')?->admin;
            if ($admin && ! $admin->canAccessLaporan($laporan)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Anda tidak memiliki akses ke laporan dari kampus atau unit lain.',
                ], 403);
            }

            $assessment = $this->scoringService->assessReadOnly($laporan);

            $groupPayload = null;
            if ($this->hasGroupingSchema() && ! empty($laporan->group_id)) {
                $group = LaporanGroup::find($laporan->group_id);
                if ($group) {
                    $members = Laporan::with([
                        'statuses' => function ($query) {
                            $query->orderBy('tanggal_merubah', 'desc');
                            $query->orderBy('id_status', 'desc');
                        },
                        'pelapor.mahasiswa',
                        'pelapor.pegawai',
                    ])
                        ->where('group_id', $group->id)
                        ->orderBy('tanggal_buat', 'asc')
                        ->orderBy('id_laporan', 'asc')
                        ->get();

                    $groupPayload = [
                        'id'                    => (int) $group->id,
                        'primary_laporan_id'    => $group->primary_laporan_id ? (int) $group->primary_laporan_id : null,
                        'total_laporan_count'   => max($members->count(), (int) $group->total_laporan_count),
                        'unique_reporter_count' => max(1, (int) $group->unique_reporter_count),
                        'is_escalated'          => (bool) $group->is_escalated,
                        'escalated_at'          => $group->escalated_at?->toIso8601String(),
                        'similarity_confidence' => $group->similarity_confidence !== null ? (float) $group->similarity_confidence : null,
                        'similarity_reason'     => $group->similarity_reason,
                        'members'               => $members->map(function (Laporan $member) use ($group) {
                            return [
                                'id_laporan'            => (int) $member->id_laporan,
                                'is_primary'            => (int) $member->id_laporan === (int) $group->primary_laporan_id,
                                'nim'                   => $member->nim,
                                'nama_pelapor'          => $member->nama_pelapor ?? 'Civitas USD',
                                'tipe_user'             => $member->pelapor?->tipe_user,
                                'kategori_laporan'      => $member->kategori_laporan,
                                'deskripsi'             => $member->deskripsi,
                                'lokasi_kampus'         => $member->lokasi_kampus,
                                'lokasi'                => $member->lokasi,
                                'tanggal_buat'          => $member->tanggal_buat,
                                'tanggal_kejadian'      => $member->tanggal_kejadian,
                                'foto'                  => $member->foto,
                                'status_terkini'        => $member->statuses->first()?->status_laporan ?? 'Terkirim',
                                'pesan_tanggapan'       => $member->pesan_tanggapan ?? '',
                                'similarity_confidence' => $member->similarity_confidence !== null ? (float) $member->similarity_confidence : null,
                                'similarity_reason'     => $member->similarity_reason,
                            ];
                        })->values()->all(),
                    ];
                }
            }

            $locWeight = $this->scoringService->resolveLocationWeight($laporan->lokasi ?? '');
            $distinctReporters = max(
                $this->scoringService->countNearbyReporters($laporan),
                (int) ($groupPayload['unique_reporter_count'] ?? 1)
            );
            $isGroupEscalated = (bool) ($groupPayload['is_escalated'] ?? $assessment->is_group_escalated ?? false);
            $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : now();
            $daysWaiting = (float) max(0, $createdAt->diffInDays(now()));

            $calculation = $this->scoringService->calculateScore(
                $laporan->kategori_laporan,
                $assessment->dimensions ?? [],
                $locWeight,
                $distinctReporters,
                $daysWaiting,
                $assessment->safety_flags ?? [],
                $isGroupEscalated
            );

            $feedback = [];
            try {
                if ($assessment->exists && $this->scoringService->hasFeedbackTable()) {
                    $feedback = $assessment->feedback()->with('admin')->orderBy('created_at', 'desc')->get();
                }
            } catch (\Throwable $e) {
                $feedback = [];
            }

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'laporan'    => $laporan,
                    'assessment' => $assessment,
                    'breakdown'  => $calculation['breakdown'],
                    'feedback'   => $feedback,
                    'group'      => $groupPayload,
                ],
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil detail prioritas: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * PATCH /api/admin/priority/reports/{id}/severity
     * Prioritas bersifat read-only bagi Admin (dihitung dan dieskalasi otomatis oleh sistem).
     */
    public function updateSeverity(Request $request, $id): JsonResponse
    {
        return response()->json([
            'status'  => 'error',
            'message' => 'Prioritas laporan dihitung dan dieskalasi secara otomatis oleh sistem sehingga bersifat read-only bagi Admin.',
        ], 403);
    }

    /**
     * GET /api/admin/priority/summary
     * Metrik ringkasan kartu statistik dashboard prioritas (murni read-only)
     */
    public function summary(Request $request): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            $hasTable = $this->scoringService->hasAssessmentTable();
            $hasGroupingSchema = $this->hasGroupingSchema();

            if ($hasTable) {
                if (! $this->hasMissingAssessments($admin)) {
                    return response()->json([
                        'status' => 'success',
                        'data'   => $this->buildSummaryFromSql($admin, $hasGroupingSchema),
                    ]);
                }

                $rowsQuery = DB::table('laporan')
                    ->leftJoin('priority_assessments', 'priority_assessments.id_laporan', '=', 'laporan.id_laporan')
                    ->select([
                        'laporan.id_laporan',
                        'priority_assessments.id AS assessment_id',
                        'priority_assessments.priority_score',
                        'priority_assessments.priority_level',
                        'priority_assessments.severity_level',
                        'priority_assessments.needs_review',
                    ]);

                if ($hasGroupingSchema) {
                    $rowsQuery->leftJoin('laporan_groups as lg', 'lg.id', '=', 'laporan.group_id');
                    $this->applyGroupRepresentativeFilter($rowsQuery, true, 'lg');
                }

                $this->applyNotRejectedFilter($rowsQuery);

                if ($admin) {
                    if ($campus = $admin->resolvedCampus()) {
                        $rowsQuery->where('laporan.lokasi_kampus', $campus);
                    }
                    if ($kategori = $admin->allowedKategoriLaporan()) {
                        $rowsQuery->where('laporan.kategori_laporan', $kategori);
                    }
                }

                $rows = $rowsQuery->get();

                $missingIds = [];
                foreach ($rows as $row) {
                    if ($row->assessment_id === null) {
                        $missingIds[] = $row->id_laporan;
                    }
                }

                $missingLaporans = Laporan::query()
                    ->select($this->lightweightLaporanColumns($hasGroupingSchema))
                    ->whereIn('laporan.id_laporan', $missingIds)
                    ->get();
                $assessed = $this->scoringService->assessReadOnlyMany($missingLaporans);

                $items = $rows->map(function ($row) use ($assessed) {
                    return $row->assessment_id !== null
                        ? $row
                        : ($assessed->get($row->id_laporan) ?? $row);
                });

                return response()->json([
                    'status' => 'success',
                    'data'   => $this->buildSummaryFromAssessments($items),
                ]);
            }

            $laporansQuery = Laporan::query()
                ->select($this->lightweightLaporanColumns($hasGroupingSchema))
                ->visibleToAdmin($admin);

            if ($hasGroupingSchema) {
                $laporansQuery->leftJoin('laporan_groups as lg', 'lg.id', '=', 'laporan.group_id');
                $this->applyGroupRepresentativeFilter($laporansQuery, true, 'lg');
            }

            $this->applyNotRejectedFilter($laporansQuery);

            $laporans = $laporansQuery->get();
            $assessments = $this->scoringService->assessReadOnlyMany($laporans);

            return response()->json([
                'status' => 'success',
                'data'   => $this->buildSummaryFromAssessments($assessments),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memuat ringkasan prioritas: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/admin/priority/recalculate
     * Menghitung ulang semua laporan aktif (misalnya untuk penuaan / aging harian)
     */
    public function recalculateAll(Request $request): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            $this->scoringService->ensureTablesExist();
            $hasGroupingSchema = $this->hasGroupingSchema();
            $laporansQuery = Laporan::query()
                ->select($this->lightweightLaporanColumns($hasGroupingSchema))
                ->visibleToAdmin($admin);

            $this->applyNotRejectedFilter($laporansQuery);

            $laporans = $laporansQuery->get();
            $assessments = $this->scoringService->assessAndSaveMany($laporans, true);
            $count = $assessments->count();

            return response()->json([
                'status'  => 'success',
                'message' => "Berhasil menghitung ulang prioritas untuk {$count} laporan.",
                'total'   => $count,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menghitung ulang: '.$e->getMessage(),
            ], 500);
        }
    }
}
