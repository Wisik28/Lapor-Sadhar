<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\Pelapor;
use App\Models\Status;
use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReporterIdentityPriorityTest extends TestCase
{
    use RefreshDatabase;

    private function createMahasiswa(string $nim, string $nama): void
    {
        Pelapor::firstOrCreate(
            ['nomor_identitas' => $nim],
            ['tipe_user' => 'mahasiswa']
        );

        UserMahasiswa::firstOrCreate(
            ['nim' => $nim],
            [
                'nama'         => $nama,
                'email'        => "mhs{$nim}@usd.ac.id",
                'password'     => Hash::make('password123'),
                'no_handphone' => '081234567890',
            ]
        );
    }

    private function createPegawai(string $nip, string $nama): void
    {
        Pelapor::firstOrCreate(
            ['nomor_identitas' => $nip],
            ['tipe_user' => 'karyawan']
        );

        UserPegawai::firstOrCreate(
            ['nomor_identitas' => $nip],
            [
                'nama'         => $nama,
                'email'        => strtolower($nip) . '@usd.ac.id',
                'password'     => Hash::make('password123'),
                'no_handphone' => '081234567891',
            ]
        );
    }

    private function createAdminToken(string $jabatan = 'wakil_rektor_ii'): string
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $plainToken = 'admin-identity-token-' . $jabatan;

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHours(8),
        ]);

        return $plainToken;
    }

    private function createLaporan(string $identifier, string $lokasi): Laporan
    {
        return Laporan::withoutEvents(function () use ($identifier, $lokasi) {
            $lap = Laporan::create([
                'nim'              => $identifier,
                'kategori_laporan' => 'Fasilitas',
                'deskripsi'        => "Kerusakan proyektor di {$lokasi}",
                'tanggal_kejadian' => now()->toDateString(),
                'lokasi_kampus'    => 'Kampus 1',
                'lokasi'           => $lokasi,
                'tanggal_buat'     => now()->subHours(3),
            ]);

            Status::create([
                'id_laporan'      => $lap->id_laporan,
                'status_laporan'  => 'Terkirim',
                'tanggal_merubah' => now()->subHours(3),
            ]);

            return $lap;
        });
    }

    public function test_karyawan_and_mahasiswa_identities_and_names_resolve_across_dashboard_and_priority(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $wr2Token = $this->createAdminToken('wakil_rektor_ii');

        $this->createMahasiswa('225314001', 'Budi Santoso');
        $this->createPegawai('198501012010121001', 'Dr. Antonius Wibowo');
        $this->createPegawai('KARYAWAN001', 'Siti Aminah');

        $lapMhs = $this->createLaporan('225314001', 'Kampus I, Kelas K.101');
        $lapNipLong = $this->createLaporan('198501012010121001', 'Kampus I, Ruang Dosen');
        $lapNipShort = $this->createLaporan('KARYAWAN001', 'Kampus I, Ruang Tata Usaha');

        // 1. Admin dashboard (/api/admin/laporan) resolves all reporter names & tipe_user
        $adminRows = collect(
            $this->withToken($wr2Token)->getJson('/api/admin/laporan')->assertOk()->json('data')
        )->keyBy('id_laporan');

        $this->assertSame('Budi Santoso', $adminRows[$lapMhs->id_laporan]['nama_pelapor']);
        $this->assertSame('mahasiswa', $adminRows[$lapMhs->id_laporan]['tipe_user']);

        $this->assertSame('Dr. Antonius Wibowo', $adminRows[$lapNipLong->id_laporan]['nama_pelapor']);
        $this->assertSame('karyawan', $adminRows[$lapNipLong->id_laporan]['tipe_user']);

        $this->assertSame('Siti Aminah', $adminRows[$lapNipShort->id_laporan]['nama_pelapor']);
        $this->assertSame('karyawan', $adminRows[$lapNipShort->id_laporan]['tipe_user']);

        // 2. Priority dashboard fallback path (before priority:backfill)
        $prioFallback = collect(
            $this->withToken($wr2Token)->getJson('/api/admin/priority/reports')->assertOk()->json('data')
        )->keyBy('id_laporan');

        $this->assertSame('Budi Santoso', $prioFallback[$lapMhs->id_laporan]['nama_pelapor']);
        $this->assertSame('mahasiswa', $prioFallback[$lapMhs->id_laporan]['tipe_user']);

        $this->assertSame('Dr. Antonius Wibowo', $prioFallback[$lapNipLong->id_laporan]['nama_pelapor']);
        $this->assertSame('karyawan', $prioFallback[$lapNipLong->id_laporan]['tipe_user']);

        $this->assertSame('Siti Aminah', $prioFallback[$lapNipShort->id_laporan]['nama_pelapor']);
        $this->assertSame('karyawan', $prioFallback[$lapNipShort->id_laporan]['tipe_user']);

        // Search by staff name & NIP on fallback path
        $searchFallbackByName = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports?search=Antonius')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $searchFallbackByName);
        $this->assertSame($lapNipLong->id_laporan, $searchFallbackByName[0]['id_laporan']);

        $searchFallbackByNip = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports?search=KARYAWAN001')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $searchFallbackByNip);
        $this->assertSame($lapNipShort->id_laporan, $searchFallbackByNip[0]['id_laporan']);

        // 3. Priority dashboard SQL fast path (after priority:backfill)
        $this->artisan('priority:backfill')->assertSuccessful();

        $prioSql = collect(
            $this->withToken($wr2Token)->getJson('/api/admin/priority/reports')->assertOk()->json('data')
        )->keyBy('id_laporan');

        $this->assertSame('Budi Santoso', $prioSql[$lapMhs->id_laporan]['nama_pelapor']);
        $this->assertSame('mahasiswa', $prioSql[$lapMhs->id_laporan]['tipe_user']);

        $this->assertSame('Dr. Antonius Wibowo', $prioSql[$lapNipLong->id_laporan]['nama_pelapor']);
        $this->assertSame('karyawan', $prioSql[$lapNipLong->id_laporan]['tipe_user']);

        $this->assertSame('Siti Aminah', $prioSql[$lapNipShort->id_laporan]['nama_pelapor']);
        $this->assertSame('karyawan', $prioSql[$lapNipShort->id_laporan]['tipe_user']);

        // Search by staff name & NIP on SQL fast path
        $searchSqlByName = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports?search=Siti%20Aminah')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $searchSqlByName);
        $this->assertSame($lapNipShort->id_laporan, $searchSqlByName[0]['id_laporan']);

        $searchSqlByNip = $this->withToken($wr2Token)
            ->getJson('/api/admin/priority/reports?search=198501012010121001')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $searchSqlByNip);
        $this->assertSame($lapNipLong->id_laporan, $searchSqlByNip[0]['id_laporan']);
    }
}
