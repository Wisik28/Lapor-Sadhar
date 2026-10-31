"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const result = await authApi.requestUserPasswordReset(email.trim().toLowerCase());
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
    const result = await authApi.resetUserPassword({
      email: email.trim().toLowerCase(),
      code,
      password,
      password_confirmation: confirmation,
    });
    if (result.status === "success") {
      setMessage(result.message);
      setTimeout(() => router.replace("/login"), 1200);
    } else {
      setError(result.message || "Kata sandi tidak dapat direset.");
    }
    setLoading(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <p className="text-sm font-semibold text-[#7A0C0C]">Lapor Sadhar</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Lupa kata sandi</h1>
        <p className="mt-2 text-sm text-slate-600">Kode reset akan dikirim ke alamat email yang terdaftar.</p>

        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

        {step === "request" ? (
          <form onSubmit={requestCode} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email terdaftar
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
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
              Kata sandi baru
              <input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Konfirmasi kata sandi
              <input type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
            </label>
            <button disabled={loading} className="h-11 w-full rounded-lg bg-[#7A0C0C] text-sm font-semibold text-white disabled:opacity-60">
              {loading ? "Menyimpan..." : "Atur kata sandi baru"}
            </button>
            <button type="button" onClick={requestCode} disabled={loading} className="w-full text-sm font-medium text-[#7A0C0C] hover:underline">Kirim ulang kode</button>
          </form>
        )}

        <div className="mt-5 flex justify-between border-t border-slate-100 pt-4 text-sm">
          <Link href="/login" className="font-medium text-slate-600 hover:text-[#7A0C0C]">Kembali ke login</Link>
          <Link href="/admin/forgot-password" className="font-medium text-slate-600 hover:text-[#7A0C0C]">Admin?</Link>
        </div>
      </section>
    </main>
  );
}
