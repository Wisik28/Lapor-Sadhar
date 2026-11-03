<?php

namespace App\Http\Middleware;

use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use App\Models\UserSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateUserSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        if (! $plainToken) {
            return response()->json(['message' => 'Sesi pengguna diperlukan.'], 401);
        }

        $session = UserSession::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->where('expires_at', '>', now())
            ->first();

        $user = match ($session?->account_type) {
            'mahasiswa' => UserMahasiswa::find($session->account_id),
            'karyawan' => UserPegawai::find($session->account_id),
            default => null,
        };

        if (! $session || ! $user) {
            return response()->json(['message' => 'Sesi pengguna tidak valid atau sudah berakhir.'], 401);
        }

        $request->attributes->set('user_session', $session);
        $request->attributes->set('authenticated_user', $user);

        return $next($request);
    }
}
