"use client";

import { FormEvent, useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  UserRound,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import AdminNavbar from "@/components/AdminNavbar";
import { authApi } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

export default function AdminAccountPage() {
  const [user, setUser] = useState(authApi.getCurrentUser());
  const [name, setName] = useState(user?.nama || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState<"request" | "confirm">("request");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setProfileLoading(true);
    const result = await authApi.updateAdminProfile({ nama: name.trim() });
    if (result.status === "success" && result.user) {
      setUser(result.user);
      setName(result.user.nama);
      const token = localStorage.getItem("admin_token");
      if (token) await setAuthSession(result.user, token, true);
      setProfileMessage(result.message);
    } else {
      setProfileError(result.message || "Profil admin tidak dapat diperbarui.");
    }
    setProfileLoading(false);
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword !== confirmation) {
      setPasswordError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setIsLoading(true);
    const result = await authApi.changeAdminPassword({
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmation,
    });
    if (result.status === "success") {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPasswordMessage(result.message);
    } else {
      setPasswordError(result.message || "Kata sandi tidak dapat diubah.");
    }
    setIsLoading(false);
  };

  const requestEmailCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError("");
    setEmailMessage("");
    setEmailLoading(true);
    const result = await authApi.requestAdminEmailChange(newEmail.trim().toLowerCase());
    if (result.status === "success") {
      setEmailStep("confirm");
      setEmailMessage(result.message);
    } else {
      setEmailError(result.message || "Kode verifikasi tidak dapat dikirim.");
    }
    setEmailLoading(false);
  };

  const confirmEmailChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError("");
    setEmailMessage("");
    setEmailLoading(true);
    const result = await authApi.confirmAdminEmailChange(emailCode);
    if (result.status === "success" && result.email && user) {
      const updatedUser = { ...user, email: result.email };
      setUser(updatedUser);
      const token = localStorage.getItem("admin_token");
      if (token) await setAuthSession(updatedUser, token, true);
      setNewEmail("");
      setEmailCode("");
      setEmailStep("request");
      setEmailMessage(result.message);
    } else {
      setEmailError(result.message || "Email admin tidak dapat diperbarui.");
    }
    setEmailLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans">
      <AdminNavbar
        adminName={user?.nama}
        adminRole={user?.jabatan_label || user?.role_detail || "Administrator"}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan Akun Admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola profil tampilan, kontak email, dan keamanan kata sandi akun admin Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Kolom Kiri: Profil & Ganti Email */}
          <div className="space-y-6">
            {/* Profil Admin */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7A0C0C]/10 text-[#7A0C0C]">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Profil Tampilan</h2>
                  <p className="text-xs text-slate-500">
                    Nama pelapor dan jabatan administrasi Anda
                  </p>
                </div>
              </div>

              {profileError && (
                <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{profileError}</span>
                </div>
              )}
              {profileMessage && (
                <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{profileMessage}</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label htmlFor="admin-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Nama Tampilan
                  </label>
                  <input
                    id="admin-name"
                    required
                    maxLength={255}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10 shadow-2xs transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block">Jabatan</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                      {user?.jabatan_label || user?.role_detail || "—"}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block">Email Aktif</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                      {user?.email || "Belum diisi"}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="h-10 rounded-xl bg-[#7A0C0C] px-5 text-xs font-semibold text-white hover:bg-[#600909] disabled:opacity-60 transition-colors shadow-2xs cursor-pointer"
                  >
                    {profileLoading ? "Menyimpan..." : "Simpan Perubahan Nama"}
                  </button>
                </div>
              </form>
            </section>

            {/* Ganti Email Admin */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7A0C0C]/10 text-[#7A0C0C]">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Alamat Email Admin</h2>
                  <p className="text-xs text-slate-500">
                    Verifikasi kode yang dikirim ke email lama sebelum menyimpan email baru
                  </p>
                </div>
              </div>

              {emailError && (
                <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{emailError}</span>
                </div>
              )}
              {emailMessage && (
                <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{emailMessage}</span>
                </div>
              )}

              {emailStep === "request" ? (
                <form onSubmit={requestEmailCode} className="space-y-4">
                  <div>
                    <label htmlFor="admin-new-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Email Baru
                    </label>
                    <input
                      id="admin-new-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="admin@usd.ac.id"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10 shadow-2xs transition-all"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">
                      {user?.email
                        ? `Kode verifikasi 6 digit akan dikirim ke email saat ini: ${user.email}`
                        : "Akun ini belum memiliki email. Kode verifikasi awal akan dikirim ke email baru."}
                    </p>
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="h-10 rounded-xl bg-[#7A0C0C] px-5 text-xs font-semibold text-white hover:bg-[#600909] disabled:opacity-60 transition-colors shadow-2xs cursor-pointer"
                    >
                      {emailLoading ? "Mengirim kode..." : "Kirim Kode Verifikasi"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={confirmEmailChange} className="space-y-4">
                  <div>
                    <label htmlFor="admin-email-code" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Kode Verifikasi 6 Digit
                    </label>
                    <input
                      id="admin-email-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="Contoh: 123456"
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10 shadow-2xs transition-all tracking-widest"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">Kode verifikasi berlaku selama 10 menit.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="h-10 rounded-xl bg-[#7A0C0C] px-5 text-xs font-semibold text-white hover:bg-[#600909] disabled:opacity-60 transition-colors shadow-2xs cursor-pointer"
                    >
                      {emailLoading ? "Memverifikasi..." : "Verifikasi & Simpan Email"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailStep("request")}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          {/* Kolom Kanan: Ubah Kata Sandi */}
          <div>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7A0C0C]/10 text-[#7A0C0C]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Keamanan Kata Sandi</h2>
                  <p className="text-xs text-slate-500">
                    Minimal 12 karakter untuk menjaga keamanan akun administrasi
                  </p>
                </div>
              </div>

              {passwordError && (
                <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordMessage && (
                <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{passwordMessage}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <PasswordField
                  id="current-password"
                  label="Kata Sandi Saat Ini"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
                <PasswordField
                  id="new-password"
                  label="Kata Sandi Baru"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  minLength={12}
                />
                <PasswordField
                  id="confirm-password"
                  label="Konfirmasi Kata Sandi Baru"
                  value={confirmation}
                  onChange={setConfirmation}
                  autoComplete="new-password"
                  minLength={12}
                />

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7A0C0C] px-5 text-xs font-semibold text-white hover:bg-[#600909] disabled:opacity-60 transition-colors shadow-2xs cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{isLoading ? "Menyimpan..." : "Simpan Kata Sandi"}</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type="password"
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10 shadow-2xs transition-all"
      />
      {minLength && (
        <span className="text-[11px] text-slate-400 mt-1 block">Minimal {minLength} karakter</span>
      )}
    </div>
  );
}
