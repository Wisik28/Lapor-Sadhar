"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { NetworkErrorAlert } from "@/components/NetworkErrorAlert";
import { laporanApi, type LaporanItem } from "@/lib/api";
import { formatUserFriendlyError } from "@/lib/networkError";
import { useAuthProtection } from "@/lib/useAuth";
import {
  getFotoList,
  getFotoUrl as getBaseFotoUrl,
  getThumbnailFotoUrl,
} from "@/lib/laporanPhoto";
import {
  normalizeLaporanStatus,
  type StatusLaporanTerkini,
} from "@/lib/laporanStatus";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  Loader2,
  Paperclip,
  X,
  MapPin,
  Edit3,
  AlertCircle,
  ZoomIn,
} from "lucide-react";

const STATUS_OPTIONS: StatusLaporanTerkini[] = [
  "Terkirim",
  "Sedang Diverifikasi",
  "Terverifikasi",
  "Diproses",
  "Selesai",
  "Ditolak",
];

// Helper Format Tanggal
function formatTanggalLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTanggalTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = d
      .toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(".", ":");
    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

// Helper Normalisasi URL Foto
function resolveFotoUrl(rawFoto: string): string {
  const trimmed = rawFoto.trim();
  if (!trimmed || trimmed.startsWith("blob:")) return "";
  if (/^(https?:|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^\/?storage\//i.test(trimmed)) {
    return getBaseFotoUrl(trimmed);
  }
  const apiBase = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
  ).replace(/\/api\/?$/, "");
  return `${apiBase}/storage/${trimmed.replace(/^\/+/, "")}`;
}

function hasBlobFoto(foto?: string | string[] | null): boolean {
  if (!foto) return false;
  if (Array.isArray(foto)) {
    return foto.some((item) => typeof item === "string" && item.startsWith("blob:"));
  }
  return typeof foto === "string" && foto.includes("blob:");
}

function getStatusBadgeStyle(status: StatusLaporanTerkini): {
  badge: string;
  dot: string;
} {
  switch (status) {
    case "Terkirim":
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      };
    case "Sedang Diverifikasi":
      return {
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
    case "Terverifikasi":
      return {
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        dot: "bg-indigo-500",
      };
    case "Diproses":
      return {
        badge: "bg-purple-50 text-[#7A0C0C] border-purple-200",
        dot: "bg-[#7A0C0C]",
      };
    case "Selesai":
      return {
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "Ditolak":
      return {
        badge: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
  }
}

// Opsi Bulan untuk Filter
const LIST_BULAN = [
  { value: "0", label: "Januari" },
  { value: "1", label: "Februari" },
  { value: "2", label: "Maret" },
  { value: "3", label: "April" },
  { value: "4", label: "Mei" },
  { value: "5", label: "Juni" },
  { value: "6", label: "Juli" },
  { value: "7", label: "Agustus" },
  { value: "8", label: "September" },
  { value: "9", label: "Oktober" },
  { value: "10", label: "November" },
  { value: "11", label: "Desember" },
];

export default function UserRiwayatLaporanPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isLoading: authLoading, user: authUser } = useAuthProtection();

  const nim = authUser?.nim || authUser?.nomor_identitas || "";
  const nama = authUser?.nama ?? "Pengguna";
  const role =
    authUser?.role ||
    (authUser?.tipe_user === "karyawan" ? "Karyawan" : "Mahasiswa");

  const [laporanList, setLaporanList] = useState<LaporanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterWaktu, setFilterWaktu] = useState("Semua Waktu");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // State Modal Detail & Pratinjau Foto
  const [selectedDetail, setSelectedDetail] = useState<LaporanItem | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[];
    index: number;
  } | null>(null);

  // Daftar URL foto valid untuk laporan yang dibuka di modal detail
  const selectedFotoList = useMemo(() => {
    if (!selectedDetail) return [];
    return getFotoList(
      selectedDetail.foto as string | string[] | null | undefined
    )
      .map(resolveFotoUrl)
      .filter((url) => url.length > 0);
  }, [selectedDetail]);

  // ── Ambil Data Backend ──
  const fetchLaporan = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      if (!nim) {
        setLaporanList([]);
        return;
      }
      const res = await laporanApi.getAll(nim);
      if (res.status === "success" && Array.isArray(res.data)) {
        const sortedData = (res.data as LaporanItem[]).sort(
          (a, b) => b.id_laporan - a.id_laporan
        );
        setLaporanList(sortedData);
      } else {
        setFetchError(
          formatUserFriendlyError(
            res.message,
            "load",
            "Gagal memuat data laporan. Silakan coba lagi."
          )
        );
      }
    } catch (error) {
      setFetchError(
        formatUserFriendlyError(
          error,
          "load",
          "Gagal memuat data laporan. Silakan coba lagi."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [nim]);

  useEffect(() => {
    if (!authLoading) {
      fetchLaporan();
    }
  }, [authLoading, fetchLaporan]);

  // Reset ke halaman 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterKategori, filterWaktu]);

  // ── Hitung KPI ──
  const totalLaporan = laporanList.length;
  const sedangDiproses = laporanList.filter((l) =>
    ["Sedang Diverifikasi", "Terverifikasi", "Diproses"].includes(
      normalizeLaporanStatus(l.status_terkini)
    )
  ).length;
  const selesaiCount = laporanList.filter(
    (l) => normalizeLaporanStatus(l.status_terkini) === "Selesai"
  ).length;
  const ditolakCount = laporanList.filter(
    (l) => normalizeLaporanStatus(l.status_terkini) === "Ditolak"
  ).length;

  // ── Filter Data ──
  const filteredList = laporanList.filter((item) => {
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === "" ||
      (item.deskripsi && item.deskripsi.toLowerCase().includes(searchLow)) ||
      (item.lokasi && item.lokasi.toLowerCase().includes(searchLow)) ||
      String(item.id_laporan).includes(searchLow);

    const normalizedItemStatus = normalizeLaporanStatus(item.status_terkini);
    const matchesStatus =
      filterStatus === "Semua" ||
      normalizedItemStatus === normalizeLaporanStatus(filterStatus);
    const matchesKategori =
      filterKategori === "Semua" || item.kategori_laporan === filterKategori;

    // Filter Bulan
    let matchesWaktu = true;
    const targetDateStr = item.tanggal_buat || item.tanggal_kejadian;

    if (targetDateStr && filterWaktu !== "Semua Waktu") {
      const itemDate = new Date(targetDateStr);
      if (!Number.isNaN(itemDate.getTime())) {
        matchesWaktu = itemDate.getMonth() === Number(filterWaktu);
      }
    }

    return matchesSearch && matchesStatus && matchesKategori && matchesWaktu;
  });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedData = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderStatusBadge = (rawStatus?: string | null) => {
    const status = normalizeLaporanStatus(rawStatus);
    const style = getStatusBadgeStyle(status);

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
        {status}
      </span>
    );
  };

  const handleGoToUbahPengajuan = (idLaporan: number) => {
    setSelectedDetail(null);
    router.push(`/ubah-pengajuan?id=${idLaporan}`);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
          <p className="text-slate-600 text-sm font-medium">
            Memeriksa autentikasi...
          </p>
        </div>
      </div>
    );
  }

  const stepsProgres: { key: StatusLaporanTerkini; label: string; num: number }[] = [
    { key: "Terkirim", label: "Terkirim", num: 1 },
    { key: "Sedang Diverifikasi", label: "Sedang Diverifikasi", num: 2 },
    { key: "Terverifikasi", label: "Terverifikasi", num: 3 },
    { key: "Diproses", label: "Diproses", num: 4 },
    { key: "Selesai", label: "Selesai", num: 5 },
  ];

  const selectedStatus = selectedDetail
    ? normalizeLaporanStatus(selectedDetail.status_terkini)
    : "Terkirim";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans text-slate-800">
      <Sidebar
        activeMenu="riwayat-laporan"
        setActiveMenu={(menu: string) => {
          if (menu === "buat-laporan") router.push("/buat-laporan");
          if (menu === "ubah-pengajuan") router.push("/ubah-pengajuan");
          if (menu === "lihat-status") router.push("/lihat-status");
        }}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          pageTitle="Riwayat Laporan"
          userName={nama}
          userRole={role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto bg-[#F3F4F6] p-0 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-2.5 md:space-y-5">
            {fetchError && (
              <div className="px-3 pt-3 md:p-0">
                <NetworkErrorAlert
                  message={fetchError}
                  onRetry={() => void fetchLaporan()}
                  retrying={loading}
                  onDismiss={() => setFetchError("")}
                />
              </div>
            )}
            {/* ═══ KELOMPOK 1: STATUS LAPORAN ═══ */}
            <section aria-label="Ringkasan Status Laporan">
              {/* Mobile: Tanpa Card, menyatu penuh sebagai kelompok 1 */}
              <div className="md:hidden bg-white border-b border-slate-200/80 px-2 py-3">
                <div className="grid grid-cols-4 divide-x divide-slate-100 text-center">
                  <div className="px-1 flex flex-col items-center">
                    <div className="w-7 h-7 rounded-lg bg-red-50 text-[#7A0C0C] flex items-center justify-center border border-red-100 mb-1">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-base font-extrabold text-slate-900 leading-none">
                      {totalLaporan}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1 truncate max-w-full">
                      Total
                    </span>
                  </div>

                  <div className="px-1 flex flex-col items-center">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 mb-1">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-base font-extrabold text-amber-600 leading-none">
                      {sedangDiproses}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1 truncate max-w-full">
                      Diproses
                    </span>
                  </div>

                  <div className="px-1 flex flex-col items-center">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-base font-extrabold text-emerald-600 leading-none">
                      {selesaiCount}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1 truncate max-w-full">
                      Selesai
                    </span>
                  </div>

                  <div className="px-1 flex flex-col items-center">
                    <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 mb-1">
                      <XCircle className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-base font-extrabold text-red-700 leading-none">
                      {ditolakCount}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1 truncate max-w-full">
                      Ditolak
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop: 4 KPI Cards (dipertahankan) */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      TOTAL LAPORAN
                    </p>
                    <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                      {totalLaporan}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">Semua kampus</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-[#7A0C0C] flex items-center justify-center border border-red-100 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      SEDANG DIPROSES
                    </p>
                    <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
                      {sedangDiproses}
                    </h3>
                    <p className="text-[11px] text-amber-600/80 mt-1">
                      Verifikasi & Teknisi
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      SELESAI
                    </p>
                    <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
                      {selesaiCount}
                    </h3>
                    <p className="text-[11px] text-emerald-600/80 mt-1">
                      Masalah tuntas
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      DITOLAK
                    </p>
                    <h3 className="text-2xl font-extrabold text-red-700 mt-1">
                      {ditolakCount}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Duplikasi / Tidak valid
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </section>

            {/* ═══ KELOMPOK 2: PENCARIAN, FILTER & DAFTAR LAPORAN ═══ */}
            <section
              aria-label="Filter dan Daftar Laporan"
              className="bg-white border-t border-slate-200/80 md:rounded-2xl md:border md:border-slate-200/80 md:shadow-2xs overflow-hidden w-full"
            >
              {/* Panel Pencarian & Filter — Desktop tergabung di bagian atas Kelompok 2 */}
              <div className="hidden md:flex p-4 border-b border-slate-200/80 flex-row items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari id laporan, deskripsi laporan, atau lokasi..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-[#7A0C0C] transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter Waktu */}
                  <select
                    value={filterWaktu}
                    onChange={(e) => setFilterWaktu(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="Semua Waktu">Waktu: Semua Waktu</option>
                    {LIST_BULAN.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>

                  {/* Filter Status */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="Semua">Status: Semua</option>
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  {/* Filter Kategori */}
                  <select
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="Semua">Kategori: Semua</option>
                    <option value="Fasilitas">Fasilitas</option>
                    <option value="Kebersihan">Kebersihan</option>
                  </select>

                  <button
                    onClick={fetchLaporan}
                    disabled={loading}
                    aria-label="Muat ulang data"
                    className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer shrink-0"
                    title="Muat ulang data"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Search Bar + Refresh Ikon Kecil + Filter — Mobile tergabung di bagian atas Kelompok 2 */}
              <div className="md:hidden px-3 py-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari ID, deskripsi, atau lokasi..."
                      className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#7A0C0C] focus:bg-white transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchLaporan}
                    disabled={loading}
                    aria-label="Muat ulang data"
                    title="Muat ulang data"
                    className="w-8 h-8 shrink-0 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <select
                    aria-label="Filter waktu"
                    value={filterWaktu}
                    onChange={(e) => setFilterWaktu(e.target.value)}
                    className="w-full min-w-0 h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 outline-none focus:border-[#7A0C0C] cursor-pointer"
                  >
                    <option value="Semua Waktu">Waktu</option>
                    {LIST_BULAN.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full min-w-0 h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 outline-none focus:border-[#7A0C0C] cursor-pointer"
                  >
                    <option value="Semua">Status</option>
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter kategori"
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="w-full min-w-0 h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 outline-none focus:border-[#7A0C0C] cursor-pointer"
                  >
                    <option value="Semua">Kategori</option>
                    <option value="Fasilitas">Fasilitas</option>
                    <option value="Kebersihan">Kebersihan</option>
                  </select>
                </div>
              </div>

              {/* Tabel Mobile — fit 1 layar tanpa scroll horizontal, klik baris untuk detail */}
              <div className="md:hidden w-full">
                <div className="px-3 py-2.5 bg-slate-50/80 border-b border-slate-200/80">
                  <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    LAPORAN
                  </h3>
                </div>
                <table className="w-full table-fixed text-left border-collapse">
                  <colgroup>
                    <col />
                    <col className="w-[106px]" />
                  </colgroup>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="py-10 text-center text-xs text-slate-400"
                        >
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7A0C0C]" />
                          Memuat riwayat laporan...
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="py-10 text-center text-xs text-slate-400"
                        >
                          Belum ada data riwayat laporan.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((lap) => {
                        const rawFoto = lap.foto as
                          | string
                          | string[]
                          | null
                          | undefined;
                        const rowFotos = getFotoList(rawFoto)
                          .map(resolveFotoUrl)
                          .filter((url) => url.length > 0);
                        const statusNorm = normalizeLaporanStatus(lap.status_terkini);
                        const statusStyle = getStatusBadgeStyle(statusNorm);

                        return (
                          <tr
                            key={`mobile-${lap.id_laporan}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedDetail(lap)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedDetail(lap);
                              }
                            }}
                            className="active:bg-red-50/60 hover:bg-slate-50/90 transition-colors cursor-pointer"
                          >
                            <td className="px-3 py-3 align-middle min-w-0">
                              <p className="font-bold text-slate-900 text-xs flex items-center gap-1 min-w-0">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#7A0C0C]" />
                                <span className="truncate">{lap.lokasi || "-"}</span>
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {lap.deskripsi}
                              </p>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                                <span className="font-medium text-slate-500">
                                  {lap.tanggal_kejadian || "-"}
                                </span>
                                <span>•</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200/70">
                                  {lap.kategori_laporan}
                                </span>
                                {rowFotos.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-slate-500">
                                    <Paperclip className="w-2.5 h-2.5" />
                                    <span>{rowFotos.length}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle text-right">
                              <span
                                className={`inline-flex max-w-full items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${statusStyle.badge}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusStyle.dot}`}
                                />
                                <span className="truncate">
                                  {statusNorm === "Sedang Diverifikasi"
                                    ? "Diverifikasi"
                                    : statusNorm}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tabel Desktop (dipertahankan) */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">
                        Tanggal & Waktu
                      </th>
                      <th className="px-4 py-3.5">Lokasi & Deskripsi Kejadian</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">
                        Kategori
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">
                        Status
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">
                        Lampiran
                      </th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-slate-400"
                        >
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7A0C0C]" />
                          Memuat riwayat laporan...
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-slate-400"
                        >
                          Belum ada data riwayat laporan.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((lap) => {
                        const rawFoto = lap.foto as
                          | string
                          | string[]
                          | null
                          | undefined;
                        const rowFotos = getFotoList(rawFoto)
                          .map(resolveFotoUrl)
                          .filter((url) => url.length > 0);
                        const firstFotoUrl = rowFotos[0] || "";

                        return (
                          <tr
                            key={lap.id_laporan}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap text-xs text-slate-500">
                              <span className="font-semibold text-slate-800 block">
                                {lap.tanggal_kejadian || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <p className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 min-w-0">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#7A0C0C]" />
                                <span className="truncate">{lap.lokasi || "-"}</span>
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {lap.deskripsi}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                              <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {lap.kategori_laporan}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                              {renderStatusBadge(lap.status_terkini)}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap text-xs text-slate-500">
                              {firstFotoUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (rowFotos.length === 1) {
                                      setPreviewGallery({ images: rowFotos, index: 0 });
                                    } else {
                                      setSelectedDetail(lap);
                                    }
                                  }}
                                  title="Klik untuk melihat foto"
                                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-red-50 hover:text-[#7A0C0C] hover:border-red-200 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                                >
                                  <Paperclip className="w-3 h-3 shrink-0" />
                                  <span>
                                    {rowFotos.length > 1
                                      ? `Foto (${rowFotos.length})`
                                      : "Foto"}
                                  </span>
                                </button>
                              ) : hasBlobFoto(rawFoto) ? (
                                <span
                                  className="text-[11px] text-amber-600 italic"
                                  title="File tidak terunggah ke server"
                                >
                                  Gagal unggah
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedDetail(lap)}
                                className="px-3.5 py-1.5 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-semibold shadow-2xs transition-all inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Detail</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-3 md:px-4 py-3 bg-white md:bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-xs text-slate-500">
                <p>
                  Menampilkan{" "}
                  {paginatedData.length > 0
                    ? (currentPage - 1) * itemsPerPage + 1
                    : 0}{" "}
                  - {Math.min(currentPage * itemsPerPage, filteredList.length)}{" "}
                  dari {filteredList.length} pengajuan laporan
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg font-bold transition-colors cursor-pointer ${
                          currentPage === p
                            ? "bg-[#7A0C0C] text-white"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL POP-UP DETAIL LAPORAN
      ════════════════════════════════════════════════════════════════════ */}
      {selectedDetail && (
        <div
          onClick={() => setSelectedDetail(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[84dvh] sm:max-h-[90vh] flex flex-col border border-slate-100"
          >
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  DETAIL LAPORAN #{selectedDetail.id_laporan}
                </p>
                <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Informasi Laporan
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge(selectedDetail.status_terkini)}
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Isi Konten Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Grid Info Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Kategori
                  </p>
                  <p className="font-bold text-slate-800">
                    {selectedDetail.kategori_laporan || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Tanggal Kejadian
                  </p>
                  <p className="font-bold text-slate-800">
                    {formatTanggalLong(selectedDetail.tanggal_kejadian)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Lokasi
                  </p>
                  <p className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{selectedDetail.lokasi || "-"}</span>
                  </p>
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">
                  Deskripsi
                </p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-slate-700 text-xs sm:text-sm leading-relaxed">
                  {selectedDetail.deskripsi}
                </div>
              </div>

              {/* Foto Pendukung */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-400 font-medium">
                    Foto Pendukung
                    {selectedFotoList.length > 1
                      ? ` (${selectedFotoList.length} foto)`
                      : ""}
                  </p>
                </div>

                {selectedFotoList.length > 0 ? (
                  <div
                    className={`grid gap-3 ${
                      selectedFotoList.length > 1
                        ? "grid-cols-1 sm:grid-cols-2"
                        : "grid-cols-1"
                    }`}
                  >
                    {selectedFotoList.map((fotoUrl, idx) => (
                      <div
                        key={`${selectedDetail.id_laporan}-foto-${idx}`}
                        className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50/70 p-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewGallery({ images: selectedFotoList, index: idx })
                          }
                          className="block w-full relative group cursor-zoom-in focus:outline-none"
                          title="Klik untuk memperbesar foto"
                        >
                          <img
                            src={getThumbnailFotoUrl(fotoUrl, 640)}
                            alt={`Foto pendukung laporan ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full max-h-60 object-contain rounded-xl transition-opacity group-hover:opacity-90"
                            onError={(e) => {
                              const parentBtn = e.currentTarget.parentElement;
                              if (parentBtn) {
                                parentBtn.style.display = "none";
                                const fallbackElem =
                                  parentBtn.nextElementSibling as HTMLElement;
                                if (fallbackElem) fallbackElem.style.display = "flex";
                              }
                            }}
                          />
                          <span className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                            <ZoomIn className="w-3 h-3" />
                            <span>Perbesar</span>
                          </span>
                        </button>

                        {/* Tampilan Fallback Rapi di Tengah */}
                        <div className="hidden w-full flex-col items-center justify-center py-6 px-4 text-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                            <Paperclip className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-xs font-semibold text-slate-600">
                            Gambar tidak dapat dimuat
                          </p>
                          {!fotoUrl.startsWith("data:") && (
                            <a
                              href={fotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#7A0C0C] font-bold hover:underline"
                            >
                              Buka Tautan Foto Asli ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : hasBlobFoto(
                    selectedDetail.foto as string | string[] | null | undefined
                  ) ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-xs">
                    Foto pada laporan ini gagal tersimpan ke server saat
                    pengajuan awal.
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs italic">
                    Tidak ada foto pendukung diunggah.
                  </div>
                )}
              </div>

              {/* Tanggal Dibuat & Terakhir Diperbarui */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Tanggal Dibuat
                  </p>
                  <p className="font-bold text-slate-800">
                    {formatTanggalLong(selectedDetail.tanggal_buat)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Terakhir Diperbarui
                  </p>
                  <p className="font-bold text-slate-800">
                    {selectedDetail.tanggal_rubah
                      ? formatTanggalLong(selectedDetail.tanggal_rubah)
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Progres Penanganan */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-700" />
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">
                    Progres Penanganan
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {stepsProgres.map((st) => {
                    const isCurrent = selectedStatus === st.key;
                    return (
                      <div
                        key={st.key}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isCurrent
                            ? "bg-red-50/60 border-red-200 text-red-900 shadow-2xs"
                            : "bg-slate-50/70 border-slate-200/80 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? "bg-red-700 text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {st.num}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-extrabold uppercase text-red-600 tracking-wider">
                              SAAT INI
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs font-bold ${
                            isCurrent ? "text-red-900" : "text-slate-600"
                          }`}
                        >
                          {st.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Riwayat Perubahan Status */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-700" />
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">
                    Riwayat Perubahan Status
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedDetail.riwayat_status &&
                  selectedDetail.riwayat_status.length > 0 ? (
                    [...selectedDetail.riwayat_status]
                      .sort((a, b) => {
                        const tanggalA = new Date(
                          a.tanggal_merubah || 0
                        ).getTime();
                        const tanggalB = new Date(
                          b.tanggal_merubah || 0
                        ).getTime();
                        return tanggalA - tanggalB;
                      })
                      .map((rs, idx) => (
                        <div
                          key={rs.id_status ?? `${rs.tanggal_merubah}-${idx}`}
                          className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(rs.status_laporan)}
                          </div>
                          <span className="text-xs text-slate-400 font-medium">
                            {formatTanggalTime(rs.tanggal_merubah)}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        {renderStatusBadge(selectedDetail.status_terkini)}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {formatTanggalTime(selectedDetail.tanggal_buat)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tanggapan Admin */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="font-bold text-slate-800 text-xs sm:text-sm">
                  Tanggapan Admin
                </p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-slate-600 text-xs leading-relaxed">
                  {selectedDetail.pesan_tanggapan ||
                    "Belum ada tanggapan dari admin untuk laporan ini."}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {selectedStatus === "Terkirim" ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 w-full sm:w-auto">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Pengajuan ini masih dapat diubah sebelum diverifikasi.
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  {selectedStatus === "Selesai"
                    ? "Laporan telah selesai ditangani."
                    : selectedStatus === "Ditolak"
                      ? "Laporan ditolak oleh admin."
                      : "Laporan dalam penanganan."}
                </span>
              )}

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {selectedStatus === "Terkirim" && (
                  <button
                    onClick={() =>
                      handleGoToUbahPengajuan(selectedDetail.id_laporan)
                    }
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Pengajuan</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Pratinjau Foto Ukuran Tetap */}
      <ImagePreviewModal
        images={previewGallery?.images ?? []}
        activeIndex={previewGallery ? previewGallery.index : null}
        onClose={() => setPreviewGallery(null)}
        onChangeIndex={(index) =>
          setPreviewGallery((prev) => (prev ? { ...prev, index } : null))
        }
        titlePrefix="Foto Bukti"
      />
    </div>
  );
}
