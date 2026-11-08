<?php

namespace Tests\Feature;

use App\Mail\VerificationCodeMail;
use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\EmailVerificationCode;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_routes_reject_requests_without_a_valid_session(): void
    {
        $this->getJson('/api/admin/me')->assertUnauthorized();
        $this->getJson('/api/admin/laporan')->assertUnauthorized();
    }

    public function test_admin_cannot_use_the_civitas_login_endpoint(): void
    {
        $admin = $this->createAdmin();

        $this->postJson('/api/login', [
            'identifier' => $admin->username,
            'password' => 'Initial-pass-123',
            'role' => 'semua',
        ])->assertUnauthorized();

        $this->postJson('/api/login', [
            'identifier' => $admin->username,
            'password' => 'Initial-pass-123',
            'role' => 'admin',
        ])->assertUnprocessable();
    }

    public function test_admin_seeder_creates_eleven_position_accounts(): void
    {
        $this->app->make(AdminSeeder::class)->run();

        $this->assertDatabaseCount('admin', 11);
        $this->assertDatabaseCount('admin_sessions', 0);

        foreach (array_keys(Admin::POSITIONS) as $position) {
            $this->assertDatabaseHas('admin', [
                'jabatan' => $position,
                'username' => Admin::USERNAMES[$position],
            ]);
        }
        $this->assertDatabaseHas('admin', ['jabatan' => 'kepala_blu', 'email' => 'laporsadhar01@gmail.com']);
        $this->assertDatabaseHas('admin', ['jabatan' => 'kepala_bps', 'email' => 'laporsadhar02@gmail.com']);
    }

    public function test_blu_or_bps_admin_can_login_and_access_their_session(): void
    {
        $admin = $this->createAdmin();

        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertOk()->assertJsonPath('user.role_detail', 'BLU');

        $this->withToken($login->json('token'))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.jabatan', 'kepala_blu');
    }

    public function test_admin_cannot_select_a_position_not_assigned_to_the_account(): void
    {
        $admin = $this->createAdmin();

        $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_bps',
        ])->assertUnauthorized();

        $this->assertDatabaseCount('admin_sessions', 0);
    }

    public function test_wr_ii_admin_has_both_unit_authorizations(): void
    {
        $admin = Admin::create([
            'nama_admin' => 'Wakil Rektor II',
            'username' => 'admin.wakil_rektor_ii',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BOTH',
            'campus' => null,
            'jabatan' => 'wakil_rektor_ii',
        ]);

        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'wakil_rektor_ii',
        ])->assertOk()->assertJsonPath('user.role_detail', 'BOTH');

        $this->withToken($login->json('token'))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.jabatan', 'wakil_rektor_ii');

        $this->withToken($login->json('token'))->putJson('/api/admin/profile', [
            'nama' => 'Nama Pribadi WR II',
            'jabatan' => 'kepala_bps',
            'role' => 'BPS',
        ])->assertOk()
            ->assertJsonPath('user.nama', 'Nama Pribadi WR II')
            ->assertJsonPath('user.jabatan', 'wakil_rektor_ii')
            ->assertJsonPath('user.role_detail', 'BOTH');
    }

    public function test_admin_password_reset_uses_the_email_assigned_to_the_selected_position(): void
    {
        Mail::fake();
        $admin = $this->createAdmin();
        $admin->update(['email' => 'admin.reset@example.com']);

        $this->postJson('/api/admin/password/forgot', [
            'username' => $admin->username,
            'jabatan' => 'kepala_blu',
        ])->assertOk();

        $verification = EmailVerificationCode::latest('id')->firstOrFail();
        Mail::assertSent(VerificationCodeMail::class, fn (VerificationCodeMail $mail): bool => $mail->hasTo('admin.reset@example.com'));
        $sentMail = Mail::sent(VerificationCodeMail::class)->last();

        $this->postJson('/api/admin/password/reset', [
            'username' => $admin->username,
            'jabatan' => 'kepala_blu',
            'code' => $sentMail->code,
            'password' => 'Changed-pass-456',
            'password_confirmation' => 'Changed-pass-456',
        ])->assertOk();

        $this->assertTrue(Hash::check('Changed-pass-456', $admin->fresh()->password));
        $this->assertNotNull($verification->fresh()->consumed_at);
    }

    public function test_admin_email_change_requires_a_code_sent_to_the_old_address(): void
    {
        Mail::fake();
        $admin = $this->createAdmin();
        $admin->update(['email' => 'old.admin@example.com']);
        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertOk();

        $this->withToken($login->json('token'))
            ->postJson('/api/admin/email-change/request', ['new_email' => 'new.admin@example.com'])
            ->assertOk();

        $verification = EmailVerificationCode::where([
            'account_type' => 'admin',
            'account_id' => (string) $admin->admin_id,
            'purpose' => 'email_change',
            'email' => 'old.admin@example.com',
            'target_email' => 'new.admin@example.com',
        ])->firstOrFail();
        Mail::assertSent(VerificationCodeMail::class, fn (VerificationCodeMail $mail): bool => $mail->hasTo('old.admin@example.com'));
        $sentMail = Mail::sent(VerificationCodeMail::class)->last();

        $this->withToken($login->json('token'))
            ->postJson('/api/admin/email-change/confirm', ['code' => $sentMail->code])
            ->assertOk()
            ->assertJsonPath('email', 'new.admin@example.com');

        $this->assertSame('new.admin@example.com', $admin->fresh()->email);
        $this->assertNotNull($verification->fresh()->consumed_at);
    }

    public function test_admin_email_change_rejects_an_email_used_by_another_account(): void
    {
        $admin = $this->createAdmin();
        $otherAdmin = Admin::create([
            'nama_admin' => 'Other Admin',
            'username' => 'other.admin',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BPS',
            'campus' => null,
            'jabatan' => 'kepala_bps',
            'email' => 'existing.admin@example.com',
        ]);
        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertOk();

        $this->withToken($login->json('token'))
            ->postJson('/api/admin/email-change/request', ['new_email' => $otherAdmin->email])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Email tersebut sudah digunakan oleh akun lain.');

        $this->assertDatabaseCount('email_verification_codes', 0);
    }

    public function test_seeder_maps_legacy_admin_accounts_to_requested_usernames_without_changing_passwords(): void
    {
        foreach (['BLU', 'BPS'] as $role) {
            foreach (range(1, 5) as $number) {
                Admin::create([
                    'nama_admin' => "Admin {$role} Kampus {$number}",
                    'username' => strtolower($role).'.kampus'.$number,
                    'password' => Hash::make('Legacy-pass-123'),
                    'role' => $role,
                    'campus' => "Kampus {$number}",
                ]);
            }
        }

        $this->app->make(AdminSeeder::class)->run();

        $this->assertDatabaseCount('admin', 11);
        $admin = Admin::where('username', 'blu.kampus1')->firstOrFail();
        $this->assertSame('kepala_bagian_blu_1', $admin->jabatan);
        $this->assertNull($admin->campus);
        $this->assertTrue(Hash::check('Legacy-pass-123', $admin->password));
    }

    public function test_legacy_admin_username_does_not_work_after_username_migration(): void
    {
        Admin::create([
            'nama_admin' => 'Admin BLU Kampus I',
            'username' => 'admin.kepala_blu',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BLU',
            'campus' => null,
            'jabatan' => 'kepala_blu',
        ]);

        $this->postJson('/api/admin/login', [
            'username' => 'blu.kampus1',
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertUnauthorized();
    }

    public function test_admin_login_requires_the_username_stored_for_the_selected_position(): void
    {
        Admin::create([
            'nama_admin' => 'Admin BLU Kampus I',
            'username' => 'blu.kampus1',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BLU',
            'campus' => null,
            'jabatan' => 'kepala_blu',
        ]);

        $this->postJson('/api/admin/login', [
            'username' => 'kepala.blu',
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertUnauthorized();
    }

    public function test_rotate_credentials_updates_all_eleven_accounts_and_revokes_sessions(): void
    {
        foreach (Admin::POSITIONS as $position => $definition) {
            $admin = Admin::create([
                'nama_admin' => $definition['label'],
                'username' => 'old.'.$position,
                'password' => Hash::make('Legacy-pass-123'),
                'role' => $definition['role'],
                'campus' => null,
                'jabatan' => $position,
            ]);

            AdminSession::create([
                'admin_id' => $admin->admin_id,
                'token_hash' => hash('sha256', 'session-'.$position),
                'expires_at' => now()->addHour(),
            ]);
        }

        $this->artisan('admin:rotate-credentials', ['--yes' => true])
            ->expectsOutputToContain('admin.wr2')
            ->expectsOutputToContain('kepala.blu')
            ->assertExitCode(0);

        foreach (Admin::POSITIONS as $position => $definition) {
            $admin = Admin::where('jabatan', $position)->firstOrFail();

            $this->assertSame(Admin::USERNAMES[$position], $admin->username);
            $this->assertFalse(Hash::check('Legacy-pass-123', $admin->password));
            $this->assertSame(0, $admin->sessions()->count());
        }
    }

    public function test_admin_password_can_be_changed_and_old_password_stops_working(): void
    {
        $admin = $this->createAdmin();
        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertOk();

        $this->withToken($login->json('token'))->putJson('/api/admin/password', [
            'current_password' => 'Initial-pass-123',
            'password' => 'Changed-pass-456',
            'password_confirmation' => 'Changed-pass-456',
        ])->assertOk();

        $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'jabatan' => 'kepala_blu',
        ])->assertUnauthorized();

        $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Changed-pass-456',
            'jabatan' => 'kepala_blu',
        ])->assertOk();
    }

    public function test_legacy_admin_password_reset_changes_only_the_ten_legacy_accounts(): void
    {
        foreach (Admin::POSITIONS as $position => $definition) {
            $admin = Admin::create([
                'nama_admin' => $definition['label'],
                'username' => 'admin.'.$position,
                'password' => Hash::make('Legacy-pass-123'),
                'role' => $definition['role'],
                'campus' => null,
                'jabatan' => $position,
            ]);

            AdminSession::create([
                'admin_id' => $admin->admin_id,
                'token_hash' => hash('sha256', 'session-'.$position),
                'expires_at' => now()->addHour(),
            ]);
        }

        $this->artisan('admin:reset-legacy-passwords')
            ->expectsConfirmation('Reset 10 password admin lama dan keluarkan semua sesi aktif mereka? Password lama tidak akan berlaku lagi.', 'yes')
            ->expectsOutputToContain('admin.kepala_blu')
            ->assertExitCode(0);

        foreach (Admin::POSITIONS as $position => $definition) {
            $admin = Admin::where('jabatan', $position)->firstOrFail();

            if ($position === 'wakil_rektor_ii') {
                $this->assertTrue(Hash::check('Legacy-pass-123', $admin->password));
                $this->assertDatabaseHas('admin_sessions', ['admin_id' => $admin->admin_id]);

                continue;
            }

            $this->assertFalse(Hash::check('Legacy-pass-123', $admin->password));
            $this->assertSame(0, $admin->sessions()->count());
        }

        $this->assertDatabaseCount('admin_sessions', 1);
    }

    private function createAdmin(): Admin
    {
        return Admin::create([
            'nama_admin' => 'Admin BLU Kampus I',
            'username' => 'blu.kampus1',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BLU',
            'campus' => null,
            'jabatan' => 'kepala_blu',
        ]);
    }
}
