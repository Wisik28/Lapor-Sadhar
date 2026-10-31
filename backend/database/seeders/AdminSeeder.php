<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Admin::POSITIONS as $position => $definition) {
            $username = 'admin.'.$position;
            $admin = Admin::where('username', $username)->first();

            if (! $admin) {
                $legacyUsername = $this->legacyUsername($position);
                $admin = $legacyUsername ? Admin::where('username', $legacyUsername)->first() : null;
            }

            $email = config("admin.emails.{$position}");

            if ($admin) {
                if (
                    $admin->username !== $username
                    || $admin->role !== $definition['role']
                    || $admin->jabatan !== $position
                ) {
                    $admin->sessions()->delete();
                }

                $attributes = [
                    'nama_admin' => str_starts_with($admin->nama_admin, 'Admin ')
                        ? $definition['label']
                        : $admin->nama_admin,
                    'username' => $username,
                    'role' => $definition['role'],
                    'campus' => null,
                    'jabatan' => $position,
                ];

                if ($email) {
                    $attributes['email'] = $email;
                }

                $admin->update($attributes);

                continue;
            }

            $initialPassword = Str::random(24);
            Admin::create([
                'nama_admin' => $definition['label'],
                'username' => $username,
                'password' => Hash::make($initialPassword),
                'role' => $definition['role'],
                'campus' => null,
                'jabatan' => $position,
                'email' => $email,
            ]);

            $this->command?->info("{$definition['label']}: {$username} / {$initialPassword}");
        }
    }

    private function legacyUsername(string $position): ?string
    {
        if ($position === 'kepala_blu') {
            return 'blu.kampus1';
        }

        if ($position === 'kepala_bps') {
            return 'bps.kampus1';
        }

        if (preg_match('/^kepala_bagian_(blu|bps)_([1-4])$/', $position, $matches)) {
            $campusNumber = (int) $matches[2] + 1;

            return "{$matches[1]}.kampus{$campusNumber}";
        }

        return null;
    }
}
