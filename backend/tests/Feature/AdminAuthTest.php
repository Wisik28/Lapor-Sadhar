<?php

namespace Tests\Feature;

use App\Mail\VerificationCodeMail;
use App\Models\Admin;
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
            $this->assertDatabaseHas('admin', ['jabatan' => $position]);
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

    public function test_seeder_remaps_legacy_admin_accounts_without_changing_their_passwords(): void
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
        $admin = Admin::where('username', 'admin.kepala_bagian_blu_1')->firstOrFail();
        $this->assertSame('kepala_bagian_blu_1', $admin->jabatan);
        $this->assertNull($admin->campus);
        $this->assertTrue(Hash::check('Legacy-pass-123', $admin->password));
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
