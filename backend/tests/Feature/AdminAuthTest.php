<?php

namespace Tests\Feature;

use App\Models\Admin;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_routes_reject_requests_without_a_valid_session(): void
    {
        $this->getJson('/api/admin/me')->assertUnauthorized();
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

    public function test_admin_seeder_creates_two_admin_accounts_for_each_of_five_campuses(): void
    {
        $this->app->make(AdminSeeder::class)->run();

        $this->assertDatabaseCount('admin', 10);
        $this->assertDatabaseCount('admin_sessions', 0);

        foreach (['BLU', 'BPS'] as $role) {
            foreach (['Kampus I', 'Kampus II', 'Kampus III', 'Kampus IV', 'Kampus V'] as $campus) {
                $this->assertDatabaseHas('admin', [
                    'role' => $role,
                    'campus' => $campus,
                ]);
            }
        }
    }

    public function test_blu_or_bps_admin_can_login_and_access_their_session(): void
    {
        $admin = $this->createAdmin();

        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'role' => 'BLU',
            'campus' => 'Kampus I',
        ])->assertOk()->assertJsonPath('user.role_detail', 'BLU');

        $this->withToken($login->json('token'))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.campus', 'Kampus I');
    }

    public function test_campus_five_admin_can_login_and_access_their_session(): void
    {
        $admin = Admin::create([
            'nama_admin' => 'Admin BLU Kampus V',
            'username' => 'blu.kampus5',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BLU',
            'campus' => 'Kampus V',
        ]);

        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'role' => 'BLU',
            'campus' => 'Kampus V',
        ])->assertOk();

        $this->withToken($login->json('token'))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.campus', 'Kampus V');
    }

    public function test_admin_password_can_be_changed_and_old_password_stops_working(): void
    {
        $admin = $this->createAdmin();
        $login = $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'role' => 'BLU',
            'campus' => 'Kampus I',
        ])->assertOk();

        $this->withToken($login->json('token'))->putJson('/api/admin/password', [
            'current_password' => 'Initial-pass-123',
            'password' => 'Changed-pass-456',
            'password_confirmation' => 'Changed-pass-456',
        ])->assertOk();

        $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Initial-pass-123',
            'role' => 'BLU',
            'campus' => 'Kampus I',
        ])->assertUnauthorized();

        $this->postJson('/api/admin/login', [
            'username' => $admin->username,
            'password' => 'Changed-pass-456',
            'role' => 'BLU',
            'campus' => 'Kampus I',
        ])->assertOk();
    }

    private function createAdmin(): Admin
    {
        return Admin::create([
            'nama_admin' => 'Admin BLU Kampus I',
            'username' => 'blu.kampus1',
            'password' => Hash::make('Initial-pass-123'),
            'role' => 'BLU',
            'campus' => 'Kampus I',
        ]);
    }
}
