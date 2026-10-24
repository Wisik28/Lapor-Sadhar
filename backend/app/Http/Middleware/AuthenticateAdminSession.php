<?php

namespace App\Http\Middleware;

use App\Models\AdminSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateAdminSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        if (! $plainToken) {
            return response()->json(['message' => 'Sesi admin diperlukan.'], 401);
        }

        $session = AdminSession::with('admin')
            ->where('token_hash', hash('sha256', $plainToken))
            ->where('expires_at', '>', now())
            ->first();

        if (
            ! $session
            || ! in_array($session->admin->role, ['BLU', 'BPS'], true)
            || ! in_array($session->admin->campus, ['Kampus I', 'Kampus II', 'Kampus III', 'Kampus IV', 'Kampus V'], true)
        ) {
            return response()->json(['message' => 'Sesi admin tidak valid atau sudah berakhir.'], 401);
        }

        $request->attributes->set('admin_session', $session);

        return $next($request);
    }
}
