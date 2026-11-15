<?php

namespace Tests\Feature;

use App\Models\Admin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class AdminBluBpsLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Artisan::call('admin:setup-blu-bps', ['--password' => 'laporsadhar123']);
    }

    public function test_all_blu_admins_can_login_with_laporsadhar123(): void
    {
        $bluAccounts = [
            'kepala_blu'          => 'BLU1@gmail.com',
            'kepala_bagian_blu_1' => 'BLU2@gmail.com',
            'kepala_bagian_blu_2' => 'BLU3@gmail.com',
            'kepala_bagian_blu_3' => 'BLU4@gmail.com',
            'kepala_bagian_blu_4' => 'BLU5@gmail.com',
        ];

        foreach ($bluAccounts as $jabatan => $username) {
            $response = $this->postJson('/api/admin/login', [
                'username' => $username,
                'password' => 'laporsadhar123',
                'jabatan'  => $jabatan,
            ]);

            $response->assertOk()
                ->assertJsonPath('status', 'success')
                ->assertJsonPath('user.role_detail', 'BLU')
                ->assertJsonPath('user.jabatan', $jabatan);
        }
    }

    public function test_all_bps_admins_can_login_with_laporsadhar123(): void
    {
        $bpsAccounts = [
            'kepala_bps'          => 'BPS1@gmail.com',
            'kepala_bagian_bps_1' => 'BPS2@gmail.com',
            'kepala_bagian_bps_2' => 'BPS3@gmail.com',
            'kepala_bagian_bps_3' => 'BPS4@gmail.com',
            'kepala_bagian_bps_4' => 'BPS5@gmail.com',
        ];

        foreach ($bpsAccounts as $jabatan => $username) {
            $response = $this->postJson('/api/admin/login', [
                'username' => $username,
                'password' => 'laporsadhar123',
                'jabatan'  => $jabatan,
            ]);

            $response->assertOk()
                ->assertJsonPath('status', 'success')
                ->assertJsonPath('user.role_detail', 'BPS')
                ->assertJsonPath('user.jabatan', $jabatan);
        }
    }

    public function test_case_insensitive_username_login_succeeds(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'username' => 'blu1@gmail.com', // huruf kecil
            'password' => 'laporsadhar123',
            'jabatan'  => 'kepala_blu',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success');
    }

    public function test_incorrect_password_is_rejected(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'username' => 'BLU1@gmail.com',
            'password' => 'salah-password',
            'jabatan'  => 'kepala_blu',
        ]);

        $response->assertUnauthorized();
    }

    public function test_blu_admin_cannot_login_as_bps_position(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'username' => 'BLU1@gmail.com',
            'password' => 'laporsadhar123',
            'jabatan'  => 'kepala_bps',
        ]);

        $response->assertUnauthorized();
    }
}

