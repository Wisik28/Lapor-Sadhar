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
            $username = Admin::USERNAMES[$position];
            $admin = Admin::where('jabatan', $position)->first();

            if (! $admin) {
                $legacyUsername = Admin::LEGACY_USERNAMES[$position] ?? null;
                $admin = $legacyUsername ? Admin::where('username', $legacyUsername)->first() : null;
            }

            if (! $admin) {
                $admin = Admin::where('username', 'admin.'.$position)->first();
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
                    'username' => $username,
                    'nama_admin' => str_starts_with($admin->nama_admin, 'Admin ')
                        ? $definition['label']
                        : $admin->nama_admin,
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
}
