<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class UserPegawai extends Authenticatable
{
    use HasFactory;

    protected $table = 'user_pegawai';

    protected $primaryKey = 'nomor_identitas';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'nomor_identitas',
        'nama',
        'password',
        'no_handphone',
    ];

    protected $hidden = [
        'password',
    ];

    public function laporans()
    {
        return $this->hasMany(Laporan::class, 'nim', 'nomor_identitas');
    }
}
