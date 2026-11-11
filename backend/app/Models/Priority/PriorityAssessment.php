<?php

namespace App\Models\Priority;

use App\Models\Admin;
use App\Models\Laporan;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PriorityAssessment extends Model
{
    use HasFactory;

    protected $table = 'priority_assessments';

    protected $fillable = [
        'id_laporan',
        'kategori',
        'severity_level',
        'severity_source',
        'ai_suggested_severity',
        'admin_severity',
        'priority_score',
        'priority_level',
        'confidence',
        'dimensions',
        'safety_flags',
        'reasons',
        'needs_review',
        'admin_notes',
        'admin_id',
        'reviewed_at',
    ];

    protected $casts = [
        'priority_score' => 'integer',
        'confidence'     => 'float',
        'dimensions'     => 'array',
        'safety_flags'   => 'array',
        'reasons'        => 'array',
        'needs_review'   => 'boolean',
        'reviewed_at'    => 'datetime',
    ];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(Laporan::class, 'id_laporan', 'id_laporan');
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id', 'admin_id');
    }

    public function feedback(): HasMany
    {
        return $this->hasMany(PriorityFeedback::class, 'id_laporan', 'id_laporan');
    }
}

