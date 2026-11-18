"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/components/AdminNavbar";
import PeriodFilter from "@/components/PeriodFilter";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { useAdminProtection } from "@/lib/useAuth";
import { adminLaporanApi } from "@/lib/api";
import { getFotoList, getFotoUrl } from "@/lib/laporanPhoto";
import { LOKASI_KAMPUS_OPTIONS, resolveLokasiKampus } from "@/lib/laporanCampus";
import {
  KATEGORI_LAPORAN_OPTIONS,
  getKategoriTextColorClass,
  isCampusScopedAdmin,
  isWakilRektorII,
  normalizeKategoriLaporan,
} from "@/lib/admin-positions";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Inbox,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Search,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  X,
  RefreshCw,
} from "lucide-react";

// Tipe Data Status Laporan di Dashboard
export type StatusLaporan =
  | "Terkirim"
  | "Diverifikasi"
  | "Diproses"
  | "Ditolak"
  | "Selesai";

const MONTH_NAMES: Record<string, string> = {
  Semua: "Semua Bulan",
  "01": "Januari",
  "02": "Februari",
  "03": "Maret",
  "04": "April",
  "05": "Mei",
  "06": "Juni",
  "07": "Juli",
  "08": "Agustus",
  "09": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Desember",
};

const REPORT_TABLE_COLUMNS = [
  { label: "ID", alignRight: false },
  { label: "Tanggal", alignRight: false },
  { label: "Pelapor", alignRight: false },
  { label: "Lokasi & Fasilitas", alignRight: false },
  { label: "Status", alignRight: false },
  { label: "Aksi", alignRight: true },
] as const;

const WR2_REPORT_TABLE_COLUMNS = [
  { label: "ID", alignRight: false },
  { label: "Tanggal", alignRight: false },
  { label: "Pelapor", alignRight: false },
  { label: "Kategori Laporan", alignRight: false },
  { label: "Lokasi & Fasilitas", alignRight: false },
  { label: "Status", alignRight: false },
  { label: "Aksi", alignRight: true },
] as const;

export interface ReportItem {
  id: string; // ID Laporan (e.g. "001")
  idRaw: number;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  pelaporNama: string;
  pelaporNim: string;
  pelaporRole: string;
  kategori: string;
  fasilitas: string;
  lokasi: string;
  kampus: string;
  deskripsi: string;
  status: StatusLaporan;
  prioritas: "Tinggi" | "Sedang" | "Rendah";
  jumlahFoto: number;
  fotoList: string[];
}

interface RawLaporanApiItem {
  id_laporan?: number | string;
  nim?: string;
  nama_pelapor?: string;
  tipe_user?: string;
  kategori_laporan?: string;
  deskripsi?: string;
  tanggal_kejadian?: string;
  tanggal_buat?: string;
  tanggal_rubah?: string | null;
  lokasi_kampus?: string | null;
  lokasi?: string;
  kategori_lokasi?: string;
  tingkat_keparahan?: string;
  skala_keparahan?: number;
  foto?: string | string[] | null;
  status_terkini?: string;
  status_laporan?: string;
}

// ── Helper Pemetaan Data dari Database ──────────────────────────────────────

function parseTanggalDanWaktu(rawDate?: string) {
  if (!rawDate) {
    return {
      tanggal: "2026-10-11",
      waktu: "00:00",
    };
  }

  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) {
    const match = rawDate.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/
    );
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, "0");
      const day = match[3].padStart(2, "0");
      const hours = (match[4] || "00").padStart(2, "0");
      const minutes = (match[5] || "00").padStart(2, "0");
      return {
        tanggal: `${year}-${month}-${day}`,
        waktu: `${hours}:${minutes}`,
      };
    }
    return {
      tanggal: rawDate,
      waktu: "00:00",
    };
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return {
    tanggal: `${year}-${month}-${day}`,
    waktu: `${hours}:${minutes}`,
  };
}

function formatReportId(id: number): string {
  return String(id).padStart(3, "0");
}

function parseLokasi(lokasi?: string, lokasiKampus?: string | null) {
  return {
    lokasiDisplay: lokasi || "Lokasi tidak dicantumkan",
    kampus: resolveLokasiKampus(lokasiKampus, lokasi),
  };
}

function extractFasilitas(item: RawLaporanApiItem): string {
  if (item.deskripsi) {
    const cleanDesk = item.deskripsi.replace(/^[\s\r\n]+/, "");
    const firstLine = cleanDesk.split(/[\r\n]+/)[0]?.trim();
    if (firstLine) {
      const firstSentence = firstLine.split(/[.!?]/)[0]?.trim() || firstLine;
      if (firstSentence.length > 0 && firstSentence.length <= 45) {
        return firstSentence;
      }
      if (firstSentence.length > 45) {
        return firstSentence.slice(0, 42).trim() + "...";
      }
    }
  }

  if (item.kategori_lokasi && item.kategori_lokasi !== "Tidak Diketahui") {
    return `${item.kategori_lokasi} (${item.kategori_laporan || "Fasilitas"})`;
  }

  return item.kategori_laporan ? `Laporan ${item.kategori_laporan}` : "Fasilitas Kampus";
}

function normalizeToDashboardStatus(val?: string | null): StatusLaporan {
  const s = (val || "Terkirim").trim().toLowerCase();
  if (s.includes("tolak")) return "Ditolak";
  if (s.includes("selesai")) return "Selesai";
  if (s.includes("proses") || s.includes("kerja")) return "Diproses";
  if (s.includes("verifikasi")) return "Diverifikasi";
  return "Terkirim";
}

function resolvePrioritas(
  tingkat?: string,
  skala?: number
): "Tinggi" | "Sedang" | "Rendah" {
  const t = (tingkat || "").toLowerCase();
  if (t === "berat" || t === "sangat tinggi" || (skala !== undefined && skala >= 3)) {
    return "Tinggi";
  }
  if (t === "sedang" || (skala !== undefined && skala === 2)) {
    return "Sedang";
  }
  return "Rendah";
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // ── Auth Protection ──
  const { isLoading: authLoading, user: authUser } = useAdminProtection();

  // State Data Laporan dari Database
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State Filter Periode (Bulan & Tahun) - default Semua agar seluruh data tampil
  const [selectedMonth, setSelectedMonth] = useState("Semua");
  const [selectedYear, setSelectedYear] = useState("Semua");

  // State Filter & Pencarian Tabel
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterLokasi, setFilterLokasi] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterStatus, setFilterStatus] = useState("Semua");

  const isWR2 = useMemo(() => isWakilRektorII(authUser), [authUser]);
  const showLocationFilter = useMemo(
    () => !isCampusScopedAdmin(authUser),
    [authUser]
  );
  const tableColumns = isWR2 ? WR2_REPORT_TABLE_COLUMNS : REPORT_TABLE_COLUMNS;

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [
    debouncedSearchTerm,
    filterLokasi,
    filterKategori,
    filterStatus,
    selectedMonth,
    selectedYear,
  ]);

  // State Modal Detail
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  // Authenticated Admin User
  const adminUser = useMemo(() => {
    return {
      nama: authUser?.nama || "Admin",
      role:
        authUser?.jabatan_label ||
        authUser?.role_detail ||
        "Admin Pengelola Sarpras",
    };
  }, [authUser]);

  // ── Fetch Data Laporan dari Database ──
  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    setFetchError(null);
    try {
      const res = await adminLaporanApi.getAll();
      const rawData: RawLaporanApiItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.laporan)
        ? res.laporan
        : [];

      const mapped: ReportItem[] = rawData.map((item) => {
        const idRaw = Number(item.id_laporan || 0);
        const { tanggal, waktu } = parseTanggalDanWaktu(
          item.tanggal_buat || item.tanggal_kejadian
        );
        const { lokasiDisplay, kampus } = parseLokasi(item.lokasi, item.lokasi_kampus);
        const fotoList = getFotoList(item.foto);
        const status = normalizeToDashboardStatus(
          item.status_terkini || item.status_laporan
        );
        const fasilitas = extractFasilitas(item);

        const pelaporNim = String(item.nim || "-");
        const tipeUser = (item.tipe_user || "").toLowerCase();
        let pelaporRole = "Mahasiswa";
        if (
          tipeUser.includes("karyawan") ||
          tipeUser.includes("pegawai") ||
          pelaporNim.length >= 12
        ) {
          pelaporRole = "Karyawan";
        }

        return {
          id: formatReportId(idRaw),
          idRaw,
          tanggal,
          waktu,
          pelaporNama: item.nama_pelapor || "Civitas USD",
          pelaporNim,
          pelaporRole,
          kategori: item.kategori_laporan || "Fasilitas",
          fasilitas,
          lokasi: lokasiDisplay,
          kampus,
          deskripsi: item.deskripsi || "-",
          status,
          prioritas: resolvePrioritas(
            item.tingkat_keparahan,
            item.skala_keparahan
          ),
          jumlahFoto: fotoList.length,
          fotoList,
        };
      });

      setReports(mapped);
    } catch (err: unknown) {
      console.error("Gagal memuat data laporan admin:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal memuat data laporan dari database.";
      setFetchError(msg);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        void fetchReports();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchReports]);

  // Filter Data Laporan Sesuai Periode Bulan & Tahun serta Filter Tabel
  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      // 1. Filter Periode (Bulan & Tahun pada item.tanggal YYYY-MM-DD)
      const [itemYear, itemMonth] = item.tanggal.split("-");
      const matchesMonth =
        selectedMonth === "Semua" || itemMonth === selectedMonth;
      const matchesYear =
        selectedYear === "Semua" || itemYear === selectedYear;

      // 2. Pencarian (ID laporan, nomor ID asli, pelapor, atau fasilitas/sarana)
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        debouncedSearchTerm === "" ||
        item.id.toLowerCase().includes(searchLower) ||
        String(item.idRaw).includes(searchLower) ||
        item.pelaporNama.toLowerCase().includes(searchLower) ||
        item.pelaporNim.toLowerCase().includes(searchLower) ||
        item.fasilitas.toLowerCase().includes(searchLower) ||
        item.kategori.toLowerCase().includes(searchLower) ||
        item.kampus.toLowerCase().includes(searchLower) ||
        item.lokasi.toLowerCase().includes(searchLower);

      // 3. Filter Lokasi Kampus (hanya aktif untuk admin lintas semua kampus)
      const matchesLokasi =
        !showLocationFilter ||
        filterLokasi === "Semua" ||
        item.kampus === filterLokasi ||
        item.lokasi.toLowerCase().includes(filterLokasi.toLowerCase());

      // 4. Filter Kategori Laporan (khusus Wakil Rektor II)
      const matchesKategori =
        !isWR2 ||
        filterKategori === "Semua" ||
        normalizeKategoriLaporan(item.kategori) === filterKategori;

      // 5. Filter Status
      const matchesStatus =
        filterStatus === "Semua" || item.status === filterStatus;

      return (
        matchesMonth &&
        matchesYear &&
        matchesSearch &&
        matchesLokasi &&
        matchesKategori &&
        matchesStatus
      );
    });
  }, [
    reports,
    selectedMonth,
    selectedYear,
    debouncedSearchTerm,
    showLocationFilter,
    filterLokasi,
    isWR2,
    filterKategori,
    filterStatus,
  ]);

  // Laporan pada periode terpilih (untuk menghitung metrik KPI periode tersebut)
  const periodReports = useMemo(() => {
    return reports.filter((item) => {
      const [itemYear, itemMonth] = item.tanggal.split("-");
      const matchesMonth =
        selectedMonth === "Semua" || itemMonth === selectedMonth;
      const matchesYear =
        selectedYear === "Semua" || itemYear === selectedYear;
      return matchesMonth && matchesYear;
    });
  }, [reports, selectedMonth, selectedYear]);

  // Hitung Data Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentReports = filteredReports.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Reset Semua Filter
  const handleResetFilter = () => {
    setSearchTerm("");
    setFilterLokasi("Semua");
    setFilterKategori("Semua");
    setFilterStatus("Semua");
    setCurrentPage(1);
  };

  // Ringkasan KPI Counts pada Periode yang Dipilih
  const totalPeriodCount = periodReports.length;
  const terkirimCount = periodReports.filter((r) => r.status === "Terkirim").length;
  const diverifikasiCount = periodReports.filter(
    (r) => r.status === "Diverifikasi"
  ).length;
  const diprosesCount = periodReports.filter((r) => r.status === "Diproses").length;
  const ditolakCount = periodReports.filter((r) => r.status === "Ditolak").length;
  const selesaiCount = periodReports.filter((r) => r.status === "Selesai").length;

  const periodLabel = useMemo(() => {
    if (selectedMonth === "Semua" && selectedYear === "Semua") {
      return "Semua Periode";
    }
    if (selectedMonth === "Semua") {
      return `Semua Bulan ${selectedYear}`;
    }
    if (selectedYear === "Semua") {
      return MONTH_NAMES[selectedMonth] || selectedMonth;
    }
    return `${MONTH_NAMES[selectedMonth] || selectedMonth} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  // Helper Badge Status: Terkirim -> Diverifikasi -> Diproses / Ditolak -> Selesai
  const getStatusBadge = (status: StatusLaporan) => {
    switch (status) {
      case "Terkirim":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#3B82F6] border border-blue-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            Terkirim
          </span>
        );
      case "Diverifikasi":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            Diverifikasi
          </span>
        );
      case "Diproses":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-[#F59E0B] border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            Diproses
          </span>
        );
      case "Ditolak":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#EF4444] border border-red-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            Ditolak
          </span>
        );
      case "Selesai":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            Selesai
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Auth Loading State */}
      {authLoading && (
        <div className="flex h-screen w-full items-center justify-center bg-[#F3F4F6]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
            <p className="text-slate-600 text-sm font-medium">
              Memeriksa autentikasi admin...
            </p>
          </div>
        </div>
      )}

      {!authLoading && (
        <div className="min-h-screen w-full bg-[#F8F9FA] text-slate-800 flex flex-col font-sans antialiased">
          {/* ------------------------------------------------------------- */}
          {/* 1. TOP NAVBAR ADMIN */}
          {/* ------------------------------------------------------------- */}
          <AdminNavbar
            adminName={adminUser.nama}
            adminRole={adminUser.role}
          />

          {/* ------------------------------------------------------------- */}
          {/* 2. MAIN CONTENT AREA */}
          {/* ------------------------------------------------------------- */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
            {/* Banner Notifikasi Error jika Gagal Fetch */}
            {fetchError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-700 shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchReports}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shrink-0 w-fit cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Keterangan Periode Aktif, Filter Bulan/Tahun & Tombol Segarkan */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* <span className="w-2.5 h-2.5 rounded-full bg-[#7A0C0C]" /> */}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Periode Data Aktif:
                </span>
                <PeriodFilter
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onMonthChange={(m) => {
                    setSelectedMonth(m);
                    setCurrentPage(1);
                  }}
                  onYearChange={(y) => {
                    setSelectedYear(y);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex items-center justify-between lg:justify-end gap-3">
                <span className="text-xs text-gray-500 font-medium">
                  {loadingReports
                    ? "Memuat data laporan..."
                    : `Menampilkan ${filteredReports.length} laporan sarana prasarana.`}
                </span>
                <button
                  type="button"
                  onClick={fetchReports}
                  disabled={loadingReports}
                  title="Perbarui data dari database"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      loadingReports ? "animate-spin" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 3. KARTU RINGKASAN STATUS (TOTAL LAPORAN PERIODE + 5 STATUS) */}
            {/* ------------------------------------------------------------- */}
            <section
              aria-label="Kartu Ringkasan KPI"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5"
            >
              {/* Card 1: TOTAL LAPORAN PERIODE */}
              <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Total Laporan
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1.5 tracking-tight">
                      {totalPeriodCount}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 group-hover:scale-105 transition-transform shrink-0">
                    <Inbox className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 truncate">Periode ini</span>
                  <span className="inline-flex items-center text-gray-700 font-bold shrink-0">
                    100% Masuk
                  </span>
                </div>
              </div>

              {/* Card 2: Terkirim */}
              <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                      Terkirim
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-600 mt-1.5 tracking-tight">
                      {terkirimCount}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#3B82F6] group-hover:scale-105 transition-transform shrink-0">
                    <Inbox className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-blue-50 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 truncate">Baru</span>
                  <span className="inline-flex items-center text-blue-600 font-bold shrink-0">
                    {totalPeriodCount > 0
                      ? Math.round((terkirimCount / totalPeriodCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>

              {/* Card 3: Diverifikasi */}
              <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      Diverifikasi
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-1.5 tracking-tight">
                      {diverifikasiCount}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-indigo-50 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 truncate">Review</span>
                  <span className="inline-flex items-center text-indigo-600 font-bold shrink-0">
                    {totalPeriodCount > 0
                      ? Math.round((diverifikasiCount / totalPeriodCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>

              {/* Card 4: Diproses */}
              <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                      Diproses
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1.5 tracking-tight">
                      {diprosesCount}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-[#F59E0B] group-hover:scale-105 transition-transform shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-amber-50 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 truncate">Teknisi</span>
                  <span className="inline-flex items-center text-amber-600 font-bold shrink-0">
                    {totalPeriodCount > 0
                      ? Math.round((diprosesCount / totalPeriodCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>

              {/* Card 5: Ditolak */}
              <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                      Ditolak
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1.5 tracking-tight">
                      {ditolakCount}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-105 transition-transform shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-red-50 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 truncate">Batal</span>
                  <span className="inline-flex items-center text-red-600 font-bold shrink-0">
                    {totalPeriodCount > 0
                      ? Math.round((ditolakCount / totalPeriodCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>

              {/* Card 6: Selesai */}
              <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                      Selesai
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1.5 tracking-tight">
                      {selesaiCount}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-[#10B981] group-hover:scale-105 transition-transform shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-emerald-50 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 truncate">Tuntas</span>
                  <span className="inline-flex items-center text-emerald-600 font-bold shrink-0">
                    {totalPeriodCount > 0
                      ? Math.round((selesaiCount / totalPeriodCount) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* 4. PANEL PENCARIAN & FILTER */}
            {/* ------------------------------------------------------------- */}
            <section
              aria-label="Filter dan Pencarian Laporan"
              className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Input Pencarian */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Cari ID laporan, nama pelapor, NIM, fasilitas, atau ruangan..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] transition-all min-h-[44px]"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns & Reset */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                  {/* Filter Lokasi Kampus (dihilangkan untuk admin masing-masing kampus) */}
                  {showLocationFilter && (
                    <div className="w-full sm:w-auto">
                      <select
                        value={filterLokasi}
                        onChange={(e) => {
                          setFilterLokasi(e.target.value);
                          setCurrentPage(1);
                        }}
                        aria-label="Filter berdasarkan lokasi kampus"
                        className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                      >
                        <option value="Semua">Semua Lokasi</option>
                        {LOKASI_KAMPUS_OPTIONS.map((kampus) => (
                          <option key={kampus} value={kampus}>
                            {kampus}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filter Kategori Laporan (khusus Wakil Rektor II) */}
                  {isWR2 && (
                    <div className="w-full sm:w-auto">
                      <select
                        value={filterKategori}
                        onChange={(e) => {
                          setFilterKategori(e.target.value);
                          setCurrentPage(1);
                        }}
                        aria-label="Filter berdasarkan kategori laporan"
                        className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                      >
                        <option value="Semua">Semua Kategori</option>
                        {KATEGORI_LAPORAN_OPTIONS.map((kategori) => (
                          <option key={kategori} value={kategori}>
                            {kategori}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filter Status Laporan */}
                  <div className="w-full sm:w-auto">
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setCurrentPage(1);
                      }}
                      aria-label="Filter berdasarkan status laporan"
                      className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                    >
                      <option value="Semua">Semua Status</option>
                      <option value="Terkirim">Terkirim</option>
                      <option value="Diverifikasi">Diverifikasi</option>
                      <option value="Diproses">Diproses</option>
                      <option value="Ditolak">Ditolak</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                  </div>

                  {/* Tombol Reset Filter */}
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 px-3 py-2 transition-colors cursor-pointer"
                    title="Reset seluruh filter"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Status Aktif Filter Info */}
              {(debouncedSearchTerm !== "" ||
                (showLocationFilter && filterLokasi !== "Semua") ||
                (isWR2 && filterKategori !== "Semua") ||
                filterStatus !== "Semua") && (
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Filter aktif:</span>
                  {debouncedSearchTerm && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      Pencarian: &quot;{debouncedSearchTerm}&quot;
                      <button
                        onClick={() => setSearchTerm("")}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {showLocationFilter && filterLokasi !== "Semua" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      {filterLokasi}
                      <button
                        onClick={() => setFilterLokasi("Semua")}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {isWR2 && filterKategori !== "Semua" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      Kategori: {filterKategori}
                      <button
                        onClick={() => setFilterKategori("Semua")}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {filterStatus !== "Semua" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      Status: {filterStatus}
                      <button
                        onClick={() => setFilterStatus("Semua")}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  <span className="text-gray-400">
                    (Ditemukan {filteredReports.length} laporan)
                  </span>
                </div>
              )}
            </section>

            {/* ------------------------------------------------------------- */}
            {/* 5. TABEL LAPORAN (RESPONSIF: MOBILE CARDS + DESKTOP TABLE) */}
            {/* ------------------------------------------------------------- */}
            <section
              aria-label="Daftar Tiket Laporan Masuk"
              className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden"
            >
              {/* Header Tabel */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    Daftar Seluruh Laporan Civitas Kampus
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Urutan laporan berdasarkan tanggal masuk dan status penanganan terkini.
                  </p>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  Menampilkan{" "}
                  <span className="font-bold text-gray-800">
                    {filteredReports.length > 0 ? startIndex + 1 : 0}
                  </span>{" "}
                  -{" "}
                  <span className="font-bold text-gray-800">
                    {Math.min(startIndex + itemsPerPage, filteredReports.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-bold text-gray-800">
                    {filteredReports.length}
                  </span>{" "}
                  laporan
                </div>
              </div>

              {/* KONTEN LOADING SKELETON */}
              {loadingReports ? (
                <>
                  {/* Skeleton Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50/75 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <tr>
                          {tableColumns.map((col) => (
                            <th
                              key={col.label}
                              scope="col"
                              className={`px-5 py-3.5 ${col.alignRight ? "text-right" : ""}`}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            <td className="px-5 py-4 align-top">
                              <div className="h-4 bg-gray-200 rounded w-10" />
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="h-4 bg-gray-100 rounded w-32" />
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="h-4 bg-gray-200 rounded w-28 mb-1.5" />
                              <div className="h-3 bg-gray-100 rounded w-20 mb-1" />
                              <div className="h-3 bg-gray-100 rounded w-16" />
                            </td>
                            {isWR2 && (
                              <td className="px-5 py-4 align-top">
                                <div className="h-4 bg-gray-200 rounded w-20" />
                              </td>
                            )}
                            <td className="px-5 py-4 align-top">
                              <div className="h-4 bg-gray-200 rounded w-36 mb-1.5" />
                              <div className="h-3 bg-gray-100 rounded w-44 mb-1" />
                              <div className="h-3 bg-gray-100 rounded w-24" />
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="h-6 bg-gray-200 rounded-full w-20" />
                            </td>
                            <td className="px-5 py-4 align-top text-right">
                              <div className="h-7 bg-gray-200 rounded-xl w-16 ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Skeleton Mobile Cards */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="p-4 space-y-3 animate-pulse">
                        <div className="flex items-start justify-between">
                          <div className="h-4 bg-gray-200 rounded w-24" />
                          <div className="h-5 bg-gray-200 rounded-full w-16" />
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-40" />
                        <div className="h-12 bg-gray-100 rounded-xl" />
                        <div className="h-4 bg-gray-200 rounded w-28" />
                      </div>
                    ))}
                  </div>
                </>
              ) : filteredReports.length === 0 ? (
                /* KONTEN JIKA KOSONG */
                <div className="py-12 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-800">
                    Tidak ada laporan yang sesuai kriteria
                  </h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Silakan ubah kata kunci pencarian atau reset filter untuk melihat laporan lainnya.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#7A0C0C] bg-[#7A0C0C]/10 hover:bg-[#7A0C0C]/20 transition-colors cursor-pointer"
                  >
                    Reset Semua Filter
                  </button>
                </div>
              ) : (
                <>
                  {/* --- TAMPILAN DESKTOP & TABLET: TABEL RESIK DENGAN HOVER EFFECT --- */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50/75 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <tr>
                          {tableColumns.map((col) => (
                            <th
                              key={col.label}
                              scope="col"
                              className={`px-5 py-3.5 ${col.alignRight ? "text-right" : ""}`}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {currentReports.map((report) => (
                          <tr
                            key={report.id}
                            className="hover:bg-gray-50/80 transition-colors group"
                          >
                            {/* Kolom ID */}
                            <td className="px-5 py-4 align-top whitespace-nowrap">
                              <span className="font-mono font-bold text-xs text-[#7A0C0C] block group-hover:underline">
                                {report.id}
                              </span>
                            </td>

                            {/* Kolom Tanggal */}
                            <td className="px-5 py-4 align-top whitespace-nowrap">
                              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                {report.tanggal} • {report.waktu}
                              </span>
                            </td>

                            {/* Kolom Pelapor */}
                            <td className="px-5 py-4 align-top">
                              <div className="font-semibold text-gray-900 leading-snug">
                                {report.pelaporNama}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                NIM: {report.pelaporNim}
                              </div>
                              <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                {report.pelaporRole}
                              </span>
                            </td>

                            {/* Kolom Kategori Laporan (Khusus WR 2) */}
                            {isWR2 && (
                              <td className="px-5 py-4 align-top whitespace-nowrap">
                                <span
                                  className={`text-xs font-semibold ${getKategoriTextColorClass(
                                    report.kategori
                                  )}`}
                                >
                                  {normalizeKategoriLaporan(report.kategori)}
                                </span>
                              </td>
                            )}

                            {/* Kolom Lokasi & Fasilitas */}
                            <td className="px-5 py-4 align-top max-w-xs">
                              <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                <span>{report.fasilitas}</span>
                                {report.jumlahFoto > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                    <ImageIcon className="w-2.5 h-2.5" />
                                    {report.jumlahFoto}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 flex items-start gap-1 mt-1 leading-relaxed">
                                <MapPin className="w-3.5 h-3.5 text-[#7A0C0C] shrink-0 mt-0.5" />
                                <span>{report.lokasi}</span>
                              </div>
                              <span className="text-[11px] font-medium text-gray-500 mt-1 block">
                                {report.kampus}
                              </span>
                            </td>

                            {/* Kolom Status */}
                            <td className="px-5 py-4 align-top">
                              {getStatusBadge(report.status)}
                            </td>

                            {/* Kolom Aksi */}
                            <td className="px-5 py-4 align-top text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedReport(report)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#7A0C0C] bg-[#7A0C0C]/10 hover:bg-[#7A0C0C] hover:text-white transition-all shadow-2xs active:scale-95 cursor-pointer"
                              >
                                <span>Detail</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* --- TAMPILAN MOBILE: LIST OF CARDS ADAPTIF (320px - 768px) --- */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {currentReports.map((report) => (
                      <div
                        key={report.id}
                        className="p-4 space-y-3 hover:bg-gray-50/70 transition-colors"
                      >
                        {/* Header Card: Tiket & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-[#7A0C0C]">
                              {report.id}
                            </span>
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {report.tanggal} • {report.waktu}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(report.status)}
                            {isWR2 && (
                              <span
                                className={`text-[11px] font-semibold ${getKategoriTextColorClass(
                                  report.kategori
                                )}`}
                              >
                                {normalizeKategoriLaporan(report.kategori)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Informasi Fasilitas & Kerusakan */}
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">
                            {report.fasilitas}
                          </h3>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                            {report.deskripsi}
                          </p>
                        </div>

                        {/* Lokasi Kejadian */}
                        <div className="text-xs text-gray-600 flex items-start gap-1.5 bg-gray-50 p-2.5 rounded-xl">
                          <MapPin className="w-4 h-4 text-[#7A0C0C] shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-800">
                              {report.lokasi}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {report.kampus}
                            </p>
                          </div>
                        </div>

                        {/* Footer Card: Pelapor & Tombol Detail (Touch Target 44px) */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                          <div className="text-xs">
                            <span className="text-gray-500">Pelapor: </span>
                            <span className="font-semibold text-gray-800">
                              {report.pelaporNama}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedReport(report)}
                            className="min-h-[44px] min-w-[88px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7A0C0C] hover:bg-[#6e1010] active:scale-98 transition-colors shadow-xs cursor-pointer"
                          >
                            <span>Detail</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ------------------------------------------------------------- */}
              {/* 6. PAGINATION INTERAKTIF */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-500 text-center sm:text-left">
                  Halaman{" "}
                  <span className="font-bold text-gray-800">
                    {filteredReports.length > 0 ? currentPage : 0}
                  </span>{" "}
                  dari{" "}
                  <span className="font-bold text-gray-800">{totalPages}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Tombol Sebelumnya */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loadingReports}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </button>

                  {/* Angka Pagination */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={loadingReports}
                          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            currentPage === pageNum
                              ? "bg-[#7A0C0C] text-white shadow-xs"
                              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    )}
                  </div>

                  {/* Tombol Selanjutnya */}
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={
                      currentPage === totalPages ||
                      totalPages === 0 ||
                      loadingReports
                    }
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Halaman selanjutnya"
                  >
                    <span className="hidden sm:inline">Selanjutnya</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </section>
          </main>

          {/* ------------------------------------------------------------- */}
          {/* 7. MODAL DETAIL LAPORAN */}
          {/* ------------------------------------------------------------- */}
          {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header Modal */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#7A0C0C]/10 text-[#7A0C0C] flex items-center justify-center font-bold">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">
                          Rincian Tiket Laporan
                        </h3>
                        <span className="font-mono text-xs font-bold text-[#7A0C0C]">
                          {selectedReport.id}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Masuk pada {selectedReport.tanggal} pukul{" "}
                        {selectedReport.waktu} WIB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReport(null);
                      setActivePhotoIndex(null);
                    }}
                    aria-label="Tutup modal"
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Konten Modal Scrollable */}
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-sm">
                  {/* Status Banner */}
                  <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60 flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">
                      Status:
                    </span>
                    {getStatusBadge(selectedReport.status)}
                  </div>

                  {/* Rincian Pelapor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-gray-100 bg-white">
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">
                        Nama Pelapor
                      </span>
                      <span className="font-semibold text-gray-900">
                        {selectedReport.pelaporNama}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">
                        NIM / Identitas
                      </span>
                      <span className="font-semibold text-gray-900">
                        {selectedReport.pelaporNim} ({selectedReport.pelaporRole})
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">
                        Kategori Fasilitas
                      </span>
                      <span className="font-semibold text-gray-900">
                        {selectedReport.kategori} - {selectedReport.fasilitas}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">
                        Lokasi / Kampus
                      </span>
                      <span className="font-semibold text-gray-900">
                        {selectedReport.kampus} — {selectedReport.lokasi}
                      </span>
                    </div>
                  </div>

                  {/* Deskripsi Kerusakan */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Deskripsi Lengkap Kerusakan
                    </h4>
                    <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200/60 text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
                      {selectedReport.deskripsi}
                    </div>
                  </div>

                  {/* Lampiran Foto Bukti */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Lampiran Bukti Foto ({selectedReport.jumlahFoto} Foto)
                    </h4>
                    {selectedReport.fotoList.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedReport.fotoList.map((fotoItem, idx) => {
                          const fullUrl = getFotoUrl(fotoItem);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActivePhotoIndex(idx)}
                              className="group relative h-28 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex flex-col items-center justify-center text-xs hover:border-[#7A0C0C] transition-colors cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={fullUrl}
                                alt={`Foto bukti ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium">
                                Foto #{idx + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/60 text-xs text-gray-400 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 opacity-50" />
                        <span>Tidak ada foto terlampir pada laporan ini.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReport(null);
                      setActivePhotoIndex(null);
                    }}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReport(null);
                      setActivePhotoIndex(null);
                      router.push("/admin/ubah-status");
                    }}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#7A0C0C] text-white text-sm font-semibold hover:bg-[#6e1010] transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Tindak Lanjuti Tiket</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ImagePreviewModal
        images={(selectedReport?.fotoList ?? []).map(getFotoUrl)}
        activeIndex={selectedReport ? activePhotoIndex : null}
        onClose={() => setActivePhotoIndex(null)}
        onChangeIndex={setActivePhotoIndex}
        titlePrefix="Foto Bukti"
      />
    </>
  );
}
