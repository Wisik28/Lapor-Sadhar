"use client";

import React, { useState, useMemo, useEffect } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { authApi } from "@/lib/api";
import { useAdminProtection } from "@/lib/useAuth";
import {
  Inbox,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RotateCcw,
  MapPin,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  Building,
  Image as ImageIcon,
  X
} from "lucide-react";

// Tipe Data Dummy Laporan
// Tipe Data Dummy Laporan
export type StatusLaporan =
  | "Terkirim"
  | "Diverifikasi"
  | "Diproses"
  | "Ditolak"
  | "Selesai";

interface ReportItem {
  id: string; // ID Tiket
  tanggal: string;
  waktu: string;
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
}

const MOCK_REPORTS: ReportItem[] = [
  {
    id: "TK-2026-001",
    tanggal: "2026-10-11",
    waktu: "09:30",
    pelaporNama: "Agustinus Kurniawan",
    pelaporNim: "225314001",
    pelaporRole: "Mahasiswa",
    kategori: "Fasilitas",
    fasilitas: "Proyektor Ruang Kelas",
    lokasi: "Ruang K.302, Gedung Thomas Aquinas Lt. 3",
    kampus: "Kampus III Paingan",
    deskripsi: "Proyektor tiba-tiba mati saat perkuliahan berlangsung dan lampu indikator berkedip merah terus-menerus.",
    status: "Terkirim",
    prioritas: "Tinggi",
    jumlahFoto: 2
  },
  {
    id: "TK-2026-002",
    tanggal: "2026-10-11",
    waktu: "08:15",
    pelaporNama: "Maria Fransiska",
    pelaporNim: "225314002",
    pelaporRole: "Mahasiswa",
    kategori: "Fasilitas",
    fasilitas: "AC Ruang Seminar",
    lokasi: "Ruang Seminar Driyarkara Lt. 2",
    kampus: "Kampus II Mrican",
    deskripsi: "AC mengeluarkan tetesan air cukup deras dan suhu ruangan tidak kunjung dingin.",
    status: "Diproses",
    prioritas: "Tinggi",
    jumlahFoto: 3
  },
  {
    id: "TK-2026-003",
    tanggal: "2026-10-10",
    waktu: "14:40",
    pelaporNama: "Ignatius Kevin Pratama",
    pelaporNim: "225314003",
    pelaporRole: "Mahasiswa",
    kategori: "Kebersihan",
    fasilitas: "Kran Air Toilet",
    lokasi: "Toilet Pria Gedung Central Lt. 1",
    kampus: "Kampus III Paingan",
    deskripsi: "Kran air wastafel tidak bisa dimatikan dengan rapat, air terus mengalir terbuang.",
    status: "Selesai",
    prioritas: "Sedang",
    jumlahFoto: 1
  },
  {
    id: "TK-2026-004",
    tanggal: "2026-10-10",
    waktu: "11:20",
    pelaporNama: "Theresia Wulandari",
    pelaporNim: "225314045",
    pelaporRole: "Mahasiswa",
    kategori: "Fasilitas",
    fasilitas: "Kursi Kuliah Rusak",
    lokasi: "Ruang K.205 Gedung Bonaventura",
    kampus: "Kampus III Paingan",
    deskripsi: "Tatakan meja kursi kuliah patah pada bagian engsel sambungan besi.",
    status: "Diverifikasi",
    prioritas: "Rendah",
    jumlahFoto: 2
  },
  {
    id: "TK-2026-005",
    tanggal: "2026-10-09",
    waktu: "16:10",
    pelaporNama: "Benediktus Ryan",
    pelaporNim: "225314088",
    pelaporRole: "Mahasiswa",
    kategori: "Fasilitas",
    fasilitas: "Lampu Penerangan Koridor",
    lokasi: "Koridor Sayap Barat Gedung Rektorat Lt. 2",
    kampus: "Kampus II Mrican",
    deskripsi: "Dua buah lampu neon padam total, membuat koridor gelap saat sore dan malam hari.",
    status: "Terkirim",
    prioritas: "Sedang",
    jumlahFoto: 1
  },
  {
    id: "TK-2026-006",
    tanggal: "2026-10-09",
    waktu: "10:05",
    pelaporNama: "Clara Shinta",
    pelaporNim: "225314102",
    pelaporRole: "Mahasiswa",
    kategori: "Kebersihan",
    fasilitas: "Tempat Sampah Pecah",
    lokasi: "Kantin Pusat Kampus I",
    kampus: "Kampus I Mrican",
    deskripsi: "Tempat pemilahan sampah organik pecah dan penutupnya hilang.",
    status: "Selesai",
    prioritas: "Rendah",
    jumlahFoto: 1
  },
  {
    id: "TK-2026-007",
    tanggal: "2026-10-08",
    waktu: "13:25",
    pelaporNama: "Yohanes Dwi",
    pelaporNim: "225314115",
    pelaporRole: "Mahasiswa",
    kategori: "Fasilitas",
    fasilitas: "Koneksi Wifi Access Point",
    lokasi: "Perpustakaan Pusat Lt. 3",
    kampus: "Kampus II Mrican",
    deskripsi: "Access Point lantai 3 sering RTO dan tidak memancarkan IP address.",
    status: "Ditolak",
    prioritas: "Rendah",
    jumlahFoto: 1
  },
  {
    id: "TK-2026-008",
    tanggal: "2026-10-07",
    waktu: "08:50",
    pelaporNama: "Fransiscus Xaverius",
    pelaporNim: "225314077",
    pelaporRole: "Mahasiswa",
    kategori: "Fasilitas",
    fasilitas: "Pintu Kamar Mandi Terkunci",
    lokasi: "Gedung Laboratorium Komputer Lt. 1",
    kampus: "Kampus III Paingan",
    deskripsi: "Kunci slot pintu macet dari dalam dan gagang pintu goyang.",
    status: "Diproses",
    prioritas: "Tinggi",
    jumlahFoto: 2
  }
];

export default function AdminDashboardPage() {
  // ── Auth Protection ──
  const { isLoading: authLoading, user: authUser } = useAdminProtection();

  // State Filter Periode Navbar (Bulan & Tahun)
  const [selectedMonth, setSelectedMonth] = useState("10"); // Default Oktober
  const [selectedYear, setSelectedYear] = useState("2026"); // Default 2026

  // State Filter & Pencarian Tabel
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLokasi, setFilterLokasi] = useState("Semua");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterPrioritas, setFilterPrioritas] = useState("Semua");

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // State Modal Detail
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  // Authenticated Admin User
  const [adminUser, setAdminUser] = useState({
    nama: "Bapak Hendro",
    role: "Admin Pengelola Sarpras",
  });

  useEffect(() => {
    if (!authLoading && authUser) {
      setAdminUser({
        nama: authUser.nama,
        role: (authUser as any).role_detail || "Admin Pengelola Sarpras",
      });
    }
  }, [authLoading, authUser]);

  // Filter Data Laporan Sesuai Periode Bulan & Tahun serta Filter Tabel
  const filteredReports = useMemo(() => {
    return MOCK_REPORTS.filter((item) => {
      // 1. Filter Periode (Bulan & Tahun pada item.tanggal YYYY-MM-DD)
      const [itemYear, itemMonth] = item.tanggal.split("-");
      const matchesMonth =
        selectedMonth === "Semua" || itemMonth === selectedMonth;
      const matchesYear =
        selectedYear === "Semua" || itemYear === selectedYear;

      // 2. Pencarian (ID tiket, pelapor, atau fasilitas/sarana)
      const matchesSearch =
        searchTerm === "" ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.pelaporNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.pelaporNim.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.fasilitas.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lokasi.toLowerCase().includes(searchTerm.toLowerCase());

      // 3. Filter Lokasi Kampus
      const matchesLokasi =
        filterLokasi === "Semua" || item.kampus === filterLokasi;

      // 4. Filter Status
      const matchesStatus =
        filterStatus === "Semua" || item.status === filterStatus;

      // 5. Filter Prioritas
      const matchesPrioritas =
        filterPrioritas === "Semua" || item.prioritas === filterPrioritas;

      return (
        matchesMonth &&
        matchesYear &&
        matchesSearch &&
        matchesLokasi &&
        matchesStatus &&
        matchesPrioritas
      );
    });
  }, [
    selectedMonth,
    selectedYear,
    searchTerm,
    filterLokasi,
    filterStatus,
    filterPrioritas
  ]);

  // Laporan pada periode terpilih (untuk menghitung metrik KPI periode tersebut)
  const periodReports = useMemo(() => {
    return MOCK_REPORTS.filter((item) => {
      const [itemYear, itemMonth] = item.tanggal.split("-");
      const matchesMonth =
        selectedMonth === "Semua" || itemMonth === selectedMonth;
      const matchesYear =
        selectedYear === "Semua" || itemYear === selectedYear;
      return matchesMonth && matchesYear;
    });
  }, [selectedMonth, selectedYear]);

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
    setFilterStatus("Semua");
    setFilterPrioritas("Semua");
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

  // Nama label bulan terpilih untuk ditampilkan pada keterangan
  const monthNames: Record<string, string> = {
    "Semua": "Semua Bulan",
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
    "12": "Desember"
  };

  const periodLabel = `${monthNames[selectedMonth] || selectedMonth} ${selectedYear === "Semua" ? "" : selectedYear}`;

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

  // Helper Badge Prioritas
  const getPriorityBadge = (prioritas: ReportItem["prioritas"]) => {
    switch (prioritas) {
      case "Tinggi":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100/70 text-red-700">
            Prioritas Tinggi
          </span>
        );
      case "Sedang":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100/70 text-amber-800">
            Prioritas Sedang
          </span>
        );
      case "Rendah":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
            Prioritas Rendah
          </span>
        );
    }
  };

  return (
    <>
      {/* Auth Loading State */}
      {authLoading && (
        <div className="flex h-screen w-full items-center justify-center bg-[#F3F4F6]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
            <p className="text-slate-600 text-sm font-medium">Memeriksa autentikasi admin...</p>
          </div>
        </div>
      )}

      {!authLoading && (
        <div className="min-h-screen w-full bg-[#F9FAFB] text-gray-900 flex flex-col font-sans antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAVBAR ADMIN (Sesuai DESIGN.md & Permintaan User) */}
      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAVBAR ADMIN DENGAN FILTER BULAN & TAHUN */}
      {/* ------------------------------------------------------------- */}
      <AdminNavbar
        adminName={adminUser.nama}
        adminRole={adminUser.role}
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

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN CONTENT AREA */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Keterangan Periode Aktif */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white px-4 py-3 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8C1515]" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Periode Data Aktif:
            </span>
            <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">
              {periodLabel}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Menampilkan data laporan sarana prasarana yang masuk pada periode ini.
          </span>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. KARTU RINGKASAN STATUS (TOTAL LAPORAN PERIODE + 5 STATUS) */}
        {/* ------------------------------------------------------------- */}
        <section aria-label="Kartu Ringkasan KPI" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
          {/* Card 1: TOTAL LAPORAN PERIODE */}
          <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
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
          <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
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
                {totalPeriodCount > 0 ? Math.round((terkirimCount / totalPeriodCount) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Card 3: Diverifikasi */}
          <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
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
                {totalPeriodCount > 0 ? Math.round((diverifikasiCount / totalPeriodCount) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Card 4: Diproses */}
          <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
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
                {totalPeriodCount > 0 ? Math.round((diprosesCount / totalPeriodCount) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Card 5: Ditolak */}
          <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
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
                {totalPeriodCount > 0 ? Math.round((ditolakCount / totalPeriodCount) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Card 6: Selesai */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
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
                {totalPeriodCount > 0 ? Math.round((selesaiCount / totalPeriodCount) * 100) : 0}%
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
                placeholder="Cari ID tiket, nama pelapor, NIM, fasilitas, atau ruangan..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8C1515] focus:border-[#8C1515] transition-all min-h-[44px]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns & Reset */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Filter Lokasi Kampus */}
              {/* <div className="w-full sm:w-auto">
                <select
                  value={filterLokasi}
                  onChange={(e) => {
                    setFilterLokasi(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter berdasarkan lokasi kampus"
                  className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8C1515] transition-colors"
                >
                  <option value="Semua">Semua Kampus</option>
                  <option value="Kampus I Mrican">Kampus I Mrican</option>
                  <option value="Kampus II Mrican">Kampus II Mrican</option>
                  <option value="Kampus III Paingan">Kampus III Paingan</option>
                </select>
              </div> */}

              {/* Filter Status Laporan */}
              <div className="w-full sm:w-auto">
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter berdasarkan status laporan"
                  className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8C1515] transition-colors"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Terkirim">Terkirim</option>
                  <option value="Diverifikasi">Diverifikasi</option>
                  <option value="Diproses">Diproses</option>
                  <option value="Ditolak">Ditolak</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>

              {/* Filter Tingkat Prioritas */}
              <div className="w-full sm:w-auto">
                <select
                  value={filterPrioritas}
                  onChange={(e) => {
                    setFilterPrioritas(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter berdasarkan prioritas"
                  className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8C1515] transition-colors"
                >
                  <option value="Semua">Semua Prioritas</option>
                  <option value="Tinggi">Tinggi</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Rendah">Rendah</option>
                </select>
              </div>

              {/* Tombol Reset Filter */}
              {/* <button
                type="button"
                onClick={handleResetFilter}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition-colors active:scale-98"
                title="Reset seluruh filter"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                <span>Reset</span>
              </button> */}
            </div>
          </div>

          {/* Status Aktif Filter Info */}
          {(searchTerm !== "" ||
            filterLokasi !== "Semua" ||
            filterStatus !== "Semua" ||
            filterPrioritas !== "Semua") && (
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Filter aktif:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  Pencarian: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm("")}
                    className="hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {filterLokasi !== "Semua" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  {filterLokasi}
                  <button
                    onClick={() => setFilterLokasi("Semua")}
                    className="hover:text-red-600"
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
                    className="hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {filterPrioritas !== "Semua" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  Prioritas: {filterPrioritas}
                  <button
                    onClick={() => setFilterPrioritas("Semua")}
                    className="hover:text-red-600"
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
                Urutan laporan berdasarkan prioritas kebutuhan penanganan darurat & tanggal masuk.
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

          {/* KONTEN JIKA KOSONG */}
          {filteredReports.length === 0 ? (
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
                className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#8C1515] bg-[#8C1515]/10 hover:bg-[#8C1515]/20 transition-colors"
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
                      <th scope="col" className="px-5 py-3.5">
                        Tiket & Tanggal
                      </th>
                      <th scope="col" className="px-5 py-3.5">
                        Pelapor
                      </th>
                      <th scope="col" className="px-5 py-3.5">
                        Lokasi & Fasilitas
                      </th>
                      <th scope="col" className="px-5 py-3.5">
                        Status & Prioritas
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-right">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentReports.map((report) => (
                      <tr
                        key={report.id}
                        className="hover:bg-gray-50/80 transition-colors group"
                      >
                        {/* Kolom Tiket & Tanggal */}
                        <td className="px-5 py-4 align-top">
                          <span className="font-mono font-bold text-xs text-[#8C1515] block group-hover:underline">
                            {report.id}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
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
                            <MapPin className="w-3.5 h-3.5 text-[#8C1515] shrink-0 mt-0.5" />
                            <span>{report.lokasi}</span>
                          </div>
                          <span className="text-[11px] font-medium text-gray-500 mt-1 block">
                            {report.kampus}
                          </span>
                        </td>

                        {/* Kolom Status & Prioritas */}
                        <td className="px-5 py-4 align-top space-y-1.5">
                          <div>{getStatusBadge(report.status)}</div>
                          <div>{getPriorityBadge(report.prioritas)}</div>
                        </td>

                        {/* Kolom Aksi */}
                        <td className="px-5 py-4 align-top text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(report)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#8C1515] bg-[#8C1515]/10 hover:bg-[#8C1515] hover:text-white transition-all shadow-2xs active:scale-95"
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
                        <span className="font-mono text-xs font-bold text-[#8C1515]">
                          {report.id}
                        </span>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {report.tanggal} • {report.waktu}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(report.status)}
                      </div>
                    </div>

                    {/* Informasi Fasilitas & Kerusakan */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">
                          {report.fasilitas}
                        </h3>
                        {getPriorityBadge(report.prioritas)}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                        {report.deskripsi}
                      </p>
                    </div>

                    {/* Lokasi Kejadian */}
                    <div className="text-xs text-gray-600 flex items-start gap-1.5 bg-gray-50 p-2.5 rounded-xl">
                      <MapPin className="w-4 h-4 text-[#8C1515] shrink-0 mt-0.5" />
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
                        className="min-h-[44px] min-w-[88px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#8C1515] hover:bg-[#6e1010] active:scale-98 transition-colors shadow-xs"
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
              Halaman <span className="font-bold text-gray-800">{currentPage}</span> dari{" "}
              <span className="font-bold text-gray-800">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Tombol Sebelumnya */}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? "bg-[#8C1515] text-white shadow-xs"
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
                disabled={currentPage === totalPages || totalPages === 0}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      {/* 7. MODAL DETAIL LAPORAN (INTERAKTIF SIMULASI UI) */}
      {/* ------------------------------------------------------------- */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8C1515]/10 text-[#8C1515] flex items-center justify-center font-bold">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">
                      Rincian Tiket Laporan
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#8C1515]">
                      {selectedReport.id}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Masuk pada {selectedReport.tanggal} pukul {selectedReport.waktu} WIB
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                aria-label="Tutup modal"
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Modal Scrollable */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-sm">
              {/* Status & Prioritas Banner */}
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Status:</span>
                  {getStatusBadge(selectedReport.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Urgensi:</span>
                  {getPriorityBadge(selectedReport.prioritas)}
                </div>
              </div>

              {/* Rincian Pelapor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-gray-100 bg-white">
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Nama Pelapor</span>
                  <span className="font-semibold text-gray-900">{selectedReport.pelaporNama}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-medium">NIM / Identitas</span>
                  <span className="font-semibold text-gray-900">{selectedReport.pelaporNim} ({selectedReport.pelaporRole})</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Kategori Fasilitas</span>
                  <span className="font-semibold text-gray-900">{selectedReport.kategori} - {selectedReport.fasilitas}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Lokasi / Kampus</span>
                  <span className="font-semibold text-gray-900">{selectedReport.lokasi}</span>
                </div>
              </div>

              {/* Deskripsi Kerusakan */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Deskripsi Lengkap Kerusakan
                </h4>
                <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200/60 text-gray-800 leading-relaxed text-sm">
                  {selectedReport.deskripsi}
                </div>
              </div>

              {/* Lampiran Foto Bukti */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Lampiran Bukti Foto ({selectedReport.jumlahFoto} Foto)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="h-28 rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-2 text-center text-xs">
                    <ImageIcon className="w-6 h-6 mb-1 text-gray-400" />
                    <span>foto_bukti_1.jpg</span>
                  </div>
                  {selectedReport.jumlahFoto > 1 && (
                    <div className="h-28 rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-2 text-center text-xs">
                      <ImageIcon className="w-6 h-6 mb-1 text-gray-400" />
                      <span>foto_bukti_2.jpg</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(
                    `Simulasi navigasi ke halaman Ubah Status untuk tiket ${selectedReport.id}`
                  );
                  setSelectedReport(null);
                }}
                className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8C1515] text-white text-sm font-semibold hover:bg-[#6e1010] transition-colors shadow-xs"
              >
                Tindak Lanjuti Tiket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. FOOTER ADMIN */}
      {/* ------------------------------------------------------------- */}
      {/* <footer className="w-full bg-white border-t border-gray-200/80 py-4 px-4 sm:px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <p>© 2026 Lapor Sadhar - Universitas Sanata Dharma. Biro Layanan Umum & Sarpras.</p>
          <div className="flex items-center gap-4">
            <span>Admin Portal v1.0</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif
            </span>
          </div>
        </div>
      </footer> */}
      </div>
      )}
    </>
  );
}
