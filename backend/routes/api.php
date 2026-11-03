<?php

use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailSecurityController;
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
Route::post('/password/forgot', [EmailSecurityController::class, 'requestUserPasswordReset'])->middleware('throttle:3,1');
Route::post('/password/reset', [EmailSecurityController::class, 'resetUserPassword'])->middleware('throttle:10,1');
Route::post('/admin/password/forgot', [EmailSecurityController::class, 'requestAdminPasswordReset'])->middleware('throttle:3,1');
Route::post('/admin/password/reset', [EmailSecurityController::class, 'resetAdminPassword'])->middleware('throttle:10,1');

Route::post('/admin/login', [AdminAuthController::class, 'login'])->middleware('throttle:5,1');
Route::middleware('admin.session')->prefix('admin')->group(function () {
    Route::get('/me', [AdminAuthController::class, 'me']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::put('/password', [AdminAuthController::class, 'changePassword']);
    Route::put('/profile', [AdminAuthController::class, 'updateProfile']);
    Route::post('/email-change/request', [EmailSecurityController::class, 'requestAdminEmailChange'])->middleware('throttle:3,1');
    Route::post('/email-change/confirm', [EmailSecurityController::class, 'confirmAdminEmailChange'])->middleware('throttle:10,1');
    Route::get('/laporan', [LaporanController::class, 'adminIndex']);
    Route::patch('/laporan/{id}/status', [LaporanController::class, 'adminUpdateStatus']);
    Route::get('/rekap', [LaporanController::class, 'adminRekap']);
});

Route::middleware('user.session')->prefix('profile')->group(function () {
    Route::post('/email-change/request', [EmailSecurityController::class, 'requestUserEmailChange'])->middleware('throttle:3,1');
    Route::post('/email-change/confirm', [EmailSecurityController::class, 'confirmUserEmailChange'])->middleware('throttle:10,1');
});

// Laporan Routes (Protected - Require Bearer Token)
Route::middleware('user.session')->group(function () {
    Route::get('/laporan', [LaporanController::class, 'index']);            // GET /api/laporan?nim=xxx
    Route::post('/laporan', [LaporanController::class, 'store']);          // POST /api/laporan
    Route::get('/laporan/{id}', [LaporanController::class, 'show']);       // GET /api/laporan/{id}
    Route::put('/laporan/{id}', [LaporanController::class, 'update']);     // PUT /api/laporan/{id}
    Route::delete('/laporan/{id}', [LaporanController::class, 'destroy']); // DELETE /api/laporan/{id}
});