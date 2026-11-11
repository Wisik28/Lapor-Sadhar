<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Providers\PriorityServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PriorityAccessControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_request_to_priority_dashboard_is_rejected(): void
    {
        $this->getJson('/api/admin/priority/reports')->assertUnauthorized();
        $this->getJson('/api/admin/priority/summary')->assertUnauthorized();
        $this->patchJson('/api/admin/priority/reports/1/severity', [
            'severity_level' => 'berat',
        ])->assertUnauthorized();
    }

    public function test_admin_session_can_access_priority_dashboard(): void
    {
        $admin = Admin::create([
            'nama_admin' => 'Admin BPS Kampus',
            'username'   => 'bps.kampus1',
            'password'   => bcrypt('password123'),
            'role'       => 'BPS',
            'campus'     => 'Kampus 1',
            'email'      => 'bps1@usd.ac.id',
            'jabatan'    => 'kepala_bagian_bps_1',
        ]);

        $plainToken = 'test-priority-admin-token-12345';
        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/admin/priority/reports');

        $response->assertOk();
        $response->assertJsonStructure([
            'status',
            'message',
            'total',
            'data',
        ]);
    }
}
