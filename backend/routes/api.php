<?php

use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\LaporanController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'API Lapor-Sadhar is running',
    ]);
});

// Authentication Routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::post('/admin/login', [AdminAuthController::class, 'login'])->middleware('throttle:5,1');
Route::middleware('admin.session')->prefix('admin')->group(function () {
    Route::get('/me', [AdminAuthController::class, 'me']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::put('/password', [AdminAuthController::class, 'changePassword']);
});

// Laporan Routes
Route::get('/laporan', [LaporanController::class, 'index']);          // GET /api/laporan?nim=xxx
Route::post('/laporan', [LaporanController::class, 'store']);          // POST /api/laporan
Route::get('/laporan/{id}', [LaporanController::class, 'show']);       // GET /api/laporan/{id}
Route::put('/laporan/{id}', [LaporanController::class, 'update']);     // PUT /api/laporan/{id}
Route::delete('/laporan/{id}', [LaporanController::class, 'destroy']); // DELETE /api/laporan/{id}
