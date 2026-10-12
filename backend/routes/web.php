
<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Auth\MahasiswaAuthController;
use App\Http\Controllers\Auth\AdminAuthController;

Route::get('/', function () {
    return view('welcome');
});

// Endpoint untuk mengecek koneksi database Supabase PostgreSQL
Route::get('/check-db', function () {
    try {
        DB::connection()->getPdo();
        $dbName = DB::connection()->getDatabaseName();

        return response()->json([
            'status' => 'success',
            'message' => "Berhasil terhubung ke database PostgreSQL Supabase ($dbName)!"
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Gagal terhubung ke database.'
        ], 500);
    }
});

// Registrasi mahasiswa
Route::get('/register', [MahasiswaAuthController::class, 'showRegister'])
    ->name('mahasiswa.register');

Route::post('/register', [MahasiswaAuthController::class, 'register'])
    ->name('mahasiswa.register.submit');

// Login mahasiswa
Route::get('/login', [MahasiswaAuthController::class, 'showLogin'])
    ->name('mahasiswa.login');

Route::post('/login', [MahasiswaAuthController::class, 'login'])
    ->name('mahasiswa.login.submit');

Route::post('/logout', [MahasiswaAuthController::class, 'logout'])
    ->name('mahasiswa.logout');

// Login admin
Route::get('/admin/login', [AdminAuthController::class, 'showLogin'])
    ->name('admin.login');

Route::post('/admin/login', [AdminAuthController::class, 'login'])
    ->name('admin.login.submit');

Route::post('/admin/logout', [AdminAuthController::class, 'logout'])
    ->name('admin.logout');
