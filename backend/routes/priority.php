<?php

use App\Http\Controllers\Priority\PriorityDashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Priority Dashboard Routes
|--------------------------------------------------------------------------
| - Rute admin dilindungi middleware admin.session (Admin BLU & BPS).
| - Rute publik/user sementara disediakan agar pelapor dapat mengakses
|   tampilan dashboard prioritas dari portal pengguna.
*/

// Rute Admin (Aksi penuh termasuk penetapan tingkat kerusakan oleh admin)
Route::middleware('admin.session')->prefix('admin/priority')->group(function () {
    Route::get('/reports', [PriorityDashboardController::class, 'index']);
    Route::get('/reports/{id}', [PriorityDashboardController::class, 'show']);
    Route::patch('/reports/{id}/severity', [PriorityDashboardController::class, 'updateSeverity']);
    Route::get('/summary', [PriorityDashboardController::class, 'summary']);
    Route::post('/recalculate', [PriorityDashboardController::class, 'recalculateAll']);
});

// Rute Sementara untuk Halaman Pengguna (Pelapor)
Route::prefix('priority')->group(function () {
    Route::get('/reports', [PriorityDashboardController::class, 'index']);
    Route::get('/reports/{id}', [PriorityDashboardController::class, 'show']);
    Route::get('/summary', [PriorityDashboardController::class, 'summary']);
});
