<?php
namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\UserMahasiswa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class MahasiswaAuthController extends Controller
{
    public function showRegister()
    {
        return view('auth.mahasiswa-register');
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'nim' => ['required', 'string', 'max:255', 'unique:user_mahasiswa,nim'],
            'nama' => ['required', 'string', 'max:255'],
            'no_handphone' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        UserMahasiswa::create([
            'nim' => $validated['nim'],
            'nama' => $validated['nama'],
            'no_handphone' => $validated['no_handphone'],
            'password' => Hash::make($validated['password']),
        ]);

        return redirect()
            ->route('mahasiswa.login')
            ->with('success', 'Registrasi berhasil. Silakan login.');
    }

    public function showLogin()
    {
        return view('auth.mahasiswa-login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'nim' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        if (Auth::guard('web')->attempt($credentials)) {
            $request->session()->regenerate();

            return redirect()->intended('/');
        }

        return back()
            ->withErrors([
                'nim' => 'NIM atau password tidak sesuai.',
            ])
            ->onlyInput('nim');
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('mahasiswa.login');
    }
}
