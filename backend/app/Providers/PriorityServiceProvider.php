<?php

namespace App\Providers;

use App\Models\Laporan;
use App\Observers\PriorityLaporanObserver;
use App\Services\Priority\GeminiSimilarityVerifier;
use App\Services\Priority\LocationCategorizer;
use App\Services\Priority\LocationDetailNormalizer;
use App\Services\Priority\LocationSeverityAssessor;
use App\Services\Priority\PriorityScoringService;
use App\Services\Priority\ReportSimilarityGroupingService;
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

        $this->app->singleton(LocationCategorizer::class, fn () => new LocationCategorizer());
        $this->app->singleton(
            LocationSeverityAssessor::class,
            fn ($app) => new LocationSeverityAssessor($app->make(LocationCategorizer::class))
        );
        $this->app->singleton(LocationDetailNormalizer::class, fn () => new LocationDetailNormalizer());
        $this->app->singleton(GeminiSimilarityVerifier::class, fn () => new GeminiSimilarityVerifier());
        $this->app->singleton(
            ReportSimilarityGroupingService::class,
            fn ($app) => new ReportSimilarityGroupingService(
                $app->make(LocationDetailNormalizer::class),
                $app->make(GeminiSimilarityVerifier::class),
                $app->make(PriorityScoringService::class)
            )
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

