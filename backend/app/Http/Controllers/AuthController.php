<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\UserMahasiswa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
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
                'errors' => $validator->errors()
            ], 422);
        }

        $nomorIdentitas = trim($request->nomor_identitas);
        $tipeUser = $request->tipe_user;
        $labelIdentitas = $tipeUser === 'karyawan' ? 'Nomor Identitas Pegawai / NIP / NPK' : 'NIM';

        try {
            // Cek apakah nomor identitas sudah terdaftar
            $exists = UserMahasiswa::where('nim', $nomorIdentitas)->exists();
            if ($exists) {
                return response()->json([
                    'status' => 'error',
                    'message' => "{$labelIdentitas} ({$nomorIdentitas}) sudah terdaftar di sistem. Silakan login."
                ], 409);
            }

            // Pastikan kolom tipe_user ada di database, jika belum ada tambahkan otomatis
            if (!Schema::hasColumn('user_mahasiswa', 'tipe_user')) {
                try {
                    Schema::table('user_mahasiswa', function (Blueprint $table) {
                        $table->string('tipe_user')->default('mahasiswa')->nullable();
                    });
                } catch (\Throwable $e) {}
            }

            $userData = [
                'nim' => $nomorIdentitas,
                'nama' => trim($request->nama),
                'password' => Hash::make($request->password),
                'no_handphone' => trim($request->no_handphone),
            ];

            if (Schema::hasColumn('user_mahasiswa', 'tipe_user')) {
                $userData['tipe_user'] = $tipeUser;
            }

            // Buat user baru
            $user = UserMahasiswa::create($userData);

            $token = Str::random(60);

            return response()->json([
                'status' => 'success',
                'message' => 'Registrasi berhasil! Selamat datang di SiLapor USD.',
                'token' => $token,
                'user' => [
                    'nomor_identitas' => $user->nim,
                    'nim' => $user->nim,
                    'nama' => $user->nama,
                    'no_handphone' => $user->no_handphone,
                    'tipe_user' => $user->tipe_user ?? $tipeUser,
                    'role' => $tipeUser === 'karyawan' ? 'Karyawan' : 'Mahasiswa',
                ],
                'redirect_to' => '/buat-laporan'
            ], 201);
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'could not find driver')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Driver database pgsql belum dimuat. Silakan restart terminal "php artisan serve" agar konfigurasi php.ini terbaru diterapkan.'
                ], 500);
            }
            if (str_contains($msg, 'Unknown host') || str_contains($msg, 'Connection refused') || str_contains($msg, 'password authentication failed')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Koneksi ke Supabase gagal. Silakan periksa kembali DB_HOST dan DB_PASSWORD di backend/.env.'
                ], 500);
            }
            return response()->json([
                'status' => 'error',
                'message' => 'Terjadi kesalahan server: ' . $e->getMessage()
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
            'role' => 'nullable|string|in:mahasiswa,karyawan,admin,semua',
        ], [
            'identifier.required' => 'Nomor Identitas (NIM/NIP) atau Username wajib diisi.',
            'password.required' => 'Kata sandi wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()
            ], 422);
        }

        $identifier = trim($request->identifier);
        $password = $request->password;
        $preferredRole = $request->input('role', 'semua');

        try {
            // 1. Coba login sebagai Admin terlebih dahulu jika role dipilih admin
            if ($preferredRole === 'admin') {
                $admin = Admin::where('username', $identifier)->first();
                if ($admin && Hash::check($password, $admin->password)) {
                    $token = Str::random(60);
                    return response()->json([
                        'status' => 'success',
                        'message' => 'Login Admin berhasil!',
                        'token' => $token,
                        'user' => [
                            'admin_id' => $admin->admin_id,
                            'username' => $admin->username,
                            'nama' => $admin->nama_admin,
                            'role' => 'Admin',
                            'role_detail' => $admin->role ?? 'admin',
                        ],
                        'redirect_to' => '/admin/dashboard'
                    ]);
                }

                return response()->json([
                    'status' => 'error',
                    'message' => 'Username atau kata sandi Admin tidak valid.'
                ], 401);
            }

            // 2. Cek sebagai User (Mahasiswa atau Karyawan)
            $user = UserMahasiswa::where('nim', $identifier)->first();

            if ($user && Hash::check($password, $user->password)) {
                $tipe = $user->tipe_user ?? 'mahasiswa';
                $roleLabel = $tipe === 'karyawan' ? 'Karyawan' : 'Mahasiswa';
                $token = Str::random(60);

                return response()->json([
                    'status' => 'success',
                    'message' => "Login berhasil! Selamat datang, {$user->nama}.",
                    'token' => $token,
                    'user' => [
                        'nomor_identitas' => $user->nim,
                        'nim' => $user->nim,
                        'nama' => $user->nama,
                        'no_handphone' => $user->no_handphone,
                        'tipe_user' => $tipe,
                        'role' => $roleLabel,
                    ],
                    'redirect_to' => '/buat-laporan'
                ]);
            }

            // 3. Fallback: jika user memilih role 'semua' dan ternyata cocok dengan Admin
            if ($preferredRole === 'semua' || empty($preferredRole)) {
                $admin = Admin::where('username', $identifier)->first();
                if ($admin && Hash::check($password, $admin->password)) {
                    $token = Str::random(60);
                    return response()->json([
                        'status' => 'success',
                        'message' => 'Login Admin berhasil!',
                        'token' => $token,
                        'user' => [
                            'admin_id' => $admin->admin_id,
                            'username' => $admin->username,
                            'nama' => $admin->nama_admin,
                            'role' => 'Admin',
                            'role_detail' => $admin->role ?? 'admin',
                        ],
                        'redirect_to' => '/admin/dashboard'
                    ]);
                }
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Nomor Identitas (NIM/NIP) atau kata sandi yang Anda masukkan salah.'
            ], 401);

        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'could not find driver')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Driver database pgsql belum dimuat. Silakan restart terminal "php artisan serve" agar konfigurasi php.ini terbaru diterapkan.'
                ], 500);
            }
            if (str_contains($msg, 'Unknown host') || str_contains($msg, 'Connection refused') || str_contains($msg, 'password authentication failed')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Koneksi ke Supabase gagal. Silakan periksa kembali DB_HOST dan DB_PASSWORD di backend/.env.'
                ], 500);
            }
            return response()->json([
                'status' => 'error',
                'message' => 'Terjadi kesalahan server: ' . $e->getMessage()
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
            'message' => 'Berhasil keluar dari akun.'
        ]);
    }
}
