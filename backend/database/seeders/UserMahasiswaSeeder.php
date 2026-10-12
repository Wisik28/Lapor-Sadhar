<?php

namespace Database\Seeders;

use App\Models\UserMahasiswa;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserMahasiswaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $userData = [
            [
                'nim' => '225314001',
                'nama' => 'Agustinus Kurniawan',
                'password' => Hash::make('password123'),
                'no_handphone' => '081234567890',
                'tipe_user' => 'mahasiswa',
            ],
            [
                'nim' => '225314002',
                'nama' => 'Maria Fransiska',
                'password' => Hash::make('password123'),
                'no_handphone' => '082198765432',
                'tipe_user' => 'mahasiswa',
            ],
            [
                'nim' => '225314003',
                'nama' => 'Ignatius Kevin Pratama',
                'password' => Hash::make('password123'),
                'no_handphone' => '085712349876',
                'tipe_user' => 'mahasiswa',
            ],
            // Contoh akun Karyawan / Dosen
            [
                'nim' => '198501012010121001',
                'nama' => 'Budi Santoso, S.T., M.Kom.',
                'password' => Hash::make('password123'),
                'no_handphone' => '081398765432',
                'tipe_user' => 'karyawan',
            ],
            [
                'nim' => 'KARYAWAN001',
                'nama' => 'Siti Rahmawati (Staff TU)',
                'password' => Hash::make('password123'),
                'no_handphone' => '081223344556',
                'tipe_user' => 'karyawan',
            ],
        ];

        foreach ($userData as $data) {
            UserMahasiswa::updateOrCreate(
                ['nim' => $data['nim']],
                $data
            );
        }
    }
}
