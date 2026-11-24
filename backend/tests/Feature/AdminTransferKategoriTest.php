<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Pelapor;
use App\Models\Priority\PriorityAssessment;
use App\Models\Status;
use App\Models\UserMahasiswa;
use App\Models\UserSession;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminTransferKategoriTest extends TestCase
{
    use RefreshDatabase;

    private function createUserToken(string $nim = '235314088'): string
    {
        Pelapor::create([
            'nomor_identitas' => $nim,
            'tipe_user'       => 'mahasiswa',
        ]);

        UserMahasiswa::create([
            'nim'          => $nim,
            'nama'         => 'Pelapor Transfer',
            'password'     => Hash::make('password123'),
            'no_handphone' => '081234567891',
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

    public function test_bps_admin_can_transfer_misclassified_report_to_blu_and_vice_versa(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $userToken = $this->createUserToken('235314088');

        // 1. User keliru mengirim laporan kebersihan ke kategori Fasilitas (masuk ke BPS Kampus 1)
        $created = $this->withToken($userToken)->postJson('/api/laporan', [
            'nim'              => '235314088',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Sampah menumpuk di depan kelas K.101 dan berbau tidak sedap',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang K.101',
        ])->assertCreated();

        $idLaporan = $created->json('data.id_laporan');

        $bps1Token = $this->createAdminToken('kepala_bagian_bps_1');
        $blu1Token = $this->createAdminToken('kepala_bagian_blu_1');
        $kepalaBluToken = $this->createAdminToken('kepala_blu');
        $kepalaBpsToken = $this->createAdminToken('kepala_bps');

        // Awalnya laporan muncul di BPS 1, belum ada di BLU 1
        $this->assertContains(
            $idLaporan,
            array_column($this->withToken($bps1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
        $this->assertNotContains(
            $idLaporan,
            array_column($this->withToken($blu1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );

        // 2. Admin BPS Kampus 1 memindahkan laporan ke BLU (Kebersihan)
        $this->withToken($bps1Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan'   => 'Kebersihan',
            'catatan_pemindahan' => 'Masalah sampah merupakan wewenang BLU.',
        ])->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.kategori_sebelumnya', 'Fasilitas')
            ->assertJsonPath('data.kategori_laporan', 'Kebersihan')
            ->assertJsonPath('data.unit_asal', 'BPS')
            ->assertJsonPath('data.unit_tujuan', 'BLU');

        $this->assertDatabaseHas('laporan', [
            'id_laporan'       => $idLaporan,
            'kategori_laporan' => 'Kebersihan',
        ]);

        // Pastikan PriorityAssessment ikut tersinkron jika ada
        $assessment = PriorityAssessment::where('id_laporan', $idLaporan)->first();
        if ($assessment) {
            $this->assertSame('Kebersihan', $assessment->kategori);
        }

        // Sekarang laporan hilang dari BPS 1 & Kepala BPS, dan masuk ke BLU 1 & Kepala BLU
        $this->assertNotContains(
            $idLaporan,
            array_column($this->withToken($bps1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
        $this->assertNotContains(
            $idLaporan,
            array_column($this->withToken($kepalaBpsToken)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
        $this->assertContains(
            $idLaporan,
            array_column($this->withToken($blu1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
        $this->assertContains(
            $idLaporan,
            array_column($this->withToken($kepalaBluToken)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );

        // 3. Admin BLU Kampus 1 juga bisa memindahkan balik ke BPS (Fasilitas)
        $this->withToken($blu1Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Fasilitas',
        ])->assertOk()
            ->assertJsonPath('data.kategori_laporan', 'Fasilitas')
            ->assertJsonPath('data.unit_asal', 'BLU')
            ->assertJsonPath('data.unit_tujuan', 'BPS');

        $this->assertContains(
            $idLaporan,
            array_column($this->withToken($bps1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
        $this->assertNotContains(
            $idLaporan,
            array_column($this->withToken($blu1Token)->getJson('/api/admin/laporan')->assertOk()->json('data'), 'id_laporan')
        );
    }

    public function test_transfer_authorization_and_validation_rules(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $userToken = $this->createUserToken('235314089');

        $created = $this->withToken($userToken)->postJson('/api/laporan', [
            'nim'              => '235314089',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'AC ruang kelas mati total tidak mengeluarkan udara dingin',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Kampus II, Ruang 202',
        ])->assertCreated();

        $idLaporan = $created->json('data.id_laporan');

        $bps1Token = $this->createAdminToken('kepala_bagian_bps_1');
        $bps2Token = $this->createAdminToken('kepala_bagian_bps_2');
        $blu2Token = $this->createAdminToken('kepala_bagian_blu_2');
        $kepalaBpsToken = $this->createAdminToken('kepala_bps');
        $kepalaBluToken = $this->createAdminToken('kepala_blu');
        $wr2Token = $this->createAdminToken('wakil_rektor_ii');

        // BPS Kampus 1 tidak boleh memindahkan laporan Kampus 2
        $this->withToken($bps1Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Kebersihan',
        ])->assertForbidden();

        // BLU Kampus 2 tidak boleh memindahkan laporan yang saat ini masih milik BPS
        $this->withToken($blu2Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Kebersihan',
        ])->assertForbidden();

        // Wakil Rektor II, Kepala Biro BPS, dan Kepala Biro BLU (read-only) tidak boleh memindahkan laporan
        $this->withToken($wr2Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Kebersihan',
        ])->assertForbidden();
        $this->withToken($kepalaBpsToken)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Kebersihan',
        ])->assertForbidden();
        $this->withToken($kepalaBluToken)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Kebersihan',
        ])->assertForbidden();

        // Memindahkan ke kategori yang sama ditolak (422)
        $this->withToken($bps2Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Fasilitas',
        ])->assertUnprocessable();

        // Laporan yang sudah Selesai tidak boleh dipindahkan (422)
        Status::create([
            'id_laporan'      => $idLaporan,
            'status_laporan'  => 'Selesai',
            'tanggal_merubah' => now()->addMinute(),
        ]);

        $this->withToken($bps2Token)->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
            'kategori_laporan' => 'Kebersihan',
        ])->assertUnprocessable();
    }
}

