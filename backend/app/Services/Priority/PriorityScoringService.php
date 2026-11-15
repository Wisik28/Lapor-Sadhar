<?php

namespace App\Services\Priority;

use App\Models\Admin;
use App\Models\Laporan;
use App\Models\Priority\PriorityAssessment;
use App\Models\Priority\PriorityFeedback;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PriorityScoringService
{
    private AiSeverityAssessor $aiAssessor;
    private LocationCategorizer $locationCategorizer;
    private LocationSeverityAssessor $locationSeverityAssessor;

    /**
     * Cache status verifikasi tabel & kolom per koneksi PDO untuk mencegah query skema berulang.
     *
     * @var array<int, bool>
     */
    private static array $tablesVerifiedByPdo = [];
    private static array $verifiedLaporanColumnsByPdo = [];

    public function __construct(
        AiSeverityAssessor $aiAssessor,
        ?LocationCategorizer $locationCategorizer = null,
        ?LocationSeverityAssessor $locationSeverityAssessor = null
    ) {
        $this->aiAssessor = $aiAssessor;
        $this->locationCategorizer = $locationCategorizer ?? new LocationCategorizer();
        $this->locationSeverityAssessor = $locationSeverityAssessor ?? new LocationSeverityAssessor($this->locationCategorizer);
    }

    /**
     * Pastikan tabel priority_assessments, priority_feedback, serta kolom kategorisasi lokasi tersedia.
     * Hanya menjalankan DDL jika tidak sedang berada di dalam transaksi DB
     * agar tidak memicu error SQLSTATE[25P02] pada PostgreSQL/Supabase.
     */
    public function ensureTablesExist(): bool
    {
        try {
            $pdoId = spl_object_id(DB::connection()->getPdo());

            // Jangan jalankan DDL di dalam transaksi aktif PostgreSQL
            if (DB::transactionLevel() > 0) {
                return Schema::hasTable('priority_assessments');
            }

            if (!empty(self::$tablesVerifiedByPdo[$pdoId])) {
                return true;
            }

            $hasAssessments = Schema::hasTable('priority_assessments');

            if (empty(self::$verifiedLaporanColumnsByPdo[$pdoId])) {
                if (Schema::hasTable('laporan')) {
                    if (!Schema::hasColumns('laporan', ['kategori_lokasi', 'tingkat_keparahan', 'skala_keparahan'])) {
                        Schema::table('laporan', function (Blueprint $table) {
                            if (!Schema::hasColumn('laporan', 'kategori_lokasi')) {
                                $table->string('kategori_lokasi', 60)->default('Tidak Diketahui');
                            }
                            if (!Schema::hasColumn('laporan', 'tingkat_keparahan')) {
                                $table->string('tingkat_keparahan', 30)->default('Sedang');
                            }
                            if (!Schema::hasColumn('laporan', 'skala_keparahan')) {
                                $table->unsignedTinyInteger('skala_keparahan')->default(2);
                            }
                        });
                    }
                    self::$verifiedLaporanColumnsByPdo[$pdoId] = true;
                }
            }

            if (!$hasAssessments) {
                Schema::create('priority_assessments', function (Blueprint $table) {
                    $table->id();
                    $table->unsignedBigInteger('id_laporan')->unique();
                    $table->string('kategori', 50)->default('Fasilitas');
                    $table->string('kategori_lokasi', 60)->default('Tidak Diketahui');
                    $table->string('tingkat_keparahan_lokasi', 30)->default('Sedang');
                    $table->unsignedTinyInteger('skala_keparahan_lokasi')->default(2);
                    $table->string('severity_level', 30)->default('sedang');
                    $table->string('severity_source', 30)->default('ai');
                    $table->string('ai_suggested_severity', 30)->default('sedang');
                    $table->string('admin_severity', 30)->nullable();
                    $table->unsignedInteger('priority_score')->default(0);
                    $table->string('priority_level', 30)->default('sedang');
                    $table->decimal('confidence', 4, 2)->default(0.80);
                    $table->json('dimensions')->nullable();
                    $table->json('safety_flags')->nullable();
                    $table->json('reasons')->nullable();
                    $table->boolean('needs_review')->default(true);
                    $table->text('admin_notes')->nullable();
                    $table->unsignedBigInteger('admin_id')->nullable();
                    $table->timestamp('reviewed_at')->nullable();
                    $table->timestamps();

                    $table->index('priority_score');
                    $table->index('priority_level');
                    $table->index('severity_level');
                    $table->index('needs_review');
                });
            } elseif (!Schema::hasColumns('priority_assessments', ['kategori_lokasi', 'tingkat_keparahan_lokasi', 'skala_keparahan_lokasi'])) {
                Schema::table('priority_assessments', function (Blueprint $table) {
                    if (!Schema::hasColumn('priority_assessments', 'kategori_lokasi')) {
                        $table->string('kategori_lokasi', 60)->default('Tidak Diketahui');
                    }
                    if (!Schema::hasColumn('priority_assessments', 'tingkat_keparahan_lokasi')) {
                        $table->string('tingkat_keparahan_lokasi', 30)->default('Sedang');
                    }
                    if (!Schema::hasColumn('priority_assessments', 'skala_keparahan_lokasi')) {
                        $table->unsignedTinyInteger('skala_keparahan_lokasi')->default(2);
                    }
                });
            }

            if (!Schema::hasTable('priority_feedback')) {
                Schema::create('priority_feedback', function (Blueprint $table) {
                    $table->id();
                    $table->unsignedBigInteger('id_laporan');
                    $table->unsignedBigInteger('admin_id')->nullable();
                    $table->string('original_level', 30);
                    $table->string('corrected_level', 30);
                    $table->text('note')->nullable();
                    $table->timestamps();

                    $table->index('id_laporan');
                });
            }

            self::$tablesVerifiedByPdo[$pdoId] = true;

            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Hitung skor prioritas berdasarkan rumus spesifikasi (0 - 100)
     */
    public function calculateScore(
        string $kategori,
        array $dimensions,
        float $locationWeight = 0.4,
        int $distinctReporters = 1,
        float $daysWaiting = 0.0,
        array $safetyFlags = []
    ): array {
        $isFasilitas = strcasecmp($kategori, 'fasilitas') === 0;

        // Faktor Duplikat & Aging
        $duplicateFactor = min(1.0, max(0.0, ($distinctReporters - 1) / 4.0));
        $agingFactor     = min(1.0, max(0.0, $daysWaiting / 14.0));

        $breakdown = [];

        if ($isFasilitas) {
            $safetyRisk        = (float) ($dimensions['safety_risk'] ?? 0.2);
            $damageLevel       = (float) ($dimensions['damage_level'] ?? 0.2);
            $operationalImpact = (float) ($dimensions['operational_impact'] ?? 0.2);

            $cSafety      = 0.30 * $safetyRisk;
            $cDamage      = 0.25 * $damageLevel;
            $cOperational = 0.20 * $operationalImpact;
            $cLocation    = 0.10 * $locationWeight;
            $cDuplicate   = 0.10 * $duplicateFactor;
            $cAging       = 0.05 * $agingFactor;

            $base = $cSafety + $cDamage + $cOperational + $cLocation + $cDuplicate + $cAging;

            $breakdown = [
                'safety_risk'        => round($cSafety * 100, 2),
                'damage_level'       => round($cDamage * 100, 2),
                'operational_impact' => round($cOperational * 100, 2),
                'location_weight'    => round($cLocation * 100, 2),
                'duplicate_factor'   => round($cDuplicate * 100, 2),
                'aging_factor'       => round($cAging * 100, 2),
            ];
        } else {
            // Kebersihan
            $healthRisk    = (float) ($dimensions['health_risk'] ?? 0.2);
            $volumeArea    = (float) ($dimensions['volume_area'] ?? 0.2);
            $pollutionType = (float) ($dimensions['pollution_type'] ?? 0.2);

            $cHealth     = 0.30 * $healthRisk;
            $cVolume     = 0.25 * $volumeArea;
            $cPollution  = 0.15 * $pollutionType;
            $cLocation   = 0.15 * $locationWeight;
            $cDuplicate  = 0.10 * $duplicateFactor;
            $cAging      = 0.05 * $agingFactor;

            $base = $cHealth + $cVolume + $cPollution + $cLocation + $cDuplicate + $cAging;

            $breakdown = [
                'health_risk'      => round($cHealth * 100, 2),
                'volume_area'      => round($cVolume * 100, 2),
                'pollution_type'   => round($cPollution * 100, 2),
                'location_weight'  => round($cLocation * 100, 2),
                'duplicate_factor' => round($cDuplicate * 100, 2),
                'aging_factor'     => round($cAging * 100, 2),
            ];
        }

        $score = (int) round($base * 100);

        // Aturan Override: jika safety_flags tidak kosong, otomatis kritis dengan skor min 81
        $hasSafetyOverride = count($safetyFlags) > 0;
        if ($hasSafetyOverride) {
            $score = max($score, 81);
            $level = 'kritis';
        } else {
            $level = $this->resolveLevelFromScore($score);
        }

        return [
            'priority_score'      => $score,
            'priority_level'      => $level,
            'location_weight'     => $locationWeight,
            'duplicate_factor'    => $duplicateFactor,
            'aging_factor'        => $agingFactor,
            'has_safety_override' => $hasSafetyOverride,
            'breakdown'           => $breakdown,
        ];
    }

    /**
     * Tentukan level dari skor deterministik
     */
    public function resolveLevelFromScore(int $score): string
    {
        if ($score >= 81) return 'kritis';
        if ($score >= 61) return 'tinggi';
        if ($score >= 31) return 'sedang';
        return 'rendah';
    }

    /**
     * Identifikasi kategori lokasi dan tingkat keparahan awal berdasarkan teks lokasi.
     *
     * @param string|null $lokasi
     * @return array{
     *     kategori_lokasi: string,
     *     tingkat_keparahan: string,
     *     skala_keparahan: int,
     *     location_weight: float
     * }
     */
    public function assessLocation(?string $lokasi): array
    {
        return $this->locationSeverityAssessor->assessLocation($lokasi);
    }

    /**
     * Dapatkan bobot lokasi berdasarkan hasil kategorisasi dan tingkat keparahan lokasi
     */
    public function resolveLocationWeight(string $lokasi): float
    {
        $assessment = $this->locationSeverityAssessor->assessLocation($lokasi);

        return (float) $assessment['location_weight'];
    }

    /**
     * Hitung jumlah pelapor serupa di lokasi yang sama dalam 30 hari terakhir
     */
    public function countNearbyReporters(Laporan $laporan): int
    {
        try {
            $prefix = trim(explode(',', $laporan->lokasi)[0]);
            if (empty($prefix)) {
                return 1;
            }

            $count = Laporan::where('lokasi', 'LIKE', '%' . $prefix . '%')
                ->where('kategori_laporan', $laporan->kategori_laporan)
                ->where('id_laporan', '<>', $laporan->id_laporan)
                ->where('tanggal_buat', '>=', now()->subDays(30))
                ->distinct('nim')
                ->count('nim');

            return 1 + $count;
        } catch (\Throwable $e) {
            return 1;
        }
    }

    /**
     * Lakukan penilaian dan simpan ke database secara batch untuk kumpulan laporan
     * (Menghindari masalah N+1 query pada daftar laporan dan ringkasan dashboard)
     *
     * @param iterable<int, Laporan> $laporans
     * @param bool $force
     * @return \Illuminate\Support\Collection<int, PriorityAssessment>
     */
    public function assessAndSaveMany(iterable $laporans, bool $force = false): \Illuminate\Support\Collection
    {
        $collection = $laporans instanceof \Illuminate\Support\Collection ? $laporans : collect($laporans);
        if ($collection->isEmpty()) {
            return collect();
        }

        $hasTable = $this->ensureTablesExist();
        $existingMap = collect();

        if ($hasTable) {
            try {
                $ids = $collection->pluck('id_laporan')->filter()->values()->all();
                if (!empty($ids)) {
                    $existingMap = PriorityAssessment::whereIn('id_laporan', $ids)
                        ->get()
                        ->keyBy('id_laporan');
                }
            } catch (\Throwable $e) {
                $pdoId = spl_object_id(DB::connection()->getPdo());
                unset(self::$tablesVerifiedByPdo[$pdoId]);
                $hasTable = false;
            }
        }

        $results = collect();
        foreach ($collection as $laporan) {
            $existing = $existingMap->get($laporan->id_laporan);
            if ($existing && !$force) {
                $results->put($laporan->id_laporan, $existing);
                continue;
            }

            $results->put(
                $laporan->id_laporan,
                $this->computeAndPersistAssessment($laporan, $existing, $hasTable, $force)
            );
        }

        return $results;
    }

    /**
     * Lakukan penilaian dan simpan ke database untuk sebuah laporan
     */
    public function assessAndSave(Laporan $laporan, bool $force = false): PriorityAssessment
    {
        $hasTable = $this->ensureTablesExist();
        $existing = null;

        if ($hasTable) {
            try {
                $existing = PriorityAssessment::where('id_laporan', $laporan->id_laporan)->first();
                if ($existing && !$force) {
                    return $existing;
                }
            } catch (\Throwable $e) {
                $pdoId = spl_object_id(DB::connection()->getPdo());
                unset(self::$tablesVerifiedByPdo[$pdoId]);
                $hasTable = false;
            }
        }

        return $this->computeAndPersistAssessment($laporan, $existing, $hasTable, $force);
    }

    /**
     * Inti komputasi skor prioritas dan penyimpanan ke database
     */
    private function computeAndPersistAssessment(
        Laporan $laporan,
        ?PriorityAssessment $existing,
        bool $hasTable,
        bool $force = false
    ): PriorityAssessment {
        $kategori = $laporan->kategori_laporan ?? 'Fasilitas';
        $deskripsi = $laporan->deskripsi ?? '';
        $lokasi = $laporan->lokasi ?? '';
        $hasPhoto = !empty($laporan->foto);

        // 1. Kategorisasi lokasi & penentuan tingkat keparahan awal berdasarkan lokasi
        $locationAssessment = $this->assessLocation($lokasi);
        $kategoriLokasi     = $locationAssessment['kategori_lokasi'];
        $tingkatKeparahan   = $locationAssessment['tingkat_keparahan'];
        $skalaKeparahan     = $locationAssessment['skala_keparahan'];
        $locationWeight     = $locationAssessment['location_weight'];

        // Sinkronkan atribut lokasi pada model Laporan hanya jika belum sesuai di DB
        $needsLaporanSync = $laporan->kategori_lokasi !== $kategoriLokasi
            || $laporan->tingkat_keparahan !== $tingkatKeparahan
            || (int) $laporan->skala_keparahan !== $skalaKeparahan;

        if ($needsLaporanSync) {
            $laporan->kategori_lokasi   = $kategoriLokasi;
            $laporan->tingkat_keparahan = $tingkatKeparahan;
            $laporan->skala_keparahan   = $skalaKeparahan;

            $pdoId = spl_object_id(DB::connection()->getPdo());
            if (DB::transactionLevel() === 0 && $laporan->exists && !empty(self::$verifiedLaporanColumnsByPdo[$pdoId])) {
                try {
                    Laporan::where('id_laporan', $laporan->id_laporan)->update([
                        'kategori_lokasi'   => $kategoriLokasi,
                        'tingkat_keparahan' => $tingkatKeparahan,
                        'skala_keparahan'   => $skalaKeparahan,
                    ]);
                } catch (\Throwable $e) {
                    // Jangan gagalkan alur apabila update kolom tambahan gagal
                }
            }
        }

        // 2. Dapatkan usulan AI dari teks deskripsi
        $aiResult = $this->aiAssessor->assess($kategori, $deskripsi, $lokasi, $hasPhoto);

        // Gunakan tingkat keparahan awal lokasi (skala 1-4) sebagai parameter penguat dimensi dampak operasional/kesehatan
        $dimensions = $aiResult['dimensions'];
        $locationImpactFloor = match ($skalaKeparahan) {
            LocationSeverityAssessor::SCALE_SANGAT_TINGGI => 0.75,
            LocationSeverityAssessor::SCALE_TINGGI        => 0.55,
            LocationSeverityAssessor::SCALE_SEDANG        => 0.35,
            default                                       => 0.20,
        };

        if (strcasecmp($kategori, 'fasilitas') === 0) {
            $dimensions['operational_impact'] = max(
                (float) ($dimensions['operational_impact'] ?? 0.2),
                $locationImpactFloor
            );
        } else {
            $dimensions['health_risk'] = max(
                (float) ($dimensions['health_risk'] ?? 0.2),
                $locationImpactFloor
            );
        }

        // Tambahkan informasi kategori lokasi & keparahan awal ke dalam alasan penilaian
        $reasons = $aiResult['reasons'];
        $reasons[] = sprintf(
            'Kategori lokasi: %s (Keparahan Awal: %s - Skala %d/4).',
            $kategoriLokasi,
            $tingkatKeparahan,
            $skalaKeparahan
        );

        // 3. Hitung faktor lingkungan
        $distinctReporters = DB::transactionLevel() === 0 ? $this->countNearbyReporters($laporan) : 1;

        $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : now();
        $daysWaiting = (float) max(0, $createdAt->diffInDays(now()));

        // 4. Hitung skor prioritas menggunakan bobot lokasi & dimensi yang dipengaruhi keparahan lokasi
        $calculated = $this->calculateScore(
            $kategori,
            $dimensions,
            $locationWeight,
            $distinctReporters,
            $daysWaiting,
            $aiResult['safety_flags']
        );

        $effectiveSeverity = $existing?->admin_severity ?: $aiResult['suggested_severity'];

        $attributes = [
            'id_laporan'               => $laporan->id_laporan,
            'kategori'                 => $kategori,
            'kategori_lokasi'          => $kategoriLokasi,
            'tingkat_keparahan_lokasi' => $tingkatKeparahan,
            'skala_keparahan_lokasi'   => $skalaKeparahan,
            'severity_level'           => $effectiveSeverity,
            'severity_source'          => $existing?->admin_severity ? 'admin' : 'ai',
            'ai_suggested_severity'    => $aiResult['suggested_severity'],
            'admin_severity'           => $existing?->admin_severity,
            'priority_score'           => $calculated['priority_score'],
            'priority_level'           => $calculated['priority_level'],
            'confidence'               => $aiResult['confidence'],
            'dimensions'               => $dimensions,
            'safety_flags'             => $aiResult['safety_flags'],
            'reasons'                  => $reasons,
            'needs_review'             => $existing ? $existing->needs_review : true,
            'admin_notes'              => $existing?->admin_notes,
            'admin_id'                 => $existing?->admin_id,
            'reviewed_at'              => $existing?->reviewed_at,
        ];

        if ($hasTable) {
            try {
                if ($existing) {
                    $existing->fill($attributes);
                    $existing->save();
                    return $existing;
                }

                return PriorityAssessment::updateOrCreate(
                    ['id_laporan' => $laporan->id_laporan],
                    $attributes
                );
            } catch (\Throwable $e) {
                $pdoId = spl_object_id(DB::connection()->getPdo());
                unset(self::$tablesVerifiedByPdo[$pdoId]);
                report($e);
            }
        }

        return new PriorityAssessment($attributes);
    }

    /**
     * Admin menetapkan atau menimpa (override) tingkat kerusakan
     */
    public function overrideSeverityByAdmin(
        int $idLaporan,
        string $newSeverity,
        ?string $adminNotes = null,
        ?int $adminId = null
    ): PriorityAssessment {
        $this->ensureTablesExist();
        $laporan = Laporan::findOrFail($idLaporan);
        $assessment = PriorityAssessment::firstOrNew(['id_laporan' => $idLaporan]);

        $originalLevel = $assessment->severity_level ?? $assessment->ai_suggested_severity ?? 'sedang';

        // Rekalkulasi dimensi berdasarkan penetapan admin
        $kategori = $laporan->kategori_laporan ?? 'Fasilitas';
        $isFasilitas = strcasecmp($kategori, 'fasilitas') === 0;

        $targetDim = match (strtolower($newSeverity)) {
            'berat'  => 0.85,
            'sedang' => 0.50,
            default  => 0.20,
        };

        if ($isFasilitas) {
            $dimensions = [
                'safety_risk'        => $targetDim,
                'damage_level'       => $targetDim,
                'operational_impact' => $targetDim,
            ];
        } else {
            $dimensions = [
                'health_risk'    => $targetDim,
                'volume_area'    => $targetDim,
                'pollution_type' => $targetDim,
            ];
        }

        $locationAssessment = $this->assessLocation($laporan->lokasi ?? '');
        $locationWeight     = $locationAssessment['location_weight'];
        $distinctReporters  = $this->countNearbyReporters($laporan);
        $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : now();
        $daysWaiting = (float) max(0, $createdAt->diffInDays(now()));

        $safetyFlags = $assessment->safety_flags ?? [];
        if ($newSeverity === 'ringan') {
            $safetyFlags = []; // Admin override ke ringan meniadakan safety flag
        }

        $calculated = $this->calculateScore(
            $kategori,
            $dimensions,
            $locationWeight,
            $distinctReporters,
            $daysWaiting,
            $safetyFlags
        );

        return DB::transaction(function () use (
            $assessment,
            $laporan,
            $newSeverity,
            $originalLevel,
            $adminNotes,
            $adminId,
            $calculated,
            $dimensions,
            $safetyFlags,
            $locationAssessment
        ) {
            // 1. Simpan riwayat koreksi ke priority_feedback
            PriorityFeedback::create([
                'id_laporan'      => $laporan->id_laporan,
                'admin_id'        => $adminId,
                'original_level'  => $originalLevel,
                'corrected_level' => $newSeverity,
                'note'            => $adminNotes,
            ]);

            // 2. Perbarui priority_assessments
            $assessment->kategori                 = $laporan->kategori_laporan ?? 'Fasilitas';
            $assessment->kategori_lokasi          = $locationAssessment['kategori_lokasi'];
            $assessment->tingkat_keparahan_lokasi = $locationAssessment['tingkat_keparahan'];
            $assessment->skala_keparahan_lokasi   = $locationAssessment['skala_keparahan'];
            $assessment->severity_level           = $newSeverity;
            $assessment->severity_source = 'admin';
            $assessment->admin_severity  = $newSeverity;
            $assessment->priority_score  = $calculated['priority_score'];
            $assessment->priority_level  = $calculated['priority_level'];
            $assessment->dimensions      = $dimensions;
            $assessment->safety_flags    = $safetyFlags;
            $assessment->needs_review    = false; // Sudah dikonfirmasi admin
            $assessment->admin_notes     = $adminNotes;
            $assessment->admin_id        = $adminId;
            $assessment->reviewed_at     = now();
            $assessment->save();

            return $assessment;
        });
    }
}

