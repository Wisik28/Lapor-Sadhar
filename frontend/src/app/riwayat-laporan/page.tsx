"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { laporanApi, type LaporanItem } from "@/lib/api";
import { useAuthProtection } from "@/lib/useAuth";
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
} from "lucide-react";

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
    const dateFormatted = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).replace(".", ":");
    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return dateStr;
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
  const role = authUser?.role || (authUser?.tipe_user === "karyawan" ? "Karyawan" : "Mahasiswa");

  const [laporanList, setLaporanList] = useState<LaporanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterWaktu, setFilterWaktu] = useState("Semua Waktu");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // State Modal Detail
  const [selectedDetail, setSelectedDetail] = useState<LaporanItem | null>(null);

  // ── Ambil Data Backend ──
  const fetchLaporan = useCallback(async () => {
    setLoading(true);
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
        setLaporanList([]);
      }
    } catch (error) {
      console.error("Gagal mengambil riwayat laporan:", error);
      setLaporanList([]);
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
    ["Terkirim", "Sedang Diverifikasi", "Terverifikasi", "Diproses"].includes(l.status_terkini)
  ).length;
  const selesaiCount = laporanList.filter((l) => l.status_terkini === "Selesai").length;
  const ditolakCount = laporanList.filter((l) => l.status_terkini === "Ditolak").length;
  const tingkatResolusi = totalLaporan > 0 ? Math.round((selesaiCount / totalLaporan) * 100) : 0;

  // ── Filter Data ──
  const filteredList = laporanList.filter((item) => {
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === "" ||
      (item.deskripsi && item.deskripsi.toLowerCase().includes(searchLow)) ||
      (item.lokasi && item.lokasi.toLowerCase().includes(searchLow)) ||
      String(item.id_laporan).includes(searchLow);

    const matchesStatus = filterStatus === "Semua" || item.status_terkini === filterStatus;
    const matchesKategori = filterKategori === "Semua" || item.kategori_laporan === filterKategori;

    // Filter Rentang Waktu / Bulan
    let matchesWaktu = true;
    const targetDateStr = item.tanggal_buat || item.tanggal_kejadian;

    if (targetDateStr && filterWaktu !== "Semua Waktu") {
      const itemDate = new Date(targetDateStr);
      if (filterWaktu === "Bulan Ini") {
        const now = new Date();
        matchesWaktu =
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear();
      } else {
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

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Terkirim":
      case "Sedang Diverifikasi":
      case "Terverifikasi":
      case "Diproses":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Sedang Dikerjakan
          </span>
        );
      case "Selesai":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Selesai
          </span>
        );
      case "Ditolak":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Ditolak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            {status}
          </span>
        );
    }
  };

  const handleGoToEdit = (idLaporan: number) => {
    router.push(`/buat-laporan?edit=${idLaporan}`);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
          <p className="text-slate-600 text-sm font-medium">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  const stepsProgres = [
    { key: "Terkirim", label: "Terkirim", num: 1 },
    { key: "Sedang Diverifikasi", label: "Sedang Diverifikasi", num: 2 },
    { key: "Terverifikasi", label: "Terverifikasi", num: 3 },
    { key: "Diproses", label: "Diproses", num: 4 },
    { key: "Selesai", label: "Selesai", num: 5 },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans text-slate-800">
      <Sidebar
        activeMenu="riwayat-laporan"
        setActiveMenu={(menu: string) => {
          if (menu === "buat-laporan") router.push("/buat-laporan");
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

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8">
          <div className="mx-auto max-w-6xl space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL LAPORAN</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalLaporan}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Semua kampus</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#7A0C0C] flex items-center justify-center border border-red-100 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SEDANG DIPROSES</p>
                  <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{sedangDiproses}</h3>
                  <p className="text-[11px] text-amber-600/80 mt-1">Tindak lanjut BPS & Teknisi</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SELESAI</p>
                  <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{selesaiCount}</h3>
                  <p className="text-[11px] text-emerald-600/80 mt-1">✓ {tingkatResolusi}% resolusi</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DITOLAK</p>
                  <h3 className="text-2xl font-extrabold text-slate-700 mt-1">{ditolakCount}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Duplikasi / Tidak valid</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Panel Pencarian & Filter */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                {/* Filter Waktu (Clean Dropdown) */}
                <select
                  value={filterWaktu}
                  onChange={(e) => setFilterWaktu(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="Semua Waktu">Waktu: Semua Waktu</option>
                  <option value="Bulan Ini">Bulan Ini</option>
                  <hr />
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
                  <option value="Terkirim">Terkirim</option>
                  <option value="Diproses">Diproses</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Ditolak">Ditolak</option>
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
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
                  title="Muat ulang data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Tabel Data */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden w-full">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">Tanggal & Waktu</th>
                      <th className="px-4 py-3.5">Judul & Lokasi Kejadian</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Kategori</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Status</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Lampiran</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7A0C0C]" />
                          Memuat riwayat laporan...
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Belum ada data riwayat laporan.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((lap) => (
                        <tr key={lap.id_laporan} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap text-xs text-slate-500">
                            <span className="font-semibold text-slate-800 block">
                              {lap.tanggal_kejadian || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            <p className="font-bold text-slate-900 line-clamp-1 text-xs sm:text-sm">
                              {lap.deskripsi}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span className="shrink-0 text-red-500">📍</span>
                              <span className="truncate">{lap.lokasi}</span>
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
                            {lap.foto ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium">
                                <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                                Foto
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <p>
                  Menampilkan {paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
                  {Math.min(currentPage * itemsPerPage, filteredList.length)} dari {filteredList.length} pengajuan laporan
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL POP-UP DETAIL LAPORAN
      ════════════════════════════════════════════════════════════════════ */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col border border-slate-100">
            
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
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  {selectedDetail.status_terkini}
                </span>
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
                  <p className="text-xs text-slate-400 font-medium mb-1">Kategori</p>
                  <p className="font-bold text-slate-800">{selectedDetail.kategori_laporan || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">Tanggal Kejadian</p>
                  <p className="font-bold text-slate-800">{formatTanggalLong(selectedDetail.tanggal_kejadian)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium mb-1">Lokasi</p>
                  <p className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{selectedDetail.lokasi || "-"}</span>
                  </p>
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">Deskripsi</p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-slate-700 text-xs sm:text-sm leading-relaxed">
                  {selectedDetail.deskripsi}
                </div>
              </div>

              {/* Foto Pendukung */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">Foto Pendukung</p>
                {selectedDetail.foto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-1">
                    <img
                      src={selectedDetail.foto}
                      alt="Foto pendukung laporan"
                      className="w-full max-h-60 object-contain rounded-xl"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallbackElem = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallbackElem) fallbackElem.style.display = "flex";
                      }}
                    />
                    <div
                      className="hidden flex-col items-center justify-center py-6 px-4 text-center w-full bg-slate-50 text-slate-400 gap-2 rounded-xl"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Paperclip className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-xs font-semibold text-slate-600">Gambar tidak dapat dimuat</p>
                      <a
                        href={selectedDetail.foto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#7A0C0C] font-bold hover:underline"
                      >
                        Buka Tautan Foto Asli ↗
                      </a>
                    </div>
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
                  <p className="text-xs text-slate-400 font-medium mb-1">Tanggal Dibuat</p>
                  <p className="font-bold text-slate-800">{formatTanggalLong(selectedDetail.tanggal_buat)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">Terakhir Diperbarui</p>
                  <p className="font-bold text-slate-800">{selectedDetail.tanggal_rubah ? formatTanggalLong(selectedDetail.tanggal_rubah) : "-"}</p>
                </div>
              </div>

              {/* Progres Penanganan */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-700" />
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">Progres Penanganan</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {stepsProgres.map((st) => {
                    const isCurrent = selectedDetail.status_terkini === st.key;
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
                              isCurrent ? "bg-red-700 text-white" : "bg-slate-200 text-slate-600"
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
                        <p className={`text-xs font-bold ${isCurrent ? "text-red-900" : "text-slate-600"}`}>
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
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">Riwayat Perubahan Status</p>
                </div>

                <div className="space-y-2">
                  {selectedDetail.riwayat_status && selectedDetail.riwayat_status.length > 0 ? (
                    selectedDetail.riwayat_status.map((rs) => (
                      <div key={rs.id_status} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {rs.status_laporan}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          {formatTanggalTime(rs.tanggal_merubah)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {selectedDetail.status_terkini}
                        </span>
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
                <p className="font-bold text-slate-800 text-xs sm:text-sm">Tanggapan Admin</p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-slate-500 text-xs leading-relaxed">
                  Belum ada tanggapan dari admin untuk laporan ini.
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {selectedDetail.status_terkini === "Terkirim" ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 w-full sm:w-auto">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Laporan ini masih dapat diubah/diedit.</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Laporan dalam penanganan.</span>
              )}

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {selectedDetail.status_terkini === "Terkirim" && (
                  <button
                    onClick={() => handleGoToEdit(selectedDetail.id_laporan)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Laporan Ini</span>
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

    </div>
  );
}