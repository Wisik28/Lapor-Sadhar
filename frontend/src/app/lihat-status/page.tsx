"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { laporanApi, type LaporanItem, type StatusLaporan } from "@/lib/api";
import { clearAuthSession } from "@/lib/auth";
import { useAuthProtection } from "@/lib/useAuth";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  FileText,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

// Halaman Lihat Status dibuat dalam satu file page.tsx.
// Data diambil dari API Laravel melalui laporanApi.getAll().

type StatusKey =
  | "Terkirim"
  | "Sedang Diverifikasi"
  | "Terverifikasi"
  | "Diproses"
  | "Ditolak"
  | "Selesai";
type LaporanDenganTanggapan = LaporanItem & {
  nama_pelapor?: string;
  pesan_tanggapan?: string | null;
};

const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  Terkirim: {
    label: "Terkirim",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  "Sedang Diverifikasi": {
    label: "Sedang Diverifikasi",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  Terverifikasi: {
    label: "Terverifikasi",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  Diproses: {
    label: "Diproses",
    text: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  Ditolak: {
    label: "Ditolak",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  Selesai: {
    label: "Selesai",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
};

const STATUS_FILTERS = [
  "Semua",
  "Terkirim",
  "Sedang Diverifikasi",
  "Terverifikasi",
  "Diproses",
  "Ditolak",
  "Selesai",
] as const;

const KATEGORI_FILTERS = ["Semua", "Fasilitas", "Kebersihan"] as const;

function normalisasiStatus(value?: string | null): StatusKey {
  const status = (value ?? "Terkirim")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

  if (status.includes("tolak")) {
    return "Ditolak";
  }

  if (status.includes("selesai")) {
    return "Selesai";
  }

  if (
    status.includes("proses") ||
    status.includes("kerja")
  ) {
    return "Diproses";
  }

  if (
    status.includes("sedang verifikasi") ||
    status.includes("sedang diverifikasi") ||
    status.includes("verifikasi") && !status.includes("terverifikasi")
  ) {
    return "Sedang Diverifikasi";
  }

  if (
    status.includes("terverifikasi") ||
    status === "diverifikasi"
  ) {
    return "Terverifikasi";
  }

  return "Terkirim";
}

function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTanggalWaktu(value?: string | null): string {
  if (!value) return "Waktu belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  if (/^(https?:|data:image\/)/i.test(foto)) return foto;
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  const cleanPath = foto.startsWith("/") ? foto : `/${foto}`;
  return `${base}${cleanPath}`;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[normalisasiStatus(status)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.bg} ${config.border} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function ProgressStatus({ status }: { status: StatusKey }) {
  const steps: StatusKey[] = [
    "Terkirim",
    "Sedang Diverifikasi",
    "Terverifikasi",
    "Diproses",
    "Selesai",
  ];

  // Tampilan khusus jika laporan ditolak
  if (status === "Ditolak") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700">
          <XCircle className="h-5 w-5" />
          <p className="font-bold">Laporan Ditolak</p>
        </div>

        <p className="mt-1 text-sm text-red-600">
          Laporan tidak dilanjutkan ke tahap penanganan.
        </p>
      </div>
    );
  }

  const currentIndex = steps.indexOf(status);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const completed = index < currentIndex;
        const current = index === currentIndex;

        return (
          <div
            key={step}
            className={`rounded-xl border p-3 ${
              completed || current
                ? "border-[#7A0C0C]/20 bg-red-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  completed
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-[#7A0C0C] text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </span>

              {current && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#7A0C0C]">
                  Saat ini
                </span>
              )}
            </div>

            <p
              className={`text-xs font-bold ${
                completed || current
                  ? "text-[#7A0C0C]"
                  : "text-slate-400"
              }`}
            >
              {step}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function LihatStatusPage() {
  const router = useRouter();
  const { isLoading: authLoading, user } = useAuthProtection();

  const [laporan, setLaporan] = useState<LaporanDenganTanggapan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState<(typeof STATUS_FILTERS)[number]>("Semua");
  const [filterKategori, setFilterKategori] = useState<(typeof KATEGORI_FILTERS)[number]>("Semua");
  const [laporanTerpilih, setLaporanTerpilih] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const identifier = user?.nim || user?.nomor_identitas || "";

  const muatLaporan = useCallback(async (showRefresh = false) => {
    if (!identifier) {
      setLoading(false);
      setError("Nomor identitas akun tidak ditemukan. Silakan login kembali.");
      return;
    }

    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await laporanApi.getAll(identifier);
      if (response.status !== "success" || !Array.isArray(response.data)) {
        throw new Error(response.message || "Data laporan gagal dimuat.");
      }
      const data = response.data as LaporanDenganTanggapan[];
      setLaporan(data);
      setLaporanTerpilih((current) => {
        if (current && data.some((item) => item.id_laporan === current)) return current;
        return data.length > 0 ? data[0].id_laporan : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data laporan.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [identifier]);

  useEffect(() => {
  if (authLoading || !user) return;

  // Halaman Lihat Status hanya mengambil laporan berdasarkan
  // identitas pengguna yang sedang login.
  if (!identifier) {
    setLoading(false);
    setError("Nomor identitas akun tidak ditemukan. Silakan login kembali.");
    return;
  }

  void muatLaporan();
}, [authLoading, user, identifier, muatLaporan]);

  const laporanTersaring = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return laporan.filter((item) => {
      const status = normalisasiStatus(item.status_terkini);
      const cocokStatus = filterStatus === "Semua" || status === filterStatus;
      const cocokKategori = filterKategori === "Semua" || item.kategori_laporan === filterKategori;
      const cocokKeyword = !q || [
        String(item.id_laporan),
        item.lokasi,
        item.deskripsi,
        item.kategori_laporan,
        item.status_terkini,
      ].some((value) => (value || "").toLowerCase().includes(q));
      return cocokStatus && cocokKategori && cocokKeyword;
    });
  }, [laporan, keyword, filterStatus, filterKategori]);

  const laporanAktif = laporan.find((item) => item.id_laporan === laporanTerpilih) ?? null;
  const statistik = useMemo(() => ({
  total: laporan.length,

  // Hanya menghitung laporan yang sedang diproses
  aktif: laporan.filter(
    (item) => normalisasiStatus(item.status_terkini) === "Diproses"
  ).length,

  selesai: laporan.filter(
    (item) => normalisasiStatus(item.status_terkini) === "Selesai"
  ).length,

  ditolak: laporan.filter(
    (item) => normalisasiStatus(item.status_terkini) === "Ditolak"
  ).length,
}), [laporan]);

  const handleMenuChange = (menu: string) => {
  switch (menu) {
    case "lihat-status":
      router.push("/lihat-status");
      break;

    case "buat-laporan":
    case "riwayat-laporan":
    case "rubah-pengajuan":
      router.push("/buat-laporan");
      break;

    default:
      break;
  }
};

  const handleLogout = async () => {
    await clearAuthSession(false);
    router.replace("/login");
  };

  if (authLoading || (!user && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-[#7A0C0C]" />
          <p className="text-sm font-medium">Memeriksa sesi pengguna...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F3F4F6] px-4 text-center">
        <AlertCircle className="h-10 w-10 text-red-600" />
        <p className="text-sm text-slate-700">Sesi login tidak ditemukan. Silakan masuk kembali.</p>
        <button onClick={() => router.replace("/login")} className="rounded-xl bg-[#7A0C0C] px-5 py-2.5 text-sm font-semibold text-white">Ke halaman login</button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans text-slate-800">
      <Sidebar
        activeMenu="lihat-status"
        setActiveMenu={handleMenuChange}
        onLogout={handleLogout}
        isOpenMobile={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          pageTitle="Lihat Status Laporan"
          userName={user.nama}
          userRole={user.role}
          onToggleSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8">
          <div className="mx-auto max-w-6xl space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50">
                    <Eye className="h-5 w-5 text-[#7A0C0C]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 sm:text-lg">Pantau Status Laporan</h2>
                    <p className="mt-1 text-sm text-slate-500">Lihat perkembangan dan riwayat penanganan laporan yang telah kamu kirim.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void muatLaporan(true)}
                  disabled={loading || refreshing}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Perbarui Data
                </button>
              </div>
            </section>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">{error}</div>
                <button onClick={() => setError("")} aria-label="Tutup pesan"><XCircle className="h-4 w-4" /></button>
              </div>
            )}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Total Laporan", value: statistik.total, icon: FileText, color: "text-slate-700", bg: "bg-slate-100" },
                { label: "Sedang Ditangani", value: statistik.aktif, icon: Clock3, color: "text-amber-700", bg: "bg-amber-100" },
                { label: "Selesai", value: statistik.selesai, icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-100" },
                { label: "Ditolak", value: statistik.ditolak, icon: XCircle, color: "text-red-700", bg: "bg-red-100" },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">{card.label}</p>
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}><Icon className={`h-4 w-4 ${card.color}`} /></span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-800">{card.value}</p>
                  </div>
                );
              })}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#7A0C0C]" />
                <h3 className="text-sm font-bold text-slate-800">Cari dan Filter Laporan</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="relative block md:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Cari ID, lokasi, atau deskripsi..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#7A0C0C] focus:ring-2 focus:ring-[#7A0C0C]/10"
                  />
                </label>
                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#7A0C0C]">
                  {STATUS_FILTERS.map((status) => <option key={status} value={status}>{status === "Semua" ? "Semua Status" : status}</option>)}
                </select>
                <select value={filterKategori} onChange={(event) => setFilterKategori(event.target.value as typeof filterKategori)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#7A0C0C]">
                  {KATEGORI_FILTERS.map((kategori) => <option key={kategori} value={kategori}>{kategori === "Semua" ? "Semua Kategori" : kategori}</option>)}
                </select>
              </div>
            </section>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Daftar Laporan</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{laporanTersaring.length} laporan ditemukan</p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
                    <Loader2 className="h-7 w-7 animate-spin text-[#7A0C0C]" />
                    <p className="text-sm">Memuat laporan...</p>
                  </div>
                ) : laporanTersaring.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">Laporan tidak ditemukan</p>
                    <p className="mt-1 text-xs text-slate-400">Belum ada laporan atau tidak sesuai dengan pencarian dan filter.</p>
                  </div>
                ) : (
                  <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
                    {laporanTersaring.map((item) => {
                      const active = laporanTerpilih === item.id_laporan;
                      return (
                        <button
                          key={item.id_laporan}
                          type="button"
                          onClick={() => setLaporanTerpilih(item.id_laporan)}
                          className={`w-full rounded-xl border p-4 text-left transition ${active ? "border-[#7A0C0C] bg-red-50/60 ring-1 ring-[#7A0C0C]/10" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.kategori_laporan === "Fasilitas" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>{item.kategori_laporan}</span>
                            <StatusBadge status={item.status_terkini} />
                          </div>
                          <p className="line-clamp-2 text-sm font-semibold text-slate-800">{item.deskripsi}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.lokasi}</span>
                            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatTanggal(item.tanggal_buat)}</span>
                          </div>
                          <p className="mt-2 text-[11px] font-semibold text-slate-400">ID Laporan: #{item.id_laporan}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                {!laporanAktif ? (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <Eye className="h-9 w-9 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">Pilih laporan untuk melihat detail</p>
                    <p className="mt-1 text-xs text-slate-400">Informasi status dan riwayat akan ditampilkan di sini.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Detail Laporan #{laporanAktif.id_laporan}</p>
                        <h3 className="mt-1 text-base font-bold text-slate-800">Informasi Laporan</h3>
                      </div>
                      <StatusBadge status={laporanAktif.status_terkini} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div><p className="text-xs text-slate-400">Kategori</p><p className="mt-1 text-sm font-semibold text-slate-700">{laporanAktif.kategori_laporan}</p></div>
                      <div><p className="text-xs text-slate-400">Tanggal Kejadian</p><p className="mt-1 text-sm font-semibold text-slate-700">{formatTanggal(laporanAktif.tanggal_kejadian)}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-slate-400">Lokasi</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><MapPin className="h-4 w-4 text-[#7A0C0C]" />{laporanAktif.lokasi}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-slate-400">Deskripsi</p><p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{laporanAktif.deskripsi}</p></div>
                      {getFotoUrl(laporanAktif.foto) && (
                        <div className="sm:col-span-2">
                          <p className="mb-2 text-xs text-slate-400">Foto Pendukung</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getFotoUrl(laporanAktif.foto) as string} alt="Foto pendukung laporan" className="max-h-64 w-full rounded-xl border border-slate-200 object-contain" />
                        </div>
                      )}
                      <div><p className="text-xs text-slate-400">Tanggal Dibuat</p><p className="mt-1 text-sm font-semibold text-slate-700">{formatTanggal(laporanAktif.tanggal_buat)}</p></div>
                      <div><p className="text-xs text-slate-400">Terakhir Diperbarui</p><p className="mt-1 text-sm font-semibold text-slate-700">{formatTanggal(laporanAktif.tanggal_rubah)}</p></div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <div className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#7A0C0C]" /><h4 className="text-sm font-bold text-slate-800">Progres Penanganan</h4></div>
                      <ProgressStatus status={normalisasiStatus(laporanAktif.status_terkini)} />
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <div className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#7A0C0C]" /><h4 className="text-sm font-bold text-slate-800">Riwayat Perubahan Status</h4></div>
                      {laporanAktif.riwayat_status && laporanAktif.riwayat_status.length > 0 ? (
                        <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-5">
                          {[...laporanAktif.riwayat_status]
                            .sort((a, b) => new Date(b.tanggal_merubah).getTime() - new Date(a.tanggal_merubah).getTime())
                            .map((history: StatusLaporan) => {
                              const config = STATUS_CONFIG[normalisasiStatus(history.status_laporan)];
                              return (
                                <div key={history.id_status} className="relative">
                                  <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${config.dot}`} />
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <StatusBadge status={history.status_laporan} />
                                    <span className="text-xs text-slate-400">{formatTanggalWaktu(history.tanggal_merubah)}</span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Belum ada riwayat perubahan status.</p>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <h4 className="mb-2 text-sm font-bold text-slate-800">Tanggapan Admin</h4>
                      {laporanAktif.pesan_tanggapan ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">{laporanAktif.pesan_tanggapan}</div>
                      ) : (
                        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Belum ada tanggapan dari admin untuk laporan ini.</p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
