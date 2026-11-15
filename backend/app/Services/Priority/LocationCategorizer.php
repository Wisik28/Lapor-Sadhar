<?php

namespace App\Services\Priority;

/**
 * LocationCategorizer
 *
 * Layanan khusus untuk melakukan normalisasi dan identifikasi kategori lokasi
 * kejadian dari input teks bebas (free-text) pengguna.
 */
class LocationCategorizer
{
    public const CATEGORY_RUANG_KELAS          = 'Ruang Kelas';
    public const CATEGORY_LAPANGAN             = 'Lapangan';
    public const CATEGORY_TOILET               = 'Toilet';
    public const CATEGORY_RUANG_TERBUKA        = 'Ruang Terbuka';
    public const CATEGORY_PARKIRAN             = 'Parkiran';
    public const CATEGORY_LABORATORIUM_PRAKTIK = 'Laboratorium Praktik';
    public const CATEGORY_RUANG_DOSEN          = 'Ruang Dosen';
    public const CATEGORY_PERPUSTAKAAN         = 'Perpustakaan';
    public const CATEGORY_TIDAK_DIKETAHUI      = 'Tidak Diketahui';

    /**
     * Daftar aturan kata kunci & pola regex terurut berdasarkan tingkat kekhususan (specificity).
     * Sebagai contoh, "Toilet Hall" atau "Toilet Perpustakaan" harus dikenali sebagai "Toilet",
     * dan "Parkiran Dosen" dikenali sebagai "Parkiran".
     */
    private const CATEGORY_RULES = [
        self::CATEGORY_TOILET => [
            'keywords' => [
                'toilet',
                'kamar mandi',
                'water closet',
                'restroom',
                'lavatory',
                'urinoir',
                'kloset',
                'kakus',
            ],
            'patterns' => [
                '/\bwc\b/u',
                '/\bkm\s*wc\b/u',
            ],
        ],
        self::CATEGORY_LABORATORIUM_PRAKTIK => [
            'keywords' => [
                'laboratorium',
                'laborat',
                'praktikum',
                'ruang praktik',
                'studio praktik',
                'bengkel praktik',
                'microteaching',
                'micro teaching',
            ],
            'patterns' => [
                '/\blab\b/u',
                '/\bbengkel\b/u',
                '/\bworkshop\b/u',
            ],
        ],
        self::CATEGORY_PARKIRAN => [
            'keywords' => [
                'parkiran',
                'parkir',
                'area parkir',
                'lahan parkir',
                'tempat parkir',
                'basement parkir',
                'garasi',
            ],
            'patterns' => [
                '/\bparkir(?:an)?\b/u',
            ],
        ],
        self::CATEGORY_RUANG_DOSEN => [
            'keywords' => [
                'ruang dosen',
                'r dosen',
                'kantor dosen',
                'kubikal dosen',
                'meja dosen',
                'gedung dosen',
                'staf dosen',
                'ruang pengajar',
                'ruang kaprodi',
                'ruang prodi',
                'ruang dekanat',
            ],
            'patterns' => [
                '/\br\.?\s*dosen\b/u',
                '/\bdosen\b/u',
            ],
        ],
        self::CATEGORY_PERPUSTAKAAN => [
            'keywords' => [
                'perpustakaan',
                'perpus',
                'pustaka',
                'library',
                'ruang baca',
                'taman baca',
                'sirkulasi buku',
                'koleksi buku',
            ],
            'patterns' => [
                '/\bperpus(?:takaan)?\b/u',
            ],
        ],
        self::CATEGORY_RUANG_KELAS => [
            'keywords' => [
                'ruang kelas',
                'kelas',
                'ruang kuliah',
                'r kuliah',
                'r kelas',
                'ruang teori',
                'ruang ujian',
                'ruang seminar',
                'smart classroom',
                'classroom',
                'auditorium',
                'amphitheater',
            ],
            'patterns' => [
                '/\bkls\b/u',
                '/\brk\b/u',
                '/\br\s*k\b/u',
                // Pola kode ruang kuliah umum di kampus seperti "K.205", "K 204", "Ruang K301"
                '/\bk\s*\d{2,3}[a-z]?\b/u',
            ],
        ],
        self::CATEGORY_LAPANGAN => [
            'keywords' => [
                'lapangan',
                'arena olahraga',
                'gelanggang',
                'lapangan basket',
                'lapangan futsal',
                'lapangan voli',
                'lapangan badminton',
                'lapangan tenis',
                'lapangan sepak bola',
                'wall climbing',
            ],
            'patterns' => [
                '/\blap\b/u',
                '/\bgor\b/u',
                '/\b(?:basket|futsal|voli|badminton|bulu\s+tangkis)\b/u',
            ],
        ],
        self::CATEGORY_RUANG_TERBUKA => [
            'keywords' => [
                'ruang terbuka',
                'area terbuka',
                'taman',
                'halaman',
                'koridor',
                'selasar',
                'teras',
                'hall',
                'student hall',
                'lobby',
                'lobi',
                'plaza',
                'gazebo',
                'pelataran',
                'panggung terbuka',
                'outdoor',
            ],
            'patterns' => [
                '/\bhall\b/u',
                '/\btaman\b/u',
            ],
        ],
    ];

    /**
     * Normalisasi string lokasi:
     * - Ubah ke huruf kecil (lowercase)
     * - Ubah tanda baca menjadi spasi agar batas kata mudah dikenali
     * - Rapikan spasi berlebih
     */
    public function normalize(?string $rawLocation): string
    {
        if ($rawLocation === null) {
            return '';
        }

        $lower = mb_strtolower(trim($rawLocation), 'UTF-8');
        if ($lower === '') {
            return '';
        }

        // Ganti karakter non-alfanumerik dengan spasi
        $cleaned = preg_replace('/[^a-z0-9\s]+/u', ' ', $lower) ?? $lower;

        // Rapikan spasi ganda menjadi satu spasi
        $normalized = preg_replace('/\s+/u', ' ', $cleaned) ?? $cleaned;

        return trim($normalized);
    }

    /**
     * Identifikasi kategori lokasi berdasarkan input teks bebas.
     * Jika tidak dikenali atau kosong, mengembalikan "Tidak Diketahui".
     */
    public function categorize(?string $rawLocation): string
    {
        try {
            $normalized = $this->normalize($rawLocation);

            if ($normalized === '') {
                return self::CATEGORY_TIDAK_DIKETAHUI;
            }

            foreach (self::CATEGORY_RULES as $category => $rules) {
                foreach ($rules['keywords'] as $keyword) {
                    // Cocokkan frasa kata kunci pada batas kata (word boundary)
                    $quoted = preg_quote($keyword, '/');
                    if (preg_match('/\b' . $quoted . '\b/u', $normalized) === 1) {
                        return $category;
                    }
                }

                foreach ($rules['patterns'] as $pattern) {
                    if (preg_match($pattern, $normalized) === 1) {
                        return $category;
                    }
                }
            }

            return self::CATEGORY_TIDAK_DIKETAHUI;
        } catch (\Throwable $e) {
            return self::CATEGORY_TIDAK_DIKETAHUI;
        }
    }

    /**
     * Mengembalikan daftar seluruh kategori lokasi yang valid (termasuk fallback).
     *
     * @return array<int, string>
     */
    public static function supportedCategories(): array
    {
        return [
            self::CATEGORY_RUANG_KELAS,
            self::CATEGORY_LAPANGAN,
            self::CATEGORY_TOILET,
            self::CATEGORY_RUANG_TERBUKA,
            self::CATEGORY_PARKIRAN,
            self::CATEGORY_LABORATORIUM_PRAKTIK,
            self::CATEGORY_RUANG_DOSEN,
            self::CATEGORY_PERPUSTAKAAN,
            self::CATEGORY_TIDAK_DIKETAHUI,
        ];
    }
}

