<?php

namespace Tests\Unit;

use App\Services\Priority\AiSeverityAssessor;
use App\Services\Priority\LocationCategorizer;
use App\Services\Priority\LocationSeverityAssessor;
use App\Services\Priority\PriorityScoringService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class LocationCategorizationAndSeverityTest extends TestCase
{
    private LocationCategorizer $categorizer;
    private LocationSeverityAssessor $severityAssessor;
    private PriorityScoringService $scoringService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->categorizer = new LocationCategorizer();
        $this->severityAssessor = new LocationSeverityAssessor($this->categorizer);
        $this->scoringService = new PriorityScoringService(
            new AiSeverityAssessor(),
            $this->categorizer,
            $this->severityAssessor
        );
    }

    /**
     * Data uji variasi penulisan lokasi untuk setiap kategori
     */
    public static function locationVariationsProvider(): array
    {
        return [
            // 1. Ruang Kelas -> Tinggi (3)
            'ruang kelas variasi 1' => ['Kelas 205', 'Ruang Kelas', 'Tinggi', 3],
            'ruang kelas variasi 2' => ['Kampus III, Ruang Kelas K.205', 'Ruang Kelas', 'Tinggi', 3],
            'ruang kelas variasi 3' => ['Ruang Kuliah R.102', 'Ruang Kelas', 'Tinggi', 3],
            'ruang kelas variasi 4' => ['Gedung Utama K.304', 'Ruang Kelas', 'Tinggi', 3],
            'ruang kelas variasi 5' => ['Auditorium Driyarkara', 'Ruang Kelas', 'Tinggi', 3],

            // 2. Lapangan -> Sedang (2)
            'lapangan variasi 1' => ['Lapangan Realino', 'Lapangan', 'Sedang', 2],
            'lapangan variasi 2' => ['Lap. Basket Kampus Paingan', 'Lapangan', 'Sedang', 2],
            'lapangan variasi 3' => ['Lapangan Futsal Mrican', 'Lapangan', 'Sedang', 2],
            'lapangan variasi 4' => ['GOR Kampus III', 'Lapangan', 'Sedang', 2],

            // 3. Toilet -> Tinggi (3)
            'toilet variasi 1' => ['Toilet Hall', 'Toilet', 'Tinggi', 3],
            'toilet variasi 2' => ['WC Lantai 2 Gedung B', 'Toilet', 'Tinggi', 3],
            'toilet variasi 3' => ['Kamar Mandi Pria Dekat Perpustakaan', 'Toilet', 'Tinggi', 3],
            'toilet variasi 4' => ['Restroom Basement', 'Toilet', 'Tinggi', 3],

            // 4. Ruang Terbuka -> Rendah (1)
            'ruang terbuka variasi 1' => ['Ruang Terbuka Kampus II', 'Ruang Terbuka', 'Rendah', 1],
            'ruang terbuka variasi 2' => ['Taman Tengah Kampus', 'Ruang Terbuka', 'Rendah', 1],
            'ruang terbuka variasi 3' => ['Hall Selatan Paingan', 'Ruang Terbuka', 'Rendah', 1],
            'ruang terbuka variasi 4' => ['Selasar Gedung A', 'Ruang Terbuka', 'Rendah', 1],
            'ruang terbuka variasi 5' => ['Gazebo Halaman Depan', 'Ruang Terbuka', 'Rendah', 1],

            // 5. Parkiran -> Tinggi (3)
            'parkiran variasi 1' => ['Parkiran Motor Paingan', 'Parkiran', 'Tinggi', 3],
            'parkiran variasi 2' => ['Area Parkir Timur Kampus 1', 'Parkiran', 'Tinggi', 3],
            'parkiran variasi 3' => ['Basement Parkir Mobil', 'Parkiran', 'Tinggi', 3],
            'parkiran variasi 4' => ['Parkiran Dosen Mrican', 'Parkiran', 'Tinggi', 3],

            // 6. Laboratorium Praktik -> Sangat Tinggi (4)
            'lab variasi 1' => ['Laboratorium Praktik Jaringan', 'Laboratorium Praktik', 'Sangat Tinggi', 4],
            'lab variasi 2' => ['Lab Komputer Lantai 3', 'Laboratorium Praktik', 'Sangat Tinggi', 4],
            'lab variasi 3' => ['Lab. Farmasi & Kimia', 'Laboratorium Praktik', 'Sangat Tinggi', 4],
            'lab variasi 4' => ['Bengkel Praktik Mesin', 'Laboratorium Praktik', 'Sangat Tinggi', 4],
            'lab variasi 5' => ['Ruang Praktikum Fisika', 'Laboratorium Praktik', 'Sangat Tinggi', 4],

            // 7. Ruang Dosen -> Sedang (2)
            'ruang dosen variasi 1' => ['Ruang Dosen Informatika', 'Ruang Dosen', 'Sedang', 2],
            'ruang dosen variasi 2' => ['R. Dosen Lantai 2', 'Ruang Dosen', 'Sedang', 2],
            'ruang dosen variasi 3' => ['Kantor Dosen Kampus III', 'Ruang Dosen', 'Sedang', 2],
            'ruang dosen variasi 4' => ['Ruang Prodi Sastra Inggris', 'Ruang Dosen', 'Sedang', 2],

            // 8. Perpustakaan -> Sedang (2)
            'perpustakaan variasi 1' => ['Perpustakaan Pusat', 'Perpustakaan', 'Sedang', 2],
            'perpustakaan variasi 2' => ['Perpus Kampus Paingan Lantai 2', 'Perpustakaan', 'Sedang', 2],
            'perpustakaan variasi 3' => ['Ruang Baca Koleksi Referensi', 'Perpustakaan', 'Sedang', 2],

            // 9. Lokasi Tidak Dikenali -> Tidak Diketahui, Default: Sedang (2)
            'tidak diketahui variasi 1' => ['Gedung XyZ Tanpa Keterangan', 'Tidak Diketahui', 'Sedang', 2],
            'tidak diketahui variasi 2' => ['Sekitar Kampus', 'Tidak Diketahui', 'Sedang', 2],
            'tidak diketahui variasi 3' => ['', 'Tidak Diketahui', 'Sedang', 2],
            'tidak diketahui variasi 4' => ['   ', 'Tidak Diketahui', 'Sedang', 2],
        ];
    }

    #[DataProvider('locationVariationsProvider')]
    public function test_categorization_and_initial_severity_for_all_categories(
        string $rawLocation,
        string $expectedCategory,
        string $expectedSeverityLabel,
        int $expectedSeverityScale
    ): void {
        $category = $this->categorizer->categorize($rawLocation);
        $this->assertSame($expectedCategory, $category, "Gagal mengidentifikasi kategori untuk input: '{$rawLocation}'");

        $assessment = $this->severityAssessor->assessLocation($rawLocation);
        $this->assertSame($expectedCategory, $assessment['kategori_lokasi']);
        $this->assertSame($expectedSeverityLabel, $assessment['tingkat_keparahan']);
        $this->assertSame($expectedSeverityScale, $assessment['skala_keparahan']);
    }

    public function test_null_location_returns_default_tidak_diketahui_and_sedang(): void
    {
        $assessment = $this->severityAssessor->assessLocation(null);

        $this->assertSame('Tidak Diketahui', $assessment['kategori_lokasi']);
        $this->assertSame('Sedang', $assessment['tingkat_keparahan']);
        $this->assertSame(2, $assessment['skala_keparahan']);
    }

    public function test_higher_location_severity_produces_higher_priority_weight(): void
    {
        $wLab = $this->scoringService->resolveLocationWeight('Laboratorium Praktik Komputer');
        $wKelas = $this->scoringService->resolveLocationWeight('Kelas 205');
        $wLapangan = $this->scoringService->resolveLocationWeight('Lapangan Realino');
        $wTerbuka = $this->scoringService->resolveLocationWeight('Taman Ruang Terbuka');

        $this->assertGreaterThan($wKelas, $wLab);
        $this->assertGreaterThan($wLapangan, $wKelas);
        $this->assertGreaterThan($wTerbuka, $wLapangan);
    }
}

