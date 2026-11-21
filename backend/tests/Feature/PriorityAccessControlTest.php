<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\Pelapor;
use App\Models\Priority\PriorityAssessment;
use App\Models\Status;
use App\Models\UserMahasiswa;
use App\Services\LaporanService;
use App\Services\Priority\PriorityScoringService;
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

        $preflight = $this->withHeaders([
            'Origin'                         => 'http://localhost:3000',
            'Access-Control-Request-Method'  => 'GET',
            'Access-Control-Request-Headers' => 'Authorization, Content-Type',
        ])->options('/api/admin/priority/reports');

        $preflight->assertNoContent();
        $preflight->assertHeader('Access-Control-Allow-Origin', '*');

        $response = $this->withHeaders([
            'Origin'        => 'http://localhost:3000',
            'Authorization' => 'Bearer ' . $plainToken,
        ])->getJson('/api/admin/priority/reports');

        $response->assertOk();
        $response->assertHeader('Access-Control-Allow-Origin', '*');
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
            'summary',
        ]);
    }

    public function test_priority_list_omits_heavy_foto_while_detail_preserves_foto_and_summary_matches(): void
    {
        $admin = Admin::create([
            'nama_admin' => 'Admin WR II',
            'username'   => 'admin.wr2',
            'password'   => bcrypt('password123'),
            'role'       => 'BOTH',
            'campus'     => 'Semua Kampus',
            'email'      => 'wr2@usd.ac.id',
            'jabatan'    => 'wakil_rektor_ii',
        ]);

        $plainToken = 'test-priority-list-token-67890';
        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHour(),
        ]);

        Pelapor::create(['nomor_identitas' => '235314010', 'tipe_user' => 'mahasiswa']);
        UserMahasiswa::create([
            'nim'          => '235314010',
            'nama'         => 'Budi Santoso',
            'password'     => bcrypt('secret123'),
            'no_handphone' => '08123456789',
        ]);

        $fakeBase64Foto = 'data:image/png;base64,' . str_repeat('A', 2048);

        $laporan = Laporan::withoutEvents(function () use ($fakeBase64Foto) {
            $lap = Laporan::create([
                'nim'              => '235314010',
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => 'Kabel terbuka di ruang kelas membuat percikan api',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi'           => 'Ruang K.205',
                'foto'             => $fakeBase64Foto,
                'tanggal_buat'     => now()->subDays(2),
            ]);

            Status::create([
                'id_laporan'      => $lap->id_laporan,
                'status_laporan'  => 'Diverifikasi',
                'tanggal_merubah' => now(),
            ]);

            return $lap;
        });

        $listResponse = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/admin/priority/reports');

        $listResponse->assertOk();
        $listData = $listResponse->json('data');
        $this->assertCount(1, $listData);
        $this->assertNull($listData[0]['foto']);
        $this->assertTrue($listData[0]['has_foto']);
        $this->assertSame('Budi Santoso', $listData[0]['nama_pelapor']);
        $this->assertSame('Diverifikasi', $listData[0]['status_terkini']);
        $this->assertSame('kritis', $listData[0]['priority_level']);

        $summaryResponse = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/admin/priority/summary');

        $summaryResponse->assertOk();
        $this->assertSame($summaryResponse->json('data'), $listResponse->json('summary'));

        $detailResponse = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/admin/priority/reports/' . $laporan->id_laporan);

        $detailResponse->assertOk();
        $this->assertSame($fakeBase64Foto, $detailResponse->json('data.laporan.foto'));
    }

    public function test_batch_assess_and_save_many_matches_single_assessment_scoring_and_duplicate_count(): void
    {
        Pelapor::create(['nomor_identitas' => '235314021', 'tipe_user' => 'mahasiswa']);
        Pelapor::create(['nomor_identitas' => '235314022', 'tipe_user' => 'mahasiswa']);

        $laporans = Laporan::withoutEvents(function () {
            $l1 = Laporan::create([
                'nim'              => '235314021',
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => 'AC mati di ruang kuliah lantai 2',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi'           => 'Ruang K.201, Gedung B',
                'tanggal_buat'     => now()->subDays(3),
            ]);

            $l2 = Laporan::create([
                'nim'              => '235314022',
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => 'AC ruangan tidak dingin sama sekali',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi'           => 'Ruang K.201, Gedung B',
                'tanggal_buat'     => now()->subDay(),
            ]);

            return collect([$l1, $l2]);
        });

        /** @var PriorityScoringService $scoringService */
        $scoringService = app(PriorityScoringService::class);
        $batchResults = $scoringService->assessAndSaveMany($laporans);

        $this->assertCount(2, $batchResults);
        $this->assertDatabaseCount('priority_assessments', 2);

        foreach ($laporans as $lap) {
            $batchAssessment = $batchResults->get($lap->id_laporan);
            $singleRecalculated = $scoringService->assessAndSave($lap->fresh(), true);

            $this->assertSame($singleRecalculated->priority_score, $batchAssessment->priority_score);
            $this->assertSame($singleRecalculated->priority_level, $batchAssessment->priority_level);
            $this->assertSame($singleRecalculated->severity_level, $batchAssessment->severity_level);
            $this->assertSame($singleRecalculated->kategori_lokasi, $batchAssessment->kategori_lokasi);
            $this->assertSame($singleRecalculated->reasons, $batchAssessment->reasons);
        }
    }
}
