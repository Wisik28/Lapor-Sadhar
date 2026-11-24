"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { AdminStatusBadge, normalizeAdminStatus } from "@/components/AdminStatusBadge";
import PeriodFilter from "@/components/PeriodFilter";
import { useAdminProtection } from "@/lib/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import {
  loadSeenReportIds,
  persistSeenReportId,
  resolveAdminSeenKey,
} from "@/lib/adminSeenReports";
import { LOKASI_KAMPUS_OPTIONS, resolveLokasiKampus } from "@/lib/laporanCampus";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  RotateCcw,
  RefreshCw,
  Calendar,
  Search,
  Building,
  Inbox,
  X,
} from "lucide-react";
import {
  priorityApi,
  PriorityReportItem,
  PrioritySummary,
} from "@/lib/priorityApi";
import { PriorityScoreBadge } from "@/components/priority/PriorityScoreBadge";
import { PriorityDetailModal } from "@/components/priority/PriorityDetailModal";
import {
  KATEGORI_LAPORAN_OPTIONS,
  isReadOnlyAdmin,
  isWakilRektorII,
  normalizeKategoriLaporan,
} from "@/lib/admin-positions";

function formatTanggal(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const day = d.getDate();
    const month = months[d.getMonth()] || "";
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

function extractReportDateParts(rawDate?: string | null): {
  year: string;
  month: string;
  day: string;
} | null {
  if (!rawDate) return null;

  const d = new Date(rawDate);
  if (!Number.isNaN(d.getTime())) {
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, "0"),
      day: String(d.getDate()).padStart(2, "0"),
    };
  }

  const match = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return {
      year: match[1],
      month: match[2].padStart(2, "0"),
      day: match[3].padStart(2, "0"),
    };
  }

  return null;
}

export default function AdminPriorityDashboardPage() {
  const { isLoading: authLoading, user: authUser } = useAdminProtection();
  const isReadOnly = useMemo(() => isReadOnlyAdmin(authUser), [authUser]);
  const isWR2 = useMemo(() => isWakilRektorII(authUser), [authUser]);

  // Data state
  const [reports, setReports] = useState<PriorityReportItem[]>([]);
  const [summary, setSummary] = useState<PrioritySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [selectedDay, setSelectedDay] = useState("Semua");
  const [selectedMonth, setSelectedMonth] = useState("Semua");
  const [selectedYear, setSelectedYear] = useState("Semua");
  const [lokasiFilter, setLokasiFilter] = useState("Semua");
  const [kategoriFilter, setKategoriFilter] = useState("Semua");
  const [severityFilter, setSeverityFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [bacaFilter, setBacaFilter] = useState<
    "Semua" | "Sudah Dibaca" | "Belum Dibaca"
  >("Semua");
  const [onlyNeedsReview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const todayParts = useMemo(() => {
    const now = new Date();
    return {
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, "0"),
      day: String(now.getDate()).padStart(2, "0"),
    };
  }, []);

  const isTodayFilterActive =
    selectedDay === todayParts.day &&
    selectedMonth === todayParts.month &&
    selectedYear === todayParts.year;

  const handleToggleTodayFilter = () => {
    if (isTodayFilterActive) {
      setSelectedDay("Semua");
      setSelectedMonth("Semua");
      setSelectedYear("Semua");
    } else {
      setSelectedDay(todayParts.day);
      setSelectedMonth(todayParts.month);
      setSelectedYear(todayParts.year);
    }
    setCurrentPage(1);
  };

  const handleResetReadOnlyFilter = () => {
    setSearch("");
    setSelectedDay("Semua");
    setSelectedMonth("Semua");
    setSelectedYear("Semua");
    setLokasiFilter("Semua");
    setKategoriFilter("Semua");
    setSeverityFilter("Semua");
    setStatusFilter("Semua");
    setBacaFilter("Semua");
    setCurrentPage(1);
  };

  // Detail modal & tracking laporan Terkirim yang sudah dibuka
  const [selectedReport, setSelectedReport] = useState<PriorityReportItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const adminSeenKey = useMemo(() => resolveAdminSeenKey(authUser), [authUser]);
  const [seenReportIds, setSeenReportIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setSeenReportIds(loadSeenReportIds(adminSeenKey));
      }
    });
    return () => {
      active = false;
    };
  }, [adminSeenKey]);

  const activeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [
    debouncedSearch,
    selectedDay,
    selectedMonth,
    selectedYear,
    lokasiFilter,
    kategoriFilter,
    severityFilter,
    statusFilter,
    bacaFilter,
  ]);

  const apiSearchQuery = isReadOnly ? "" : debouncedSearch;
  const apiKategoriFilter = isReadOnly ? "Semua" : kategoriFilter;
  const apiSeverityFilter = isReadOnly ? "Semua" : severityFilter;
  const apiStatusFilter = isReadOnly ? "Semua" : statusFilter;

  const loadPriorityData = useCallback(
    async (searchQuery: string, signal?: AbortSignal) => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { reports: reportsData, summary: inlineSummary } =
          await priorityApi.getReportsWithSummary(
            isReadOnly
              ? undefined
              : {
                  kategori: apiKategoriFilter,
                  severity: apiSeverityFilter,
                  status: apiStatusFilter,
                  needs_review: onlyNeedsReview,
                  search: searchQuery.trim() || undefined,
                },
            signal
          );

        if (signal?.aborted) return;
        setReports(reportsData);

        if (inlineSummary) {
          setSummary(inlineSummary);
        } else {
          const fallbackSummary = await priorityApi.getSummary(signal);
          if (signal?.aborted) return;
          setSummary(fallbackSummary);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (signal?.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Gagal memuat data prioritas laporan."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      isReadOnly,
      apiKategoriFilter,
      apiSeverityFilter,
      apiStatusFilter,
      onlyNeedsReview,
    ]
  );

  const fetchData = useCallback(() => {
    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;
    void loadPriorityData(apiSearchQuery, controller.signal);
  }, [loadPriorityData, apiSearchQuery]);

  useEffect(() => {
    if (authLoading || !authUser) {
      return;
    }

    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadPriorityData(apiSearchQuery, controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [authLoading, authUser, apiSearchQuery, loadPriorityData]);

  const hasPeriodFilter =
    isReadOnly &&
    (selectedDay !== "Semua" ||
      selectedMonth !== "Semua" ||
      selectedYear !== "Semua");

  const periodReports = useMemo(() => {
    if (!hasPeriodFilter) {
      return reports;
    }

    return reports.filter((item) => {
      const parts = extractReportDateParts(
        item.tanggal_buat || item.tanggal_kejadian
      );
      if (!parts) return false;

      const matchesDay = selectedDay === "Semua" || parts.day === selectedDay;
      const matchesMonth =
        selectedMonth === "Semua" || parts.month === selectedMonth;
      const matchesYear =
        selectedYear === "Semua" || parts.year === selectedYear;

      return matchesDay && matchesMonth && matchesYear;
    });
  }, [reports, hasPeriodFilter, selectedDay, selectedMonth, selectedYear]);

  const displayedReports = useMemo(() => {
    if (!isReadOnly) {
      return reports;
    }

    const searchLower = debouncedSearch.trim().toLowerCase();

    return periodReports.filter((item) => {
      const kampus = resolveLokasiKampus(item.lokasi_kampus, item.lokasi);
      const normalizedStatus = normalizeAdminStatus(item.status_terkini);
      const formattedId = String(item.id_laporan).padStart(3, "0");

      const matchesSearch =
        searchLower === "" ||
        formattedId.includes(searchLower) ||
        String(item.id_laporan).includes(searchLower) ||
        (item.nama_pelapor || "").toLowerCase().includes(searchLower) ||
        (item.nim || "").toLowerCase().includes(searchLower) ||
        (item.deskripsi || "").toLowerCase().includes(searchLower) ||
        (item.kategori_laporan || "").toLowerCase().includes(searchLower) ||
        kampus.toLowerCase().includes(searchLower) ||
        (item.lokasi || "").toLowerCase().includes(searchLower);

      const matchesLokasi =
        lokasiFilter === "Semua" ||
        kampus === lokasiFilter ||
        (item.lokasi || "").toLowerCase().includes(lokasiFilter.toLowerCase());

      const matchesKategori =
        !isWR2 ||
        kategoriFilter === "Semua" ||
        normalizeKategoriLaporan(item.kategori_laporan) === kategoriFilter;

      const matchesSeverity =
        severityFilter === "Semua" || item.severity_level === severityFilter;

      const matchesStatus =
        statusFilter === "Semua" || normalizedStatus === statusFilter;

      const isUnread =
        normalizedStatus === "Terkirim" && !seenReportIds.has(item.id_laporan);
      const matchesBaca =
        bacaFilter === "Semua" ||
        (bacaFilter === "Belum Dibaca" ? isUnread : !isUnread);

      return (
        matchesSearch &&
        matchesLokasi &&
        matchesKategori &&
        matchesSeverity &&
        matchesStatus &&
        matchesBaca
      );
    });
  }, [
    isReadOnly,
    reports,
    periodReports,
    debouncedSearch,
    lokasiFilter,
    isWR2,
    kategoriFilter,
    severityFilter,
    statusFilter,
    bacaFilter,
    seenReportIds,
  ]);

  const unreadDisplayedCount = useMemo(
    () =>
      displayedReports.filter(
        (item) =>
          normalizeAdminStatus(item.status_terkini) === "Terkirim" &&
          !seenReportIds.has(item.id_laporan)
      ).length,
    [displayedReports, seenReportIds]
  );

  const handleOpenDetail = (item: PriorityReportItem) => {
    setSelectedReport(item);
    setIsModalOpen(true);
    setSeenReportIds((prev) => persistSeenReportId(adminSeenKey, item.id_laporan, prev));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-medium">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] font-sans antialiased text-slate-800 flex flex-col">
      <AdminNavbar
        adminName={authUser?.nama || "Admin"}
        adminRole={authUser?.jabatan_label || authUser?.role_detail || "Administrator"}
      />

      {/* Konten Utama */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Kartu Ringkasan Jumlah Laporan Berdasarkan Prioritas */}
          {(() => {
            const summarySource = hasPeriodFilter ? periodReports : reports;
            const useServerSummary = !hasPeriodFilter && Boolean(summary);
            const totalCount = useServerSummary
              ? (summary?.total_laporan ?? summarySource.length)
              : summarySource.length;
            const tinggiCount = useServerSummary
              ? (summary?.kritis_berat ?? 0) + (summary?.tinggi ?? 0)
              : summarySource.filter(
                  (r) =>
                    r.priority_level === "tinggi" ||
                    r.priority_level === "kritis" ||
                    r.severity_level === "berat"
                ).length;
            const sedangCount = useServerSummary
              ? (summary?.sedang ?? 0)
              : summarySource.filter(
                  (r) =>
                    r.priority_level === "sedang" &&
                    r.severity_level !== "berat"
                ).length;
            const rendahCount = useServerSummary
              ? (summary?.rendah ?? 0)
              : summarySource.filter(
                  (r) =>
                    r.severity_level !== "berat" &&
                    r.priority_level !== "kritis" &&
                    r.priority_level !== "tinggi" &&
                    r.priority_level !== "sedang"
                ).length;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Laporan */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Total Laporan
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                      {totalCount}
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Total seluruh laporan terdaftar
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 w-2 h-full bg-[#7A0C0C]" />
                </div>

                {/* Card 2: Prioritas Tinggi */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-red-200/80 shadow-2xs flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                      Prioritas Tinggi
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-red-900">
                      {tinggiCount}
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Membutuhkan penanganan segera
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 w-2 h-full bg-red-600" />
                </div>

                {/* Card 3: Prioritas Sedang */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/80 shadow-2xs flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                      Prioritas Sedang
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-900">
                      {sedangCount}
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Gangguan fungsi fasilitas / kenyamanan
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
                </div>

                {/* Card 4: Prioritas Rendah */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      Prioritas Rendah
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-900">
                      {rendahCount}
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Kerusakan ringan / perawatan rutin
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
                </div>
              </div>
            );
          })()}

          {errorMessage && (
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold"
            >
              {errorMessage}
            </div>
          )}

          {/* Filter Bar (Card Terpisah dari Card Daftar Laporan) */}
          {isReadOnly ? (
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              {/* Baris 1: Pencarian + Periode (Tanggal/Bulan/Tahun), Hari Ini & Segarkan */}
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari ID laporan, nama pelapor, NIM, lokasi, atau deskripsi..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full min-h-[42px] text-xs sm:text-sm pl-10 pr-9 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] transition-all"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setCurrentPage(1);
                      }}
                      aria-label="Hapus kata kunci pencarian"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Periode:
                  </span>
                  <PeriodFilter
                    selectedDay={selectedDay}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onDayChange={(d) => {
                      setSelectedDay(d);
                      setCurrentPage(1);
                    }}
                    onMonthChange={(m) => {
                      setSelectedMonth(m);
                      if (selectedDay !== "Semua" && m !== "Semua") {
                        const y = selectedYear !== "Semua" ? Number(selectedYear) : 2024;
                        const maxDay = new Date(y, Number(m), 0).getDate();
                        if (Number(selectedDay) > maxDay) {
                          setSelectedDay("Semua");
                        }
                      }
                      setCurrentPage(1);
                    }}
                    onYearChange={(y) => {
                      setSelectedYear(y);
                      if (selectedDay !== "Semua" && selectedMonth !== "Semua") {
                        const yearNum = y !== "Semua" ? Number(y) : 2024;
                        const maxDay = new Date(yearNum, Number(selectedMonth), 0).getDate();
                        if (Number(selectedDay) > maxDay) {
                          setSelectedDay("Semua");
                        }
                      }
                      setCurrentPage(1);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleToggleTodayFilter}
                    aria-pressed={isTodayFilterActive}
                    title={
                      isTodayFilterActive
                        ? "Klik untuk menampilkan semua periode"
                        : "Tampilkan laporan yang masuk hari ini"
                    }
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
                      isTodayFilterActive
                        ? "bg-[#7A0C0C] border-[#7A0C0C] text-white hover:bg-[#650909]"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Hari Ini</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchData}
                    disabled={loading}
                    title="Perbarui data dari database"
                    className="inline-flex items-center justify-center min-h-[38px] px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Baris 2: Filter Dropdowns (Lokasi, Kategori WR2, Tingkat, Status, Status Baca) & Reset */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filter Lokasi Kampus */}
                <div className="w-full sm:w-auto">
                  <select
                    value={lokasiFilter}
                    onChange={(e) => {
                      setLokasiFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter berdasarkan lokasi kampus"
                    className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                  >
                    <option value="Semua">Semua Lokasi</option>
                    {LOKASI_KAMPUS_OPTIONS.map((kampus) => (
                      <option key={kampus} value={kampus}>
                        {kampus}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Kategori Laporan (khusus Wakil Rektor II) */}
                {isWR2 && (
                  <div className="w-full sm:w-auto">
                    <select
                      value={kategoriFilter}
                      onChange={(e) => {
                        setKategoriFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      aria-label="Filter berdasarkan kategori laporan"
                      className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
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

                {/* Filter Tingkat Kerusakan */}
                <div className="w-full sm:w-auto">
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter berdasarkan tingkat kerusakan"
                    className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                  >
                    <option value="Semua">Semua Tingkat</option>
                    <option value="berat">Berat (Bobot 100)</option>
                    <option value="sedang">Sedang (Bobot 50)</option>
                    <option value="ringan">Ringan (Bobot 20)</option>
                  </select>
                </div>

                {/* Filter Status Laporan */}
                <div className="w-full sm:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter berdasarkan status laporan"
                    className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Terkirim">Terkirim</option>
                    <option value="Diverifikasi">Diverifikasi</option>
                    <option value="Diproses">Diproses</option>
                    <option value="Ditolak">Ditolak</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>

                {/* Filter Status Baca (Semua / Belum Dibaca / Sudah Dibaca) */}
                <div className="w-full sm:w-auto">
                  <select
                    value={bacaFilter}
                    onChange={(e) => {
                      setBacaFilter(
                        e.target.value as "Semua" | "Sudah Dibaca" | "Belum Dibaca"
                      );
                      setCurrentPage(1);
                    }}
                    aria-label="Filter berdasarkan status baca laporan"
                    className="w-full sm:w-auto min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] transition-colors cursor-pointer"
                  >
                    <option value="Semua">Semua Laporan</option>
                    <option value="Belum Dibaca">Belum Dibaca</option>
                    <option value="Sudah Dibaca">Sudah Dibaca</option>
                  </select>
                </div>

                {/* Tombol Reset */}
                <button
                  type="button"
                  onClick={handleResetReadOnlyFilter}
                  className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 px-3 py-2 transition-colors cursor-pointer"
                  title="Reset seluruh filter"
                >
                  Reset
                </button>
              </div>

              {/* Ringkasan Jumlah Hasil */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan{" "}
                  <span className="font-bold text-slate-900">
                    {displayedReports.length}
                  </span>{" "}
                  laporan
                  <span className="hidden sm:inline text-slate-400 ml-2">
                    • Klik baris laporan untuk melihat detail
                  </span>
                </span>
                {unreadDisplayedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                    {unreadDisplayedCount} belum dibaca
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Pencarian */}
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari deskripsi, lokasi, pelapor, atau nomor laporan..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Filter Kategori */}
                <div>
                  <select
                    value={kategoriFilter}
                    onChange={(e) => {
                      setKategoriFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7A0C0C]"
                  >
                    <option value="Semua">Semua Kategori</option>
                    <option value="Fasilitas">Kerusakan Fasilitas</option>
                    <option value="Kebersihan">Kebersihan</option>
                  </select>
                </div>

                {/* Filter Tingkat Kerusakan */}
                <div>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7A0C0C]"
                  >
                    <option value="Semua">Semua Tingkat</option>
                    <option value="berat">Berat (Bobot 100)</option>
                    <option value="sedang">Sedang (Bobot 50)</option>
                    <option value="ringan">Ringan (Bobot 20)</option>
                  </select>
                </div>

                {/* Filter Status */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7A0C0C]"
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Terkirim">Terkirim</option>
                    <option value="Diverifikasi">Diverifikasi</option>
                    <option value="Diproses">Diproses</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Ditolak">Ditolak</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan <span className="font-bold text-slate-900">{displayedReports.length}</span> laporan
                  <span className="hidden sm:inline text-slate-400 ml-2">• Klik baris laporan untuk melihat detail</span>
                </span>
                <button
                  type="button"
                  onClick={fetchData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>
          )}

          {/* Tabel Prioritas Laporan */}
          {(() => {
            const totalPages = Math.ceil(displayedReports.length / itemsPerPage) || 1;
            const paginatedReports = displayedReports.slice(
              (currentPage - 1) * itemsPerPage,
              currentPage * itemsPerPage
            );

            return (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] animate-spin" />
                    <p className="text-xs font-bold text-slate-500">Memuat urutan prioritas laporan...</p>
                  </div>
                ) : displayedReports.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <Inbox className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Tidak ada laporan yang cocok</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Tidak ditemukan laporan yang sesuai dengan filter atau kata kunci yang dimasukkan.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-4 px-4 sm:px-6">Peringkat & Skor</th>
                            <th className="py-4 px-4">Pelapor</th>
                            <th className="py-4 px-4">Tanggal</th>
                            <th className="py-4 px-4">Kategori & Lokasi</th>
                            <th className="py-4 px-4">Deskripsi Laporan</th>
                            <th className="py-4 px-4 sm:pr-6">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {paginatedReports.map((item, index) => {
                            const isTopPriority = item.priority_level === "kritis" || item.severity_level === "berat";
                            const isUnread =
                              normalizeAdminStatus(item.status_terkini) === "Terkirim" &&
                              !seenReportIds.has(item.id_laporan);

                            return (
                              <tr
                                key={item.id_laporan}
                                onClick={() => handleOpenDetail(item)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleOpenDetail(item);
                                  }
                                }}
                                tabIndex={0}
                                role="button"
                                title="Klik untuk melihat detail laporan"
                                className={`cursor-pointer transition-colors outline-none focus-visible:bg-slate-100 ${
                                  isUnread
                                    ? "bg-blue-50/35 hover:bg-blue-50/65 active:bg-blue-100/50"
                                    : isTopPriority
                                      ? "bg-red-50/30 hover:bg-red-50/70 active:bg-red-100/60"
                                      : "hover:bg-slate-50 active:bg-slate-100/80"
                                }`}
                              >
                                {/* Kolom Peringkat & Skor */}
                                <td
                                  className={`py-4 px-4 sm:px-6 ${
                                    isUnread ? "border-l-[3px] border-l-[#3B82F6]" : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 min-w-[34px]">
                                      {isUnread && (
                                        <span
                                          title="Laporan baru belum dibuka"
                                          className="relative flex h-2 w-2 shrink-0"
                                        >
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3B82F6]" />
                                        </span>
                                      )}
                                      <span className="w-6 text-center font-bold text-gray-400 text-xs font-mono">
                                        #{(currentPage - 1) * itemsPerPage + index + 1}
                                      </span>
                                    </div>
                                    <PriorityScoreBadge
                                      score={item.priority_score}
                                      level={item.priority_level}
                                    />
                                  </div>
                                </td>

                                {/* Kolom Pelapor */}
                                <td className="py-4 px-4">
                                  <div className="space-y-0.5">
                                    <span className="font-semibold text-gray-900 block text-xs">
                                      {item.nama_pelapor || "Civitas USD"}
                                    </span>
                                    {item.nim && (
                                      <span className="text-[10px] text-gray-400 block font-mono">
                                        NIM: {item.nim}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Kolom Tanggal */}
                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="space-y-0.5">
                                    <span className="font-semibold text-gray-800 block text-xs">
                                      {formatTanggal(item.tanggal_buat)}
                                    </span>
                                    {item.lama_menunggu && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        <span>{item.lama_menunggu}</span>
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Kolom Kategori & Lokasi */}
                                <td className="py-4 px-4">
                                  <div className="space-y-1">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        item.kategori_laporan === "Fasilitas"
                                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      }`}
                                    >
                                      {item.kategori_laporan}
                                    </span>
                                    <div className="flex items-center gap-1 text-gray-700 font-medium text-xs" title={item.lokasi}>
                                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate max-w-[180px]">
                                        {item.lokasi_kampus ? `${item.lokasi_kampus} • ` : ""}
                                        {item.lokasi}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Kolom Deskripsi Laporan (Menggantikan Kolom Tingkat Kerusakan & Alasan AI) */}
                                <td className="py-4 px-4 max-w-sm">
                                  <p className="text-gray-600 line-clamp-2 text-xs leading-relaxed" title={item.deskripsi}>
                                    {item.deskripsi || "-"}
                                  </p>
                                </td>

                                {/* Kolom Status (konsisten dengan /admin/dashboard) */}
                                <td className="py-4 px-4 sm:pr-6">
                                  <AdminStatusBadge status={item.status_terkini} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-white">
                      <p>
                        Menampilkan{" "}
                        {displayedReports.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                        {Math.min(currentPage * itemsPerPage, displayedReports.length)} dari{" "}
                        {displayedReports.length} laporan
                      </p>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-xs"
                        >
                          Sebelumnya
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                          if (
                            totalPages > 5 &&
                            p !== 1 &&
                            p !== totalPages &&
                            Math.abs(p - currentPage) > 1
                          ) {
                            if (p === 2 || p === totalPages - 1) {
                              return (
                                <span key={p} className="px-1 text-slate-400">
                                  ...
                                </span>
                              );
                            }
                            return null;
                          }

                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`w-7 h-7 rounded-md font-bold text-xs transition-colors cursor-pointer flex items-center justify-center ${
                                currentPage === p
                                  ? "bg-[#7A0C0C] text-white"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-xs"
                        >
                          Selanjutnya
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </main>

      {/* Modal Detail Laporan */}
      <PriorityDetailModal
        report={selectedReport}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdated={() => {
          fetchData();
        }}
        hideAiAnalysis={true}
        hideScoreBreakdown={true}
        hideHandlingInfo={true}
        readOnly={isReadOnly}
      />
    </div>
  );
}
