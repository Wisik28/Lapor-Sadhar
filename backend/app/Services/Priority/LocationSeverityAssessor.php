<?php

namespace App\Services\Priority;

/**
 * LocationSeverityAssessor
 *
 * Layanan khusus untuk menentukan tingkat keparahan awal (Initial Severity)
 * dan skala keparahan (1-4) berdasarkan kategori lokasi hasil identifikasi.
 */
class LocationSeverityAssessor
{
    public const SEVERITY_RENDAH        = 'Rendah';
    public const SEVERITY_SEDANG        = 'Sedang';
    public const SEVERITY_TINGGI        = 'Tinggi';
    public const SEVERITY_SANGAT_TINGGI = 'Sangat Tinggi';

    public const SCALE_RENDAH        = 1;
    public const SCALE_SEDANG        = 2;
    public const SCALE_TINGGI        = 3;
    public const SCALE_SANGAT_TINGGI = 4;

    /**
     * Pemetaan standar Kategori Lokasi -> Tingkat Keparahan Awal, Skala (1-4), dan Bobot Prioritas (0.0-1.0)
     */
    private const CATEGORY_SEVERITY_MAP = [
        LocationCategorizer::CATEGORY_RUANG_KELAS => [
            'severity_label'  => self::SEVERITY_TINGGI,
            'severity_score'  => self::SCALE_TINGGI,
            'location_weight' => 0.90,
        ],
        LocationCategorizer::CATEGORY_LAPANGAN => [
            'severity_label'  => self::SEVERITY_SEDANG,
            'severity_score'  => self::SCALE_SEDANG,
            'location_weight' => 0.50,
        ],
        LocationCategorizer::CATEGORY_TOILET => [
            'severity_label'  => self::SEVERITY_TINGGI,
            'severity_score'  => self::SCALE_TINGGI,
            'location_weight' => 0.80,
        ],
        LocationCategorizer::CATEGORY_RUANG_TERBUKA => [
            'severity_label'  => self::SEVERITY_RENDAH,
            'severity_score'  => self::SCALE_RENDAH,
            'location_weight' => 0.25,
        ],
        LocationCategorizer::CATEGORY_PARKIRAN => [
            'severity_label'  => self::SEVERITY_TINGGI,
            'severity_score'  => self::SCALE_TINGGI,
            'location_weight' => 0.75,
        ],
        LocationCategorizer::CATEGORY_LABORATORIUM_PRAKTIK => [
            'severity_label'  => self::SEVERITY_SANGAT_TINGGI,
            'severity_score'  => self::SCALE_SANGAT_TINGGI,
            'location_weight' => 1.00,
        ],
        LocationCategorizer::CATEGORY_RUANG_DOSEN => [
            'severity_label'  => self::SEVERITY_SEDANG,
            'severity_score'  => self::SCALE_SEDANG,
            'location_weight' => 0.60,
        ],
        LocationCategorizer::CATEGORY_PERPUSTAKAAN => [
            'severity_label'  => self::SEVERITY_SEDANG,
            'severity_score'  => self::SCALE_SEDANG,
            'location_weight' => 0.60,
        ],
        LocationCategorizer::CATEGORY_TIDAK_DIKETAHUI => [
            'severity_label'  => self::SEVERITY_SEDANG,
            'severity_score'  => self::SCALE_SEDANG,
            'location_weight' => 0.50,
        ],
    ];

    private LocationCategorizer $categorizer;

    /**
     * Cache hasil penilaian lokasi di memori per input string lokasi.
     *
     * @var array<string, array{kategori_lokasi: string, tingkat_keparahan: string, skala_keparahan: int, location_weight: float}>
     */
    private static array $locationCache = [];

    public function __construct(?LocationCategorizer $categorizer = null)
    {
        $this->categorizer = $categorizer ?? new LocationCategorizer();
    }

    /**
     * Tentukan tingkat keparahan awal berdasarkan kategori lokasi.
     * Jika kategori tidak dikenali, gunakan fallback "Tidak Diketahui" dengan tingkat keparahan "Sedang" (2).
     *
     * @param string $category
     * @return array{
     *     kategori_lokasi: string,
     *     tingkat_keparahan: string,
     *     skala_keparahan: int,
     *     location_weight: float
     * }
     */
    public function assessByCategory(string $category): array
    {
        $normalizedCategory = array_key_exists($category, self::CATEGORY_SEVERITY_MAP)
            ? $category
            : LocationCategorizer::CATEGORY_TIDAK_DIKETAHUI;

        $mapping = self::CATEGORY_SEVERITY_MAP[$normalizedCategory];

        return [
            'kategori_lokasi'   => $normalizedCategory,
            'tingkat_keparahan' => $mapping['severity_label'],
            'skala_keparahan'   => $mapping['severity_score'],
            'location_weight'   => $mapping['location_weight'],
        ];
    }

    /**
     * Lakukan identifikasi kategori lokasi sekaligus penentuan tingkat keparahan awal
     * dari teks lokasi bebas. Tidak pernah melempar exception (selalu aman).
     *
     * @param string|null $rawLocation
     * @return array{
     *     kategori_lokasi: string,
     *     tingkat_keparahan: string,
     *     skala_keparahan: int,
     *     location_weight: float
     * }
     */
    public function assessLocation(?string $rawLocation): array
    {
        $cacheKey = $rawLocation ?? '';
        if (isset(self::$locationCache[$cacheKey])) {
            return self::$locationCache[$cacheKey];
        }

        try {
            if (count(self::$locationCache) >= 512) {
                self::$locationCache = [];
            }

            $category = $this->categorizer->categorize($rawLocation);
            return self::$locationCache[$cacheKey] = $this->assessByCategory($category);
        } catch (\Throwable $e) {
            return $this->assessByCategory(LocationCategorizer::CATEGORY_TIDAK_DIKETAHUI);
        }
    }

    /**
     * Konversi label tingkat keparahan menjadi nilai skala numerik (1-4).
     */
    public function resolveScoreFromLabel(string $label): int
    {
        return match (mb_strtolower(trim($label), 'UTF-8')) {
            'rendah'        => self::SCALE_RENDAH,
            'sedang'        => self::SCALE_SEDANG,
            'tinggi'        => self::SCALE_TINGGI,
            'sangat tinggi' => self::SCALE_SANGAT_TINGGI,
            default         => self::SCALE_SEDANG,
        };
    }
}

