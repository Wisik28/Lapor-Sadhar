<?php

namespace App\Observers;

use App\Models\Laporan;
use App\Services\Priority\PriorityScoringService;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Support\Facades\DB;

class PriorityLaporanObserver implements ShouldHandleEventsAfterCommit
{
    private PriorityScoringService $scoringService;

    public function __construct(PriorityScoringService $scoringService)
    {
        $this->scoringService = $scoringService;
    }

    /**
     * Handle the Laporan "created" event after the database transaction commits.
     * Menjalankan penilaian di luar transaksi utama agar tidak pernah membatalkan
     * transaksi pembuatan laporan pada PostgreSQL (SQLSTATE[25P02]).
     */
    public function created(Laporan $laporan): void
    {
        DB::afterCommit(function () use ($laporan) {
            try {
                $this->scoringService->assessAndSave($laporan);
            } catch (\Throwable $e) {
                report($e);
            }
        });
    }

    /**
     * Handle the Laporan "updated" event after the database transaction commits.
     */
    public function updated(Laporan $laporan): void
    {
        DB::afterCommit(function () use ($laporan) {
            try {
                $this->scoringService->assessAndSave($laporan, true);
            } catch (\Throwable $e) {
                report($e);
            }
        });
    }
}


