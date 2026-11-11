<?php

namespace App\Observers;

use App\Models\Laporan;
use App\Services\Priority\PriorityScoringService;

class PriorityLaporanObserver
{
    private PriorityScoringService $scoringService;

    public function __construct(PriorityScoringService $scoringService)
    {
        $this->scoringService = $scoringService;
    }

    /**
     * Handle the Laporan "created" event.
     */
    public function created(Laporan $laporan): void
    {
        try {
            $this->scoringService->assessAndSave($laporan);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}

