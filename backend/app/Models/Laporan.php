<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;

class Laporan extends Model
{
    use HasFactory;

    public const CAMPUS_OPTIONS = [
        'Kampus 1',
        'Kampus 2',
        'Kampus 3',
        'Kampus 4',
    ];

    protected $table = 'laporan';

    protected $primaryKey = 'id_laporan';

    protected $fillable = [
        'nim',
        'kategori_laporan',
        'tanggal_buat',
        'deskripsi',
        'foto',
        'tanggal_kejadian',
        'lokasi',
        'lokasi_kampus',
        'kategori_lokasi',
        'tingkat_keparahan',
        'skala_keparahan',
        'tanggal_rubah',
    ];

    protected $casts = [
        'skala_keparahan' => 'integer',
    ];

    protected $appends = ['nama_pelapor'];

    public function getNamaPelaporAttribute(): ?string
    {
        return $this->pelapor?->mahasiswa?->nama ?? $this->pelapor?->pegawai?->nama;
    }

    public function pelapor()
    {
        return $this->belongsTo(Pelapor::class, 'nim', 'nomor_identitas');
    }

    public function statuses()
    {
        return $this->hasMany(Status::class, 'id_laporan', 'id_laporan');
    }

    /**
     * Batasi query laporan sesuai cakupan kampus dan unit admin yang sedang login.
     */
    public function scopeVisibleToAdmin(Builder $query, ?Admin $admin): Builder
    {
        if (! $admin) {
            return $query;
        }

        if ($campus = $admin->resolvedCampus()) {
            $query->where('laporan.lokasi_kampus', $campus);
        }

        if ($kategori = $admin->allowedKategoriLaporan()) {
            $query->where('laporan.kategori_laporan', $kategori);
        }

        return $query;
    }

    /**
     * Normalisasi string kampus menjadi salah satu nilai baku (Kampus 1..4) atau null.
     */
    public static function normalizeCampus(?string $campus): ?string
    {
        if ($campus === null) {
            return null;
        }

        $trimmed = trim($campus);
        if ($trimmed === '' || strcasecmp($trimmed, 'Semua Kampus') === 0) {
            return null;
        }

        if (in_array($trimmed, self::CAMPUS_OPTIONS, true)) {
            return $trimmed;
        }

        return self::inferCampusFromLokasi($trimmed, null);
    }

    /**
     * Deteksi kampus dari teks lokasi untuk keperluan migrasi data lama dan fallback internal.
     */
    public static function inferCampusFromLokasi(?string $lokasi, ?string $default = 'Kampus 3'): ?string
    {
        if ($lokasi === null || trim($lokasi) === '') {
            return $default;
        }

        if (preg_match('/\bkampus\s*(?:iv|4)\b/i', $lokasi) === 1 || stripos($lokasi, 'kotabaru') !== false) {
            return 'Kampus 4';
        }
        if (
            preg_match('/\bkampus\s*(?:iii|3)\b/i', $lokasi) === 1
            || stripos($lokasi, 'paingan') !== false
            || stripos($lokasi, 'drost') !== false
        ) {
            return 'Kampus 3';
        }
        if (preg_match('/\bkampus\s*(?:ii|2)\b/i', $lokasi) === 1) {
            return 'Kampus 2';
        }
        if (preg_match('/\bkampus\s*(?:i|1)\b/i', $lokasi) === 1 || stripos($lokasi, 'mrican') !== false) {
            return 'Kampus 1';
        }

        return $default;
    }

    /**
     * Kembalikan Closure rule validasi untuk input foto.
     */
    public static function fotoValidationRule(): \Closure
    {
        return static function (string $attribute, mixed $value, \Closure $fail): void {
            self::validateFotoValue($attribute, $value, $fail);
        };
    }

    /**
     * Aturan validasi bersama untuk input foto (string data URI/URL/JSON atau file gambar).
     */
    public static function validateFotoValue(string $attribute, mixed $value, \Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }

        if (is_string($value) || $value instanceof UploadedFile) {
            return;
        }

        if (is_array($value)) {
            foreach ($value as $item) {
                if (! is_string($item) && ! ($item instanceof UploadedFile)) {
                    $fail("Format {$attribute} harus berupa file gambar atau URL/data gambar yang valid.");

                    return;
                }
            }

            return;
        }

        $fail("Format {$attribute} harus berupa file gambar atau URL/data gambar yang valid.");
    }
}
