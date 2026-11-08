<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Admin extends Authenticatable
{
    use HasFactory;

    public const POSITIONS = [
        'wakil_rektor_ii' => ['label' => 'Wakil Rektor II', 'role' => 'BOTH'],
        'kepala_blu' => ['label' => 'Kepala Biro Layanan Umum', 'role' => 'BLU'],
        'kepala_bps' => ['label' => 'Kepala Biro Sarana dan Prasarana', 'role' => 'BPS'],
        'kepala_bagian_blu_1' => ['label' => 'Kepala Bagian BLU 1', 'role' => 'BLU'],
        'kepala_bagian_blu_2' => ['label' => 'Kepala Bagian BLU 2', 'role' => 'BLU'],
        'kepala_bagian_blu_3' => ['label' => 'Kepala Bagian BLU 3', 'role' => 'BLU'],
        'kepala_bagian_blu_4' => ['label' => 'Kepala Bagian BLU 4', 'role' => 'BLU'],
        'kepala_bagian_bps_1' => ['label' => 'Kepala Bagian BPS 1', 'role' => 'BPS'],
        'kepala_bagian_bps_2' => ['label' => 'Kepala Bagian BPS 2', 'role' => 'BPS'],
        'kepala_bagian_bps_3' => ['label' => 'Kepala Bagian BPS 3', 'role' => 'BPS'],
        'kepala_bagian_bps_4' => ['label' => 'Kepala Bagian BPS 4', 'role' => 'BPS'],
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
}
