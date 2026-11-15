"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { authApi, UserSession } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

type ConfirmModalState =
  | {
      isOpen: false;
    }
  | {
      isOpen: true;
      type: "profile" | "password";
      title: string;
      description: string;
      changes?: { label: string; oldValue: string; newValue: string }[];
    };

export default function ProfilePage() {
  const [user, setUser] = useState<UserSession | null>(() => authApi.getCurrentUser());

  // State untuk form kontak (Email & Nomor Handphone)
  const [email, setEmail] = useState<string>(() => authApi.getCurrentUser()?.email || "");
  const [noHandphone, setNoHandphone] = useState<string>(
    () => authApi.getCurrentUser()?.no_handphone || "",
  );
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // State untuk form kata sandi
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // State untuk modal konfirmasi
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ isOpen: false });

  // Sinkronisasi profil terbaru dari server saat halaman dimuat
  useEffect(() => {
    let active = true;
    authApi.getUserSession().then((res) => {
      if (active && res.status === "success" && res.user) {
        setUser(res.user);
        setEmail(res.user.email || "");
        setNoHandphone(res.user.no_handphone || "");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Handler submit form perubahan data diri (Email & No Handphone)
  const handleProfileFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = noHandphone.trim();

    if (!trimmedEmail) {
      setProfileError("Alamat email wajib diisi.");
      return;
    }

    if (!trimmedPhone) {
      setProfileError("Nomor handphone wajib diisi.");
      return;
    }

    if (!/^[0-9+\-\s]{8,20}$/.test(trimmedPhone)) {
      setProfileError("Format nomor handphone tidak valid (gunakan 8-20 digit angka).");
      return;
    }

    const currentEmail = (user?.email || "").trim().toLowerCase();
    const currentPhone = (user?.no_handphone || "").trim();

    const changes: { label: string; oldValue: string; newValue: string }[] = [];

    if (trimmedEmail !== currentEmail) {
      changes.push({
        label: "Email",
        oldValue: user?.email || "Belum diisi",
        newValue: trimmedEmail,
      });
    }

    if (trimmedPhone !== currentPhone) {
      changes.push({
        label: "Nomor Handphone",
        oldValue: user?.no_handphone || "Belum diisi",
        newValue: trimmedPhone,
      });
    }

    if (changes.length === 0) {
      setProfileError("Tidak ada perubahan data yang dilakukan.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "profile",
      title: "Konfirmasi Perubahan Data Diri",
      description: "Apakah Anda yakin ingin mengganti data berikut?",
      changes,
    });
  };

  // Eksekusi simpan perubahan profil setelah dikonfirmasi
  const executeProfileUpdate = async () => {
    setConfirmModal({ isOpen: false });
    setProfileError("");
    setProfileMessage("");
    setProfileLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = noHandphone.trim();

    const result = await authApi.updateUserProfile({
      email: trimmedEmail,
      no_handphone: trimmedPhone,
    });

    if (result.status === "success" && result.user) {
      setUser(result.user);
      setEmail(result.user.email || "");
      setNoHandphone(result.user.no_handphone || "");
      const token = localStorage.getItem("auth_token") ?? "";
      await setAuthSession(result.user, token, false);
      setProfileMessage(result.message || "Data profil berhasil diperbarui.");
    } else {
      setProfileError(result.message || "Data profil tidak dapat diperbarui.");
    }

    setProfileLoading(false);
  };

  // Handler submit form ganti kata sandi
  const handlePasswordFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword) {
      setPasswordError("Kata sandi saat ini wajib diisi.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Kata sandi baru minimal 6 karakter.");
      return;
    }

    if (newPassword !== passwordConfirmation) {
      setPasswordError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("Kata sandi baru harus berbeda dengan kata sandi saat ini.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "password",
      title: "Konfirmasi Penggantian Kata Sandi",
      description:
        "Apakah Anda yakin ingin mengganti kata sandi akun Anda? Pastikan Anda mengingat kata sandi baru untuk login berikutnya.",
    });
  };

  // Eksekusi ubah kata sandi setelah dikonfirmasi
  const executePasswordChange = async () => {
    setConfirmModal({ isOpen: false });
    setPasswordError("");
    setPasswordMessage("");
    setPasswordLoading(true);

    const result = await authApi.changeUserPassword({
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: passwordConfirmation,
    });

    if (result.status === "success") {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setPasswordMessage(result.message || "Kata sandi berhasil diubah.");
    } else {
      setPasswordError(result.message || "Kata sandi tidak dapat diubah.");
    }

    setPasswordLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar pageTitle="Profil" userName={user?.nama} userRole={user?.role} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Profil Pengguna</h1>
            <p className="mt-1 text-sm text-slate-600">
              Kelola informasi kontak (email & nomor handphone) serta keamanan kata sandi akun Anda.
            </p>
          </div>
          <Link
            href="/buat-laporan"
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-[#7A0C0C]/30 hover:text-[#7A0C0C]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Laporan
          </Link>
        </div>

        <div className="space-y-6">
          {/* Ringkasan Informasi Akun */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#7A0C0C]/10 text-[#7A0C0C]">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Informasi Akun</h2>
                <p className="text-xs text-slate-500">Data identitas pelapor yang terdaftar di sistem</p>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Lengkap</dt>
                <dd className="mt-1 font-medium text-slate-900">{user?.nama || "—"}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nomor Identitas (NIM / NIP)
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {user?.nomor_identitas || user?.nim || "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Saat Ini</dt>
                <dd className="mt-1 font-medium text-slate-900 break-all">
                  {user?.email || "Belum diisi"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nomor Handphone Saat Ini
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {user?.no_handphone || "Belum diisi"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3.5 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis Akun</dt>
                <dd className="mt-1 font-medium text-slate-900">{user?.role || "—"}</dd>
              </div>
            </dl>
          </section>

          {/* Form Penggantian Data Diri (Email & Nomor Handphone) */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
            <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#7A0C0C]/10 text-[#7A0C0C]">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Ubah Data Kontak</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Perbarui alamat email dan nomor handphone / WhatsApp Anda secara langsung.
                </p>
              </div>
            </div>

            {profileMessage && (
              <div
                role="status"
                className="mb-5 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{profileMessage}</span>
              </div>
            )}

            {profileError && (
              <div
                role="alert"
                className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileFormSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Alamat Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#7A0C0C] focus:ring-2 focus:ring-[#7A0C0C]/15"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nomor Handphone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="profile-phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={20}
                      placeholder="081234567890"
                      value={noHandphone}
                      onChange={(e) => setNoHandphone(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#7A0C0C] focus:ring-2 focus:ring-[#7A0C0C]/15"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#7A0C0C] px-5 text-sm font-semibold text-white transition hover:bg-[#600909] disabled:opacity-60 cursor-pointer"
                >
                  {profileLoading ? "Menyimpan perubahan..." : "Simpan Perubahan Data"}
                </button>
              </div>
            </form>
          </section>

          {/* Form Penggantian Kata Sandi */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
            <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#7A0C0C]/10 text-[#7A0C0C]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Ganti Kata Sandi</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Gunakan minimal 6 karakter untuk menjaga keamanan akun Anda.
                </p>
              </div>
            </div>

            {passwordMessage && (
              <div
                role="status"
                className="mb-5 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{passwordMessage}</span>
              </div>
            )}

            {passwordError && (
              <div
                role="alert"
                className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Kata Sandi Saat Ini
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Masukkan kata sandi saat ini"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-[#7A0C0C] focus:ring-2 focus:ring-[#7A0C0C]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showCurrentPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-[#7A0C0C] focus:ring-2 focus:ring-[#7A0C0C]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showNewPassword ? "Sembunyikan kata sandi baru" : "Tampilkan kata sandi baru"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Ulangi kata sandi baru"
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-[#7A0C0C] focus:ring-2 focus:ring-[#7A0C0C]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={
                        showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"
                      }
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7A0C0C] px-5 text-sm font-semibold text-white transition hover:bg-[#600909] disabled:opacity-60 cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" />
                  {passwordLoading ? "Menyimpan..." : "Ubah Kata Sandi"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>

      {/* Modal Alert / Konfirmasi Perubahan Data */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-desc"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 id="confirm-modal-title" className="font-bold text-slate-900">
                  {confirmModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false })}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup dialog konfirmasi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              <p id="confirm-modal-desc" className="text-sm text-slate-600">
                {confirmModal.description}
              </p>

              {confirmModal.changes && confirmModal.changes.length > 0 && (
                <div className="mt-4 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  {confirmModal.changes.map((item) => (
                    <div key={item.label} className="space-y-0.5">
                      <span className="font-semibold text-slate-700">{item.label}:</span>
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span className="line-through text-slate-400">{item.oldValue}</span>
                        <span>→</span>
                        <span className="font-semibold text-slate-900">{item.newValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false })}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={
                    confirmModal.type === "profile" ? executeProfileUpdate : executePasswordChange
                  }
                  className="h-10 rounded-lg bg-[#7A0C0C] px-4 text-sm font-semibold text-white transition hover:bg-[#600909] cursor-pointer"
                >
                  Ya, Saya Yakin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
