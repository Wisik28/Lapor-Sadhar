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

class AdminDeleteRejectedLaporanTest extends TestCase
{
    use RefreshDatabase;

    private function createPelapor(string $nim = '235314600'): string
    {
        Pelapor::firstOrCreate(
            ['nomor_identitas' => $nim],
            ['tipe_user' => 'mahasiswa']
        );

        UserMahasiswa::firstOrCreate(
            ['nim' => $nim],
            [
                'nama'         => 'Mahasiswa Uji Hapus',
                'email'        => "uji{$nim}@usd.ac.id",
                'password'     => Hash::make('password123'),
                'no_handphone' => '081234567890',
            ]
        );

        return $nim;
    }

    private function createAdminToken(string $jabatan): array
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $plainToken = 'admin-delete-token-' . $jabatan;

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHours(8),
        ]);

        return [$admin, $plainToken];
    }

    private function createLaporanWithStatuses(
        string $nim,
        array $statuses,
        string $kategori = 'Fasilitas',
        string $lokasiKampus = 'Kampus 1',
        string $lokasi = 'Kampus I, Gedung Pusat'
    ): Laporan {
        return Laporan::withoutEvents(function () use ($nim, $statuses, $kategori, $lokasiKampus, $lokasi) {
            $laporan = Laporan::create([
                'nim'              => $nim,
                'kategori_laporan' => $kategori,
                'deskripsi'        => 'Pengujian hapus laporan ditolak',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => $lokasiKampus,
                'lokasi'           => $lokasi,
                'tanggal_buat'     => now()->subDay(),
            ]);

            $timestamp = now()->subHours(count($statuses) + 1);
            foreach ($statuses as $index => $statusName) {
                Status::create([
                    'id_laporan'      => $laporan->id_laporan,
                    'status_laporan'  => $statusName,
                    'tanggal_merubah' => $timestamp->copy()->addMinutes($index * 10),
                ]);
            }

            return $laporan;
        });
    }

    public function test_action_admin_can_delete_in_scope_rejected_laporan(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $bpsToken] = $this->createAdminToken('kepala_bagian_bps_1');
        [, $bluToken] = $this->createAdminToken('kepala_bagian_blu_3');
        $nim = $this->createPelapor('235314601');

        $bpsLaporan = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Ditolak'],
            'Fasilitas',
            'Kampus 1',
            'Kampus I, Ruang K.101'
        );

        $bluLaporan = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Sedang Diverifikasi', 'Ditolak'],
            'Kebersihan',
            'Kampus 3',
            'Kampus III, Paingan Lobby'
        );

        $this->withToken($bpsToken)
            ->deleteJson("/api/admin/laporan/{$bpsLaporan->id_laporan}")
            ->assertOk()
            ->assertJson([
                'status' => 'success',
            ]);

        $this->withToken($bluToken)
            ->deleteJson("/api/admin/laporan/{$bluLaporan->id_laporan}")
            ->assertOk()
            ->assertJson([
                'status' => 'success',
            ]);

        $this->assertDatabaseMissing('laporan', ['id_laporan' => $bpsLaporan->id_laporan]);
        $this->assertDatabaseMissing('status', ['id_laporan' => $bpsLaporan->id_laporan]);
        $this->assertDatabaseMissing('laporan', ['id_laporan' => $bluLaporan->id_laporan]);
        $this->assertDatabaseMissing('status', ['id_laporan' => $bluLaporan->id_laporan]);
    }

    public function test_admin_cannot_delete_laporan_with_non_rejected_status(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $token] = $this->createAdminToken('kepala_bagian_bps_1');
        $nim = $this->createPelapor('235314602');

        $disallowedStatuses = [
            ['Terkirim'],
            ['Terkirim', 'Sedang Diverifikasi'],
            ['Terkirim', 'Sedang Diverifikasi', 'Terverifikasi'],
            ['Terkirim', 'Sedang Diverifikasi', 'Terverifikasi', 'Proses'],
            ['Terkirim', 'Sedang Diverifikasi', 'Terverifikasi', 'Proses', 'Selesai'],
        ];

        foreach ($disallowedStatuses as $sequence) {
            $laporan = $this->createLaporanWithStatuses(
                $nim,
                $sequence,
                'Fasilitas',
                'Kampus 1',
                'Kampus I, Ruang K.102'
            );

            $this->withToken($token)
                ->deleteJson("/api/admin/laporan/{$laporan->id_laporan}")
                ->assertForbidden()
                ->assertJson([
                    'status' => 'error',
                ]);

            $this->assertDatabaseHas('laporan', ['id_laporan' => $laporan->id_laporan]);
        }
    }

    public function test_out_of_scope_admin_cannot_delete_rejected_laporan(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $bpsKampus2Token] = $this->createAdminToken('kepala_bagian_bps_2');
        [, $bluKampus1Token] = $this->createAdminToken('kepala_bagian_blu_1');
        $nim = $this->createPelapor('235314603');

        $laporan = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Ditolak'],
            'Fasilitas',
            'Kampus 1',
            'Kampus I, Ruang K.103'
        );

        $this->withToken($bpsKampus2Token)
            ->deleteJson("/api/admin/laporan/{$laporan->id_laporan}")
            ->assertForbidden();

        $this->withToken($bluKampus1Token)
            ->deleteJson("/api/admin/laporan/{$laporan->id_laporan}")
            ->assertForbidden();

        $this->assertDatabaseHas('laporan', ['id_laporan' => $laporan->id_laporan]);
    }

    public function test_read_only_admins_cannot_delete_rejected_laporan(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $nim = $this->createPelapor('235314604');

        $laporan = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Ditolak'],
            'Fasilitas',
            'Kampus 1',
            'Kampus I, Ruang K.104'
        );

        foreach (['wakil_rektor_ii', 'kepala_bps', 'kepala_blu'] as $jabatan) {
            [, $token] = $this->createAdminToken($jabatan);

            $this->withToken($token)
                ->deleteJson("/api/admin/laporan/{$laporan->id_laporan}")
                ->assertForbidden();
        }

        $this->assertDatabaseHas('laporan', ['id_laporan' => $laporan->id_laporan]);
    }

    public function test_deleting_nonexistent_laporan_returns_404(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $token] = $this->createAdminToken('kepala_bagian_bps_1');

        $this->withToken($token)
            ->deleteJson('/api/admin/laporan/999999')
            ->assertNotFound();
    }

    public function test_bps_and_blu_admins_cannot_follow_up_rejected_laporan(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $bpsToken] = $this->createAdminToken('kepala_bagian_bps_1');
        [, $bluToken] = $this->createAdminToken('kepala_bagian_blu_3');
        $nim = $this->createPelapor('235314605');

        $bpsRejected = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Ditolak'],
            'Fasilitas',
            'Kampus 1',
            'Kampus I, Ruang K.105'
        );

        $bluRejected = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Sedang Diverifikasi', 'Ditolak'],
            'Kebersihan',
            'Kampus 3',
            'Kampus III, Paingan Taman'
        );

        foreach (
            [
                [$bpsToken, $bpsRejected->id_laporan],
                [$bluToken, $bluRejected->id_laporan],
            ] as [$token, $idLaporan]
        ) {
            $this->withToken($token)
                ->patchJson("/api/admin/laporan/{$idLaporan}/status", [
                    'status_laporan'  => 'Proses',
                    'pesan_tanggapan' => 'Mencoba tindak lanjut ulang',
                ])
                ->assertForbidden();

            $this->withToken($token)
                ->patchJson("/api/admin/laporan/{$idLaporan}/status", [
                    'status_laporan'  => 'Ditolak',
                    'pesan_tanggapan' => 'Mengubah catatan laporan ditolak',
                ])
                ->assertForbidden();

            $this->withToken($token)
                ->patchJson("/api/admin/priority/reports/{$idLaporan}/severity", [
                    'severity_level' => 'berat',
                    'admin_notes'    => 'Mencoba ubah prioritas laporan ditolak',
                ])
                ->assertForbidden();

            $this->withToken($token)
                ->patchJson("/api/admin/laporan/{$idLaporan}/kategori", [
                    'kategori_laporan' => $idLaporan === $bpsRejected->id_laporan ? 'Kebersihan' : 'Fasilitas',
                ])
                ->assertUnprocessable();
        }
    }

    public function test_status_follow_up_lock_applies_only_when_current_status_is_ditolak(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $bpsToken] = $this->createAdminToken('kepala_bagian_bps_1');
        $nim = $this->createPelapor('235314606');

        $selesaiLaporan = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim', 'Proses', 'Selesai'],
            'Fasilitas',
            'Kampus 1',
            'Kampus I, Ruang K.106'
        );

        $this->withToken($bpsToken)
            ->patchJson("/api/admin/laporan/{$selesaiLaporan->id_laporan}/status", [
                'status_laporan'  => 'Selesai',
                'pesan_tanggapan' => 'Catatan selesai diperbarui.',
            ])
            ->assertOk();

        $terkirimLaporan = $this->createLaporanWithStatuses(
            $nim,
            ['Terkirim'],
            'Fasilitas',
            'Kampus 1',
            'Kampus I, Ruang K.107'
        );

        $this->withToken($bpsToken)
            ->patchJson("/api/admin/laporan/{$terkirimLaporan->id_laporan}/status", [
                'status_laporan'  => 'Ditolak',
                'pesan_tanggapan' => 'Ditolak karena duplikat.',
            ])
            ->assertOk();

        // Setelah menjadi Ditolak, tindak lanjut berikutnya harus ditolak 403
        $this->withToken($bpsToken)
            ->patchJson("/api/admin/laporan/{$terkirimLaporan->id_laporan}/status", [
                'status_laporan'  => 'Sedang Diverifikasi',
                'pesan_tanggapan' => 'Coba aktifkan kembali',
            ])
            ->assertForbidden();
    }
}

