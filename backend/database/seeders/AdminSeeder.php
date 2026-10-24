<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (['BLU', 'BPS'] as $role) {
            foreach (range(1, 5) as $campusNumber) {
                $campus = "Kampus {$this->romanNumeral($campusNumber)}";
                $username = strtolower($role).'.kampus'.$campusNumber;

                if (Admin::where('username', $username)->exists()) {
                    continue;
                }

                $initialPassword = Str::random(20);
                Admin::create([
                    'nama_admin' => "Admin {$role} {$campus}",
                    'username' => $username,
                    'password' => Hash::make($initialPassword),
                    'role' => $role,
                    'campus' => $campus,
                ]);

                $this->command?->info("{$campus} / {$role}: {$username} / {$initialPassword}");
            }
        }
    }

    private function romanNumeral(int $number): string
    {
        return ['I', 'II', 'III', 'IV', 'V'][$number - 1];
    }
}
