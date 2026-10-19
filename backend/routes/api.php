<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LaporanController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/ping', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'API Lapor-Sadhar is running'
    ]);
});

// Authentication Routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);

// Laporan Routes
Route::get('/laporan', [LaporanController::class, 'index']);          // GET /api/laporan?nim=xxx
Route::post('/laporan', [LaporanController::class, 'store']);          // POST /api/laporan
Route::get('/laporan/rekap', [LaporanController::class, 'rekap']);    // GET /api/laporan/rekap?nim=xxx
Route::get('/laporan/{id}', [LaporanController::class, 'show']);       // GET /api/laporan/{id}
Route::put('/laporan/{id}', [LaporanController::class, 'update']);     // PUT /api/laporan/{id}
Route::delete('/laporan/{id}', [LaporanController::class, 'destroy']); // DELETE /api/laporan/{id}
