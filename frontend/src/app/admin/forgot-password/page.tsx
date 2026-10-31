"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { adminPositions, AdminPosition } from "@/lib/admin-positions";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [jabatan, setJabatan] = useState<AdminPosition>("kepala_blu");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const result = await authApi.requestAdminPasswordReset({ username: username.trim(), jabatan });
    if (result.status === "success") {
      setStep("reset");
      setMessage(result.message);
    } else {
      setError(result.message || "Kode reset tidak dapat dikirim.");
    }
    setLoading(false);
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmation) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    const result = await authApi.resetAdminPassword({
      username: username.trim(),
      jabatan,
      code,
      password,
      password_confirmation: confirmation,
    });
    if (result.status === "success") {
      setMessage(result.message);
      setTimeout(() => router.replace("/admin/login"), 1200);
    } else {
      setError(result.message || "Kata sandi admin tidak dapat direset.");
    }
    setLoading(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <p className="text-sm font-semibold text-[#7A0C0C]">Portal Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Reset kata sandi admin</h1>
        <p className="mt-2 text-sm text-slate-600">Kode akan dikirim ke email yang terdaftar pada akun admin.</p>

        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

        {step === "request" ? (
          <form onSubmit={requestCode} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Jabatan admin
              <select value={jabatan} onChange={(event) => setJabatan(event.target.value as AdminPosition)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#7A0C0C]">
                {adminPositions.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Username admin
              <input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
            </label>
            <button disabled={loading} className="h-11 w-full rounded-lg bg-[#7A0C0C] text-sm font-semibold text-white disabled:opacity-60">
              {loading ? "Mengirim kode..." : "Kirim kode reset"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Kode 6 digit
              <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Kata sandi baru (minimal 12 karakter)
              <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Konfirmasi kata sandi
              <input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
            </label>
            <button disabled={loading} className="h-11 w-full rounded-lg bg-[#7A0C0C] text-sm font-semibold text-white disabled:opacity-60">
              {loading ? "Menyimpan..." : "Atur kata sandi baru"}
            </button>
            <button type="button" onClick={() => requestCode()} disabled={loading} className="w-full text-sm font-medium text-[#7A0C0C] hover:underline">Kirim ulang kode</button>
          </form>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center text-sm">
          <Link href="/admin/login" className="font-medium text-slate-600 hover:text-[#7A0C0C]">Kembali ke login admin</Link>
        </div>
      </section>
    </main>
  );
}
