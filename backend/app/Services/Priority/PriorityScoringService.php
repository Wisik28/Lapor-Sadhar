<?php

namespace App\Services\Priority;

use App\Models\Admin;
use App\Models\Laporan;
use App\Models\Priority\PriorityAssessment;
use App\Models\Priority\PriorityFeedback;
use App\Support\SchemaVerification;
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

            // Skema sudah pernah diverifikasi pada request sebelumnya: lewati ~8 query skema
            // (round-trip ke database jarak jauh). Verifikasi penuh tetap berjalan jika marker hilang.
            if (SchemaVerification::isVerified('priority_schema')) {
                self::$verifiedLaporanColumnsByPdo[$pdoId] = true;

                return self::$tablesVerifiedByPdo[$pdoId] = true;
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

            SchemaVerification::markVerified('priority_schema');
            if (!empty(self::$verifiedLaporanColumnsByPdo[$pdoId])) {
                SchemaVerification::markVerified('laporan_location_columns');
            }

            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Batalkan status terverifikasi (cache request ini dan marker lintas-request)
     * agar verifikasi/pembuatan skema dijalankan ulang pada pemanggilan berikutnya.
     */
    private function invalidateSchemaVerification(): void
    {
        $pdoId = spl_object_id(DB::connection()->getPdo());
        unset(self::$tablesVerifiedByPdo[$pdoId]);

        SchemaVerification::forget('priority_schema');
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

            $query = Laporan::where('lokasi', 'LIKE', '%' . $prefix . '%')
                ->where('kategori_laporan', $laporan->kategori_laporan)
                ->where('id_laporan', '<>', $laporan->id_laporan)
                ->where('tanggal_buat', '>=', now()->subDays(30));

            if (!empty($laporan->lokasi_kampus)) {
                $query->where('lokasi_kampus', $laporan->lokasi_kampus);
            }

            $count = $query->distinct('nim')->count('nim');

            return 1 + $count;
        } catch (\Throwable $e) {
            return 1;
        }
    }

    /**
     * Periksa keberadaan tabel priority_assessments secara read-only tanpa menjalankan DDL.
     */
    public function hasAssessmentTable(): bool
    {
        try {
            $pdoId = spl_object_id(DB::connection()->getPdo());
            if (!empty(self::$tablesVerifiedByPdo[$pdoId])) {
                return true;
            }

            return Schema::hasTable('priority_assessments');
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Periksa keberadaan tabel priority_feedback secara read-only tanpa menjalankan DDL.
     */
    public function hasFeedbackTable(): bool
    {
        try {
            $pdoId = spl_object_id(DB::connection()->getPdo());
            if (!empty(self::$tablesVerifiedByPdo[$pdoId])) {
                return true;
            }

            return Schema::hasTable('priority_feedback');
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Ambil penilaian prioritas secara murni read-only (tanpa menulis ke database).
     * Laporan yang belum memiliki baris di priority_assessments dihitung di memori saja.
     *
     * @param iterable<int, Laporan> $laporans
     * @return \Illuminate\Support\Collection<int, PriorityAssessment>
     */
    public function assessReadOnlyMany(iterable $laporans): \Illuminate\Support\Collection
    {
        $collection = $laporans instanceof \Illuminate\Support\Collection ? $laporans : collect($laporans);
        if ($collection->isEmpty()) {
            return collect();
        }

        $hasTable = $this->hasAssessmentTable();
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
                $existingMap = collect();
            }
        }

        $results = collect();
        $missing = [];

        foreach ($collection as $laporan) {
            $existing = $existingMap->get($laporan->id_laporan);
            if ($existing) {
                $results->put($laporan->id_laporan, $existing);
                continue;
            }
            $missing[] = $laporan;
        }

        if (empty($missing)) {
            return $results;
        }

        $recentLaporans = null;
        $driverName = null;
        if (count($missing) > 1 && DB::transactionLevel() === 0) {
            try {
                $driverName = DB::connection()->getDriverName();
                $recentLaporans = Laporan::query()
                    ->select(['id_laporan', 'nim', 'kategori_laporan', 'lokasi', 'lokasi_kampus'])
                    ->where('tanggal_buat', '>=', now()->subDays(30))
                    ->get();
            } catch (\Throwable $e) {
                $recentLaporans = null;
            }
        }

        foreach ($missing as $laporan) {
            $distinctReporters = $recentLaporans !== null
                ? $this->countNearbyReportersFromCollection($laporan, $recentLaporans, $driverName)
                : null;

            $prepared = $this->buildAssessmentPayload($laporan, null, $distinctReporters);
            $results->put($laporan->id_laporan, new PriorityAssessment($prepared['attributes']));
        }

        return $results;
    }

    /**
     * Ambil atau hitung penilaian prioritas satu laporan secara murni read-only (tanpa menulis ke database).
     */
    public function assessReadOnly(Laporan $laporan): PriorityAssessment
    {
        if ($this->hasAssessmentTable()) {
            try {
                $existing = PriorityAssessment::where('id_laporan', $laporan->id_laporan)->first();
                if ($existing) {
                    return $existing;
                }
            } catch (\Throwable $e) {
                // Fallback komputasi di memori
            }
        }

        $prepared = $this->buildAssessmentPayload($laporan, null);

        return new PriorityAssessment($prepared['attributes']);
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
                $this->invalidateSchemaVerification();
                $hasTable = false;
            }
        }

        $results = collect();
        $toCompute = [];

        foreach ($collection as $laporan) {
            $existing = $existingMap->get($laporan->id_laporan);
            if ($existing && !$force) {
                $results->put($laporan->id_laporan, $existing);
                continue;
            }
            $toCompute[] = [$laporan, $existing];
        }

        if (empty($toCompute)) {
            return $results;
        }

        // Untuk > 1 laporan yang perlu dihitung, pra-ambil data pelapor 30 hari terakhir sekali saja
        // dan lakukan batch update/upsert agar tidak memicu 4N round-trip query ke DB jarak jauh.
        $recentLaporans = null;
        $driverName = null;
        if (count($toCompute) > 1 && DB::transactionLevel() === 0) {
            try {
                $driverName = DB::connection()->getDriverName();
                $recentLaporans = Laporan::query()
                    ->select(['id_laporan', 'nim', 'kategori_laporan', 'lokasi', 'lokasi_kampus'])
                    ->where('tanggal_buat', '>=', now()->subDays(30))
                    ->get();
            } catch (\Throwable $e) {
                $recentLaporans = null;
            }
        }

        $pdoId = spl_object_id(DB::connection()->getPdo());
        $canSyncLaporan = DB::transactionLevel() === 0 && !empty(self::$verifiedLaporanColumnsByPdo[$pdoId]);
        $laporanSyncGroups = [];
        $computedPayloads = [];
        $fallbackModels = [];

        foreach ($toCompute as [$laporan, $existing]) {
            $distinctReporters = null;
            if ($recentLaporans !== null) {
                $distinctReporters = $this->countNearbyReportersFromCollection($laporan, $recentLaporans, $driverName);
            }

            $prepared = $this->buildAssessmentPayload($laporan, $existing, $distinctReporters);
            $attributes = $prepared['attributes'];
            $syncData = $prepared['sync'];

            if ($syncData !== null) {
                $laporan->kategori_lokasi   = $syncData['kategori_lokasi'];
                $laporan->tingkat_keparahan = $syncData['tingkat_keparahan'];
                $laporan->skala_keparahan   = $syncData['skala_keparahan'];

                if ($canSyncLaporan && $laporan->exists) {
                    $groupKey = $syncData['kategori_lokasi'] . "\0" . $syncData['tingkat_keparahan'] . "\0" . $syncData['skala_keparahan'];
                    if (!isset($laporanSyncGroups[$groupKey])) {
                        $laporanSyncGroups[$groupKey] = ['values' => $syncData, 'ids' => []];
                    }
                    $laporanSyncGroups[$groupKey]['ids'][] = $laporan->id_laporan;
                }
            }

            $computedPayloads[$laporan->id_laporan] = $attributes;
            if ($existing) {
                $existing->fill($attributes);
                $fallbackModels[$laporan->id_laporan] = $existing;
            } else {
                $fallbackModels[$laporan->id_laporan] = new PriorityAssessment($attributes);
            }
        }

        if (!empty($laporanSyncGroups)) {
            foreach ($laporanSyncGroups as $group) {
                try {
                    Laporan::whereIn('id_laporan', $group['ids'])->update($group['values']);
                } catch (\Throwable $e) {
                    // Jangan gagalkan alur apabila update kolom tambahan gagal
                }
            }
        }

        $persistedMap = collect();
        if ($hasTable && !empty($computedPayloads)) {
            try {
                $nowStr = now()->toDateTimeString();
                $upsertRows = [];
                foreach ($computedPayloads as $attributes) {
                    $upsertRows[] = [
                        'id_laporan'               => $attributes['id_laporan'],
                        'kategori'                 => $attributes['kategori'],
                        'kategori_lokasi'          => $attributes['kategori_lokasi'],
                        'tingkat_keparahan_lokasi' => $attributes['tingkat_keparahan_lokasi'],
                        'skala_keparahan_lokasi'   => $attributes['skala_keparahan_lokasi'],
                        'severity_level'           => $attributes['severity_level'],
                        'severity_source'          => $attributes['severity_source'],
                        'ai_suggested_severity'    => $attributes['ai_suggested_severity'],
                        'admin_severity'           => $attributes['admin_severity'],
                        'priority_score'           => $attributes['priority_score'],
                        'priority_level'           => $attributes['priority_level'],
                        'confidence'               => $attributes['confidence'],
                        'dimensions'               => json_encode($attributes['dimensions'], JSON_THROW_ON_ERROR),
                        'safety_flags'             => json_encode($attributes['safety_flags'], JSON_THROW_ON_ERROR),
                        'reasons'                  => json_encode($attributes['reasons'], JSON_THROW_ON_ERROR),
                        'needs_review'             => (bool) $attributes['needs_review'],
                        'admin_notes'              => $attributes['admin_notes'],
                        'admin_id'                 => $attributes['admin_id'],
                        'reviewed_at'              => $attributes['reviewed_at'] instanceof \DateTimeInterface
                            ? $attributes['reviewed_at']->format('Y-m-d H:i:s')
                            : $attributes['reviewed_at'],
                        'created_at'               => $nowStr,
                        'updated_at'               => $nowStr,
                    ];
                }

                $updateColumns = [
                    'kategori',
                    'kategori_lokasi',
                    'tingkat_keparahan_lokasi',
                    'skala_keparahan_lokasi',
                    'severity_level',
                    'severity_source',
                    'ai_suggested_severity',
                    'admin_severity',
                    'priority_score',
                    'priority_level',
                    'confidence',
                    'dimensions',
                    'safety_flags',
                    'reasons',
                    'needs_review',
                    'admin_notes',
                    'admin_id',
                    'reviewed_at',
                    'updated_at',
                ];

                foreach (array_chunk($upsertRows, 40) as $chunk) {
                    PriorityAssessment::upsert($chunk, ['id_laporan'], $updateColumns);
                }

                $persistedMap = PriorityAssessment::whereIn('id_laporan', array_keys($computedPayloads))
                    ->get()
                    ->keyBy('id_laporan');
            } catch (\Throwable $e) {
                $this->invalidateSchemaVerification();
                report($e);
            }
        }

        foreach ($computedPayloads as $idLaporan => $_) {
            $results->put($idLaporan, $persistedMap->get($idLaporan) ?? $fallbackModels[$idLaporan]);
        }

        return $results;
    }

    /**
     * Hitung jumlah pelapor serupa dalam 30 hari dari koleksi yang sudah di-load (menghindari N+1 query).
     */
    private function countNearbyReportersFromCollection(
        Laporan $laporan,
        \Illuminate\Support\Collection $recentLaporans,
        ?string $driverName
    ): int {
        $prefix = trim(explode(',', (string) $laporan->lokasi)[0]);
        if ($prefix === '') {
            return 1;
        }

        // Jika mengandung wildcard SQL LIKE, fallback ke query SQL persis agar perilaku 100% identik
        if (str_contains($prefix, '%') || str_contains($prefix, '_')) {
            return $this->countNearbyReporters($laporan);
        }

        $isCaseSensitive = $driverName === 'pgsql';
        $uniqueNims = [];

        foreach ($recentLaporans as $row) {
            if ((string) $row->kategori_laporan !== (string) $laporan->kategori_laporan) {
                continue;
            }
            if ((int) $row->id_laporan === (int) $laporan->id_laporan) {
                continue;
            }
            if (
                !empty($laporan->lokasi_kampus)
                && !empty($row->lokasi_kampus)
                && (string) $row->lokasi_kampus !== (string) $laporan->lokasi_kampus
            ) {
                continue;
            }

            $lokasi = (string) ($row->lokasi ?? '');
            $matched = $isCaseSensitive
                ? str_contains($lokasi, $prefix)
                : (mb_stripos($lokasi, $prefix, 0, 'UTF-8') !== false);

            if ($matched && $row->nim !== null && $row->nim !== '') {
                $uniqueNims[(string) $row->nim] = true;
            }
        }

        return 1 + count($uniqueNims);
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
                $this->invalidateSchemaVerification();
                $hasTable = false;
            }
        }

        return $this->computeAndPersistAssessment($laporan, $existing, $hasTable, $force);
    }

    /**
     * Susun atribut penilaian prioritas dan perubahan atribut lokasi laporan tanpa mengeksekusi query tulis.
     *
     * @return array{attributes: array<string, mixed>, sync: array<string, mixed>|null}
     */
    private function buildAssessmentPayload(
        Laporan $laporan,
        ?PriorityAssessment $existing,
        ?int $precomputedDistinctReporters = null
    ): array {
        $kategori = $laporan->kategori_laporan ?? 'Fasilitas';
        $deskripsi = $laporan->deskripsi ?? '';
        $lokasi = $laporan->lokasi ?? '';
        $hasPhoto = array_key_exists('has_foto', $laporan->getAttributes())
            ? (bool) $laporan->getAttribute('has_foto')
            : !empty($laporan->foto);

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

        $syncData = $needsLaporanSync ? [
            'kategori_lokasi'   => $kategoriLokasi,
            'tingkat_keparahan' => $tingkatKeparahan,
            'skala_keparahan'   => $skalaKeparahan,
        ] : null;

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
        if ($precomputedDistinctReporters !== null) {
            $distinctReporters = $precomputedDistinctReporters;
        } else {
            $distinctReporters = DB::transactionLevel() === 0 ? $this->countNearbyReporters($laporan) : 1;
        }

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

        return [
            'sync'       => $syncData,
            'attributes' => [
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
            ],
        ];
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
        $prepared = $this->buildAssessmentPayload($laporan, $existing);
        $attributes = $prepared['attributes'];
        $syncData = $prepared['sync'];

        if ($syncData !== null) {
            $laporan->kategori_lokasi   = $syncData['kategori_lokasi'];
            $laporan->tingkat_keparahan = $syncData['tingkat_keparahan'];
            $laporan->skala_keparahan   = $syncData['skala_keparahan'];

            $pdoId = spl_object_id(DB::connection()->getPdo());
            if (DB::transactionLevel() === 0 && $laporan->exists && !empty(self::$verifiedLaporanColumnsByPdo[$pdoId])) {
                try {
                    Laporan::where('id_laporan', $laporan->id_laporan)->update($syncData);
                } catch (\Throwable $e) {
                    // Jangan gagalkan alur apabila update kolom tambahan gagal
                }
            }
        }

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
                $this->invalidateSchemaVerification();
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

