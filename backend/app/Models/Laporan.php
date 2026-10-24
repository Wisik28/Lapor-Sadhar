<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Laporan extends Model
{
    use HasFactory;

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
        'tanggal_rubah',
    ];

    public function pelapor()
    {
        return $this->belongsTo(Pelapor::class, 'nim', 'nomor_identitas');
    }

    public function statuses()
    {
        return $this->hasMany(Status::class, 'id_laporan', 'id_laporan');
    }
}
