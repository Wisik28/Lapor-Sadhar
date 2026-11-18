<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\Pelapor;
use App\Models\UserMahasiswa;
use App\Models\UserSession;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LaporanCampusScopingTest extends TestCase
{
    use RefreshDatabase;

    private function createUserToken(string $nim = '235314099'): string
    {
        Pelapor::create([
            'nomor_identitas' => $nim,
            'tipe_user'       => 'mahasiswa',
        ]);

        UserMahasiswa::create([
            'nim'          => $nim,
            'nama'         => 'Pelapor Uji',
            'password'     => Hash::make('password123'),
            'no_handphone' => '081234567890',
        ]);

        $plainToken = 'user-token-' . $nim;
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id'   => $nim,
            'token_hash'   => hash('sha256', $plainToken),
            'expires_at'   => now()->addHour(),
        ]);

        return $plainToken;
    }

    private function createAdminToken(string $jabatan): string
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $plainToken = 'admin-token-' . $jabatan;

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHour(),
        ]);

        return $plainToken;
    }

    public function test_store_laporan_validates_and_persists_lokasi_kampus(): void
    {
        $token = $this->createUserToken('235314050');

        // Wajib pilih lokasi_kampus
        $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314050',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu ruang kelas mati total',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi'           => 'Ruang K.205',
        ])->assertUnprocessable()->assertJsonValidationErrors(['lokasi_kampus']);

        // Tolak nilai di luar Kampus 1..4
        $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314050',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu ruang kelas mati total',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 5',
            'lokasi'           => 'Ruang K.205',
        ])->assertUnprocessable()->assertJsonValidationErrors(['lokasi_kampus']);

        // Terima nilai Kampus 1..4
        $created = $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314050',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu ruang kelas mati total',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Ruang Kelas 201',
        ])->assertCreated()
            ->assertJsonPath('data.lokasi_kampus', 'Kampus 2');

        $idLaporan = $created->json('data.id_laporan');

        $this->assertDatabaseHas('laporan', [
            'id_laporan'    => $idLaporan,
            'lokasi_kampus' => 'Kampus 2',
        ]);

        // Update lokasi_kampus pada laporan berstatus Terkirim
        $this->withToken($token)->putJson('/api/laporan/' . $idLaporan, [
            'lokasi_kampus' => 'Kampus 4',
        ])->assertOk()
            ->assertJsonPath('data.lokasi_kampus', 'Kampus 4');

        $this->assertDatabaseHas('laporan', [
            'id_laporan'    => $idLaporan,
            'lokasi_kampus' => 'Kampus 4',
        ]);
    }

    public function test_admin_only_sees_and_manages_reports_matching_their_campus_and_unit(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $userToken = $this->createUserToken('235314051');

        $reports = [];
        $specs = [
            'k1_fasilitas'  => ['lokasi_kampus' => 'Kampus 1', 'kategori_laporan' => 'Fasilitas'],
            'k1_kebersihan' => ['lokasi_kampus' => 'Kampus 1', 'kategori_laporan' => 'Kebersihan'],
            'k2_fasilitas'  => ['lokasi_kampus' => 'Kampus 2', 'kategori_laporan' => 'Fasilitas'],
            'k2_kebersihan' => ['lokasi_kampus' => 'Kampus 2', 'kategori_laporan' => 'Kebersihan'],
        ];

        foreach ($specs as $key => $spec) {
            $res = $this->withToken($userToken)->postJson('/api/laporan', [
                'nim'              => '235314051',
                'kategori_laporan' => $spec['kategori_laporan'],
                'deskripsi'        => "Kerusakan/keluhan uji untuk {$key}",
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => $spec['lokasi_kampus'],
                'lokasi'           => 'Ruang Kelas 101',
            ])->assertCreated();

            $reports[$key] = $res->json('data.id_laporan');
        }

        // Kepala Bagian BPS 1 -> hanya Kampus 1 & Fasilitas
        $bps1Token = $this->createAdminToken('kepala_bagian_bps_1');
        $this->assertSame(
            [$reports['k1_fasilitas']],
            array_column($this->withToken($bps1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
        $this->withToken($bps1Token)->getJson('/api/admin/rekap')->assertOk()->assertJsonPath('data.total_laporan', 1);
        $this->assertSame(
            [$reports['k1_fasilitas']],
            array_column($this->withToken($bps1Token)->getJson('/api/admin/priority/reports')->assertOk()->json('data'), 'id_laporan')
        );
        $this->withToken($bps1Token)->getJson('/api/admin/priority/summary')->assertOk()->assertJsonPath('data.total_laporan', 1);

        // BPS 1 tidak bisa mengakses/mengubah laporan Kampus 2 atau Kebersihan Kampus 1
        $this->withToken($bps1Token)->patchJson("/api/admin/laporan/{$reports['k1_kebersihan']}/status", [
            'status_laporan' => 'Sedang Diverifikasi',
        ])->assertForbidden();
        $this->withToken($bps1Token)->patchJson("/api/admin/laporan/{$reports['k2_fasilitas']}/status", [
            'status_laporan' => 'Sedang Diverifikasi',
        ])->assertForbidden();
        $this->withToken($bps1Token)->getJson("/api/admin/priority/reports/{$reports['k2_fasilitas']}")->assertForbidden();
        $this->withToken($bps1Token)->patchJson("/api/admin/priority/reports/{$reports['k2_fasilitas']}/severity", [
            'severity_level' => 'berat',
        ])->assertForbidden();

        // BPS 1 bisa mengubah laporan Kampus 1 & Fasilitas
        $this->withToken($bps1Token)->patchJson("/api/admin/laporan/{$reports['k1_fasilitas']}/status", [
            'status_laporan' => 'Sedang Diverifikasi',
        ])->assertOk();

        // Kepala Bagian BLU 1 -> hanya Kampus 1 & Kebersihan
        $blu1Token = $this->createAdminToken('kepala_bagian_blu_1');
        $this->assertSame(
            [$reports['k1_kebersihan']],
            array_column($this->withToken($blu1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );

        // Kepala Bagian BPS 2 -> hanya Kampus 2 & Fasilitas
        $bps2Token = $this->createAdminToken('kepala_bagian_bps_2');
        $this->assertSame(
            [$reports['k2_fasilitas']],
            array_column($this->withToken($bps2Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );

        // Kepala Bagian BLU 2 -> hanya Kampus 2 & Kebersihan
        $blu2Token = $this->createAdminToken('kepala_bagian_blu_2');
        $this->assertSame(
            [$reports['k2_kebersihan']],
            array_column($this->withToken($blu2Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );

        // Kepala Biro BPS -> semua kampus, kategori Fasilitas
        $kepalaBpsToken = $this->createAdminToken('kepala_bps');
        $kepalaBpsIds = array_column($this->withToken($kepalaBpsToken)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan');
        sort($kepalaBpsIds);
        $this->assertSame([$reports['k1_fasilitas'], $reports['k2_fasilitas']], $kepalaBpsIds);

        // Kepala Biro BLU -> semua kampus, kategori Kebersihan
        $kepalaBluToken = $this->createAdminToken('kepala_blu');
        $kepalaBluIds = array_column($this->withToken($kepalaBluToken)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan');
        sort($kepalaBluIds);
        $this->assertSame([$reports['k1_kebersihan'], $reports['k2_kebersihan']], $kepalaBluIds);

        // Wakil Rektor II -> semua kampus dan semua kategori
        $wr2Token = $this->createAdminToken('wakil_rektor_ii');
        $wr2Ids = array_column($this->withToken($wr2Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan');
        sort($wr2Ids);
        $this->assertSame(array_values($reports), $wr2Ids);
    }

    public function test_infer_campus_from_lokasi_handles_roman_numerals_without_prefix_collision(): void
    {
        $this->assertSame('Kampus 1', Laporan::inferCampusFromLokasi('Kampus I Mrican, Ruang 1'));
        $this->assertSame('Kampus 2', Laporan::inferCampusFromLokasi('Kampus II, Lab'));
        $this->assertSame('Kampus 3', Laporan::inferCampusFromLokasi('Kampus III, Kelas K.205'));
        $this->assertSame('Kampus 4', Laporan::inferCampusFromLokasi('Kampus IV Kotabaru'));
        $this->assertSame('Kampus 3', Laporan::inferCampusFromLokasi('Ruang kelas tanpa keterangan', 'Kampus 3'));
    }
}
