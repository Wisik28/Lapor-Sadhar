"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, UserRound, Building2, ShieldCheck } from "lucide-react";
import { authApi } from "@/lib/api";

const campuses = ["Kampus I", "Kampus II", "Kampus III", "Kampus IV", "Kampus V"] as const;

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"BLU" | "BPS">("BLU");
  const [campus, setCampus] = useState<(typeof campuses)[number]>(campuses[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await authApi.adminLogin({ username: username.trim(), password, role, campus });
    if (result.status === "success") {
      router.replace("/admin/dashboard");
    } else {
      setError(result.message || "Username atau kata sandi tidak sesuai.");
    }
    setIsLoading(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[url('/assets/bg_kampus.jpg')] bg-cover bg-center px-4 py-10">
      <div className="absolute inset-0 bg-black/40" />

      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/50 bg-white/95 shadow-2xl shadow-black/30 backdrop-blur-md md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between bg-[#7a171b] p-7 text-white sm:p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10">
              <Image src="/assets/logo_usd.png" alt="Logo Universitas Sanata Dharma" width={32} height={32} className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold">Universitas Sanata Dharma</p>
              <p className="text-xs text-white/70">Lapor Sadhar</p>
            </div>
          </div>

          <div className="my-12">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl border border-white/20 bg-white/10">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Akses terbatas</p>
            <h1 className="max-w-xs text-3xl font-semibold leading-tight">Portal Admin BLU &amp; BPS</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
              Masuk menggunakan akun admin yang telah diberikan untuk unit dan kampus Anda.
            </p>
          </div>

          <p className="text-xs text-white/60">Akses hanya untuk admin terdaftar.</p>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-7">
            <p className="text-sm font-medium text-[#7a171b]">Masuk ke akun</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Login admin</h2>
            <p className="mt-2 text-sm text-slate-500">Pilih unit dan kampus yang sesuai dengan akun Anda.</p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-role" className="mb-1.5 block text-sm font-medium text-slate-700">Unit admin</label>
              <select id="admin-role" value={role} onChange={(event) => setRole(event.target.value as "BLU" | "BPS")} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#7a171b] focus:ring-2 focus:ring-[#7a171b]/15">
                <option value="BLU">BLU</option>
                <option value="BPS">BPS</option>
              </select>
            </div>

            <div>
              <label htmlFor="admin-campus" className="mb-1.5 block text-sm font-medium text-slate-700">Kampus</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select id="admin-campus" value={campus} onChange={(event) => setCampus(event.target.value as (typeof campuses)[number])} className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#7a171b] focus:ring-2 focus:ring-[#7a171b]/15">
                  {campuses.map((campusOption) => <option key={campusOption} value={campusOption}>{campusOption}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username admin" className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7a171b] focus:ring-2 focus:ring-[#7a171b]/15" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Kata sandi</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-11 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7a171b] focus:ring-2 focus:ring-[#7a171b]/15" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#7a171b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#641216] disabled:cursor-wait disabled:opacity-60">
              {isLoading ? "Memeriksa akun..." : "Masuk sebagai admin"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-[#7a171b]">Kembali ke login civitas</Link>
          </div>
        </div>
      </section>
    </main>
  );
}