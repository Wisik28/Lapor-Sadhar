<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SetupAdminBluBpsCommand extends Command
{
    protected $signature = 'admin:setup-blu-bps
                            {--password=laporsadhar123 : Password default untuk semua admin}';

    protected $description = 'Setel ulang username dan password untuk admin BLU dan BPS sesuai format BLU1@gmail.com dan BPS1@gmail.com';

    public function handle(): int
    {
        $defaultPassword = $this->option('password') ?: 'laporsadhar123';
        $hashedPassword = Hash::make($defaultPassword);

        $accounts = [
            'kepala_blu' => [
                'nama'     => 'Kepala Biro Layanan Umum',
                'username' => 'BLU1@gmail.com',
                'role'     => 'BLU',
                'email'    => 'blu1@gmail.com',
            ],
            'kepala_bagian_blu_1' => [
                'nama'     => 'Kepala Bagian BLU 1',
                'username' => 'BLU2@gmail.com',
                'role'     => 'BLU',
                'email'    => 'blu2@gmail.com',
            ],
            'kepala_bagian_blu_2' => [
                'nama'     => 'Kepala Bagian BLU 2',
                'username' => 'BLU3@gmail.com',
                'role'     => 'BLU',
                'email'    => 'blu3@gmail.com',
            ],
            'kepala_bagian_blu_3' => [
                'nama'     => 'Kepala Bagian BLU 3',
                'username' => 'BLU4@gmail.com',
                'role'     => 'BLU',
                'email'    => 'blu4@gmail.com',
            ],
            'kepala_bagian_blu_4' => [
                'nama'     => 'Kepala Bagian BLU 4',
                'username' => 'BLU5@gmail.com',
                'role'     => 'BLU',
                'email'    => 'blu5@gmail.com',
            ],
            'kepala_bps' => [
                'nama'     => 'Kepala Biro Sarana dan Prasarana',
                'username' => 'BPS1@gmail.com',
                'role'     => 'BPS',
                'email'    => 'bps1@gmail.com',
            ],
            'kepala_bagian_bps_1' => [
                'nama'     => 'Kepala Bagian BPS 1',
                'username' => 'BPS2@gmail.com',
                'role'     => 'BPS',
                'email'    => 'bps2@gmail.com',
            ],
            'kepala_bagian_bps_2' => [
                'nama'     => 'Kepala Bagian BPS 2',
                'username' => 'BPS3@gmail.com',
                'role'     => 'BPS',
                'email'    => 'bps3@gmail.com',
            ],
            'kepala_bagian_bps_3' => [
                'nama'     => 'Kepala Bagian BPS 3',
                'username' => 'BPS4@gmail.com',
                'role'     => 'BPS',
                'email'    => 'bps4@gmail.com',
            ],
            'kepala_bagian_bps_4' => [
                'nama'     => 'Kepala Bagian BPS 4',
                'username' => 'BPS5@gmail.com',
                'role'     => 'BPS',
                'email'    => 'bps5@gmail.com',
            ],
            'wakil_rektor_ii' => [
                'nama'     => 'Wakil Rektor II',
                'username' => 'WR2@gmail.com',
                'role'     => 'BOTH',
                'email'    => 'wr2@gmail.com',
            ],
        ];

        $tableData = [];

        DB::transaction(function () use ($accounts, $hashedPassword, $defaultPassword, &$tableData) {
            foreach ($accounts as $jabatan => $data) {
                $admin = Admin::where('jabatan', $jabatan)->first();

                if ($admin) {
                    $admin->update([
                        'nama_admin' => $data['nama'],
                        'username'   => $data['username'],
                        'password'   => $hashedPassword,
                        'role'       => $data['role'],
                    ]);
                    $admin->sessions()->delete();
                } else {
                    $admin = Admin::create([
                        'nama_admin' => $data['nama'],
                        'username'   => $data['username'],
                        'password'   => $hashedPassword,
                        'role'       => $data['role'],
                        'jabatan'    => $jabatan,
                        'email'      => $data['email'],
                    ]);
                }

                $tableData[] = [
                    $jabatan,
                    $data['nama'],
                    $data['role'],
                    $data['username'],
                    $defaultPassword,
                ];
            }
        });

        $this->info('Akun admin BLU dan BPS berhasil diperbarui:');
        $this->table(
            ['Jabatan Key', 'Nama Jabatan', 'Role', 'Username Baru', 'Password'],
            $tableData
        );

        return self::SUCCESS;
    }
}

