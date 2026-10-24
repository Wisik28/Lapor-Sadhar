<?php

namespace Tests\Feature;

use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use Database\Seeders\UserMahasiswaSeeder;
use Database\Seeders\UserPegawaiSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_registration_saves_account_in_student_table(): void
    {
        $this->postJson('/api/register', [
            'tipe_user' => 'mahasiswa',
            'nomor_identitas' => '225314100',
            'nama' => 'Mahasiswa Tes',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()
            ->assertJsonPath('user.tipe_user', 'mahasiswa');

        $student = UserMahasiswa::findOrFail('225314100');

        $this->assertDatabaseHas('pelapor', [
            'nomor_identitas' => '225314100',
            'tipe_user' => 'mahasiswa',
        ]);
        $this->assertDatabaseMissing('user_pegawai', ['nomor_identitas' => '225314100']);
        $this->assertTrue(Hash::check('password123', $student->password));

        $this->postJson('/api/login', [
            'identifier' => $student->nim,
            'password' => 'password123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'Mahasiswa');
    }

    public function test_pegawai_registration_saves_account_in_pegawai_table_and_keeps_reports_linked(): void
    {
        $this->postJson('/api/register', [
            'tipe_user' => 'karyawan',
            'nomor_identitas' => '198501012010121001',
            'nama' => 'Pegawai Tes',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()
            ->assertJsonPath('user.tipe_user', 'karyawan');

        $pegawai = UserPegawai::findOrFail('198501012010121001');

        $this->assertDatabaseMissing('user_mahasiswa', ['nim' => '198501012010121001']);
        $this->assertTrue(Hash::check('password123', $pegawai->password));

        $this->postJson('/api/login', [
            'identifier' => $pegawai->nomor_identitas,
            'password' => 'password123',
            'role' => 'semua',
        ])->assertOk()
            ->assertJsonPath('user.role', 'Karyawan');

        $this->postJson('/api/login', [
            'identifier' => $pegawai->nomor_identitas,
            'password' => 'password123',
            'role' => 'mahasiswa',
        ])->assertUnauthorized();

        $report = $this->postJson('/api/laporan', [
            'nim' => $pegawai->nomor_identitas,
            'kategori_laporan' => 'Fasilitas',
            'deskripsi' => 'Kerusakan fasilitas ruang kerja.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi' => 'Ruang Kerja',
        ])->assertCreated();

        $this->getJson('/api/laporan/'.$report->json('data.id_laporan'))
            ->assertOk()
            ->assertJsonPath('data.nama_pelapor', 'Pegawai Tes');
    }

    public function test_registration_rejects_an_identifier_already_used_by_another_user_type(): void
    {
        $this->postJson('/api/register', [
            'tipe_user' => 'mahasiswa',
            'nomor_identitas' => 'SHARED-ID',
            'nama' => 'Mahasiswa Tes',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->postJson('/api/register', [
            'tipe_user' => 'karyawan',
            'nomor_identitas' => 'SHARED-ID',
            'nama' => 'Pegawai Tes',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(409);
    }

    public function test_seeders_keep_student_and_pegawai_accounts_in_separate_tables(): void
    {
        $this->seed([UserMahasiswaSeeder::class, UserPegawaiSeeder::class]);

        $this->assertDatabaseCount('user_mahasiswa', 3);
        $this->assertDatabaseCount('user_pegawai', 2);
        $this->assertDatabaseHas('pelapor', [
            'nomor_identitas' => 'KARYAWAN001',
            'tipe_user' => 'karyawan',
        ]);
    }

    public function test_existing_pegawai_accounts_and_reports_survive_the_table_migration(): void
    {
        $identifier = 'LEGACY-PEGAWAI';
        $now = now();

        DB::table('pelapor')->insert([
            'nomor_identitas' => $identifier,
            'tipe_user' => 'karyawan',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('user_pegawai')->insert([
            'nomor_identitas' => $identifier,
            'nama' => 'Pegawai Lama',
            'password' => Hash::make('password123'),
            'no_handphone' => '081234567890',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('laporan')->insert([
            'nim' => $identifier,
            'kategori_laporan' => 'Fasilitas',
            'tanggal_buat' => $now,
            'deskripsi' => 'Laporan pegawai sebelum pemisahan akun.',
            'tanggal_kejadian' => $now,
            'lokasi' => 'Ruang Kerja',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $migration = require database_path('migrations/2026_10_24_025742_split_pegawai_accounts_from_user_mahasiswa.php');
        $migration->down();

        $this->assertDatabaseHas('user_mahasiswa', [
            'nim' => $identifier,
            'tipe_user' => 'karyawan',
        ]);
        $this->assertDatabaseHas('laporan', ['nim' => $identifier]);

        $migration->up();

        $this->assertDatabaseMissing('user_mahasiswa', ['nim' => $identifier]);
        $this->assertDatabaseHas('user_pegawai', ['nomor_identitas' => $identifier]);
        $this->assertDatabaseHas('laporan', ['nim' => $identifier]);

        $this->getJson('/api/laporan/1')
            ->assertOk()
            ->assertJsonPath('data.nama_pelapor', 'Pegawai Lama');
    }
}
