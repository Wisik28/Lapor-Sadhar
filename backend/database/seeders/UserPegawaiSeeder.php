<?php

namespace Database\Seeders;

use App\Models\Pelapor;
use App\Models\UserPegawai;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserPegawaiSeeder extends Seeder
{
    public function run(): void
    {
        $userData = [
            [
                'nomor_identitas' => '198501012010121001',
                'nama' => 'Budi Santoso, S.T., M.Kom.',
                'password' => Hash::make('password123'),
                'no_handphone' => '081398765432',
            ],
            [
                'nomor_identitas' => 'KARYAWAN001',
                'nama' => 'Siti Rahmawati (Staff TU)',
                'password' => Hash::make('password123'),
                'no_handphone' => '081223344556',
            ],
        ];

        foreach ($userData as $data) {
            DB::transaction(function () use ($data): void {
                Pelapor::updateOrCreate(
                    ['nomor_identitas' => $data['nomor_identitas']],
                    ['tipe_user' => 'karyawan']
                );

                UserPegawai::updateOrCreate(
                    ['nomor_identitas' => $data['nomor_identitas']],
                    $data
                );
            });
        }
    }
}
