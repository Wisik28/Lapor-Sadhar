"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import AdminNavbar from "@/components/AdminNavbar";
import { authApi } from "@/lib/api";

export default function AdminAccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const user = authApi.getCurrentUser();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmation) {
      setError("Konfirmasi kata sandi baru tidak cocok.");
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
      setMessage(result.message);
    } else {
      setError(result.message || "Kata sandi tidak dapat diubah.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <AdminNavbar adminName={user?.nama} adminRole={`${user?.role_detail || "Admin"} · ${user?.campus || ""}`} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a171b]">Pengaturan akun</p>
          <h1 className="mt-1 text-2xl font-semibold">Keamanan akun</h1>
          <p className="mt-2 text-sm text-slate-500">Perbarui kata sandi admin Anda.</p>
        </div>

        <section className="max-w-2xl border-y border-slate-200 bg-white px-5 py-6 sm:px-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#7a171b]/10 text-[#7a171b]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Ubah kata sandi</h2>
              <p className="mt-1 text-sm text-slate-500">Gunakan minimal 12 karakter. Sesi admin lain akan dikeluarkan.</p>
            </div>
          </div>

          {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
          {message && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField id="current-password" label="Kata sandi saat ini" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordField id="new-password" label="Kata sandi baru" value={newPassword} onChange={setNewPassword} autoComplete="new-password" minLength={12} />
            <PasswordField id="confirm-password" label="Konfirmasi kata sandi baru" value={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={12} />
            <button disabled={isLoading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#7a171b] px-4 text-sm font-semibold text-white hover:bg-[#641216] disabled:opacity-60">
              <KeyRound className="h-4 w-4" />
              {isLoading ? "Menyimpan..." : "Simpan kata sandi"}
            </button>
          </form>
        </section>
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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input id={id} type="password" required minLength={minLength} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7a171b] focus:ring-2 focus:ring-[#7a171b]/15" />
    </div>
  );
}