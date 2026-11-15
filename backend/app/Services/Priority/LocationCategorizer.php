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
     * Pola regex gabungan yang telah dikompilasi per kategori untuk menghindari
     * pemanggilan preg_quote() dan puluhan preg_match() berulang pada setiap eksekusi.
     */
    private const COMPILED_CATEGORY_PATTERNS = [
        self::CATEGORY_TOILET => '/\b(?:toilet|kamar mandi|water closet|restroom|lavatory|urinoir|kloset|kakus|wc|km\s*wc)\b/u',
        self::CATEGORY_LABORATORIUM_PRAKTIK => '/\b(?:laboratorium|laborat|praktikum|ruang praktik|studio praktik|bengkel praktik|microteaching|micro teaching|lab|bengkel|workshop)\b/u',
        self::CATEGORY_PARKIRAN => '/\b(?:parkiran|parkir|area parkir|lahan parkir|tempat parkir|basement parkir|garasi)\b/u',
        self::CATEGORY_RUANG_DOSEN => '/\b(?:ruang dosen|r\.?\s*dosen|kantor dosen|kubikal dosen|meja dosen|gedung dosen|staf dosen|ruang pengajar|ruang kaprodi|ruang prodi|ruang dekanat|dosen)\b/u',
        self::CATEGORY_PERPUSTAKAAN => '/\b(?:perpustakaan|perpus|pustaka|library|ruang baca|taman baca|sirkulasi buku|koleksi buku)\b/u',
        self::CATEGORY_RUANG_KELAS => '/\b(?:ruang kelas|kelas|ruang kuliah|r kuliah|r kelas|ruang teori|ruang ujian|ruang seminar|smart classroom|classroom|auditorium|amphitheater|kls|rk|r\s*k|k\s*\d{2,3}[a-z]?)\b/u',
        self::CATEGORY_LAPANGAN => '/\b(?:lapangan|arena olahraga|gelanggang|lapangan basket|lapangan futsal|lapangan voli|lapangan badminton|lapangan tenis|lapangan sepak bola|wall climbing|lap|gor|basket|futsal|voli|badminton|bulu\s+tangkis)\b/u',
        self::CATEGORY_RUANG_TERBUKA => '/\b(?:ruang terbuka|area terbuka|taman|halaman|koridor|selasar|teras|hall|student hall|lobby|lobi|plaza|gazebo|pelataran|panggung terbuka|outdoor)\b/u',
    ];

    /**
     * Cache hasil kategorisasi di memori untuk menghindari komputasi ulang pada lokasi yang sama.
     *
     * @var array<string, string>
     */
    private static array $categorizeCache = [];

    /**
     * Normalisasi string lokasi:
     * - Ubah ke huruf kecil (lowercase)
     * - Ubah tanda baca menjadi spasi agar batas kata mudah dikenali
     * - Rapikan spasi berlebih
     */
    public function normalize(?string $rawLocation): string
    {
        if ($rawLocation === null || $rawLocation === '') {
            return '';
        }

        $lower = mb_strtolower(trim($rawLocation), 'UTF-8');
        if ($lower === '') {
            return '';
        }

        // Ganti karakter non-alfanumerik dengan spasi dan rapikan spasi berlebih dalam satu langkah
        $cleaned = preg_replace('/[^a-z0-9]+/u', ' ', $lower) ?? $lower;

        return trim($cleaned);
    }

    /**
     * Identifikasi kategori lokasi berdasarkan input teks bebas.
     * Jika tidak dikenali atau kosong, mengembalikan "Tidak Diketahui".
     */
    public function categorize(?string $rawLocation): string
    {
        if ($rawLocation === null || $rawLocation === '') {
            return self::CATEGORY_TIDAK_DIKETAHUI;
        }

        if (isset(self::$categorizeCache[$rawLocation])) {
            return self::$categorizeCache[$rawLocation];
        }

        try {
            $normalized = $this->normalize($rawLocation);

            if ($normalized === '') {
                return self::$categorizeCache[$rawLocation] = self::CATEGORY_TIDAK_DIKETAHUI;
            }

            if (count(self::$categorizeCache) >= 512) {
                self::$categorizeCache = [];
            }

            foreach (self::COMPILED_CATEGORY_PATTERNS as $category => $pattern) {
                if (preg_match($pattern, $normalized) === 1) {
                    return self::$categorizeCache[$rawLocation] = $category;
                }
            }

            return self::$categorizeCache[$rawLocation] = self::CATEGORY_TIDAK_DIKETAHUI;
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

