<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $adminData = [
            [
                'username' => 'admin',
                'nama_admin' => 'Admin Sarpras USD',
                'password' => Hash::make('admin123'),
                'role' => 'Super Admin',
            ],
            [
                'username' => 'sarpras01',
                'nama_admin' => 'Petugas Sarpras Kampus III',
                'password' => Hash::make('admin123'),
                'role' => 'Petugas Sarpras',
            ],
        ];

        foreach ($adminData as $data) {
            Admin::updateOrCreate(
                ['username' => $data['username']],
                $data
            );
        }
    }
}
