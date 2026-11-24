<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Pelapor;
use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use App\Models\UserSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const SESSION_TTL_HOURS = 12;

    /**
     * Registrasi Akun Mahasiswa atau Karyawan
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tipe_user' => 'required|in:mahasiswa,karyawan',
            'nomor_identitas' => 'required|string|max:50',
            'nama' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'no_handphone' => 'required|string|max:20',
            'password' => 'required|string|min:6|confirmed',
        ], [
            'tipe_user.required' => 'Tipe pengguna wajib dipilih.',
            'tipe_user.in' => 'Tipe pengguna harus berupa mahasiswa atau karyawan.',
            'nomor_identitas.required' => 'Nomor Identitas wajib diisi.',
            'nama.required' => 'Nama lengkap wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'no_handphone.required' => 'Nomor WhatsApp / Handphone wajib diisi.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.min' => 'Kata sandi minimal 6 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $nomorIdentitas = trim($request->nomor_identitas);
        $tipeUser = $request->tipe_user;
        $email = mb_strtolower(trim($request->email));
        $labelIdentitas = $tipeUser === 'karyawan' ? 'Nomor Identitas Pegawai / NIP / NPK' : 'NIM';

        try {
            if (
                UserMahasiswa::where('email', $email)->exists()
                || UserPegawai::where('email', $email)->exists()
                || Admin::where('email', $email)->exists()
            ) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Email tersebut sudah digunakan oleh akun lain.',
                ], 409);
            }

            $exists = Pelapor::where('nomor_identitas', $nomorIdentitas)->exists();
            if ($exists) {
                return response()->json([
                    'status' => 'error',
                    'message' => "{$labelIdentitas} ({$nomorIdentitas}) sudah terdaftar di sistem. Silakan login.",
                ], 409);
            }

            $user = DB::transaction(function () use ($nomorIdentitas, $tipeUser, $request, $email) {
                Pelapor::create([
                    'nomor_identitas' => $nomorIdentitas,
                    'tipe_user' => $tipeUser,
                ]);

                $userData = [
                    'nama' => trim($request->nama),
                    'email' => $email,
                    'password' => Hash::make($request->password),
                    'no_handphone' => trim($request->no_handphone),
                ];

                if ($tipeUser === 'karyawan') {
                    return UserPegawai::create([
                        ...$userData,
                        'nomor_identitas' => $nomorIdentitas,
                    ]);
                }

                return UserMahasiswa::create([
                    ...$userData,
                    'nim' => $nomorIdentitas,
                ]);
            });

            // Pastikan user berhasil dibuat
            if (!$user) {
                throw new \Exception('Gagal membuat akun pengguna.');
            }

            $token = Str::random(60);
            $userIdentifier = $tipeUser === 'karyawan' ? $user->nomor_identitas : $user->nim;
            $session = $this->createUserSession($tipeUser, $userIdentifier, $token);

            return response()->json([
                'status' => 'success',
                'message' => 'Registrasi berhasil! Selamat datang di Lapor Sadhar.',
                'token' => $token,
                'expires_at' => $session->expires_at?->toIso8601String(),
                'user' => [
                    'nomor_identitas' => $userIdentifier,
                    'nim' => $userIdentifier,
                    'nama' => $user->nama,
                    'email' => $user->email,
                    'no_handphone' => $user->no_handphone,
                    'tipe_user' => $tipeUser,
                    'role' => $tipeUser === 'karyawan' ? 'Karyawan' : 'Mahasiswa',
                ],
                'redirect_to' => '/buat-laporan',
            ], 201);
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'could not find driver')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Driver database pgsql belum dimuat. Silakan restart terminal "php artisan serve" agar konfigurasi php.ini terbaru diterapkan.',
                ], 500);
            }
            if (str_contains($msg, 'Unknown host') || str_contains($msg, 'Connection refused') || str_contains($msg, 'password authentication failed')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Koneksi ke Supabase gagal. Silakan periksa kembali DB_HOST dan DB_PASSWORD di backend/.env.',
                ], 500);
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Terjadi kesalahan server: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Login Akun (Mahasiswa, Karyawan, atau Admin)
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'identifier' => 'required|string',
            'password' => 'required|string',
            'role' => 'nullable|string|in:mahasiswa,karyawan,semua',
        ], [
            'identifier.required' => 'Nomor Identitas (NIM/NIP) atau Username wajib diisi.',
            'password.required' => 'Kata sandi wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $identifier = trim($request->identifier);
        $password = $request->password;
        $preferredRole = $request->input('role') ?? 'semua';

        try {
            $user = null;
            $tipe = $preferredRole === 'semua'
                ? Pelapor::where('nomor_identitas', $identifier)->value('tipe_user')
                : $preferredRole;

            if ($tipe === 'mahasiswa') {
                $user = UserMahasiswa::where('nim', $identifier)->first();
            } elseif ($tipe === 'karyawan') {
                $user = UserPegawai::where('nomor_identitas', $identifier)->first();
            }

            if ($user && Hash::check($password, $user->password)) {
                $roleLabel = $tipe === 'karyawan' ? 'Karyawan' : 'Mahasiswa';
                $token = Str::random(60);
                $userIdentifier = $tipe === 'karyawan' ? $user->nomor_identitas : $user->nim;
                $session = $this->createUserSession($tipe, $userIdentifier, $token);

                return response()->json([
                    'status' => 'success',
                    'message' => "Login berhasil! Selamat datang, {$user->nama}.",
                    'token' => $token,
                    'expires_at' => $session->expires_at?->toIso8601String(),
                    'user' => [
                        'nomor_identitas' => $userIdentifier,
                        'nim' => $userIdentifier,
                        'nama' => $user->nama,
                        'email' => $user->email,
                        'no_handphone' => $user->no_handphone,
                        'tipe_user' => $tipe,
                        'role' => $roleLabel,
                    ],
                    'redirect_to' => '/buat-laporan',
                ]);
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Nomor Identitas (NIM/NIP) atau kata sandi yang Anda masukkan salah.',
            ], 401);

        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'could not find driver')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Driver database pgsql belum dimuat. Silakan restart terminal "php artisan serve" agar konfigurasi php.ini terbaru diterapkan.',
                ], 500);
            }
            if (str_contains($msg, 'Unknown host') || str_contains($msg, 'Connection refused') || str_contains($msg, 'password authentication failed')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Koneksi ke Supabase gagal. Silakan periksa kembali DB_HOST dan DB_PASSWORD di backend/.env.',
                ], 500);
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Terjadi kesalahan server: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Logout
     */
    public function logout(Request $request)
    {
        if ($token = $request->bearerToken()) {
            UserSession::where('token_hash', hash('sha256', $token))->delete();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil keluar dari akun.',
        ]);
    }

    /**
     * Get current user profile
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->attributes->get('authenticated_user');
        $session = $request->attributes->get('user_session');
        $identifier = $session->account_id;
        $roleLabel = $session->account_type === 'karyawan' ? 'Karyawan' : 'Mahasiswa';

        return response()->json([
            'status' => 'success',
            'expires_at' => $session->expires_at?->toIso8601String(),
            'user' => [
                'nomor_identitas' => $identifier,
                'nim' => $identifier,
                'nama' => $user->nama,
                'email' => $user->email,
                'no_handphone' => $user->no_handphone,
                'tipe_user' => $session->account_type,
                'role' => $roleLabel,
            ],
        ]);
    }

    /**
     * Update user profile (phone number, email, and/or name)
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nama' => 'nullable|string|max:255',
            'no_handphone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
        ], [
            'email.email' => 'Format email tidak valid.',
            'no_handphone.max' => 'Nomor WhatsApp / Handphone maksimal 20 karakter.',
            'nama.max' => 'Nama maksimal 255 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->attributes->get('authenticated_user');
        $session = $request->attributes->get('user_session');

        $updates = [];

        if ($request->has('nama') && trim((string) $request->nama) !== '') {
            $updates['nama'] = trim($request->nama);
        }

        if ($request->has('no_handphone')) {
            $updates['no_handphone'] = trim((string) $request->no_handphone);
        }

        if ($request->has('email')) {
            $rawEmail = $request->email;
            if ($rawEmail !== null && trim((string) $rawEmail) !== '') {
                $newEmail = mb_strtolower(trim($rawEmail));

                // Check uniqueness across user_mahasiswa, user_pegawai, admin
                $isUsed = UserMahasiswa::where('email', $newEmail)
                    ->when($user instanceof UserMahasiswa, fn ($q) => $q->where('nim', '!=', $user->nim))
                    ->exists()
                    || UserPegawai::where('email', $newEmail)
                    ->when($user instanceof UserPegawai, fn ($q) => $q->where('nomor_identitas', '!=', $user->nomor_identitas))
                    ->exists()
                    || Admin::where('email', $newEmail)->exists();

                if ($isUsed) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Email tersebut sudah digunakan oleh akun lain.',
                    ], 422);
                }

                $updates['email'] = $newEmail;
            } elseif ($rawEmail === null || trim((string) $rawEmail) === '') {
                $updates['email'] = null;
            }
        }

        if (! empty($updates)) {
            $user->update($updates);
        }

        $user->refresh();
        $identifier = $session->account_id;
        $roleLabel = $session->account_type === 'karyawan' ? 'Karyawan' : 'Mahasiswa';

        return response()->json([
            'status' => 'success',
            'message' => 'Profil berhasil diperbarui.',
            'user' => [
                'nomor_identitas' => $identifier,
                'nim' => $identifier,
                'nama' => $user->nama,
                'email' => $user->email,
                'no_handphone' => $user->no_handphone,
                'tipe_user' => $session->account_type,
                'role' => $roleLabel,
            ],
        ]);
    }

    /**
     * Change user password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'password' => 'required|string|min:6|confirmed',
        ], [
            'current_password.required' => 'Kata sandi saat ini wajib diisi.',
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.min' => 'Kata sandi baru minimal 6 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi baru tidak cocok.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->attributes->get('authenticated_user');
        $session = $request->attributes->get('user_session');

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kata sandi saat ini tidak sesuai.',
            ], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // Hapus sesi lain milik user ini, pertahankan sesi saat ini
        UserSession::where('account_type', $session->account_type)
            ->where('account_id', $session->account_id)
            ->where('id', '!=', $session->id)
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi berhasil diubah.',
        ]);
    }

    private function createUserSession(string $type, string $identifier, string $token): UserSession
    {
        return UserSession::create([
            'account_type' => $type,
            'account_id' => $identifier,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHours(self::SESSION_TTL_HOURS),
        ]);
    }
}
