<?php

namespace App\Http\Middleware;

use App\Models\Admin;
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

        $admin = $session?->admin;

        if (
            ! $admin
            || ! in_array($admin->role, ['BLU', 'BPS', 'BOTH'], true)
            || ! array_key_exists($admin->jabatan, Admin::POSITIONS)
            || Admin::POSITIONS[$admin->jabatan]['role'] !== $admin->role
        ) {
            return response()->json(['message' => 'Sesi admin tidak valid atau sudah berakhir.'], 401);
        }

        $request->attributes->set('admin_session', $session);

        return $next($request);
    }
}
