<?php

use App\Http\Controllers\Priority\PriorityDashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Priority Dashboard Routes (Khusus Admin BLU & BPS)
|--------------------------------------------------------------------------
| Seluruh rute dilindungi middleware admin.session sehingga hanya dapat
| diakses oleh sesi admin yang valid. Civitas / pelapor tidak dapat mengakses.
*/

Route::middleware('admin.session')->prefix('admin/priority')->group(function () {
    Route::get('/reports', [PriorityDashboardController::class, 'index']);
    Route::get('/reports/{id}', [PriorityDashboardController::class, 'show']);
    Route::patch('/reports/{id}/severity', [PriorityDashboardController::class, 'updateSeverity']);
    Route::get('/summary', [PriorityDashboardController::class, 'summary']);
    Route::post('/recalculate', [PriorityDashboardController::class, 'recalculateAll']);
});

