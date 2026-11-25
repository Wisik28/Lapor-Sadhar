<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminNotification extends Model
{
    public const TYPE_NEW_REPORT = 'laporan_baru';
    public const TYPE_REVISED_REPORT = 'revisi_laporan';

    protected $table = 'admin_notifications';

    protected $fillable = [
        'admin_id',
        'id_laporan',
        'jenis_aktivitas',
        'judul',
        'pesan',
        'nama_pelapor',
        'nim_pelapor',
        'kategori_laporan',
        'lokasi_kampus',
        'lokasi',
        'tanggal_kejadian',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'admin_id'   => 'integer',
        'id_laporan' => 'integer',
        'is_read'    => 'boolean',
        'read_at'    => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id', 'admin_id');
    }

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(Laporan::class, 'id_laporan', 'id_laporan');
    }

    public function getActivityLabel(): string
    {
        return match ($this->jenis_aktivitas) {
            self::TYPE_REVISED_REPORT => 'Revisi Pengajuan',
            default => 'Laporan Baru',
        };
    }

    public function toApiArray(): array
    {
        $formattedId = str_pad((string) $this->id_laporan, 3, '0', STR_PAD_LEFT);

        return [
            'id'               => (int) $this->id,
            'id_laporan'       => (int) $this->id_laporan,
            'kode_laporan'     => $formattedId,
            'jenis_aktivitas'  => $this->jenis_aktivitas,
            'label_aktivitas'  => $this->getActivityLabel(),
            'judul'            => $this->judul,
            'pesan'            => $this->pesan,
            'nama_pelapor'     => $this->nama_pelapor ?: ($this->nim_pelapor ? "Pelapor ({$this->nim_pelapor})" : 'Civitas USD'),
            'nim_pelapor'      => $this->nim_pelapor,
            'kategori_laporan' => $this->kategori_laporan,
            'lokasi_kampus'    => $this->lokasi_kampus,
            'lokasi'           => $this->lokasi,
            'tanggal_kejadian' => $this->tanggal_kejadian ? (string) $this->tanggal_kejadian : null,
            'is_read'          => (bool) $this->is_read,
            'read_at'          => $this->read_at?->toIso8601String(),
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }
}

