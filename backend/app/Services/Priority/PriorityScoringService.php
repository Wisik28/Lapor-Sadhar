<?php

namespace App\Services\Priority;

use App\Models\Admin;
use App\Models\Laporan;
use App\Models\Priority\PriorityAssessment;
use App\Models\Priority\PriorityFeedback;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PriorityScoringService
{
    private AiSeverityAssessor $aiAssessor;

    public function __construct(AiSeverityAssessor $aiAssessor)
    {
        $this->aiAssessor = $aiAssessor;
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
     * Dapatkan bobot lokasi berdasarkan teks lokasi
     */
    public function resolveLocationWeight(string $lokasi): float
    {
        $locLower = strtolower($lokasi);

        if (str_contains($locLower, 'laboratorium') || str_contains($locLower, 'lab') || str_contains($locLower, 'evakuasi')) {
            return 1.0;
        }
        if (str_contains($locLower, 'kelas') || str_contains($locLower, 'kuliah') || str_contains($locLower, 'ruang k.') || str_contains($locLower, 'seminar')) {
            return 0.9;
        }
        if (str_contains($locLower, 'toilet') || str_contains($locLower, 'wc') || str_contains($locLower, 'perpustakaan') || str_contains($locLower, 'kantin')) {
            return 0.8;
        }
        if (str_contains($locLower, 'kantor') || str_contains($locLower, 'koridor') || str_contains($locLower, 'hall') || str_contains($locLower, 'lobby')) {
            return 0.6;
        }
        if (str_contains($locLower, 'parkir') || str_contains($locLower, 'halaman') || str_contains($locLower, 'lapangan')) {
            return 0.4;
        }

        return (float) config('priority.location_weights.default', 0.4);
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
     * Lakukan penilaian dan simpan ke database untuk sebuah laporan
     */
    public function assessAndSave(Laporan $laporan, bool $force = false): PriorityAssessment
    {
        $existing = PriorityAssessment::where('id_laporan', $laporan->id_laporan)->first();
        if ($existing && !$force) {
            return $existing;
        }

        $kategori = $laporan->kategori_laporan ?? 'Fasilitas';
        $deskripsi = $laporan->deskripsi ?? '';
        $lokasi = $laporan->lokasi ?? '';
        $hasPhoto = !empty($laporan->foto);

        // 1. Dapatkan usulan AI
        $aiResult = $this->aiAssessor->assess($kategori, $deskripsi, $lokasi, $hasPhoto);

        // 2. Hitung faktor lingkungan
        $locationWeight    = $this->resolveLocationWeight($lokasi);
        $distinctReporters = $this->countNearbyReporters($laporan);

        $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : now();
        $daysWaiting = (float) max(0, $createdAt->diffInDays(now()));

        // 3. Hitung skor
        $calculated = $this->calculateScore(
            $kategori,
            $aiResult['dimensions'],
            $locationWeight,
            $distinctReporters,
            $daysWaiting,
            $aiResult['safety_flags']
        );

        $effectiveSeverity = $existing?->admin_severity ?: $aiResult['suggested_severity'];

        return PriorityAssessment::updateOrCreate(
            ['id_laporan' => $laporan->id_laporan],
            [
                'kategori'              => $kategori,
                'severity_level'        => $effectiveSeverity,
                'severity_source'       => $existing?->admin_severity ? 'admin' : 'ai',
                'ai_suggested_severity' => $aiResult['suggested_severity'],
                'admin_severity'        => $existing?->admin_severity,
                'priority_score'        => $calculated['priority_score'],
                'priority_level'        => $calculated['priority_level'],
                'confidence'            => $aiResult['confidence'],
                'dimensions'            => $aiResult['dimensions'],
                'safety_flags'          => $aiResult['safety_flags'],
                'reasons'               => $aiResult['reasons'],
                'needs_review'          => $existing ? $existing->needs_review : true,
                'admin_notes'           => $existing?->admin_notes,
                'admin_id'              => $existing?->admin_id,
                'reviewed_at'           => $existing?->reviewed_at,
            ]
        );
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

        $locationWeight    = $this->resolveLocationWeight($laporan->lokasi ?? '');
        $distinctReporters = $this->countNearbyReporters($laporan);
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
            $safetyFlags
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
            $assessment->severity_level  = $newSeverity;
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

