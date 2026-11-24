<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\Pelapor;
use App\Models\Priority\PriorityAssessment;
use App\Models\Status;
use App\Models\UserMahasiswa;
use App\Models\UserSession;
use Carbon\Carbon;
use Database\Seeders\AdminSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditRemediationTest extends TestCase
{
    use RefreshDatabase;

    private function createUserWithSession(string $nim = '235314500', string $email = 'uji500@usd.ac.id'): array
    {
        Pelapor::create([
            'nomor_identitas' => $nim,
            'tipe_user'       => 'mahasiswa',
        ]);

        UserMahasiswa::create([
            'nim'          => $nim,
            'nama'         => 'Mahasiswa Uji Audit',
            'email'        => $email,
            'password'     => Hash::make('password123'),
            'no_handphone' => '081234567890',
        ]);

        $plainToken = 'user-audit-token-' . $nim;
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id'   => $nim,
            'token_hash'   => hash('sha256', $plainToken),
            'expires_at'   => now()->addHours(12),
        ]);

        return [$nim, $plainToken];
    }

    private function createAdminToken(string $jabatan): array
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $plainToken = 'admin-audit-token-' . $jabatan;

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHours(8),
        ]);

        return [$admin, $plainToken];
    }

    public function test_status_table_has_latest_lookup_composite_index(): void
    {
        $indexes = Schema::getIndexes('status');
        $names = array_column($indexes, 'name');

        $this->assertContains('status_laporan_latest_idx', $names);
    }

    public function test_priority_get_endpoints_are_strictly_read_only_and_backfill_persists(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $wr2Token] = $this->createAdminToken('wakil_rektor_ii');
        [$nim] = $this->createUserWithSession('235314501', 'uji501@usd.ac.id');

        $laporan = Laporan::withoutEvents(function () use ($nim) {
            $lap = Laporan::create([
                'nim'              => $nim,
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => 'Kabel listrik terbuka dan berbau gosong di ruang kelas',
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => 'Kampus 3',
                'lokasi'           => 'Kampus III, Ruang K.205',
                'tanggal_buat'     => now()->subDay(),
            ]);

            Status::create([
                'id_laporan'      => $lap->id_laporan,
                'status_laporan'  => 'Terkirim',
                'tanggal_merubah' => now()->subDay(),
            ]);

            return $lap;
        });

        $this->assertDatabaseCount('priority_assessments', 0);

        // Semua endpoint GET prioritas harus murni read-only tanpa menulis ke priority_assessments
        $listRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports')
            ->assertOk();
        $this->assertCount(1, $listRes->json('data'));
        $this->assertDatabaseCount('priority_assessments', 0);

        $summaryRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/summary')
            ->assertOk();
        $this->assertSame($listRes->json('summary'), $summaryRes->json('data'));
        $this->assertDatabaseCount('priority_assessments', 0);

        $this->withToken($wr2Token)
            ->getJson("/api/admin/priority/reports/{$laporan->id_laporan}")
            ->assertOk();
        $this->assertDatabaseCount('priority_assessments', 0);

        // Command backfill mengisi tabel priority_assessments secara offline
        $this->artisan('priority:backfill')->assertSuccessful();
        $this->assertDatabaseCount('priority_assessments', 1);

        // Setelah terisi, jalur cepat SQL mengembalikan data & summary yang konsisten
        $sqlListRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports?page=1&per_page=500&kategori=Fasilitas&search=gosong')
            ->assertOk();
        $this->assertSame(100, $sqlListRes->json('per_page'));
        $this->assertCount(1, $sqlListRes->json('data'));

        $sqlSummaryRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/summary')
            ->assertOk();
        $this->assertSame($sqlListRes->json('summary'), $sqlSummaryRes->json('data'));
    }

    public function test_admin_laporan_clamps_per_page_supports_include_foto_false_and_rekap_returns_latest_reports(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $wr2Token] = $this->createAdminToken('wakil_rektor_ii');
        [$nim, $userToken] = $this->createUserWithSession('235314502', 'uji502@usd.ac.id');

        for ($i = 1; $i <= 6; $i++) {
            $this->withToken($userToken)->postJson('/api/laporan', [
                'nim'              => $nim,
                'kategori_laporan' => $i % 2 === 0 ? 'Kebersihan' : 'Fasilitas',
                'deskripsi'        => "Laporan uji ke-{$i}",
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => 'Kampus 1',
                'lokasi'           => "Kampus I, Ruang {$i}",
                'foto'             => "https://example.com/foto-{$i}.jpg",
            ])->assertCreated();
        }

        // per_page dibatasi maksimal 100 dan include_foto=0 meniadakan payload foto
        $lightRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/laporan?page=1&per_page=999&include_foto=0')
            ->assertOk();
        $this->assertSame(100, $lightRes->json('per_page'));
        $this->assertCount(6, $lightRes->json('data'));
        foreach ($lightRes->json('data') as $row) {
            $this->assertNull($row['foto']);
        }

        // Default tetap mengembalikan foto untuk kompatibilitas UI
        $fullRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/laporan?page=1&per_page=2')
            ->assertOk();
        $this->assertSame(2, $fullRes->json('per_page'));
        $this->assertCount(2, $fullRes->json('data'));
        $this->assertNotNull($fullRes->json('data.0.foto'));

        // Rekap menyertakan tepat 5 laporan terbaru tanpa kolom foto
        $rekapRes = $this->withToken($wr2Token)
            ->getJson('/api/admin/rekap')
            ->assertOk();
        $this->assertSame(6, $rekapRes->json('data.total_laporan'));
        $latest = $rekapRes->json('data.laporan_terbaru');
        $this->assertIsArray($latest);
        $this->assertCount(5, $latest);
        $this->assertArrayNotHasKey('foto', $latest[0]);
        $this->assertArrayHasKey('deskripsi', $latest[0]);
        $this->assertArrayHasKey('status_terkini', $latest[0]);
    }

    public function test_user_laporan_index_supports_etag_and_304_not_modified(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $bps1Token] = $this->createAdminToken('kepala_bagian_bps_1');
        [$nim, $userToken] = $this->createUserWithSession('235314503', 'uji503@usd.ac.id');

        $created = $this->withToken($userToken)->postJson('/api/laporan', [
            'nim'              => $nim,
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Proyektor mati di kelas',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Kelas 102',
        ])->assertCreated();
        $laporanId = $created->json('data.id_laporan');

        $firstRes = $this->withToken($userToken)->getJson('/api/laporan')->assertOk();
        $etag = $firstRes->headers->get('ETag');
        $this->assertNotEmpty($etag);

        // Permintaan ulang dengan ETag yang sama mengembalikan 304 Not Modified
        $this->withToken($userToken)
            ->withHeader('If-None-Match', $etag)
            ->getJson('/api/laporan')
            ->assertStatus(304)
            ->assertHeader('ETag', $etag);

        // Setelah status berubah oleh admin, ETag berubah dan mengembalikan 200 OK
        $this->withToken($bps1Token)
            ->patchJson("/api/admin/laporan/{$laporanId}/status", [
                'status_laporan' => 'Sedang Diverifikasi',
            ])
            ->assertOk();

        $afterUpdate = $this->withToken($userToken)
            ->withHeader('If-None-Match', $etag)
            ->getJson('/api/laporan')
            ->assertOk();
        $newEtag = $afterUpdate->headers->get('ETag');
        $this->assertNotEmpty($newEtag);
        $this->assertNotSame($etag, $newEtag);
    }

    public function test_auth_endpoints_return_synchronized_expires_at(): void
    {
        $this->app->make(AdminSeeder::class)->run();

        // Admin login & /me -> 8 jam
        $admin = Admin::where('jabatan', 'wakil_rektor_ii')->firstOrFail();
        $admin->update(['password' => Hash::make('AdminRahasia123!')]);

        $adminLogin = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'AdminRahasia123!',
            'jabatan'  => $admin->jabatan,
        ])->assertOk();

        $adminExpiresAt = $adminLogin->json('expires_at');
        $this->assertNotEmpty($adminExpiresAt);
        $adminToken = $adminLogin->json('token');

        $adminMe = $this->withToken($adminToken)->getJson('/api/admin/me')->assertOk();
        $this->assertSame($adminExpiresAt, $adminMe->json('expires_at'));
        $this->assertGreaterThan(7 * 60, now()->diffInMinutes(Carbon::parse($adminExpiresAt)));

        // User register, login & /profile/me -> 12 jam
        $registerRes = $this->postJson('/api/register', [
            'tipe_user'             => 'mahasiswa',
            'nomor_identitas'       => '235314504',
            'nama'                  => 'Pelapor Sesi',
            'email'                 => 'uji504@usd.ac.id',
            'no_handphone'          => '081234567891',
            'password'              => 'secret123',
            'password_confirmation' => 'secret123',
        ])->assertCreated();

        $regExpiresAt = $registerRes->json('expires_at');
        $this->assertNotEmpty($regExpiresAt);
        $this->assertGreaterThan(11 * 60, now()->diffInMinutes(Carbon::parse($regExpiresAt)));

        $userMe = $this->withToken($registerRes->json('token'))
            ->getJson('/api/profile/me')
            ->assertOk();
        $this->assertSame($regExpiresAt, $userMe->json('expires_at'));

        $loginRes = $this->postJson('/api/login', [
            'identifier' => '235314504',
            'password'   => 'secret123',
        ])->assertOk();
        $this->assertNotEmpty($loginRes->json('expires_at'));
    }

    public function test_admin_report_reads_persists_per_admin_and_enforces_scope(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        [, $bps1Token] = $this->createAdminToken('kepala_bagian_bps_1');
        [, $wr2Token] = $this->createAdminToken('wakil_rektor_ii');
        [$nim, $userToken] = $this->createUserWithSession('235314505', 'uji505@usd.ac.id');

        $k1Fas = $this->withToken($userToken)->postJson('/api/laporan', [
            'nim'              => $nim,
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kursi rusak Kampus 1',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang 101',
        ])->assertCreated()->json('data.id_laporan');

        $k2Keb = $this->withToken($userToken)->postJson('/api/laporan', [
            'nim'              => $nim,
            'kategori_laporan' => 'Kebersihan',
            'deskripsi'        => 'Sampah menumpuk Kampus 2',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Kampus II, Lorong',
        ])->assertCreated()->json('data.id_laporan');

        // BPS 1 bisa menandai laporan dalam cakupannya (idempoten) dan melihatnya kembali
        $this->withToken($bps1Token)->postJson("/api/admin/laporan/{$k1Fas}/seen")->assertOk();
        $this->withToken($bps1Token)->postJson("/api/admin/laporan/{$k1Fas}/seen")->assertOk();
        $this->assertSame([$k1Fas], $this->withToken($bps1Token)->getJson('/api/admin/laporan/seen')->assertOk()->json('data'));

        // BPS 1 dilarang menandai laporan di luar kampus/unitnya
        $this->withToken($bps1Token)->postJson("/api/admin/laporan/{$k2Keb}/seen")->assertForbidden();

        // Admin read-only (WR II) tetap dapat menandai laporan sebagai sudah dibaca di semua cakupan
        $this->withToken($wr2Token)->postJson("/api/admin/laporan/{$k2Keb}/seen")->assertOk();
        $this->assertSame([$k2Keb], $this->withToken($wr2Token)->getJson('/api/admin/laporan/seen')->assertOk()->json('data'));
    }

    public function test_pelapor_delete_is_restricted_when_laporan_exists_and_admin_delete_nulls_priority_admin_id(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON');
        }

        $this->app->make(AdminSeeder::class)->run();
        $admin = Admin::where('jabatan', 'kepala_bagian_bps_1')->firstOrFail();
        [$nim, $userToken] = $this->createUserWithSession('235314506', 'uji506@usd.ac.id');

        $laporanId = $this->withToken($userToken)->postJson('/api/laporan', [
            'nim'              => $nim,
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Pintu kelas macet',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang 105',
        ])->assertCreated()->json('data.id_laporan');

        // FK laporan.nim -> pelapor.nomor_identitas harus RESTRICT (menolak penghapusan pelapor yang memiliki laporan)
        $threwRestrict = false;
        try {
            DB::table('pelapor')->where('nomor_identitas', $nim)->delete();
        } catch (QueryException) {
            $threwRestrict = true;
        }
        $this->assertTrue($threwRestrict, 'Menghapus pelapor yang masih memiliki laporan harus ditolak oleh ON DELETE RESTRICT.');
        $this->assertDatabaseHas('laporan', ['id_laporan' => $laporanId]);

        // FK priority_assessments.admin_id -> admin.admin_id harus ON DELETE SET NULL
        PriorityAssessment::where('id_laporan', $laporanId)->update(['admin_id' => $admin->admin_id]);
        DB::table('admin')->where('admin_id', $admin->admin_id)->delete();

        $this->assertDatabaseHas('priority_assessments', [
            'id_laporan' => $laporanId,
            'admin_id'   => null,
        ]);
    }
}

