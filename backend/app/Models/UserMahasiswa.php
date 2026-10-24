<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class UserMahasiswa extends Authenticatable
{
    use HasFactory;

    protected $table = 'user_mahasiswa';

    protected $primaryKey = 'nim';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'nim',
        'nama',
        'password',
        'no_handphone',
    ];

    protected $hidden = [
        'password',
    ];

    public function laporans()
    {
        return $this->hasMany(Laporan::class, 'nim', 'nim');
    }
}
