<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ResetLegacyAdminPasswords extends Command
{
    protected $signature = 'admin:reset-legacy-passwords';

    protected $description = 'Reset passwords for the ten legacy admin accounts, excluding WR II';

    public function handle(): int
    {
        $positions = array_values(array_diff(array_keys(Admin::POSITIONS), ['wakil_rektor_ii']));
        $admins = Admin::query()->whereIn('jabatan', $positions)->orderBy('jabatan')->get();
        $foundPositions = $admins->pluck('jabatan')->all();

        if (count($foundPositions) !== count($positions) || array_diff($positions, $foundPositions) !== []) {
            $this->error('Reset dibatalkan: database harus memiliki tepat satu akun untuk setiap jabatan admin lama.');

            return self::FAILURE;
        }

        foreach ($admins as $admin) {
            if (
                ! isset(Admin::POSITIONS[$admin->jabatan])
                || Admin::POSITIONS[$admin->jabatan]['role'] !== $admin->role
            ) {
                $this->error("Reset dibatalkan: role akun {$admin->username} tidak sesuai dengan jabatannya.");

                return self::FAILURE;
            }
        }

        if (! $this->confirm('Reset 10 password admin lama dan keluarkan semua sesi aktif mereka? Password lama tidak akan berlaku lagi.')) {
            $this->info('Reset dibatalkan; tidak ada perubahan.');

            return self::SUCCESS;
        }

        $credentials = DB::transaction(function () use ($admins): array {
            $credentials = [];

            foreach ($admins as $admin) {
                $password = Str::random(24);
                $admin->update(['password' => Hash::make($password)]);
                $admin->sessions()->delete();

                $credentials[] = [
                    $admin->jabatan,
                    $admin->username,
                    $password,
                ];
            }

            return $credentials;
        });

        $this->table(['Jabatan', 'Username', 'Password baru'], $credentials);
        $this->warn('Simpan dan bagikan password ini secara pribadi. Password hanya ditampilkan pada hasil perintah ini.');

        return self::SUCCESS;
    }
}
