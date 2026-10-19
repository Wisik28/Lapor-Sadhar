"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Briefcase,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Info
} from "lucide-react";
import { authApi } from "@/lib/api";

type UserType = "mahasiswa" | "karyawan";

export default function RegisterPage() {
  const router = useRouter();
  const [tipeUser, setTipeUser] = useState<UserType>("mahasiswa");
  const [nomorIdentitas, setNomorIdentitas] = useState("");
  const [nama, setNama] = useState("");
  const [noHandphone, setNoHandphone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [waEditable, setWaEditable] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!nomorIdentitas.trim() || !nama.trim() || !noHandphone.trim() || !password) {
      setErrorMessage("Semua kolom formulir pendaftaran wajib diisi!");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Kata sandi minimal harus terdiri dari 6 karakter!");
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok dengan kata sandi!");
      return;
    }

    if (!agreeTerms) {
      setErrorMessage("Anda harus menyetujui ketentuan pelaporan fasilitas kampus.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authApi.register({
        tipe_user: tipeUser,
        nomor_identitas: nomorIdentitas.trim(),
        nama: nama.trim(),
        no_handphone: noHandphone.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });

      if (res.status === "success") {
        setSuccessMessage(
          res.message || "Pendaftaran akun berhasil! Mengalihkan ke halaman formulir laporan..."
        );
        setTimeout(() => {
          router.push(res.redirect_to || "/buat-laporan");
        }, 1200);
      } else {
        setErrorMessage(res.message || "Gagal melakukan pendaftaran. Silakan periksa kembali data Anda.");
      }
    } catch (err: any) {
      setErrorMessage("Terjadi kesalahan saat menghubungi server backend.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans antialiased overflow-hidden">
      {/* ═══════════ TOP BANNER: Maroon Header (compact) ═══════════ */}
      <header className="relative bg-[#7A0C0C] w-full shrink-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex items-center justify-center gap-3 py-3 px-4">
          <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-white/20 p-0.5 shadow-lg shadow-black/20 shrink-0">
            <img
              src="/assets/logo_usd.png"
              alt="Logo Universitas Sanata Dharma"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-white text-center">
            <span className="block text-sm sm:text-base md:text-lg font-extrabold tracking-wide drop-shadow-md">
              Universitas Sanata Dharma
            </span>
          </h1>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT: Campus BG + Register Card ═══════════ */}
      <main
        className="relative flex-1 flex items-center justify-center px-4"
        style={{
          backgroundImage: "url('/assets/bg_kampus.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-black/40" />

        {/* Register Card */}
        <div className="relative z-10 w-full max-w-lg">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/30 border border-white/50 px-5 py-4 sm:px-6 sm:py-5 space-y-3">
            {/* Card Header */}
            <div className="text-center space-y-0.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Registrasi Akun Pelapor
              </h2>
              <p className="text-[11px] text-slate-500">
                Daftarkan diri Anda untuk mengajukan & memantau laporan fasilitas USD
              </p>
            </div>

            {/* Pemilihan Kategori Pengguna: Mahasiswa vs Karyawan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kategori Pengguna <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTipeUser("mahasiswa");
                    setErrorMessage("");
                  }}
                  className={`px-3 py-2 rounded-lg border-2 text-left flex items-center gap-2 transition-all ${
                    tipeUser === "mahasiswa"
                      ? "border-[#7A0C0C] bg-red-50/30 text-slate-900 shadow-xs ring-1 ring-[#7A0C0C]/30"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      tipeUser === "mahasiswa"
                        ? "bg-[#7A0C0C] text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Mahasiswa</span>
                    <span className="text-[10px] text-slate-500">NIM Sanata Dharma</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTipeUser("karyawan");
                    setErrorMessage("");
                  }}
                  className={`px-3 py-2 rounded-lg border-2 text-left flex items-center gap-2 transition-all ${
                    tipeUser === "karyawan"
                      ? "border-[#7A0C0C] bg-red-50/30 text-slate-900 shadow-xs ring-1 ring-[#7A0C0C]/30"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      tipeUser === "karyawan"
                        ? "bg-[#7A0C0C] text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Karyawan / Dosen</span>
                    <span className="text-[10px] text-slate-500">NIP / NPK / ID Pegawai</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Feedback Alerts */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <div className="flex-1 leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* Form Registrasi */}
            <form onSubmit={handleSubmit} className="space-y-2.5">
              {/* Row 1: NIM/NIP + Nama Lengkap side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {tipeUser === "mahasiswa" ? "NIM" : "NIP / NPK"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nomorIdentitas}
                    onChange={(e) => setNomorIdentitas(e.target.value)}
                    placeholder={
                      tipeUser === "mahasiswa"
                        ? "Contoh: 225314001"
                        : "Contoh: KARYAWAN001"
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. WhatsApp <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    readOnly={!waEditable}
                    required
                    value={noHandphone}
                    onFocus={() => setWaEditable(true)}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9+\s-]/g, "");
                      setNoHandphone(cleaned);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text");
                      const cleaned = pasted.replace(/[^0-9+\s-]/g, "");
                      setNoHandphone(cleaned);
                    }}
                    placeholder="Contoh: 081234567890"
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Kata Sandi & Konfirmasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kata Sandi <span className="text-red-500">*</span>
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
                      placeholder="Minimal 6 karakter"
                      className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Tampilkan atau sembunyikan kata sandi"
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konfirmasi Sandi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Checkbox Ketentuan */}
              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#7A0C0C] focus:ring-[#7A0C0C] w-3.5 h-3.5"
                />
                <span>
                  Saya menyatakan data yang saya daftarkan valid dan bersedia mematuhi aturan pelaporan fasilitas kampus USD.
                </span>
              </label>

              {/* Tombol Daftar */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] active:bg-[#600808] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mendaftarkan Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Daftar Akun Sekarang</span>
                    <UserPlus className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Navigasi ke Halaman Login */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Sudah memiliki akun?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[#7A0C0C] hover:text-[#9E1B1B] hover:underline transition-colors"
                >
                  Masuk
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
