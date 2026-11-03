<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;

class ValidateSession
{
    /**
     * Validasi bahwa session masih aktif dan belum expired
     * Digunakan untuk melindungi API endpoints yang memerlukan autentikasi
     */
    public function handle(Request $request, Closure $next)
    {
        // Cek apakah session sudah di-load
        if (!$request->session()->has('authenticated')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Session tidak ditemukan. Silakan login kembali.',
            ], 401);
        }

        // Cek session lifetime - jika sudah melebihi 60 menit
        $lastActivity = $request->session()->get('last_activity');
        $sessionTimeout = config('session.lifetime') * 60; // Convert to seconds

        if ($lastActivity && (time() - $lastActivity) > $sessionTimeout) {
            // Session sudah expired
            $request->session()->flush();
            return response()->json([
                'status' => 'error',
                'message' => 'Session Anda telah berakhir. Silakan login kembali.',
            ], 401);
        }

        // Update last activity time
        $request->session()->put('last_activity', time());

        // Tambahkan user info ke request untuk digunakan di controller
        $request->merge([
            'authenticated_user' => $request->session()->get('user'),
        ]);

        return $next($request);
    }
}
