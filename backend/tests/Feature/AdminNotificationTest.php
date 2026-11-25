<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminNotification;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\Pelapor;
use App\Models\UserMahasiswa;
use App\Models\UserSession;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function createUserWithToken(string $nim = '235314701', string $nama = 'Budi Santoso'): array
    {
        Pelapor::firstOrCreate(
            ['nomor_identitas' => $nim],
            ['tipe_user' => 'mahasiswa']
        );

        UserMahasiswa::firstOrCreate(
            ['nim' => $nim],
            [
                'nama'         => $nama,
                'email'        => "notif{$nim}@usd.ac.id",
                'password'     => Hash::make('password123'),
                'no_handphone' => '081234567890',
            ]
        );

        $plainToken = 'user-notif-token-' . $nim;
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id'   => $nim,
            'token_hash'   => hash('sha256', $plainToken),
            'expires_at'   => now()->addHours(12),
        ]);

        return [$nim, $plainToken];
    }

    private function createAdminWithToken(string $jabatan): array
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $plainToken = 'admin-notif-token-' . $jabatan;

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHours(8),
        ]);

        return [$admin, $plainToken];
    }

    public function test_new_and_revised_laporan_generate_scoped_admin_notifications(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [$nim, $userToken] = $this->createUserWithToken('235314701', 'Clara Wijaya');
        [$bps1, $bps1Token] = $this->createAdminWithToken('kepala_bagian_bps_1');
        [, $bps2Token] = $this->createAdminWithToken('kepala_bagian_bps_2');
        [, $blu1Token] = $this->createAdminWithToken('kepala_bagian_blu_1');
        [, $kepalaBpsToken] = $this->createAdminWithToken('kepala_bps');
        [, $wr2Token] = $this->createAdminWithToken('wakil_rektor_ii');

        // 1. Pelapor kirim laporan baru (Fasilitas, Kampus 1)
        $created = $this->withToken($userToken)
            ->postJson('/api/laporan', [
                'nim'              => $nim,
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => 'Proyektor kelas mati total sebelum kuliah',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => 'Kampus 1',
                'lokasi'           => 'Kampus I, Ruang K.201',
            ])
            ->assertCreated();

        $laporanId = (int) $created->json('data.id_laporan');

        // Admin BPS Kampus 1, Kepala Biro BPS, dan WR II harus menerima notifikasi Laporan Baru
        foreach ([$bps1Token, $kepalaBpsToken, $wr2Token] as $token) {
            $res = $this->withToken($token)
                ->getJson('/api/admin/notifications')
                ->assertOk()
                ->assertJsonPath('unread_count', 1);

            $items = $res->json('data');
            $this->assertCount(1, $items);
            $this->assertSame($laporanId, $items[0]['id_laporan']);
            $this->assertSame('laporan_baru', $items[0]['jenis_aktivitas']);
            $this->assertSame('Laporan Baru', $items[0]['label_aktivitas']);
            $this->assertSame('Clara Wijaya', $items[0]['nama_pelapor']);
            $this->assertFalse($items[0]['is_read']);
        }

        // Admin di luar cakupan (BPS Kampus 2 & BLU Kampus 1) tidak boleh menerima notifikasi
        $this->withToken($bps2Token)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');

        $this->withToken($blu1Token)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');

        // 2. Pelapor merevisi pengajuan laporan tersebut
        $this->withToken($userToken)
            ->putJson("/api/laporan/{$laporanId}", [
                'deskripsi' => 'Proyektor kelas mati total dan kabel HDMI putus',
                'lokasi'    => 'Kampus I, Ruang K.202',
            ])
            ->assertOk();

        $afterRevise = $this->withToken($bps1Token)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2);

        $bpsItems = $afterRevise->json('data');
        $this->assertCount(2, $bpsItems);
        $this->assertSame('revisi_laporan', $bpsItems[0]['jenis_aktivitas']);
        $this->assertSame('Revisi Pengajuan', $bpsItems[0]['label_aktivitas']);
        $this->assertStringContainsString('lokasi', strtolower($bpsItems[0]['pesan']));
        $this->assertStringContainsString('deskripsi', strtolower($bpsItems[0]['pesan']));
        $this->assertSame('laporan_baru', $bpsItems[1]['jenis_aktivitas']);

        // Pastikan baris notifikasi milik admin BPS 1 benar-benar tersimpan
        $this->assertSame(
            2,
            AdminNotification::where('admin_id', $bps1->admin_id)->count()
        );
    }

    public function test_admin_can_mark_single_and_all_notifications_as_read_with_isolation_and_etag(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [$nim, $userToken] = $this->createUserWithToken('235314702', 'Dimas Pratama');
        [, $blu3Token] = $this->createAdminWithToken('kepala_bagian_blu_3');
        [, $wr2Token] = $this->createAdminWithToken('wakil_rektor_ii');

        $first = $this->withToken($userToken)
            ->postJson('/api/laporan', [
                'nim'              => $nim,
                'kategori_laporan' => 'Kebersihan',
                'deskripsi'        => 'Tempat sampah di koridor penuh',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => 'Kampus 3',
                'lokasi'           => 'Kampus III, Koridor Gedung Drost',
            ])
            ->assertCreated();

        $laporanId = (int) $first->json('data.id_laporan');

        $this->withToken($userToken)
            ->putJson("/api/laporan/{$laporanId}", [
                'deskripsi' => 'Tempat sampah di koridor penuh dan berbau tidak sedap',
            ])
            ->assertOk();

        // Uji ETag 304 Not Modified untuk polling real-time ringan
        $listRes = $this->withToken($blu3Token)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2);

        $etag = $listRes->headers->get('ETag');
        $this->assertNotEmpty($etag);

        $this->withToken($blu3Token)
            ->withHeader('If-None-Match', (string) $etag)
            ->getJson('/api/admin/notifications')
            ->assertStatus(304);

        $bluNotificationId = (int) $listRes->json('data.0.id');

        // WR II tidak boleh menandai notifikasi milik BLU 3 sebagai dibaca (404)
        $this->withToken($wr2Token)
            ->patchJson("/api/admin/notifications/{$bluNotificationId}/read")
            ->assertNotFound();

        // BLU 3 menandai 1 notifikasi sebagai sudah dibaca
        $this->withToken($blu3Token)
            ->patchJson("/api/admin/notifications/{$bluNotificationId}/read")
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.is_read', true);

        // ETag harus berubah setelah status baca diperbarui
        $afterSingleRead = $this->withToken($blu3Token)
            ->withHeader('If-None-Match', (string) $etag)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->assertNotSame($etag, $afterSingleRead->headers->get('ETag'));

        // Tandai semua sebagai sudah dibaca
        $this->withToken($blu3Token)
            ->patchJson('/api/admin/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonPath('updated_count', 1);

        // WR II tetap memiliki 2 notifikasi belum dibaca (terisolasi per admin)
        $this->withToken($wr2Token)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2);
    }

    public function test_deleting_laporan_cascades_related_admin_notifications(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [$nim, $userToken] = $this->createUserWithToken('235314703', 'Eka Putri');
        [, $bps1Token] = $this->createAdminWithToken('kepala_bagian_bps_1');

        $created = $this->withToken($userToken)
            ->postJson('/api/laporan', [
                'nim'              => $nim,
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => 'Kursi kelas patah',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => 'Kampus 1',
                'lokasi'           => 'Kampus I, Ruang K.101',
            ])
            ->assertCreated();

        $laporanId = (int) $created->json('data.id_laporan');
        $this->assertGreaterThan(0, AdminNotification::where('id_laporan', $laporanId)->count());

        // Pelapor menghapus laporannya saat status masih Terkirim -> notifikasi terkait ikut terhapus
        $this->withToken($userToken)
            ->deleteJson("/api/laporan/{$laporanId}")
            ->assertOk();

        $this->assertSame(0, AdminNotification::where('id_laporan', $laporanId)->count());
        $this->withToken($bps1Token)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');
    }
}

