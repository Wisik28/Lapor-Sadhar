<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Layanan penyimpanan gambar ke Cloudinary melalui Upload REST API.
 */
class CloudinaryStorageService
{
    private const ALLOWED_MIME_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
    ];

    /**
     * Unggah data biner gambar ke Cloudinary dan kembalikan URL HTTPS (secure_url).
     */
    public function uploadImage(string $binaryContents, string $extension, ?string $publicId = null): string
    {
        [$cloudName, $apiKey, $apiSecret, $folder] = $this->resolveConfig();

        $timestamp = time();
        $resolvedPublicId = $publicId ?: (string) Str::uuid();

        $params = array_filter([
            'folder'    => $folder !== '' ? $folder : null,
            'public_id' => $resolvedPublicId,
            'timestamp' => (string) $timestamp,
        ], static fn (?string $value): bool => $value !== null && $value !== '');

        $signature = $this->generateSignature($params, $apiSecret);
        $endpoint = "https://api.cloudinary.com/v1_1/{$cloudName}/image/upload";

        $response = Http::timeout(30)
            ->attach('file', $binaryContents, "{$resolvedPublicId}.{$extension}")
            ->post($endpoint, array_merge($params, [
                'api_key'   => $apiKey,
                'signature' => $signature,
            ]));

        if (! $response->successful()) {
            $errorMessage = $response->json('error.message') ?? ('HTTP ' . $response->status());
            throw new \RuntimeException('Gagal mengunggah foto ke Cloudinary: ' . $errorMessage);
        }

        $secureUrl = $response->json('secure_url') ?? $response->json('url');
        if (! is_string($secureUrl) || trim($secureUrl) === '') {
            throw new \RuntimeException('Cloudinary tidak mengembalikan URL gambar yang valid.');
        }

        return $secureUrl;
    }

    /**
     * Validasi dan unggah instance UploadedFile gambar ke Cloudinary.
     */
    public function uploadUploadedFile(UploadedFile $file): string
    {
        $contents = $file->get();
        if ($contents === false || $contents === '') {
            throw new \InvalidArgumentException('Data foto laporan tidak valid.');
        }

        $extension = $this->detectSupportedExtension($contents);

        return $this->uploadImage($contents, $extension);
    }

    /**
     * Deteksi ekstensi gambar yang didukung dari isi biner file.
     */
    public function detectSupportedExtension(string $binaryContents): string
    {
        $mimeType = (new \finfo(FILEINFO_MIME_TYPE))->buffer($binaryContents);
        $extension = self::ALLOWED_MIME_TYPES[$mimeType] ?? null;

        if ($extension === null) {
            throw new \InvalidArgumentException('Format foto harus berupa JPG, PNG, GIF, atau WebP.');
        }

        return $extension;
    }

    /**
     * Hapus gambar pada Cloudinary berdasarkan URL-nya (best-effort, tidak melempar error).
     */
    public function deleteByUrl(string $url): void
    {
        try {
            [$cloudName, $apiKey, $apiSecret] = $this->resolveConfig();
            $publicId = $this->extractPublicIdFromUrl($url, $cloudName);

            if ($publicId === null) {
                return;
            }

            $timestamp = time();
            $params = [
                'public_id' => $publicId,
                'timestamp' => (string) $timestamp,
            ];

            $signature = $this->generateSignature($params, $apiSecret);
            $endpoint = "https://api.cloudinary.com/v1_1/{$cloudName}/image/destroy";

            Http::timeout(15)->asForm()->post($endpoint, array_merge($params, [
                'api_key'   => $apiKey,
                'signature' => $signature,
            ]));
        } catch (\Throwable) {
            // Pembersihan aset bersifat best-effort agar tidak menggagalkan operasi utama.
        }
    }

    /**
     * Ekstrak public_id dari URL Cloudinary milik cloud yang aktif.
     */
    public function extractPublicIdFromUrl(string $url, ?string $expectedCloudName = null): ?string
    {
        $parts = parse_url(trim($url));
        if (! is_array($parts) || empty($parts['host']) || empty($parts['path'])) {
            return null;
        }

        if (strcasecmp($parts['host'], 'res.cloudinary.com') !== 0) {
            return null;
        }

        $cloudName = $expectedCloudName ?? (string) config('services.cloudinary.cloud_name', '');
        $prefix = '/' . trim($cloudName, '/') . '/image/upload/';
        $path = $parts['path'];

        if ($cloudName === '' || ! str_starts_with($path, $prefix)) {
            return null;
        }

        $relative = substr($path, strlen($prefix));
        if ($relative === false || $relative === '') {
            return null;
        }

        // Lewati segmen transformasi opsional dan versi (mis. v1700000000/)
        $segments = explode('/', $relative);
        $versionIndex = null;
        foreach ($segments as $index => $segment) {
            if (preg_match('/^v\d+$/', $segment) === 1) {
                $versionIndex = $index;
                break;
            }
        }

        if ($versionIndex !== null) {
            $segments = array_slice($segments, $versionIndex + 1);
        }

        if (empty($segments)) {
            return null;
        }

        $joined = implode('/', $segments);

        return preg_replace('/\.[^.\/]+$/', '', $joined) ?: null;
    }

    /**
     * Bangun signature SHA-1 sesuai spesifikasi signed upload Cloudinary.
     *
     * @param  array<string, string>  $params
     */
    public function generateSignature(array $params, string $apiSecret): string
    {
        ksort($params);

        $base = implode('&', array_map(
            static fn (string $key, string $value): string => "{$key}={$value}",
            array_keys($params),
            array_values($params)
        ));

        return sha1($base . $apiSecret);
    }

    /**
     * @return array{0: string, 1: string, 2: string, 3: string}
     */
    private function resolveConfig(): array
    {
        $cloudName = trim((string) config('services.cloudinary.cloud_name', ''));
        $apiKey    = trim((string) config('services.cloudinary.api_key', ''));
        $apiSecret = trim((string) config('services.cloudinary.api_secret', ''));
        $folder    = trim((string) config('services.cloudinary.folder', 'lapor-sadhar/laporan'), '/');

        if ($cloudName === '' || $apiKey === '' || $apiSecret === '') {
            throw new \RuntimeException(
                'Konfigurasi Cloudinary belum lengkap. Pastikan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_SECRET_KEY sudah diisi di .env.'
            );
        }

        return [$cloudName, $apiKey, $apiSecret, $folder];
    }
}

