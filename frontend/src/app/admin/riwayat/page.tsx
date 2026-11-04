"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { adminLaporanApi } from "@/lib/api";
import { getCurrentAuthUser } from "@/lib/auth";
import {
  Search,
  FileText,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Loader2,
  X,
  MapPin,
  Edit3,
  AlertCircle,
  ShieldCheck,
  Lock,
  UserCheck,
} from "lucide-react";


interface RiwayatStatus {
  id_status?: number;
  status_laporan?: string;
  status?: string;
  tanggal_merubah?: string;
  tanggal?: string;
  keterangan?: string;
  pesan?: string;
}

interface LaporanItem {
  id_laporan: number;
  nim?: string;
  nama_pelapor?: string;
  kategori_laporan: string;
  deskripsi: string;
  tanggal_kejadian?: string;
  tanggal_buat: string;
  tanggal_rubah?: string | null;
  lokasi: string;
  foto?: string | string[] | null;
  pesan_tanggapan?: string | null;
  status_terkini: string;
  status_laporan?: string;
  riwayat_status?: RiwayatStatus[];
}

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

export default function AdminRiwayatLaporanPage() {
  const [adminUser, setAdminUser] = useState({
    nama: "Admin Lapor Sadhar",
    role: "Administrator",
  });

  useEffect(() => {
    const currentUser = getCurrentAuthUser();
    if (currentUser) {
      setAdminUser({
        nama: currentUser.nama || currentUser.username || "Admin",
        role: currentUser.jabatan_label || currentUser.jabatan || "Administrator",
      });
    }
  }, []);

  const [laporanList, setLaporanList] = useState<LaporanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // State Filter Navbar (Bulan & Tahun)
  const [selectedMonth, setSelectedMonth] = useState("Semua");
  const [selectedYear, setSelectedYear] = useState("2026");

  // State Filter Tabel
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKampus, setFilterKampus] = useState("Semua Kampus");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // State Modal Detail & Ubah Status
  const [selectedDetail, setSelectedDetail] = useState<LaporanItem | null>(null);
  const [statusBaru, setStatusBaru] = useState("");
  const [pesanTanggapan, setPesanTanggapan] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  // Pengecekan Hak Akses Admin berdasarkan Wewenang Unit & Kampus
  const checkCanEditStatus = useCallback(
    (laporan: LaporanItem): boolean => {
      const role = (adminUser.role || "").toLowerCase();

      if (role.includes("wakil rektor ii") || role.includes("wr ii") || role.includes("administrator")) {
        return true;
      }

      const isBLU = laporan.kategori_laporan === "Fasilitas" || laporan.kategori_laporan === "BLU";
      const isBPS = laporan.kategori_laporan === "Kebersihan" || laporan.kategori_laporan === "BPS";

      if (role.includes("kepala biro layanan umum") || role.includes("kepala blu")) {
        return isBLU;
      }

      if (role.includes("kepala biro prasarana") || role.includes("kepala bps")) {
        return isBPS;
      }

      const lokasi = (laporan.lokasi || "").toLowerCase();
      const isKampus1 = lokasi.includes("kampus i ") || lokasi.includes("kampus 1") || lokasi.includes("mrican");
      const isKampus2 = lokasi.includes("kampus ii") || lokasi.includes("kampus 2") || lokasi.includes("mrican");
      const isKampus3 = lokasi.includes("kampus iii") || lokasi.includes("kampus 3") || lokasi.includes("paingan");
      const isKampus4 = lokasi.includes("kampus iv") || lokasi.includes("kampus 4");

      if (role.includes("blu") && role.includes("kampus i") && isBLU && isKampus1) return true;
      if (role.includes("blu") && role.includes("kampus ii") && isBLU && isKampus2) return true;
      if (role.includes("blu") && role.includes("kampus iii") && isBLU && isKampus3) return true;
      if (role.includes("blu") && role.includes("kampus iv") && isBLU && isKampus4) return true;

      if (role.includes("bps") && role.includes("kampus i") && isBPS && isKampus1) return true;
      if (role.includes("bps") && role.includes("kampus ii") && isBPS && isKampus2) return true;
      if (role.includes("bps") && role.includes("kampus iii") && isBPS && isKampus3) return true;
      if (role.includes("bps") && role.includes("kampus iv") && isBPS && isKampus4) return true;

      return false;
    },
    [adminUser.role]
  );

  const fetchAllLaporanAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminLaporanApi.getAll();
      const data = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.laporan)
            ? res.laporan
            : [];

      const sortedData = (data as LaporanItem[]).sort(
        (a, b) => b.id_laporan - a.id_laporan
      );
      setLaporanList(sortedData);
    } catch (error) {
      console.error("Gagal mengambil data riwayat laporan admin:", error);
      setLaporanList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllLaporanAdmin();
  }, [fetchAllLaporanAdmin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterKampus, filterStatus, filterKategori, selectedMonth, selectedYear]);

  // Metrik KPI Dashboard
  const totalLaporan = laporanList.length;
  const masukCount = laporanList.filter((l) => l.status_terkini === "Terkirim").length;
  const diprosesCount = laporanList.filter((l) =>
    ["Sedang Diverifikasi", "Terverifikasi", "Diverifikasi", "Diproses", "Proses"].includes(l.status_terkini)
  ).length;
  const selesaiCount = laporanList.filter((l) => l.status_terkini === "Selesai").length;

  // Filter Data Laporan Sesuai Periode Bulan, Tahun & Kriteria Tabel
  const filteredList = useMemo(() => {
    return laporanList.filter((item) => {
      const searchLow = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === "" ||
        (item.deskripsi && item.deskripsi.toLowerCase().includes(searchLow)) ||
        (item.lokasi && item.lokasi.toLowerCase().includes(searchLow)) ||
        (item.nim && item.nim.toLowerCase().includes(searchLow)) ||
        String(item.id_laporan).includes(searchLow);

      const matchesStatus = filterStatus === "Semua" || item.status_terkini === filterStatus;
      const matchesKategori = filterKategori === "Semua" || item.kategori_laporan === filterKategori;

      let matchesKampus = true;
      if (filterKampus !== "Semua Kampus" && item.lokasi) {
        matchesKampus = item.lokasi.toLowerCase().includes(filterKampus.toLowerCase());
      }

      let matchesMonth = true;
      let matchesYear = true;
      const targetDateStr = item.tanggal_buat || item.tanggal_kejadian;

      if (targetDateStr) {
        const d = new Date(targetDateStr);
        if (!isNaN(d.getTime())) {
          const itemMonthNum = String(d.getMonth() + 1).padStart(2, "0");
          const itemYearStr = String(d.getFullYear());

          matchesMonth = selectedMonth === "Semua" || itemMonthNum === selectedMonth;
          matchesYear = selectedYear === "Semua" || itemYearStr === selectedYear;
        }
      }

      return matchesSearch && matchesStatus && matchesKategori && matchesKampus && matchesMonth && matchesYear;
    });
  }, [laporanList, searchTerm, filterStatus, filterKategori, filterKampus, selectedMonth, selectedYear]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedData = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Terkirim":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            Terkirim
          </span>
        );
      case "Sedang Diverifikasi":
      case "Terverifikasi":
      case "Diverifikasi":
      case "Diproses":
      case "Proses":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {status}
          </span>
        );
      case "Selesai":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Selesai
          </span>
        );
      case "Ditolak":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            Ditolak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedDetail || !statusBaru) return;
    if (statusBaru === "Ditolak" && !pesanTanggapan.trim()) {
      setModalError("Mohon berikan pesan tanggapan / alasan penolakan!");
      return;
    }

    setUpdateLoading(true);
    setModalError("");
    setModalSuccess("");

    try {
      await adminLaporanApi.updateStatus(
        selectedDetail.id_laporan,
        statusBaru,
        pesanTanggapan.trim()
      );

      setModalSuccess("Status laporan berhasil diperbarui!");
      setSelectedDetail((prev) =>
        prev
          ? {
              ...prev,
              status_terkini: statusBaru,
              pesan_tanggapan: pesanTanggapan.trim() || prev.pesan_tanggapan,
            }
          : null
      );
      fetchAllLaporanAdmin();
    } catch (err) {
      console.error(err);
      setModalError(
        err instanceof Error ? err.message : "Gagal memperbarui status laporan."
      );
    } finally {
      setUpdateLoading(false);
    }
  };

  const stepsProgres = [
    { key: "Terkirim", label: "Terkirim", num: 1 },
    { key: "Sedang Diverifikasi", label: "Diverifikasi", num: 2 },
    { key: "Terverifikasi", label: "Terverifikasi", num: 3 },
    { key: "Diproses", label: "Diproses", num: 4 },
    { key: "Selesai", label: "Selesai", num: 5 },
  ];

  return (
    <div className="min-h-screen w-full bg-[#F3F4F6] font-sans text-slate-800 flex flex-col">
      <AdminNavbar
        adminName={adminUser.nama}
        adminRole={adminUser.role}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={(m) => setSelectedMonth(m)}
        onYearChange={(y) => setSelectedYear(y)}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8">
        <div className="mx-auto max-w-6xl space-y-5">
          
          {/* Banner Informasi Hak Akses Admin */}
          <div className="bg-gradient-to-r from-[#7A0C0C] to-[#9E1B1B] rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 shrink-0">
                <ShieldCheck className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <span>Riwayat Pelaporan Admin: {adminUser.role}</span>
                </h2>
                <p className="text-xs text-red-100 mt-0.5 leading-relaxed">
                  Pantau riwayat penanganan laporan di lingkungan USD. Perubahan status disesuaikan dengan hak akses unit & wilayah kerja Anda.
                </p>
              </div>
            </div>
            <button
              onClick={fetchAllLaporanAdmin}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sinkronkan Data</span>
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL KESELURUHAN</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalLaporan}</h3>
                <p className="text-[11px] text-slate-400 mt-1">Laporan terdaftar</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#7A0C0C] flex items-center justify-center border border-red-100 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">LAPORAN MASUK</p>
                <h3 className="text-2xl font-extrabold text-blue-600 mt-1">{masukCount}</h3>
                <p className="text-[11px] text-blue-600/80 mt-1">Status: Terkirim</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SEDANG DITANGANI</p>
                <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{diprosesCount}</h3>
                <p className="text-[11px] text-amber-600/80 mt-1">Verifikasi & Teknisi</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SELESAI DITANGANI</p>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{selesaiCount}</h3>
                <p className="text-[11px] text-emerald-600/80 mt-1">Masalah Tuntas</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
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
                placeholder="Cari NIM, deskripsi, lokasi, atau ID Laporan..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-[#7A0C0C] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterKampus}
                onChange={(e) => setFilterKampus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Semua Kampus">Kampus: Semua Kampus</option>
                <option value="Kampus I">Kampus I (Mrican)</option>
                <option value="Kampus II">Kampus II (Mrican)</option>
                <option value="Kampus III">Kampus III (Paingan)</option>
                <option value="Kampus IV">Kampus IV</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Semua">Status: Semua</option>
                <option value="Terkirim">Terkirim</option>
                <option value="Sedang Diverifikasi">Sedang Diverifikasi</option>
                <option value="Terverifikasi">Terverifikasi</option>
                <option value="Diproses">Diproses</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditolak">Ditolak</option>
              </select>

              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Semua">Unit: Semua Unit</option>
                <option value="Fasilitas">Fasilitas (BLU)</option>
                <option value="Kebersihan">Kebersihan (BPS)</option>
              </select>
            </div>
          </div>

          {/* Tabel Data Admin */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5 whitespace-nowrap">Pelapor & ID</th>
                    <th className="px-4 py-3.5">Judul & Lokasi Kejadian</th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">Unit/Kategori</th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">Status saat ini</th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">Akses Kelola</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7A0C0C]" />
                        Memuat data riwayat laporan seluruh kampus...
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Tidak ditemukan data laporan yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((lap) => {
                      const canEdit = checkCanEditStatus(lap);
                      return (
                        <tr key={lap.id_laporan} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap text-xs text-slate-500">
                            <span className="font-bold text-slate-900 block">NIM: {lap.nim || "-"}</span>
                            <span className="text-[11px] text-slate-400">ID Laporan #{lap.id_laporan}</span>
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
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                                lap.kategori_laporan === "Fasilitas"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {lap.kategori_laporan} ({lap.kategori_laporan === "Fasilitas" ? "BLU" : "BPS"})
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                            {renderStatusBadge(lap.status_terkini)}
                          </td>
                          <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                            {canEdit ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <UserCheck className="w-3 h-3 shrink-0" /> Bisa Diubah
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                <Lock className="w-3 h-3 shrink-0" /> Lihat Saja
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedDetail(lap);
                                setStatusBaru(lap.status_terkini);
                                setPesanTanggapan(lap.pesan_tanggapan || "");
                                setModalError("");
                                setModalSuccess("");
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-semibold shadow-2xs transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Detail / Kelola</span>
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
            <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <p>
                Menampilkan {paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredList.length)} dari {filteredList.length} total laporan admin
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

      {/* Modal Detail & Kelola Status */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col border border-slate-100">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  KELOLA LAPORAN #{selectedDetail.id_laporan}
                </p>
                <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Informasi Detail & Akses Status
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

            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {modalSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {checkCanEditStatus(selectedDetail) ? (
                <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <Edit3 className="w-4 h-4 text-amber-700" />
                    <span>Panel Pengubahan Status & Tanggapan Admin</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Status Baru</label>
                      <select
                        value={statusBaru}
                        onChange={(e) => setStatusBaru(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#7A0C0C]"
                      >
                        <option value="Terkirim">1. Terkirim (Baru Masuk)</option>
                        <option value="Sedang Diverifikasi">2. Sedang Diverifikasi Sarpras</option>
                        <option value="Terverifikasi">3. Terverifikasi</option>
                        <option value="Diproses">4. Diproses Teknisi</option>
                        <option value="Selesai">5. Selesai Ditangani</option>
                        <option value="Ditolak">6. Ditolak (Tidak Valid / Duplikat)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pesan Tanggapan Admin {statusBaru === "Ditolak" && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        rows={3}
                        value={pesanTanggapan}
                        onChange={(e) => setPesanTanggapan(e.target.value)}
                        placeholder="Tuliskan catatan verifikasi, hasil penanganan teknisi, atau alasan penolakan..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 outline-none focus:border-[#7A0C0C] resize-y"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleUpdateStatus}
                        disabled={updateLoading || (statusBaru === selectedDetail.status_terkini && pesanTanggapan.trim() === (selectedDetail.pesan_tanggapan || ""))}
                        className="px-5 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {updateLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span>Simpan Perubahan Status</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 flex items-center gap-2.5 text-slate-600 text-xs">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Role Anda (<strong>{adminUser.role}</strong>) hanya memiliki hak akses untuk <strong>melihat laporan ini</strong> dan tidak dapat mengubah statusnya.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">NIM / Nama Pelapor</p>
                  <p className="font-bold text-slate-800">{selectedDetail.nim || "-"} {selectedDetail.nama_pelapor ? `(${selectedDetail.nama_pelapor})` : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Kategori / Unit Tujuan</p>
                  <p className="font-bold text-slate-800">
                    {selectedDetail.kategori_laporan} ({selectedDetail.kategori_laporan === "Fasilitas" ? "BLU" : "BPS"})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Tanggal Kejadian</p>
                  <p className="font-bold text-slate-800">{formatTanggalLong(selectedDetail.tanggal_kejadian)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Tanggal Dibuat</p>
                  <p className="font-bold text-slate-800">{formatTanggalLong(selectedDetail.tanggal_buat)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Lokasi Kejadian</p>
                  <p className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{selectedDetail.lokasi || "-"}</span>
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">Deskripsi Masalah</p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-slate-700 text-xs sm:text-sm leading-relaxed">
                  {selectedDetail.deskripsi}
                </div>
              </div>

              {/* Tanggapan Admin jika ada */}
              {selectedDetail.pesan_tanggapan && (
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1.5">Catatan / Tanggapan Admin</p>
                  <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100 text-purple-900 text-xs sm:text-sm leading-relaxed">
                    {selectedDetail.pesan_tanggapan}
                  </div>
                </div>
              )}

              {/* Foto Bukti */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">Foto Bukti Pendukung</p>
                {selectedDetail.foto ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-1">
                    <img
                      src={typeof selectedDetail.foto === "string" ? selectedDetail.foto : (Array.isArray(selectedDetail.foto) ? selectedDetail.foto[0] : "")}
                      alt="Foto pendukung laporan"
                      className="w-full max-h-60 object-contain rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs italic">
                    Pelapor tidak mengunggah foto pendukung.
                  </div>
                )}
              </div>

              {/* Alur Progres Penanganan */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#7A0C0C]" />
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">Progres Penanganan Laporan</p>
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

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <p className="text-xs text-slate-400">Portal Admin USD</p>
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white py-4 text-center mt-auto">
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} Lapor Sadhar — Universitas Sanata Dharma. Hak cipta dilindungi.
        </p>
      </footer>
    </div>
  );
}