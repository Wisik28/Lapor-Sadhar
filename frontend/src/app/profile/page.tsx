"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { authApi } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState(authApi.getCurrentUser());
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const result = await authApi.requestUserEmailChange(newEmail.trim().toLowerCase());
    if (result.status === "success") {
      setStep("confirm");
      setMessage(result.message);
    } else {
      setError(result.message || "Kode verifikasi tidak dapat dikirim.");
    }
    setLoading(false);
  };

  const confirmEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const result = await authApi.confirmUserEmailChange(code);
    if (result.status === "success" && result.email && user) {
      const updatedUser = { ...user, email: result.email };
      setUser(updatedUser);
      setAuthSession(updatedUser, localStorage.getItem("auth_token") ?? "", false);
      setNewEmail("");
      setCode("");
      setStep("request");
      setMessage(result.message);
    } else {
      setError(result.message || "Email tidak dapat diperbarui.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar pageTitle="Profil" userName={user?.nama} userRole={user?.role} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Profil pengguna</h1>
          <p className="mt-1 text-sm text-slate-600">Email hanya dapat diubah setelah verifikasi melalui email lama.</p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</dt>
              <dd className="mt-1 font-medium text-slate-900">{user?.nama || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor identitas</dt>
              <dd className="mt-1 font-medium text-slate-900">{user?.nomor_identitas || user?.nim || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email saat ini</dt>
              <dd className="mt-1 font-medium text-slate-900">{user?.email || "Belum diisi"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis akun</dt>
              <dd className="mt-1 font-medium text-slate-900">{user?.role || "—"}</dd>
            </div>
          </dl>

          {message && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

          {step === "request" ? (
            <form onSubmit={requestCode} className="mt-7 space-y-4 border-t border-slate-100 pt-6">
              <h2 className="font-semibold text-slate-900">Ganti email</h2>
              <label className="block text-sm font-medium text-slate-700">
                Email baru
                <input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
              </label>
              <p className="text-xs text-slate-500">
                {user?.email
                  ? `Kode verifikasi dikirim ke email lama: ${user.email}`
                  : "Belum ada email tersimpan. Kode verifikasi awal akan dikirim ke email baru."}
              </p>
              <button disabled={loading || !user?.email} className="h-11 rounded-lg bg-[#7A0C0C] px-5 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? "Mengirim kode..." : "Kirim kode ke email lama"}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmEmail} className="mt-7 space-y-4 border-t border-slate-100 pt-6">
              <h2 className="font-semibold text-slate-900">Verifikasi email lama</h2>
              <label className="block text-sm font-medium text-slate-700">
                Kode 6 digit
                <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#7A0C0C]" />
              </label>
              <p className="text-xs text-slate-500">Kode berlaku selama 10 menit.</p>
              <button disabled={loading} className="h-11 rounded-lg bg-[#7A0C0C] px-5 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? "Memverifikasi..." : "Verifikasi dan simpan email"}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-sm">
            <Link href="/buat-laporan" className="font-medium text-[#7A0C0C] hover:underline">Kembali ke halaman laporan</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
