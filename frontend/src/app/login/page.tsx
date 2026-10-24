"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Users,
  IdCard,
} from "lucide-react";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!identifier.trim() || !password) {
      setErrorMessage("Mohon lengkapi NIM/NIP dan kata sandi.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authApi.login({
        identifier: identifier.trim(),
        password,
        role: "semua",
      });

      if (res.status === "success") {
        setSuccessMessage(res.message || "Login berhasil! Sedang mengalihkan...");
        setTimeout(() => {
          if (res.redirect_to) {
            router.push(res.redirect_to);
          } else if (res.user?.role === "Admin") {
            router.push("/admin/dashboard");
          } else {
            router.push("/buat-laporan");
          }
        }, 1000);
      } else {
        setErrorMessage(res.message || "Gagal masuk. Periksa kembali data login Anda.");
      }
    } catch {
      setErrorMessage("Terjadi kesalahan saat menghubungkan ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans antialiased overflow-hidden">
      {/* ═══════════ TOP BANNER: Maroon Header (compact) ═══════════ */}
      <header className="relative bg-[#7A0C0C] w-full shrink-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center py-4 sm:py-5 px-4">
          {/* University Logo */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 backdrop-blur-sm border-2 border-white/20 p-1 mb-2.5 shadow-lg shadow-black/20">
            <Image
              src="/assets/logo_usd.png"
              alt="Logo Universitas Sanata Dharma"
              width={56}
              height={56}
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>

          {/* Title Text */}
          <h1 className="text-white text-center">
            <span className="block text-lg sm:text-xl md:text-2xl font-extrabold tracking-wide drop-shadow-md">
              Universitas Sanata Dharma
            </span>
          </h1>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT: Campus BG + Login Card ═══════════ */}
      <main
        className="relative flex-1 flex items-center justify-center px-4"
        style={{
          backgroundImage: "url('/assets/bg_kampus.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Login Card */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/30 border border-white/50 px-6 py-5 sm:px-7 sm:py-6 space-y-4">
            {/* Card Header */}
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                SELAMAT DATANG
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Sistem Pelaporan Fasilitas & Sarana Prasarana Kampus
              </p>
            </div>

            {/* Role Badge: Civitas Akademika */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7A0C0C]/10 border border-[#7A0C0C]/20 rounded-full">
                <Users className="w-3.5 h-3.5 text-[#7A0C0C]" />
                <span className="text-xs font-semibold text-[#7A0C0C]">
                  Civitas Akademika
                </span>
              </div>
            </div>

            {/* Feedback Alerts */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <div className="flex-1 leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* NIM/NIP Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIM / NIP
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <IdCard className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Masukkan NIM atau NIP Anda"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Kata Sandi Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Anda"
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Tampilkan atau sembunyikan kata sandi"
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#7A0C0C] focus:ring-[#7A0C0C] w-3.5 h-3.5"
                  />
                  <span className="text-xs text-slate-600">Ingat Saya</span>
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#7A0C0C] hover:text-[#9E1B1B] hover:underline transition-colors"
                >
                  Lupa Password
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] active:bg-[#600808] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Login</span>
                  </>
                )}
              </button>
            </form>

            {/* Register Link */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Belum Punya Akun?{" "}
                <Link
                  href="/register"
                  className="font-bold text-[#7A0C0C] hover:text-[#9E1B1B] hover:underline transition-colors"
                >
                  Registrasi
                </Link>
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Admin BLU/BPS?{" "}
                <Link href="/admin/login" className="font-bold text-[#7A0C0C] hover:text-[#9E1B1B] hover:underline">
                  Masuk ke portal admin
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
