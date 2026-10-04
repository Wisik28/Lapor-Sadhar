<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

Route::get('/', function () {
    return view('welcome');
});

// Endpoint untuk mengecek status koneksi ke database Supabase PostgreSQL
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
            'message' => 'Gagal terhubung ke database: ' . $e->getMessage()
        ], 500);
    }
});

