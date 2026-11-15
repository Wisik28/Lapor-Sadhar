<?php

namespace Tests\Feature;

use App\Mail\VerificationCodeMail;
use App\Models\EmailVerificationCode;
use App\Models\Pelapor;
use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use App\Models\UserSession;
use Database\Seeders\UserMahasiswaSeeder;
use Database\Seeders\UserPegawaiSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
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
            'email' => 'mahasiswa.tes@example.com',
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
            'email' => 'pegawai.tes@example.com',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()
            ->assertJsonPath('user.tipe_user', 'karyawan');

        $pegawai = UserPegawai::findOrFail('198501012010121001');

        $this->assertDatabaseMissing('user_mahasiswa', ['nim' => '198501012010121001']);
        $this->assertTrue(Hash::check('password123', $pegawai->password));

        $login = $this->postJson('/api/login', [
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

        $report = $this->withToken($login->json('token'))->postJson('/api/laporan', [
            'nim' => $pegawai->nomor_identitas,
            'kategori_laporan' => 'Fasilitas',
            'deskripsi' => 'Kerusakan fasilitas ruang kerja.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi' => 'Ruang Kerja',
        ])->assertCreated();

        $this->withToken($login->json('token'))->getJson('/api/laporan/'.$report->json('data.id_laporan'))
            ->assertOk()
            ->assertJsonPath('data.nama_pelapor', 'Pegawai Tes');
    }

    public function test_registration_rejects_an_identifier_already_used_by_another_user_type(): void
    {
        $this->postJson('/api/register', [
            'tipe_user' => 'mahasiswa',
            'nomor_identitas' => 'SHARED-ID',
            'nama' => 'Mahasiswa Tes',
            'email' => 'mahasiswa.shared@example.com',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->postJson('/api/register', [
            'tipe_user' => 'karyawan',
            'nomor_identitas' => 'SHARED-ID',
            'nama' => 'Pegawai Tes',
            'email' => 'pegawai.shared@example.com',
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

        UserSession::create([
            'account_type' => 'karyawan',
            'account_id' => $identifier,
            'token_hash' => hash('sha256', 'pegawai-migration-token'),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken('pegawai-migration-token')
            ->getJson('/api/laporan/1')
            ->assertOk()
            ->assertJsonPath('data.nama_pelapor', 'Pegawai Lama');
    }

    public function test_registered_email_can_request_and_complete_a_password_reset(): void
    {
        Mail::fake();

        $this->postJson('/api/register', [
            'tipe_user' => 'mahasiswa',
            'nomor_identitas' => 'RESET-USER',
            'nama' => 'Mahasiswa Reset',
            'email' => 'reset.user@example.com',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->postJson('/api/password/forgot', ['email' => 'reset.user@example.com'])->assertOk();
        $verification = EmailVerificationCode::latest('id')->firstOrFail();
        Mail::assertSent(VerificationCodeMail::class, fn (VerificationCodeMail $mail): bool => $mail->hasTo('reset.user@example.com'));
        $sentMail = Mail::sent(VerificationCodeMail::class)->last();

        $this->postJson('/api/password/reset', [
            'email' => 'reset.user@example.com',
            'code' => '000000',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertUnprocessable();

        $this->postJson('/api/password/reset', [
            'email' => 'reset.user@example.com',
            'code' => $sentMail->code,
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-password', UserMahasiswa::findOrFail('RESET-USER')->password));
        $this->assertNotNull($verification->fresh()->consumed_at);
    }

    public function test_email_change_requires_a_code_sent_to_the_old_address(): void
    {
        Mail::fake();

        $this->postJson('/api/register', [
            'tipe_user' => 'mahasiswa',
            'nomor_identitas' => 'EMAIL-USER',
            'nama' => 'Mahasiswa Email',
            'email' => 'old.email@example.com',
            'no_handphone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $login = $this->postJson('/api/login', [
            'identifier' => 'EMAIL-USER',
            'password' => 'password123',
        ])->assertOk();

        $this->withToken($login->json('token'))
            ->postJson('/api/profile/email-change/request', ['new_email' => 'new.email@example.com'])
            ->assertOk();

        $verification = EmailVerificationCode::where([
            'account_id' => 'EMAIL-USER',
            'purpose' => 'email_change',
            'email' => 'old.email@example.com',
            'target_email' => 'new.email@example.com',
        ])->firstOrFail();
        Mail::assertSent(VerificationCodeMail::class, fn (VerificationCodeMail $mail): bool => $mail->hasTo('old.email@example.com'));
        $sentMail = Mail::sent(VerificationCodeMail::class)->last();

        $this->withToken($login->json('token'))
            ->postJson('/api/profile/email-change/confirm', ['code' => $sentMail->code])
            ->assertOk()
            ->assertJsonPath('email', 'new.email@example.com');

        $this->assertSame('new.email@example.com', UserMahasiswa::findOrFail('EMAIL-USER')->email);
    }

    public function test_legacy_user_without_an_email_can_verify_an_initial_email(): void
    {
        Mail::fake();
        $identifier = 'LEGACY-EMAIL';
        Pelapor::create(['nomor_identitas' => $identifier, 'tipe_user' => 'mahasiswa']);
        UserMahasiswa::create([
            'nim' => $identifier,
            'nama' => 'Pengguna Lama',
            'email' => null,
            'password' => Hash::make('password123'),
            'no_handphone' => '081234567890',
        ]);
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id' => $identifier,
            'token_hash' => hash('sha256', 'legacy-session-token'),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken('legacy-session-token')
            ->postJson('/api/profile/email-change/request', ['new_email' => 'first.email@example.com'])
            ->assertOk();

        Mail::assertSent(VerificationCodeMail::class, fn (VerificationCodeMail $mail): bool => $mail->hasTo('first.email@example.com'));
        $sentMail = Mail::sent(VerificationCodeMail::class)->last();

        $this->withToken('legacy-session-token')
            ->postJson('/api/profile/email-change/confirm', ['code' => $sentMail->code])
            ->assertOk()
            ->assertJsonPath('email', 'first.email@example.com');

        $this->assertSame('first.email@example.com', UserMahasiswa::findOrFail($identifier)->email);
    }

    public function test_user_can_view_profile_me(): void
    {
        $identifier = '225314999';
        Pelapor::create(['nomor_identitas' => $identifier, 'tipe_user' => 'mahasiswa']);
        $user = UserMahasiswa::create([
            'nim' => $identifier,
            'nama' => 'Profil User',
            'email' => 'profil@example.com',
            'no_handphone' => '081234567890',
            'password' => Hash::make('password123'),
        ]);
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id' => $identifier,
            'token_hash' => hash('sha256', 'profile-test-token'),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken('profile-test-token')
            ->getJson('/api/profile/me')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('user.nama', 'Profil User')
            ->assertJsonPath('user.no_handphone', '081234567890')
            ->assertJsonPath('user.email', 'profil@example.com');
    }

    public function test_user_can_update_phone_number_and_email_directly(): void
    {
        $identifier = '225314888';
        Pelapor::create(['nomor_identitas' => $identifier, 'tipe_user' => 'mahasiswa']);
        $user = UserMahasiswa::create([
            'nim' => $identifier,
            'nama' => 'Update User',
            'email' => 'old@example.com',
            'no_handphone' => '0811111111',
            'password' => Hash::make('password123'),
        ]);
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id' => $identifier,
            'token_hash' => hash('sha256', 'update-test-token'),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken('update-test-token')
            ->putJson('/api/profile', [
                'no_handphone' => '0899999999',
                'email' => 'newdirect@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('user.no_handphone', '0899999999')
            ->assertJsonPath('user.email', 'newdirect@example.com');

        $user->refresh();
        $this->assertSame('0899999999', $user->no_handphone);
        $this->assertSame('newdirect@example.com', $user->email);
    }

    public function test_user_cannot_update_email_to_another_users_email(): void
    {
        $identifier1 = '225314771';
        $identifier2 = '225314772';
        Pelapor::create(['nomor_identitas' => $identifier1, 'tipe_user' => 'mahasiswa']);
        Pelapor::create(['nomor_identitas' => $identifier2, 'tipe_user' => 'mahasiswa']);
        UserMahasiswa::create([
            'nim' => $identifier1,
            'nama' => 'User One',
            'email' => 'taken@example.com',
            'no_handphone' => '0811111111',
            'password' => Hash::make('password123'),
        ]);
        UserMahasiswa::create([
            'nim' => $identifier2,
            'nama' => 'User Two',
            'email' => 'two@example.com',
            'no_handphone' => '0822222222',
            'password' => Hash::make('password123'),
        ]);
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id' => $identifier2,
            'token_hash' => hash('sha256', 'dup-test-token'),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken('dup-test-token')
            ->putJson('/api/profile', [
                'email' => 'taken@example.com',
            ])
            ->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_user_can_change_password(): void
    {
        $identifier = '225314666';
        Pelapor::create(['nomor_identitas' => $identifier, 'tipe_user' => 'mahasiswa']);
        $user = UserMahasiswa::create([
            'nim' => $identifier,
            'nama' => 'Password User',
            'email' => 'pwd@example.com',
            'no_handphone' => '081234567890',
            'password' => Hash::make('oldpassword'),
        ]);
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id' => $identifier,
            'token_hash' => hash('sha256', 'pwd-test-token'),
            'expires_at' => now()->addHour(),
        ]);

        // Wrong current password
        $this->withToken('pwd-test-token')
            ->putJson('/api/profile/password', [
                'current_password' => 'wrongpass',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ])
            ->assertStatus(422);

        // Success
        $this->withToken('pwd-test-token')
            ->putJson('/api/profile/password', [
                'current_password' => 'oldpassword',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $user->refresh();
        $this->assertTrue(Hash::check('newpassword123', $user->password));

        // Can login with new password
        $this->postJson('/api/login', [
            'identifier' => $identifier,
            'password' => 'newpassword123',
        ])->assertOk();
    }
}
