<?php

namespace App\Http\Controllers;

use App\Models\Pelapor;
use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Registrasi Akun Mahasiswa atau Karyawan
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tipe_user' => 'required|in:mahasiswa,karyawan',
            'nomor_identitas' => 'required|string|max:50',
            'nama' => 'required|string|max:255',
            'no_handphone' => 'required|string|max:20',
            'password' => 'required|string|min:6|confirmed',
        ], [
            'tipe_user.required' => 'Tipe pengguna wajib dipilih.',
            'tipe_user.in' => 'Tipe pengguna harus berupa mahasiswa atau karyawan.',
            'nomor_identitas.required' => 'Nomor Identitas wajib diisi.',
            'nama.required' => 'Nama lengkap wajib diisi.',
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
        $labelIdentitas = $tipeUser === 'karyawan' ? 'Nomor Identitas Pegawai / NIP / NPK' : 'NIM';

        try {
            $exists = Pelapor::where('nomor_identitas', $nomorIdentitas)->exists();
            if ($exists) {
                return response()->json([
                    'status' => 'error',
                    'message' => "{$labelIdentitas} ({$nomorIdentitas}) sudah terdaftar di sistem. Silakan login.",
                ], 409);
            }

            $user = DB::transaction(function () use ($nomorIdentitas, $tipeUser, $request) {
                Pelapor::create([
                    'nomor_identitas' => $nomorIdentitas,
                    'tipe_user' => $tipeUser,
                ]);

                $userData = [
                    'nama' => trim($request->nama),
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

            $token = Str::random(60);
            $userIdentifier = $tipeUser === 'karyawan' ? $user->nomor_identitas : $user->nim;

            return response()->json([
                'status' => 'success',
                'message' => 'Registrasi berhasil! Selamat datang di Lapor Sadhar.',
                'token' => $token,
                'user' => [
                    'nomor_identitas' => $userIdentifier,
                    'nim' => $userIdentifier,
                    'nama' => $user->nama,
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

                return response()->json([
                    'status' => 'success',
                    'message' => "Login berhasil! Selamat datang, {$user->nama}.",
                    'token' => $token,
                    'user' => [
                        'nomor_identitas' => $userIdentifier,
                        'nim' => $userIdentifier,
                        'nama' => $user->nama,
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
        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil keluar dari akun.',
        ]);
    }
}
