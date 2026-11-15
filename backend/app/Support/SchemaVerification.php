<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Penanda (marker) berbasis file yang menyimpan fakta bahwa skema tertentu
 * sudah pernah diverifikasi pada database PostgreSQL yang sama.
 *
 * Latar belakang performa: database berada di jaringan jarak jauh (Supabase) sehingga
 * setiap query skema (Schema::hasTable / hasColumns) memakan satu atau lebih round-trip.
 * Cache `static` pada service hanya hidup selama satu request PHP, sehingga pengecekan
 * skema yang sama terulang di setiap request. Marker ini membuat hasil verifikasi
 * bertahan lintas request tanpa mengubah logika verifikasi/pembuatan skema itu sendiri.
 *
 * Marker hanya dipakai untuk driver pgsql, sehingga test (sqlite) tidak terpengaruh.
 * Jika marker dihapus (atau pemanggil memanggil forget()), verifikasi penuh berjalan lagi.
 */
class SchemaVerification
{
    public static function isVerified(string $name): bool
    {
        $path = self::path($name);

        return $path !== null && is_file($path);
    }

    public static function markVerified(string $name): void
    {
        $path = self::path($name);

        if ($path === null || ! is_dir(dirname($path))) {
            return;
        }

        @file_put_contents($path, (string) time(), LOCK_EX);
    }

    public static function forget(string $name): void
    {
        $path = self::path($name);

        if ($path !== null && is_file($path)) {
            @unlink($path);
        }
    }

    private static function path(string $name): ?string
    {
        try {
            $connection = DB::connection();

            if ($connection->getDriverName() !== 'pgsql') {
                return null;
            }

            $config = $connection->getConfig();
            $fingerprint = sha1(implode('|', [
                $config['host'] ?? '',
                $config['port'] ?? '',
                $config['database'] ?? '',
                $config['username'] ?? '',
            ]));

            return storage_path('framework/cache/schema_' . $name . '_' . $fingerprint . '.ok');
        } catch (\Throwable $e) {
            return null;
        }
    }
}

