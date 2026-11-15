"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useAuthProtection } from "@/lib/useAuth";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
  RotateCcw,
  Search,
  Building,
  TrendingUp,
  Inbox,
  ChevronRight,
  Info
} from "lucide-react";
import {
  priorityApi,
  PriorityReportItem,
  PrioritySummary
} from "@/lib/priorityApi";
import { PriorityScoreBadge, SeverityBadge } from "@/components/priority/PriorityScoreBadge";
import { PriorityDetailModal } from "@/components/priority/PriorityDetailModal";

export default function UserPriorityDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const [currentUser, setCurrentUser] = useState({ nama: "Pengguna", role: "Mahasiswa", nim: "" });

  // Data state
  const [reports, setReports] = useState<PriorityReportItem[]>([]);
  const [summary, setSummary] = useState<PrioritySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("Semua");
  const [severityFilter, setSeverityFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  // Detail modal
  const [selectedReport, setSelectedReport] = useState<PriorityReportItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    if (!authLoading && authUser) {
      setCurrentUser({
        nama: authUser.nama,
        role: authUser.role || (authUser.tipe_user === "karyawan" ? "Karyawan" : "Mahasiswa"),
        nim: authUser.nim || authUser.nomor_identitas || "",
      });
    }
  }, [authLoading, authUser]);

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
    if (!authLoading && authUser) {
      fetchData();
    }
  }, [authLoading, authUser, fetchData]);

  const handleOpenDetail = (item: PriorityReportItem) => {
    setSelectedReport(item);
    setIsModalOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-medium">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      {/* Sidebar Navigasi Pengguna */}
      <Sidebar isOpenMobile={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Navbar Pengguna */}
        <Navbar
          pageTitle="Dashboard Prioritas Laporan"
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        {/* Konten Utama */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 bg-[#F3F4F6] space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Banner Header User */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#7A0C0C]/10 text-[#7A0C0C] mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sistem Prioritas Kerusakan & Kebersihan</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Dashboard Prioritas Penanganan Laporan
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
                  Menampilkan urutan prioritas penanganan laporan di lingkungan kampus Universitas Sanata Dharma
                  berdasarkan keparahan, sinyal urgensi AI, lokasi strategis, dan waktu tunggu.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchData}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {/* Notice Penjelasan untuk Pelapor */}
            <div className="p-4 bg-linear-to-r from-red-50 to-amber-50 rounded-2xl border border-red-200/70 flex items-start gap-3">
              <Info className="w-5 h-5 text-[#7A0C0C] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <p className="font-bold text-slate-900">Transparansi Urutan Penanganan</p>
                <p className="mt-0.5 text-slate-600 leading-relaxed">
                  Laporan civitas akademika diproses secara otomatis oleh sistem cerdas untuk membantu admin BLU dan BPS
                  mendahulukan masalah yang membahayakan keselamatan atau menghentikan aktivitas perkuliahan.
                </p>
              </div>
            </div>

            {/* Kartu Ringkasan Metrik */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Prioritas Kritis */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-red-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                    Prioritas Kritis / Berat
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-red-900">
                    {summary?.kritis_berat ?? 0}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Membutuhkan penanganan paling mendesak
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-2 h-full bg-red-600" />
              </div>

              {/* Card 2: Prioritas Tinggi */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Prioritas Tinggi
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-900">
                    {summary?.tinggi ?? 0}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Mengganggu fungsi fasilitas / area ramai
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
              </div>

              {/* Card 3: Perlu Konfirmasi AI */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                    Perlu Konfirmasi AI
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-purple-900">
                    {summary?.perlu_konfirmasi ?? 0}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Usulan AI dalam peninjauan admin
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-2 h-full bg-purple-600" />
              </div>

              {/* Card 4: Rata-Rata Skor */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Rata-rata Skor
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                      {summary?.rata_skor_prioritas ?? 0}
                    </span>
                    <span className="text-xs font-bold text-slate-400">/ 100</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Dari {summary?.total_laporan ?? 0} total laporan terdaftar
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-2 h-full bg-[#7A0C0C]" />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Pencarian */}
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari deskripsi, lokasi, atau ID laporan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Filter Kategori */}
                <div>
                  <select
                    value={kategoriFilter}
                    onChange={(e) => setKategoriFilter(e.target.value)}
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
                    onChange={(e) => setSeverityFilter(e.target.value)}
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
                    onChange={(e) => setStatusFilter(e.target.value)}
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
                  Menampilkan <span className="font-bold text-slate-900">{reports.length}</span> laporan
                </span>
              </div>
            </div>

            {/* Tabel Prioritas Laporan */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] animate-spin" />
                  <p className="text-xs font-bold text-slate-500">Memuat urutan prioritas laporan...</p>
                </div>
              ) : reports.length === 0 ? (
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-4 px-4 sm:px-6">Peringkat & Skor</th>
                        <th className="py-4 px-4">Nomor & Tanggal</th>
                        <th className="py-4 px-4">Kategori & Lokasi</th>
                        <th className="py-4 px-4">Tingkat Kerusakan</th>
                        <th className="py-4 px-4 hidden lg:table-cell">Alasan Prioritas AI</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4 text-right pr-6">Rincian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {reports.map((item, index) => {
                        const isTopPriority = item.priority_level === "kritis" || item.severity_level === "berat";
                        return (
                          <tr
                            key={item.id_laporan}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isTopPriority ? "bg-red-50/30" : ""
                            }`}
                          >
                            {/* Peringkat & Skor */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <span className="w-6 text-center font-bold text-slate-400 text-xs font-mono">
                                  #{index + 1}
                                </span>
                                <PriorityScoreBadge
                                  score={item.priority_score}
                                  level={item.priority_level}
                                />
                              </div>
                            </td>

                            {/* Nomor & Tanggal */}
                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-900 block font-mono">
                                  #{item.id_laporan}
                                </span>
                                <span className="text-[11px] text-slate-500 block truncate max-w-[130px]">
                                  {item.nama_pelapor}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{item.lama_menunggu}</span>
                                </span>
                              </div>
                            </td>

                            {/* Kategori & Lokasi */}
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
                                <div className="flex items-center gap-1 text-slate-700 font-medium">
                                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[160px]">{item.lokasi}</span>
                                </div>
                              </div>
                            </td>

                            {/* Tingkat Kerusakan */}
                            <td className="py-4 px-4">
                              <SeverityBadge
                                severity={item.severity_level}
                                source={item.severity_source}
                                needsReview={item.needs_review}
                              />
                            </td>

                            {/* Alasan AI */}
                            <td className="py-4 px-4 hidden lg:table-cell max-w-xs">
                              <p className="text-slate-600 line-clamp-2 text-xs leading-relaxed">
                                {item.ringkasan_alasan}
                              </p>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                {item.status_terkini}
                              </span>
                            </td>

                            {/* Aksi Detail */}
                            <td className="py-4 px-4 text-right pr-6">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs hover:border-[#7A0C0C] hover:text-[#7A0C0C] transition-all cursor-pointer"
                              >
                                <span>Detail</span>
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
          </div>
        </main>
      </div>

      {/* Modal Detail & Analisis AI */}
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

