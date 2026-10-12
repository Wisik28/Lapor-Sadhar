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
          href="/login"
          className="text-xs sm:text-sm font-semibold text-[#7A0C0C] hover:text-[#9E1B1B] hover:underline flex items-center gap-1"
        >
          Sudah punya akun? Masuk
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Container / Registration Card */}
      <main className="max-w-xl w-full mx-auto my-6 sm:my-8">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 sm:p-8 space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Registrasi Akun Pelapor
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Daftarkan diri Anda untuk mengajukan & memantau laporan fasilitas USD
            </p>
          </div>

          {/* Pemilihan Kategori Pengguna: Mahasiswa vs Karyawan */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
              Kategori Pengguna Kampus <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Opsi Mahasiswa */}
              <button
                type="button"
                onClick={() => {
                  setTipeUser("mahasiswa");
                  setErrorMessage("");
                }}
                className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                  tipeUser === "mahasiswa"
                    ? "border-[#7A0C0C] bg-red-50/30 text-slate-900 shadow-xs ring-1 ring-[#7A0C0C]/30"
                    : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    tipeUser === "mahasiswa"
                      ? "bg-[#7A0C0C] text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                    Mahasiswa
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Memiliki NIM resmi Sanata Dharma
                  </p>
                </div>
              </button>

              {/* Opsi Karyawan */}
              <button
                type="button"
                onClick={() => {
                  setTipeUser("karyawan");
                  setErrorMessage("");
                }}
                className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                  tipeUser === "karyawan"
                    ? "border-[#7A0C0C] bg-red-50/30 text-slate-900 shadow-xs ring-1 ring-[#7A0C0C]/30"
                    : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    tipeUser === "karyawan"
                      ? "bg-[#7A0C0C] text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                    Karyawan / Dosen
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Memiliki NIP, NPK, atau ID Pegawai
                  </p>
                </div>
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

          {/* Form Registrasi */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Input Nomor Identitas (Dinamis: NIM untuk Mahasiswa, NIP/NPK untuk Karyawan) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                {tipeUser === "mahasiswa"
                  ? "Nomor Induk Mahasiswa (NIM)"
                  : "Nomor Identitas Pegawai (NIP / NPK / No. Pegawai)"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={nomorIdentitas}
                  onChange={(e) => setNomorIdentitas(e.target.value)}
                  placeholder={
                    tipeUser === "mahasiswa"
                      ? "Contoh: 225314001"
                      : "Contoh: 198501012010121001 atau KARYAWAN001"
                  }
                  className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {tipeUser === "mahasiswa"
                  ? "Masukkan 9 digit nomor induk mahasiswa Anda."
                  : "Karyawan & Dosen tidak memiliki NIM, gunakan nomor identitas pegawai resmi Anda."}
              </p>
            </div>

            {/* 2. Nama Lengkap */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder={
                    tipeUser === "mahasiswa"
                      ? "Contoh: Agustinus Kurniawan"
                      : "Contoh: Budi Santoso, S.T., M.Kom."
                  }
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                />
              </div>
            </div>

            {/* 3. Nomor WhatsApp / Handphone */}
            <div>
              <label htmlFor="nomorwa_field" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                Nomor WhatsApp / Handphone <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Phone className="w-4 h-4 text-slate-400" />
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
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Masukkan nomor WhatsApp aktif Anda (contoh: 08xxxxxxxxxx) untuk notifikasi perbaikan fasilitas.
              </p>
            </div>

            {/* 4. Kata Sandi & Konfirmasi Kata Sandi (Grid 2 Kolom di Desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Kata Sandi <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Tampilkan atau sembunyikan kata sandi"
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Konfirmasi Sandi <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Checkbox Ketentuan */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#7A0C0C] focus:ring-[#7A0C0C]"
                />
                <span>
                  Saya menyatakan bahwa data yang saya daftarkan valid dan bersedia mematuhi aturan pelaporan fasilitas kampus Universitas Sanata Dharma.
                </span>
              </label>
            </div>

            {/* Tombol Daftar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] active:bg-[#600808] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/20 transition-all duration-200 active:scale-98 disabled:opacity-60 cursor-pointer"
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
            </div>
          </form>

          {/* Navigasi ke Halaman Login */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs sm:text-sm text-slate-600">
              Sudah memiliki akun pelapor sebelumnya?
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 hover:border-[#7A0C0C] text-slate-700 hover:text-[#7A0C0C] hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-all"
            >
              Masuk ke Akun Anda
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
