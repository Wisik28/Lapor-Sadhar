<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Admin extends Authenticatable
{
    use HasFactory;

    public const POSITIONS = [
        'wakil_rektor_ii' => ['label' => 'Wakil Rektor II', 'role' => 'BOTH', 'campus' => null],
        'kepala_blu' => ['label' => 'Kepala Biro Layanan Umum', 'role' => 'BLU', 'campus' => null],
        'kepala_bps' => ['label' => 'Kepala Biro Prasarana dan Sarana', 'role' => 'BPS', 'campus' => null],
        'kepala_bagian_blu_1' => ['label' => 'Kepala Bagian BLU Kampus I', 'role' => 'BLU', 'campus' => 'Kampus 1'],
        'kepala_bagian_blu_2' => ['label' => 'Kepala Bagian BLU Kampus II', 'role' => 'BLU', 'campus' => 'Kampus 2'],
        'kepala_bagian_blu_3' => ['label' => 'Kepala Bagian BLU Kampus III', 'role' => 'BLU', 'campus' => 'Kampus 3'],
        'kepala_bagian_blu_4' => ['label' => 'Kepala Bagian BLU Kampus IV', 'role' => 'BLU', 'campus' => 'Kampus 4'],
        'kepala_bagian_bps_1' => ['label' => 'Kepala Bagian BPS Kampus I', 'role' => 'BPS', 'campus' => 'Kampus 1'],
        'kepala_bagian_bps_2' => ['label' => 'Kepala Bagian BPS Kampus II', 'role' => 'BPS', 'campus' => 'Kampus 2'],
        'kepala_bagian_bps_3' => ['label' => 'Kepala Bagian BPS Kampus III', 'role' => 'BPS', 'campus' => 'Kampus 3'],
        'kepala_bagian_bps_4' => ['label' => 'Kepala Bagian BPS Kampus IV', 'role' => 'BPS', 'campus' => 'Kampus 4'],
    ];

    public const USERNAMES = [
        'wakil_rektor_ii' => 'admin.wr2',
        'kepala_blu' => 'kepala.blu',
        'kepala_bps' => 'kepala.bps',
        'kepala_bagian_blu_1' => 'blu.kampus1',
        'kepala_bagian_blu_2' => 'blu.kampus2',
        'kepala_bagian_blu_3' => 'blu.kampus3',
        'kepala_bagian_blu_4' => 'blu.kampus4',
        'kepala_bagian_bps_1' => 'bps.kampus1',
        'kepala_bagian_bps_2' => 'bps.kampus2',
        'kepala_bagian_bps_3' => 'bps.kampus3',
        'kepala_bagian_bps_4' => 'bps.kampus4',
    ];

    public const LEGACY_USERNAMES = [
        'wakil_rektor_ii' => 'admin.wakil_rektor_ii',
        'kepala_blu' => 'blu.kampus1',
        'kepala_bps' => 'bps.kampus1',
        'kepala_bagian_blu_1' => 'blu.kampus2',
        'kepala_bagian_blu_2' => 'blu.kampus3',
        'kepala_bagian_blu_3' => 'blu.kampus4',
        'kepala_bagian_blu_4' => 'blu.kampus5',
        'kepala_bagian_bps_1' => 'bps.kampus2',
        'kepala_bagian_bps_2' => 'bps.kampus3',
        'kepala_bagian_bps_3' => 'bps.kampus4',
        'kepala_bagian_bps_4' => 'bps.kampus5',
    ];

    protected $table = 'admin';

    protected $primaryKey = 'admin_id';

    protected $fillable = [
        'nama_admin',
        'username',
        'password',
        'role',
        'campus',
        'email',
        'jabatan',
    ];

    protected $hidden = [
        'password',
    ];

    public function sessions(): HasMany
    {
        return $this->hasMany(AdminSession::class, 'admin_id', 'admin_id');
    }

    /**
     * Kembalikan kampus yang dikelola admin ini, atau null jika lintas semua kampus.
     */
    public function resolvedCampus(): ?string
    {
        $campusFromPosition = self::POSITIONS[$this->jabatan]['campus'] ?? null;

        return Laporan::normalizeCampus($this->campus) ?? $campusFromPosition;
    }

    /**
     * Kembalikan kategori laporan yang menjadi wewenang unit admin (BPS -> Fasilitas, BLU -> Kebersihan, BOTH -> null).
     */
    public function allowedKategoriLaporan(): ?string
    {
        return match ($this->role) {
            'BPS' => 'Fasilitas',
            'BLU' => 'Kebersihan',
            default => null,
        };
    }

    /**
     * Periksa apakah admin berwenang mengakses/mengubah laporan sesuai kampus dan unitnya.
     */
    public function canAccessLaporan(Laporan $laporan): bool
    {
        $campus = $this->resolvedCampus();
        if ($campus !== null && Laporan::normalizeCampus($laporan->lokasi_kampus) !== $campus) {
            return false;
        }

        $kategori = $this->allowedKategoriLaporan();
        if ($kategori !== null && strcasecmp((string) $laporan->kategori_laporan, $kategori) !== 0) {
            return false;
        }

        return true;
    }

    /**
     * Wakil Rektor II hanya dapat melihat laporan. Admin unit lain dapat mengubah
     * laporan yang sesuai dengan cakupan kampus dan kategori unitnya.
     */
    public function canEditLaporan(Laporan $laporan): bool
    {
        if ($this->jabatan === 'wakil_rektor_ii' || $this->role === 'BOTH') {
            return false;
        }

        return $this->canAccessLaporan($laporan);
    }
}
