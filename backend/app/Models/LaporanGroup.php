<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LaporanGroup extends Model
{
    use HasFactory;

    protected $table = 'laporan_groups';

    protected $fillable = [
        'primary_laporan_id',
        'kategori_laporan',
        'lokasi_kampus',
        'normalized_location',
        'unique_reporter_count',
        'total_laporan_count',
        'is_escalated',
        'escalated_at',
        'similarity_confidence',
        'similarity_reason',
    ];

    protected $casts = [
        'primary_laporan_id'    => 'integer',
        'unique_reporter_count' => 'integer',
        'total_laporan_count'   => 'integer',
        'is_escalated'          => 'boolean',
        'escalated_at'          => 'datetime',
        'similarity_confidence' => 'float',
    ];

    public function primaryLaporan(): BelongsTo
    {
        return $this->belongsTo(Laporan::class, 'primary_laporan_id', 'id_laporan');
    }

    public function laporans(): HasMany
    {
        return $this->hasMany(Laporan::class, 'group_id', 'id');
    }
}

