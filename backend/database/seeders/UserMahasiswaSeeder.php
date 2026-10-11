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
        $mahasiswaData = [
            [
                'nim' => '225314001',
                'nama' => 'Agustinus Kurniawan',
                'password' => Hash::make('password123'),
                'no_handphone' => '081234567890',
            ],
            [
                'nim' => '225314002',
                'nama' => 'Maria Fransiska',
                'password' => Hash::make('password123'),
                'no_handphone' => '082198765432',
            ],
            [
                'nim' => '225314003',
                'nama' => 'Ignatius Kevin Pratama',
                'password' => Hash::make('password123'),
                'no_handphone' => '085712349876',
            ],
        ];

        foreach ($mahasiswaData as $data) {
            UserMahasiswa::updateOrCreate(
                ['nim' => $data['nim']],
                $data
            );
        }
    }
}
