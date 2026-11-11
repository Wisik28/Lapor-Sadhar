"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { useAdminProtection } from "@/lib/useAuth";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Building,
  Layers,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Inbox
} from "lucide-react";
import {
  priorityApi,
  PriorityReportItem,
  PrioritySummary,
  PriorityFilterParams,
  SeverityLevel,
  PriorityLevel
} from "@/lib/priorityApi";
import { PriorityScoreBadge, SeverityBadge } from "@/components/priority/PriorityScoreBadge";
import { PriorityDetailModal } from "@/components/priority/PriorityDetailModal";

export default function AdminPriorityDashboardPage() {
  // Verifikasi proteksi admin (Hanya role Admin / BLU / BPS yang dapat membuka)
  const { isLoading: isAuthLoading, user } = useAdminProtection();

  // State data
  const [reports, setReports] = useState<PriorityReportItem[]>([]);
  const [summary, setSummary] = useState<PrioritySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("Semua");
  const [severityFilter, setSeverityFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  // Modal detail
  const [selectedReport, setSelectedReport] = useState<PriorityReportItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [reportsData, summaryData] = await Promise.all([
        priorityApi.getReports({
          kategori: kategoriFilter,
          severity: severityFilter,
          status: statusFilter,
          needs_review: onlyNeedsReview,
          search: search.trim() || undefined,
        }),
        priorityApi.getSummary(),
      ]);

      setReports(reportsData);
      setSummary(summaryData);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memuat data prioritas laporan.");
    } finally {
      setLoading(false);
    }
  }, [kategoriFilter, severityFilter, statusFilter, onlyNeedsReview, search]);

  useEffect(() => {
    if (!isAuthLoading && user && user.role === "Admin") {
      fetchData();
    }
  }, [isAuthLoading, user, fetchData]);

  const handleRecalculateAll = async () => {
    try {
      setRecalculating(true);
      await priorityApi.recalculateAll();
      await fetchData();
    } catch (err: any) {
      alert("Gagal menghitung ulang: " + (err.message || "Error server"));
    } finally {
      setRecalculating(false);
    }
  };

  const handleOpenDetail = (item: PriorityReportItem) => {
    setSelectedReport(item);
    setIsModalOpen(true);
  };

  if (isAuthLoading || !user || user.role !== "Admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8C1515]/20 border-t-[#8C1515]" />
          <p className="font-semibold text-xs">Memverifikasi hak akses admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 pb-16">
      {/* Navbar Admin */}
      <AdminNavbar
        adminName={user?.nama || "Admin Pengelola Sarpras"}
        adminRole={user?.jabatan_label || user?.role_detail || "Admin BLU/BPS"}
      />

      {/* Konten Utama */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#8C1515] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Sistem Cerdas Penilaian Kerusakan & Kebersihan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Dashboard Prioritas Laporan
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
              Antrean laporan terurut otomatis berdasarkan tingkat keparahan kerusakan, urgensi AI,
              lokasi strategis, dan waktu tunggu belum ditangani.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRecalculateAll}
              disabled={recalculating}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
              title="Hitung ulang faktor penuaan hari dan skor seluruh laporan"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
              <span>{recalculating ? "Menghitung Ulang..." : "Sinkronkan Penuaan (Aging)"}</span>
            </button>

            <button
              onClick={fetchData}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8C1515] text-white text-xs font-bold hover:bg-[#701010] shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Kartu Ringkasan Metrik KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Prioritas Kritis / Berat */}
          <div className="p-5 rounded-2xl bg-white border border-red-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                Prioritas Kritis / Berat
              </span>
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-red-900">
                {summary?.kritis_berat ?? 0}
              </span>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                Wajib ditangani segera (bahaya keselamatan / operasional)
              </p>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-red-600" />
          </div>

          {/* Card 2: Prioritas Tinggi / Sedang */}
          <div className="p-5 rounded-2xl bg-white border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Prioritas Tinggi
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-amber-900">
                {summary?.tinggi ?? 0}
              </span>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                Mengganggu fungsi atau kenyamanan area penting
              </p>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
          </div>

          {/* Card 3: Perlu Konfirmasi AI */}
          <div className="p-5 rounded-2xl bg-white border border-purple-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                Perlu Konfirmasi AI
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-purple-900">
                {summary?.perlu_konfirmasi ?? 0}
              </span>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                Usulan AI menunggu verifikasi & penetapan admin
              </p>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-purple-600" />
          </div>

          {/* Card 4: Rata-Rata Skor */}
          <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Rata-rata Skor Prioritas
              </span>
              <div className="w-9 h-9 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {summary?.rata_skor_prioritas ?? 0}
                </span>
                <span className="text-xs font-bold text-gray-400">/ 100</span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                Dari {summary?.total_laporan ?? 0} total laporan terdaftar
              </p>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-[#8C1515]" />
          </div>
        </div>

        {/* Filter Bar Interaktif */}
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Input Pencarian */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari deskripsi, lokasi, pelapor, atau nomor laporan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8C1515] focus:border-[#8C1515] bg-gray-50 focus:bg-white transition-all font-medium"
              />
            </div>

            {/* Filter Kategori */}
            <div>
              <select
                value={kategoriFilter}
                onChange={(e) => setKategoriFilter(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8C1515]"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Fasilitas">Kerusakan Fasilitas</option>
                <option value="Kebersihan">Kebersihan</option>
              </select>
            </div>

            {/* Filter Tingkat Kerusakan (Severity) */}
            <div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8C1515]"
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
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8C1515]"
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

          {/* Quick Toggle Checkbox */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyNeedsReview}
                onChange={(e) => setOnlyNeedsReview(e.target.checked)}
                className="w-4 h-4 rounded text-[#8C1515] focus:ring-[#8C1515] border-gray-300"
              />
              <span className="font-semibold text-purple-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Hanya tampilkan laporan yang membutuhkan konfirmasi usulan AI
              </span>
            </label>

            <span className="text-gray-500 font-medium">
              Menampilkan <span className="font-bold text-gray-900">{reports.length}</span> laporan
            </span>
          </div>
        </div>

        {/* Tabel Utama Prioritas Laporan */}
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-[#8C1515]/20 border-t-[#8C1515] animate-spin" />
              <p className="text-xs font-bold text-gray-500">Menghitung skor dan memuat prioritas...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                <Inbox className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Tidak ada laporan yang cocok</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Tidak ditemukan laporan sesuai filter atau kata kunci pencarian yang dipilih.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-4 sm:px-6">Peringkat & Skor</th>
                    <th className="py-4 px-4">Nomor & Tanggal</th>
                    <th className="py-4 px-4">Kategori & Lokasi</th>
                    <th className="py-4 px-4">Tingkat Kerusakan</th>
                    <th className="py-4 px-4 hidden lg:table-cell">Alasan AI</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-right pr-6">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {reports.map((item, index) => {
                    const isTopPriority = item.priority_level === "kritis" || item.severity_level === "berat";
                    return (
                      <tr
                        key={item.id_laporan}
                        className={`hover:bg-gray-50/80 transition-colors ${
                          isTopPriority ? "bg-red-50/30" : ""
                        }`}
                      >
                        {/* Kolom Peringkat & Skor */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-center font-bold text-gray-400 text-xs font-mono">
                              #{index + 1}
                            </span>
                            <PriorityScoreBadge
                              score={item.priority_score}
                              level={item.priority_level}
                            />
                          </div>
                        </td>

                        {/* Kolom Nomor & Tanggal */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-900 block font-mono">
                              #{item.id_laporan}
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              {item.nama_pelapor}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>{item.lama_menunggu}</span>
                            </span>
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
                            <div className="flex items-center gap-1 text-gray-700 font-medium">
                              <Building className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[180px]">{item.lokasi}</span>
                            </div>
                          </div>
                        </td>

                        {/* Kolom Tingkat Kerusakan */}
                        <td className="py-4 px-4">
                          <SeverityBadge
                            severity={item.severity_level}
                            source={item.severity_source}
                            needsReview={item.needs_review}
                          />
                        </td>

                        {/* Kolom Alasan AI */}
                        <td className="py-4 px-4 hidden lg:table-cell max-w-xs">
                          <p className="text-gray-600 line-clamp-2 text-xs leading-relaxed">
                            {item.ringkasan_alasan}
                          </p>
                        </td>

                        {/* Kolom Status Laporan */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                            {item.status_terkini}
                          </span>
                        </td>

                        {/* Kolom Aksi */}
                        <td className="py-4 px-4 text-right pr-6">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 text-xs font-bold shadow-2xs hover:border-[#8C1515] hover:text-[#8C1515] transition-all cursor-pointer"
                          >
                            <span>Tinjau</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Detail & Verifikasi */}
      <PriorityDetailModal
        report={selectedReport}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdated={() => {
          fetchData();
        }}
      />
    </div>
  );
}
