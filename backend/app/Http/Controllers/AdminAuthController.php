<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\AdminSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AdminAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255',
            'password' => 'required|string',
            'role' => 'required|in:BLU,BPS',
            'campus' => 'required|in:Kampus I,Kampus II,Kampus III,Kampus IV,Kampus V',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $admin = Admin::where('username', trim($request->username))
            ->where('role', $request->role)
            ->where('campus', $request->campus)
            ->first();

        if (! $admin || ! Hash::check($request->password, $admin->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Username atau kata sandi admin tidak valid.',
            ], 401);
        }

        $plainToken = Str::random(80);
        AdminSession::create([
            'admin_id' => $admin->admin_id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => now()->addHours(8),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Login admin berhasil.',
            'token' => $plainToken,
            'user' => $this->adminData($admin),
            'redirect_to' => '/admin/dashboard',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'user' => $this->adminData($request->attributes->get('admin_session')->admin),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->attributes->get('admin_session')->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil keluar dari akun admin.',
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'password' => 'required|string|min:12|confirmed',
        ], [
            'password.min' => 'Kata sandi baru minimal 12 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $session = $request->attributes->get('admin_session');
        $admin = $session->admin;

        if (! Hash::check($request->current_password, $admin->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kata sandi saat ini tidak sesuai.',
            ], 422);
        }

        $admin->update(['password' => Hash::make($request->password)]);
        AdminSession::where('admin_id', $admin->admin_id)
            ->where('id', '!=', $session->id)
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi berhasil diubah.',
        ]);
    }

    private function adminData(Admin $admin): array
    {
        return [
            'admin_id' => $admin->admin_id,
            'username' => $admin->username,
            'nama' => $admin->nama_admin,
            'role' => 'Admin',
            'role_detail' => $admin->role,
            'campus' => $admin->campus,
        ];
    }
}
