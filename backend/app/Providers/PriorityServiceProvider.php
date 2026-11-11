<?php

namespace App\Providers;

use App\Models\Laporan;
use App\Observers\PriorityLaporanObserver;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class PriorityServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(
            base_path('config/priority.php'),
            'priority'
        );
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // 1. Daftarkan observer pada model Laporan tanpa mengubah file model
        Laporan::observe(PriorityLaporanObserver::class);

        // 2. Muat rute priority di bawah prefix /api
        Route::prefix('api')
            ->middleware('api')
            ->group(base_path('routes/priority.php'));
    }
}

