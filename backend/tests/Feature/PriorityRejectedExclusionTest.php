<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\Pelapor;
use App\Models\Status;
use App\Models\UserMahasiswa;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PriorityRejectedExclusionTest extends TestCase
{
    use RefreshDatabase;

    private function createPelapor(string $nim = '235314800'): string
    {
        Pelapor::firstOrCreate(
            ['nomor_identitas' => $nim],
            ['tipe_user' => 'mahasiswa']
        );

        UserMahasiswa::firstOrCreate(
            ['nim' => $nim],
            [
                'nama'         => 'Mahasiswa Uji Prioritas',
                'email'        => "prio{$nim}@usd.ac.id",
                'password'     => Hash::make('password123'),
                'no_handphone' => '081234567890',
            ]
        );

        return $nim;
    }

    private function createAdminToken(string $jabatan): string
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $plainToken = 'admin-prio-excl-token-' . $jabatan;

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHours(8),
        ]);

        return $plainToken;
    }

    private function createLaporanWithLatestStatus(
        string $nim,
        string $status,
        string $kategori = 'Fasilitas',
        string $lokasiKampus = 'Kampus 1',
        string $lokasi = 'Kampus I, Ruang K.201'
    ): Laporan {
        return Laporan::withoutEvents(function () use ($nim, $status, $kategori, $lokasiKampus, $lokasi) {
            $lap = Laporan::create([
                'nim'              => $nim,
                'kategori_laporan' => $kategori,
                'deskripsi'        => "Laporan {$status} di {$lokasi}",
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => $lokasiKampus,
                'lokasi'           => $lokasi,
                'tanggal_buat'     => now()->subHours(4),
            ]);

            Status::create([
                'id_laporan'      => $lap->id_laporan,
                'status_laporan'  => 'Terkirim',
                'tanggal_merubah' => now()->subHours(4),
            ]);

            if ($status !== 'Terkirim') {
                Status::create([
                    'id_laporan'      => $lap->id_laporan,
                    'status_laporan'  => $status,
                    'tanggal_merubah' => now()->subHours(2),
                ]);
            }

            return $lap;
        });
    }

    public function test_rejected_reports_are_excluded_from_priority_dashboard_across_fallback_and_sql_paths_but_remain_in_admin_dashboard(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $bps1Token = $this->createAdminToken('kepala_bagian_bps_1');
        $wr2Token = $this->createAdminToken('wakil_rektor_ii');
        $nim = $this->createPelapor('235314801');

        $terkirim = $this->createLaporanWithLatestStatus($nim, 'Terkirim', 'Fasilitas', 'Kampus 1', 'Kampus I, Kelas 101');
        $proses = $this->createLaporanWithLatestStatus($nim, 'Proses', 'Kebersihan', 'Kampus 2', 'Kampus II, Lobby');
        $selesai = $this->createLaporanWithLatestStatus($nim, 'Selesai', 'Fasilitas', 'Kampus 1', 'Kampus I, Kelas 102');
        $ditolakBps1 = $this->createLaporanWithLatestStatus($nim, 'Ditolak', 'Fasilitas', 'Kampus 1', 'Kampus I, Kelas 103');
        $ditolakBlu2 = $this->createLaporanWithLatestStatus($nim, 'Ditolak', 'Kebersihan', 'Kampus 2', 'Kampus II, Toilet');

        // 1. Sebelum priority:backfill (jalur fallback read-only)
        $wr2PriorityFallback = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports')
            ->assertOk();
        $wr2IdsFallback = array_column($wr2PriorityFallback->json('data'), 'id_laporan');
        sort($wr2IdsFallback);
        $this->assertSame([$terkirim->id_laporan, $proses->id_laporan, $selesai->id_laporan], $wr2IdsFallback);
        $this->assertSame(3, $wr2PriorityFallback->json('summary.total_laporan'));

        $bps1PriorityFallback = $this->withToken($bps1Token)
            ->getJson('/api/admin/priority/reports')
            ->assertOk();
        $bps1IdsFallback = array_column($bps1PriorityFallback->json('data'), 'id_laporan');
        sort($bps1IdsFallback);
        $this->assertSame([$terkirim->id_laporan, $selesai->id_laporan], $bps1IdsFallback);

        $publicPriorityFallback = $this->getJson('/api/priority/reports')->assertOk();
        $publicIdsFallback = array_column($publicPriorityFallback->json('data'), 'id_laporan');
        $this->assertNotContains($ditolakBps1->id_laporan, $publicIdsFallback);
        $this->assertNotContains($ditolakBlu2->id_laporan, $publicIdsFallback);

        $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/summary')
            ->assertOk()
            ->assertJsonPath('data.total_laporan', 3);

        // Tabel Dashboard biasa (/api/admin/laporan) TETAP menampilkan seluruh laporan termasuk yang Ditolak
        $dashboardIds = array_column(
            $this->withToken($wr2Token)->getJson('/api/admin/laporan')->assertOk()->json('data'),
            'id_laporan'
        );
        $this->assertContains($ditolakBps1->id_laporan, $dashboardIds);
        $this->assertContains($ditolakBlu2->id_laporan, $dashboardIds);
        $this->assertCount(5, $dashboardIds);

        // 2. Setelah priority:backfill (jalur cepat SQL)
        $this->artisan('priority:backfill')->assertSuccessful();

        $wr2PrioritySql = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports')
            ->assertOk();
        $wr2IdsSql = array_column($wr2PrioritySql->json('data'), 'id_laporan');
        sort($wr2IdsSql);
        $this->assertSame([$terkirim->id_laporan, $proses->id_laporan, $selesai->id_laporan], $wr2IdsSql);
        $this->assertSame(3, $wr2PrioritySql->json('total'));
        $this->assertSame(3, $wr2PrioritySql->json('summary.total_laporan'));

        $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports?status=Ditolak')
            ->assertOk()
            ->assertJsonPath('total', 0)
            ->assertJsonCount(0, 'data');

        $this->withToken($bps1Token)
            ->getJson('/api/admin/priority/summary')
            ->assertOk()
            ->assertJsonPath('data.total_laporan', 2);

        $this->getJson('/api/priority/summary')
            ->assertOk()
            ->assertJsonPath('data.total_laporan', 3);

        // 3. Laporan yang awalnya aktif langsung hilang dari Dashboard Prioritas ketika statusnya diubah menjadi Ditolak,
        // namun tetap tampil pada Dashboard biasa (/api/admin/laporan)
        $this->withToken($bps1Token)
            ->patchJson("/api/admin/laporan/{$terkirim->id_laporan}/status", [
                'status_laporan'  => 'Ditolak',
                'pesan_tanggapan' => 'Laporan tidak valid.',
            ])
            ->assertOk();

        $afterRejectPriorityIds = array_column(
            $this->withToken($bps1Token)->getJson('/api/admin/priority/reports')->assertOk()->json('data'),
            'id_laporan'
        );
        $this->assertSame([$selesai->id_laporan], $afterRejectPriorityIds);

        $afterRejectDashboardIds = array_column(
            $this->withToken($bps1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'),
            'id_laporan'
        );
        $this->assertContains($terkirim->id_laporan, $afterRejectDashboardIds);
        $this->assertContains($ditolakBps1->id_laporan, $afterRejectDashboardIds);
    }
}

