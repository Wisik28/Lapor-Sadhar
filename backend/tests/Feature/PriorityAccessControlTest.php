<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Pelapor;
use App\Models\Priority\PriorityAssessment;
use App\Services\LaporanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PriorityAccessControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_laporan_persists_location_category_and_initial_severity_to_database(): void
    {
        Pelapor::create([
            'nomor_identitas' => '235314002',
            'tipe_user'       => 'mahasiswa',
        ]);

        /** @var LaporanService $service */
        $service = app(LaporanService::class);

        $laporanKelas = $service->createLaporan([
            'nim'              => '235314002',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu ruangan berkedip',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi'           => 'Kelas 205',
        ]);

        $this->assertSame('Ruang Kelas', $laporanKelas->kategori_lokasi);
        $this->assertSame('Tinggi', $laporanKelas->tingkat_keparahan);
        $this->assertSame(3, $laporanKelas->skala_keparahan);

        $this->assertDatabaseHas('laporan', [
            'id_laporan'        => $laporanKelas->id_laporan,
            'kategori_lokasi'   => 'Ruang Kelas',
            'tingkat_keparahan' => 'Tinggi',
            'skala_keparahan'   => 3,
        ]);

        $assessmentKelas = PriorityAssessment::where('id_laporan', $laporanKelas->id_laporan)->first();
        $this->assertNotNull($assessmentKelas);
        $this->assertSame('Ruang Kelas', $assessmentKelas->kategori_lokasi);
        $this->assertSame('Tinggi', $assessmentKelas->tingkat_keparahan_lokasi);
        $this->assertSame(3, $assessmentKelas->skala_keparahan_lokasi);

        // Uji lokasi tidak dikenali -> Tidak Diketahui & Sedang (2), pembuatan laporan tetap berhasil
        $laporanUnknown = $service->createLaporan([
            'nim'              => '235314002',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu ruangan berkedip',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi'           => 'Lokasi Rahasia XYZ',
        ]);

        $this->assertSame('Tidak Diketahui', $laporanUnknown->kategori_lokasi);
        $this->assertSame('Sedang', $laporanUnknown->tingkat_keparahan);
        $this->assertSame(2, $laporanUnknown->skala_keparahan);

        $assessmentUnknown = PriorityAssessment::where('id_laporan', $laporanUnknown->id_laporan)->first();
        $this->assertNotNull($assessmentUnknown);
        $this->assertGreaterThan(
            $assessmentUnknown->priority_score,
            $assessmentKelas->priority_score,
            'Laporan pada lokasi dengan keparahan Tinggi (Ruang Kelas) harus memiliki skor prioritas lebih tinggi daripada lokasi Sedang.'
        );
    }

    public function test_creating_laporan_succeeds_without_aborting_transaction_even_if_priority_tables_missing(): void
    {
        Pelapor::create([
            'nomor_identitas' => '235314001',
            'tipe_user'       => 'mahasiswa',
        ]);

        // Simulasikan kondisi database remote yang belum menjalankan migrasi tabel prioritas
        Schema::dropIfExists('priority_feedback');
        Schema::dropIfExists('priority_assessments');

        /** @var LaporanService $service */
        $service = app(LaporanService::class);

        $laporan = $service->createLaporan([
            'nim'              => '235314001',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'AC ruang kelas mati dan mengeluarkan bau gosong',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi'           => 'Kampus III Paingan, Ruang K.204',
        ]);

        $this->assertNotNull($laporan->id_laporan);
        $this->assertCount(1, $laporan->statuses);
        $this->assertEquals('Terkirim', $laporan->statuses->first()->status_laporan);
    }

    public function test_unauthenticated_request_to_priority_dashboard_is_rejected(): void
    {
        $this->getJson('/api/admin/priority/reports')->assertUnauthorized();
        $this->getJson('/api/admin/priority/summary')->assertUnauthorized();
        $this->patchJson('/api/admin/priority/reports/1/severity', [
            'severity_level' => 'berat',
        ])->assertUnauthorized();
    }

    public function test_admin_session_can_access_priority_dashboard(): void
    {
        $admin = Admin::create([
            'nama_admin' => 'Admin BPS Kampus',
            'username'   => 'bps.kampus1',
            'password'   => bcrypt('password123'),
            'role'       => 'BPS',
            'campus'     => 'Kampus 1',
            'email'      => 'bps1@usd.ac.id',
            'jabatan'    => 'kepala_bagian_bps_1',
        ]);

        $plainToken = 'test-priority-admin-token-12345';
        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/admin/priority/reports');

        $response->assertOk();
        $response->assertJsonStructure([
            'status',
            'message',
            'total',
            'data',
        ]);
    }

    public function test_user_temporary_route_can_access_priority_reports(): void
    {
        $response = $this->getJson('/api/priority/reports');
        $response->assertOk();
        $response->assertJsonStructure([
            'status',
            'message',
            'total',
            'data',
        ]);
    }
}
