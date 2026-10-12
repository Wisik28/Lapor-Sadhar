"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Briefcase,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Info
} from "lucide-react";
import { authApi } from "@/lib/api";

type RoleType = "mahasiswa" | "karyawan" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleType>("mahasiswa");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getIdentifierLabel = () => {
    switch (selectedRole) {
      case "mahasiswa":
        return "Nomor Induk Mahasiswa (NIM)";
      case "karyawan":
        return "NIP / NPK / No. Identitas Karyawan";
      case "admin":
        return "Username Administrator";
    }
  };

  const getIdentifierPlaceholder = () => {
    switch (selectedRole) {
      case "mahasiswa":
        return "Contoh: 225314001";
      case "karyawan":
        return "Contoh: 198501012010121001 atau KARYAWAN001";
      case "admin":
        return "Contoh: admin atau sarpras01";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!identifier.trim() || !password) {
      setErrorMessage("Mohon lengkapi kolom identitas dan kata sandi.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authApi.login({
        identifier: identifier.trim(),
        password,
        role: selectedRole,
      });

      if (res.status === "success") {
        setSuccessMessage(res.message || "Login berhasil! Sedang mengalihkan...");
        setTimeout(() => {
          if (res.redirect_to) {
            router.push(res.redirect_to);
          } else if (selectedRole === "admin") {
            router.push("/admin/dashboard");
          } else {
            router.push("/buat-laporan");
          }
        }, 1000);
      } else {
        setErrorMessage(res.message || "Gagal masuk. Periksa kembali data login Anda.");
      }
    } catch (err: any) {
      setErrorMessage("Terjadi kesalahan saat menghubungkan ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F4F6] font-sans text-slate-800 flex flex-col justify-between p-4 sm:p-6 lg:p-8 antialiased selection:bg-[#7A0C0C]/10 selection:text-[#7A0C0C]">
      {/* Top Bar / Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white p-1.5 shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
            <img
              src="/assets/logo_usd.png"
              alt="Logo Universitas Sanata Dharma"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Lapor Sadhar
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Universitas Sanata Dharma
            </p>
          </div>
        </div>

        <Link
          href="/buat-laporan"
          className="text-xs sm:text-sm font-semibold text-[#7A0C0C] hover:text-[#9E1B1B] hover:underline flex items-center gap-1"
        >
          Lihat Halaman Laporan
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Container / Auth Card */}
      <main className="max-w-md w-full mx-auto my-6 sm:my-8">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 sm:p-8 space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Masuk ke Akun Anda
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Sistem Pelaporan Fasilitas & Sarana Prasarana Kampus
            </p>
          </div>

          {/* Role Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Pilih Peran Pengguna:
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
              {/* Mahasiswa */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("mahasiswa");
                  setErrorMessage("");
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedRole === "mahasiswa"
                    ? "bg-[#7A0C0C] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span className="truncate">Mahasiswa</span>
              </button>

              {/* Karyawan */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("karyawan");
                  setErrorMessage("");
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedRole === "karyawan"
                    ? "bg-[#7A0C0C] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="truncate">Karyawan</span>
              </button>

              {/* Admin */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("admin");
                  setErrorMessage("");
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedRole === "admin"
                    ? "bg-[#7A0C0C] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">Admin</span>
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Identifier (NIM, NIP, or Username) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                {getIdentifierLabel()} <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={getIdentifierPlaceholder()}
                  className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                />
              </div>
              {selectedRole === "karyawan" && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Karyawan & Dosen dapat menggunakan NIP, NPK, atau No. Pegawai.
                </p>
              )}
            </div>

            {/* Input Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-700">
                  Kata Sandi <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi Anda"
                  className="w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Tampilkan atau sembunyikan kata sandi"
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Tombol Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] active:bg-[#600808] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/20 transition-all duration-200 active:scale-98 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses Masuk...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Akun</span>
                    <LogIn className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Navigasi ke Halaman Registrasi */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs sm:text-sm text-slate-600">
              Belum memiliki akun pelapor?
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#7A0C0C]/30 text-[#7A0C0C] hover:bg-[#7A0C0C]/5 active:bg-[#7A0C0C]/10 text-xs sm:text-sm font-semibold transition-all"
            >
              Daftar Akun Baru (Mahasiswa / Karyawan)
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-500 py-3 border-t border-slate-200/60">
        <p>SiLapor USD © 2026 Universitas Sanata Dharma Yogyakarta</p>
      </footer>
    </div>
  );
}
