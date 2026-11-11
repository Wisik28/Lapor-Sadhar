<?php

namespace App\Models\Priority;

use App\Models\Admin;
use App\Models\Laporan;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriorityFeedback extends Model
{
    use HasFactory;

    protected $table = 'priority_feedback';

    protected $fillable = [
        'id_laporan',
        'admin_id',
        'original_level',
        'corrected_level',
        'note',
    ];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(Laporan::class, 'id_laporan', 'id_laporan');
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id', 'admin_id');
    }
}

