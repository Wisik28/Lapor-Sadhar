<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Pelapor extends Model
{
    protected $table = 'pelapor';

    protected $primaryKey = 'nomor_identitas';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'nomor_identitas',
        'tipe_user',
    ];

    public function mahasiswa(): HasOne
    {
        return $this->hasOne(UserMahasiswa::class, 'nim', 'nomor_identitas');
    }

    public function pegawai(): HasOne
    {
        return $this->hasOne(UserPegawai::class, 'nomor_identitas', 'nomor_identitas');
    }
}
