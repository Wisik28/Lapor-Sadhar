<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RotateAdminCredentials extends Command
{
    protected $signature = 'admin:rotate-credentials
                            {--dry-run : Preview account mappings without changing the database}
                            {--yes : Confirm changing all admin usernames and passwords}';

    protected $description = 'Set the requested usernames and generate new passwords for all eleven admin accounts';

    public function handle(): int
    {
        $positions = array_keys(Admin::POSITIONS);
        $admins = Admin::query()->whereIn('jabatan', $positions)->orderBy('jabatan')->get();
        $foundPositions = $admins->pluck('jabatan')->all();

        if (count($foundPositions) !== count($positions) || array_diff($positions, $foundPositions) !== []) {
            $this->error('Perubahan dibatalkan: database harus memiliki tepat satu akun untuk setiap jabatan admin.');

            return self::FAILURE;
        }

        foreach ($admins as $admin) {
            if (Admin::POSITIONS[$admin->jabatan]['role'] !== $admin->role) {
                $this->error("Perubahan dibatalkan: role akun untuk jabatan {$admin->jabatan} tidak sesuai.");

                return self::FAILURE;
            }
        }

        if ($this->option('dry-run')) {
            $mappings = $admins
                ->map(fn (Admin $admin): array => [$admin->jabatan, Admin::USERNAMES[$admin->jabatan]])
                ->all();
            $this->table(['Jabatan', 'Username baru'], $mappings);
            $this->info('Dry run selesai; tidak ada perubahan pada database.');

            return self::SUCCESS;
        }

        if (! $this->option('yes') && ! $this->confirm(
            'Ubah username dan reset password semua 11 akun admin? Password dan sesi lama tidak akan berlaku lagi.'
        )) {
            $this->info('Perubahan dibatalkan; tidak ada perubahan.');

            return self::SUCCESS;
        }

        $credentials = DB::transaction(function () use ($admins): array {
            $credentials = [];

            foreach ($admins as $admin) {
                $username = Admin::USERNAMES[$admin->jabatan];
                $password = Str::random(32);

                $admin->update([
                    'username' => $username,
                    'password' => Hash::make($password),
                ]);
                $admin->sessions()->delete();

                $credentials[] = [$username, $password];
            }

            return $credentials;
        });

        $this->table(['Username', 'Password baru'], $credentials);
        $this->warn('Password hanya ditampilkan sekali. Salin dari terminal dan bagikan melalui jalur pribadi yang aman.');

        return self::SUCCESS;
    }
}
