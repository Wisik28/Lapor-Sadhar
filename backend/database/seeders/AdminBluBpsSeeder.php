<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminBluBpsSeeder extends Seeder
{
    /**
     * Seed username & password admin BLU & BPS sesuai format:
     * BLU1@gmail.com s/d BLU5@gmail.com
     * BPS1@gmail.com s/d BPS5@gmail.com
     * Password semua: laporsadhar123
     */
    public function run(): void
    {
        $password = Hash::make('laporsadhar123');

        $accounts = [
            'kepala_blu' => [
                'nama'     => 'Kepala Biro Layanan Umum',
                'username' => 'BLU1@gmail.com',
                'email'    => 'blu1@gmail.com',
                'role'     => 'BLU',
            ],
            'kepala_bagian_blu_1' => [
                'nama'     => 'Kepala Bagian BLU 1',
                'username' => 'BLU2@gmail.com',
                'email'    => 'blu2@gmail.com',
                'role'     => 'BLU',
            ],
            'kepala_bagian_blu_2' => [
                'nama'     => 'Kepala Bagian BLU 2',
                'username' => 'BLU3@gmail.com',
                'email'    => 'blu3@gmail.com',
                'role'     => 'BLU',
            ],
            'kepala_bagian_blu_3' => [
                'nama'     => 'Kepala Bagian BLU 3',
                'username' => 'BLU4@gmail.com',
                'email'    => 'blu4@gmail.com',
                'role'     => 'BLU',
            ],
            'kepala_bagian_blu_4' => [
                'nama'     => 'Kepala Bagian BLU 4',
                'username' => 'BLU5@gmail.com',
                'email'    => 'blu5@gmail.com',
                'role'     => 'BLU',
            ],
            'kepala_bps' => [
                'nama'     => 'Kepala Biro Sarana dan Prasarana',
                'username' => 'BPS1@gmail.com',
                'email'    => 'bps1@gmail.com',
                'role'     => 'BPS',
            ],
            'kepala_bagian_bps_1' => [
                'nama'     => 'Kepala Bagian BPS 1',
                'username' => 'BPS2@gmail.com',
                'email'    => 'bps2@gmail.com',
                'role'     => 'BPS',
            ],
            'kepala_bagian_bps_2' => [
                'nama'     => 'Kepala Bagian BPS 2',
                'username' => 'BPS3@gmail.com',
                'email'    => 'bps3@gmail.com',
                'role'     => 'BPS',
            ],
            'kepala_bagian_bps_3' => [
                'nama'     => 'Kepala Bagian BPS 3',
                'username' => 'BPS4@gmail.com',
                'email'    => 'bps4@gmail.com',
                'role'     => 'BPS',
            ],
            'kepala_bagian_bps_4' => [
                'nama'     => 'Kepala Bagian BPS 4',
                'username' => 'BPS5@gmail.com',
                'email'    => 'bps5@gmail.com',
                'role'     => 'BPS',
            ],
            'wakil_rektor_ii' => [
                'nama'     => 'Wakil Rektor II',
                'username' => 'WR2@gmail.com',
                'email'    => 'wr2@gmail.com',
                'role'     => 'BOTH',
            ],
        ];

        foreach ($accounts as $jabatan => $data) {
            $admin = Admin::where('jabatan', $jabatan)->first();

            if ($admin) {
                $admin->update([
                    'nama_admin' => $data['nama'],
                    'username'   => $data['username'],
                    'password'   => $password,
                    'role'       => $data['role'],
                    'email'      => $data['email'],
                ]);
                $admin->sessions()->delete();
            } else {
                Admin::create([
                    'nama_admin' => $data['nama'],
                    'username'   => $data['username'],
                    'password'   => $password,
                    'role'       => $data['role'],
                    'jabatan'    => $jabatan,
                    'email'      => $data['email'],
                ]);
            }
        }

        $this->command?->info('Berhasil menyetel akun admin BLU & BPS dengan password laporsadhar123.');
    }
}

