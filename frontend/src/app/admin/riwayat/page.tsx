"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { adminLaporanApi } from "@/lib/api";
import { getCurrentAuthUser } from "@/lib/auth";
import { LOKASI_KAMPUS_OPTIONS, resolveLokasiKampus } from "@/lib/laporanCampus";
import {
  KATEGORI_LAPORAN_OPTIONS,
  isCampusScopedAdmin,
  isWakilRektorII,
  normalizeKategoriLaporan,
  resolveAdminCampus,
} from "@/lib/admin-positions";
import { getFotoList, getFotoUrl } from "@/lib/laporanPhoto";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  MapPin,
  Edit3,
  Lock,
  Clock,
  ChevronDown,
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
  lokasi_kampus?: string | null;
  lokasi: string;
  foto?: string | string[] | null;
  pesan_tanggapan?: string | null;
  status_terkini: string;
  status_laporan?: string;
  riwayat_status?: RiwayatStatus[];
}

function formatTanggalTicket(dateStr?: string | null): string {
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
    const month = months[d.getMonth()] || "Okt";
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
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

function parseLokasiDanFasilitas(
  lokasi?: string,
  deskripsi?: string,
  lokasiKampus?: string | null,
) {
  const kampus = resolveLokasiKampus(lokasiKampus, lokasi);

  if (!lokasi) {
    return {
      kampus,
      detail: deskripsi || "Sarana Prasarana",
    };
  }

  let detail = lokasi;
  if (deskripsi) {
    detail = `${lokasi} (${deskripsi})`;
  }

  return { kampus, detail };
}

function formatPelaporRole(lap: LaporanItem): string {
  if (lap.nim) {
    if (lap.nim.length >= 12) {
      return `Dosen / Pegawai • ${lap.nim}`;
    }
    return `Mahasiswa • ${lap.nim}`;
  }
  return "Civitas USD";
}

export default function AdminRiwayatLaporanPage() {
  const [adminUser] = useState(() => {
    const currentUser = getCurrentAuthUser();
    return {
      nama: currentUser?.nama || currentUser?.username || "Admin",
      role: currentUser?.jabatan_label || currentUser?.jabatan || "Administrator",
      roleDetail: currentUser?.role_detail || "",
      campus: currentUser?.campus || "",
      jabatan: currentUser?.jabatan || "",
      jabatanLabel: currentUser?.jabatan_label || "",
      username: currentUser?.username || "",
    };
  });

  const adminIdentity = useMemo(
    () => ({
      campus: adminUser.campus,
      role_detail: adminUser.roleDetail,
      jabatan: adminUser.jabatan,
      jabatan_label: adminUser.jabatanLabel || adminUser.role,
      username: adminUser.username,
    }),
    [adminUser],
  );
  const adminCampus = useMemo(() => resolveAdminCampus(adminIdentity), [adminIdentity]);
  const showLocationFilter = useMemo(() => !isCampusScopedAdmin(adminIdentity), [adminIdentity]);
  const isWR2 = useMemo(() => isWakilRektorII(adminIdentity), [adminIdentity]);

  const [laporanList, setLaporanList] = useState<LaporanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // State Filter Tabel
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterKampus, setFilterKampus] = useState("Semua Lokasi");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [debouncedSearchTerm, filterKampus, filterKategori, filterStatus]);

  // State Modal Detail & Ubah Status
  const [selectedDetail, setSelectedDetail] = useState<LaporanItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [statusBaru, setStatusBaru] = useState("");
  const [pesanTanggapan, setPesanTanggapan] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  // Pengecekan Hak Akses Admin berdasarkan Wewenang Unit & Kampus
  // Fasilitas -> BPS | Kebersihan -> BLU
  const checkCanEditStatus = useCallback(
    (laporan: LaporanItem): boolean => {
      const role = (adminUser.role || "").toLowerCase();
      const roleDetail = (adminUser.roleDetail || "").toUpperCase();
      const jabatan = (adminUser.jabatan || "").toLowerCase();

      if (
        roleDetail === "BOTH" ||
        jabatan === "wakil_rektor_ii" ||
        role.includes("wakil rektor ii") ||
        role.includes("wr ii") ||
        role === "administrator"
      ) {
        return true;
      }

      const isBPS = laporan.kategori_laporan === "Fasilitas" || laporan.kategori_laporan === "BPS";
      const isBLU = laporan.kategori_laporan === "Kebersihan" || laporan.kategori_laporan === "BLU";

      if (
        jabatan === "kepala_blu" ||
        role.includes("kepala biro layanan umum") ||
        role.includes("kepala blu")
      ) {
        return isBLU;
      }

      if (
        jabatan === "kepala_bps" ||
        role.includes("kepala biro sarana") ||
        role.includes("kepala biro prasarana") ||
        role.includes("kepala bps")
      ) {
        return isBPS;
      }

      const jabatanKampusMatch = jabatan.match(/_([1-4])$/) ?? role.match(/\b([1-4])\b/);
      const adminCampus =
        adminUser.campus || (jabatanKampusMatch ? `Kampus ${jabatanKampusMatch[1]}` : "");
      if (!adminCampus) {
        return false;
      }

      const reportCampus = resolveLokasiKampus(laporan.lokasi_kampus, laporan.lokasi);
      if (reportCampus !== adminCampus) {
        return false;
      }

      if (roleDetail === "BPS" || role.includes("bps")) return isBPS;
      if (roleDetail === "BLU" || role.includes("blu")) return isBLU;

      return false;
    },
    [adminUser],
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

      const sortedData = (data as LaporanItem[]).sort((a, b) => b.id_laporan - a.id_laporan);
      setLaporanList(sortedData);
    } catch (error) {
      console.error("Gagal mengambil data riwayat laporan admin:", error);
      setLaporanList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminLaporanApi
      .getAll()
      .then((res) => {
        if (!active) return;
        const data = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.laporan)
              ? res.laporan
              : [];

        const sortedData = (data as LaporanItem[]).sort((a, b) => b.id_laporan - a.id_laporan);
        setLaporanList(sortedData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Gagal mengambil data riwayat laporan admin:", err);
        if (active) {
          setLaporanList([]);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Metrik KPI Dashboard
  const totalLaporan = laporanList.length;
  const masukCount = laporanList.filter(
    (l) => l.status_terkini === "Terkirim" || l.status_terkini === "Menunggu Suku Cadang",
  ).length;
  const diprosesCount = laporanList.filter((l) =>
    [
      "Sedang Diverifikasi",
      "Terverifikasi",
      "Diverifikasi",
      "Diproses",
      "Proses",
      "Dalam Penanganan",
    ].includes(l.status_terkini),
  ).length;
  const selesaiCount = laporanList.filter(
    (l) => l.status_terkini === "Selesai" || l.status_terkini === "Selesai Ditangani",
  ).length;

  const selesaiPercentage =
    totalLaporan > 0 ? ((selesaiCount / totalLaporan) * 100).toFixed(1) : "0.0";

  // Filter Data Laporan Sesuai Kriteria
  const filteredList = useMemo(() => {
    return laporanList.filter((item) => {
      const searchLow = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        debouncedSearchTerm === "" ||
        (item.deskripsi && item.deskripsi.toLowerCase().includes(searchLow)) ||
        (item.kategori_laporan && item.kategori_laporan.toLowerCase().includes(searchLow)) ||
        (item.lokasi_kampus && item.lokasi_kampus.toLowerCase().includes(searchLow)) ||
        (item.lokasi && item.lokasi.toLowerCase().includes(searchLow)) ||
        (item.nim && item.nim.toLowerCase().includes(searchLow)) ||
        (item.nama_pelapor && item.nama_pelapor.toLowerCase().includes(searchLow)) ||
        String(item.id_laporan).includes(searchLow);

      let matchesStatus = true;
      if (filterStatus !== "Semua") {
        if (filterStatus === "Dalam Penanganan") {
          matchesStatus = [
            "Sedang Diverifikasi",
            "Terverifikasi",
            "Diverifikasi",
            "Diproses",
            "Proses",
            "Dalam Penanganan",
          ].includes(item.status_terkini);
        } else if (filterStatus === "Selesai Ditangani") {
          matchesStatus =
            item.status_terkini === "Selesai" || item.status_terkini === "Selesai Ditangani";
        } else {
          matchesStatus = item.status_terkini === filterStatus;
        }
      }

      const matchesKampus =
        !showLocationFilter ||
        filterKampus === "Semua Lokasi" ||
        resolveLokasiKampus(item.lokasi_kampus, item.lokasi) === filterKampus;

      const matchesKategori =
        !isWR2 ||
        filterKategori === "Semua" ||
        normalizeKategoriLaporan(item.kategori_laporan) === filterKategori;

      return matchesSearch && matchesStatus && matchesKampus && matchesKategori;
    });
  }, [
    laporanList,
    debouncedSearchTerm,
    filterStatus,
    showLocationFilter,
    filterKampus,
    isWR2,
    filterKategori,
  ]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedData = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleResetFilter = () => {
    setSearchTerm("");
    setFilterKampus("Semua Lokasi");
    setFilterKategori("Semua");
    setFilterStatus("Semua");
    setCurrentPage(1);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Selesai":
      case "Selesai Ditangani":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8F8F0] text-[#127A45] border border-emerald-200/60 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Selesai Ditangani
          </span>
        );
      case "Sedang Diverifikasi":
      case "Terverifikasi":
      case "Diverifikasi":
      case "Diproses":
      case "Proses":
      case "Dalam Penanganan":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF2FF] text-[#1E56B0] border border-blue-200/60 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            Dalam Penanganan
          </span>
        );
      case "Menunggu Suku Cadang":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF7E6] text-[#A26207] border border-amber-200/60 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Menunggu Suku Cadang
          </span>
        );
      case "Terkirim":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF7E6] text-[#A26207] border border-amber-200/60 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Menunggu Tindakan
          </span>
        );
      case "Ditolak":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEECEC] text-[#B02323] border border-rose-200/60 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            Ditolak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
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
        pesanTanggapan.trim(),
      );

      setModalSuccess("Status laporan berhasil diperbarui!");
      setSelectedDetail((prev) =>
        prev
          ? {
              ...prev,
              status_terkini: statusBaru,
              pesan_tanggapan: pesanTanggapan.trim() || prev.pesan_tanggapan,
            }
          : null,
      );
      fetchAllLaporanAdmin();
    } catch (err) {
      console.error(err);
      setModalError(
        err instanceof Error ? err.message : "Gagal memperbarui status laporan.",
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
    <div className="min-h-screen w-full bg-[#F8F9FA] font-sans text-slate-800 flex flex-col">
      <AdminNavbar adminName={adminUser.nama} adminRole={adminUser.role} />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Laporan */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <p className="text-xs font-medium text-slate-500">Total Laporan</p>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {totalLaporan}
                </span>
                <span className="text-xs text-slate-400">tiket</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {adminCampus || "Semua kampus USD"}
              </p>
            </div>

            {/* Card 2: Selesai */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <p className="text-xs font-medium text-slate-500">Selesai</p>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-emerald-600">
                  {selesaiCount}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {selesaiPercentage}%
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Selesai & terverifikasi</p>
            </div>

            {/* Card 3: Dalam Pengerjaan */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <p className="text-xs font-medium text-slate-500">Dalam Pengerjaan</p>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-amber-600">
                  {diprosesCount}
                </span>
                <span className="text-xs text-slate-500 font-normal">aktif</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Sedang ditangani teknisi</p>
            </div>

            {/* Card 4: Menunggu Tindakan */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <p className="text-xs font-medium text-slate-500">Menunggu Tindakan</p>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-[#7A0C0C]">
                  {masukCount}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                  Perlu Atensi
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Suku cadang / penugasan</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari ID tiket, pelapor, atau sarana..."
                className="w-full h-11 pl-10 pr-9 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10 shadow-2xs transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Lokasi (dihilangkan untuk admin masing-masing kampus) */}
            {showLocationFilter && (
              <div className="relative">
                <select
                  value={filterKampus}
                  onChange={(e) => {
                    setFilterKampus(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter berdasarkan lokasi kampus"
                  className="h-11 pl-4 pr-9 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:border-[#7A0C0C] shadow-2xs cursor-pointer appearance-none w-full sm:w-auto"
                >
                  <option value="Semua Lokasi">Semua Lokasi</option>
                  {LOKASI_KAMPUS_OPTIONS.map((kampus) => (
                    <option key={kampus} value={kampus}>
                      {kampus}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Dropdown Kategori Laporan (khusus Wakil Rektor II) */}
            {isWR2 && (
              <div className="relative">
                <select
                  value={filterKategori}
                  onChange={(e) => {
                    setFilterKategori(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter berdasarkan kategori laporan"
                  className="h-11 pl-4 pr-9 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:border-[#7A0C0C] shadow-2xs cursor-pointer appearance-none w-full sm:w-auto"
                >
                  <option value="Semua">Semua Kategori</option>
                  {KATEGORI_LAPORAN_OPTIONS.map((kategori) => (
                    <option key={kategori} value={kategori}>
                      {kategori}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Dropdown Status */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 pl-4 pr-9 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:border-[#7A0C0C] shadow-2xs cursor-pointer appearance-none w-full sm:w-auto"
              >
                <option value="Semua">Semua Status</option>
                <option value="Terkirim">Terkirim</option>
                <option value="Dalam Penanganan">Dalam Penanganan</option>
                <option value="Selesai Ditangani">Selesai Ditangani</option>
                <option value="Ditolak">Ditolak</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Tombol Reset */}
            <button
              type="button"
              onClick={handleResetFilter}
              className="h-11 px-4 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center self-end sm:self-auto"
            >
              Reset
            </button>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="bg-white border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-4 px-6 whitespace-nowrap">TIKET & TANGGAL</th>
                    <th className="py-4 px-6 whitespace-nowrap">PELAPOR</th>
                    <th className="py-4 px-6 whitespace-nowrap">LOKASI & FASILITAS</th>
                    <th className="py-4 px-6 whitespace-nowrap">STATUS</th>
                    <th className="py-4 px-6 whitespace-nowrap text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7A0C0C]" />
                        Memuat data riwayat laporan...
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400">
                        Tidak ada laporan yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((lap) => {
                      const { kampus, detail } = parseLokasiDanFasilitas(
                        lap.lokasi,
                        lap.deskripsi,
                        lap.lokasi_kampus,
                      );
                      const year = lap.tanggal_buat
                        ? new Date(lap.tanggal_buat).getFullYear()
                        : 2024;
                      const ticketId = `#TK-${year}-${lap.id_laporan}`;

                      return (
                        <tr
                          key={lap.id_laporan}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Tiket & Tanggal */}
                          <td className="py-4 px-6 align-middle whitespace-nowrap">
                            <span className="font-bold text-[#7A0C0C] text-xs sm:text-sm block">
                              {ticketId}
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              {formatTanggalTicket(lap.tanggal_buat)}
                            </span>
                          </td>

                          {/* Pelapor */}
                          <td className="py-4 px-6 align-middle whitespace-nowrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                              {lap.nama_pelapor || "Civitas USD"}
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              {formatPelaporRole(lap)}
                            </span>
                          </td>

                          {/* Lokasi & Fasilitas */}
                          <td className="py-4 px-6 align-middle">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                              {kampus}
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5 line-clamp-1 max-w-xs sm:max-w-md">
                              {detail}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6 align-middle whitespace-nowrap">
                            {renderStatusBadge(lap.status_terkini)}
                          </td>

                          {/* Aksi */}
                          <td className="py-4 px-6 align-middle text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDetail(lap);
                                setActivePhotoIndex(null);
                                setStatusBaru(lap.status_terkini);
                                setPesanTanggapan(lap.pesan_tanggapan || "");
                                setModalError("");
                                setModalSuccess("");
                              }}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                            >
                              <span>Detail</span>
                              <span>→</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-white">
              <p>
                Menampilkan{" "}
                {filteredList.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                {Math.min(currentPage * itemsPerPage, filteredList.length)} dari{" "}
                {filteredList.length} laporan
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
          </div>
        </div>
      </main>

      {/* Modal Detail & Kelola Status */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  TIKET #TK-
                  {selectedDetail.tanggal_buat
                    ? new Date(selectedDetail.tanggal_buat).getFullYear()
                    : 2024}
                  -{selectedDetail.id_laporan}
                </p>
                <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Informasi Detail & Akses Status
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge(selectedDetail.status_terkini)}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetail(null);
                    setActivePhotoIndex(null);
                  }}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Baru
                      </label>
                      <select
                        value={statusBaru}
                        onChange={(e) => setStatusBaru(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#7A0C0C]"
                      >
                        <option value="Terkirim">1. Terkirim (Menunggu Tindakan)</option>
                        <option value="Sedang Diverifikasi">2. Sedang Diverifikasi Sarpras</option>
                        <option value="Terverifikasi">3. Terverifikasi</option>
                        <option value="Diproses">4. Diproses (Dalam Penanganan)</option>
                        <option value="Selesai">5. Selesai Ditangani</option>
                        <option value="Ditolak">6. Ditolak (Tidak Valid / Duplikat)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pesan Tanggapan Admin{" "}
                        {statusBaru === "Ditolak" && <span className="text-red-500">*</span>}
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
                        type="button"
                        onClick={handleUpdateStatus}
                        disabled={
                          updateLoading ||
                          (statusBaru === selectedDetail.status_terkini &&
                            pesanTanggapan.trim() ===
                              (selectedDetail.pesan_tanggapan || ""))
                        }
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
                    Role Anda (<strong>{adminUser.role}</strong>) hanya memiliki hak akses untuk{" "}
                    <strong>melihat laporan ini</strong> dan tidak dapat mengubah statusnya.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">NIM / Nama Pelapor</p>
                  <p className="font-bold text-slate-800">
                    {selectedDetail.nim || "-"}{" "}
                    {selectedDetail.nama_pelapor
                      ? `(${selectedDetail.nama_pelapor})`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">
                    Kategori / Unit Tujuan
                  </p>
                  <p className="font-bold text-slate-800">
                    {selectedDetail.kategori_laporan} (
                    {selectedDetail.kategori_laporan === "Fasilitas" ? "BPS" : "BLU"})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Tanggal Kejadian</p>
                  <p className="font-bold text-slate-800">
                    {formatTanggalLong(selectedDetail.tanggal_kejadian)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Tanggal Dibuat</p>
                  <p className="font-bold text-slate-800">
                    {formatTanggalLong(selectedDetail.tanggal_buat)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Lokasi Kejadian</p>
                  <p className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      {selectedDetail.lokasi_kampus ? `${selectedDetail.lokasi_kampus} — ` : ""}
                      {selectedDetail.lokasi || "-"}
                    </span>
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
                  <p className="text-xs text-slate-400 font-medium mb-1.5">
                    Catatan / Tanggapan Admin
                  </p>
                  <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100 text-purple-900 text-xs sm:text-sm leading-relaxed">
                    {selectedDetail.pesan_tanggapan}
                  </div>
                </div>
              )}

              {/* Foto Bukti */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">Foto Bukti Pendukung</p>
                {(() => {
                  const detailPhotos = getFotoList(selectedDetail.foto);
                  if (detailPhotos.length === 0) {
                    return (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs italic">
                        Pelapor tidak mengunggah foto pendukung.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {detailPhotos.map((foto, index) => {
                        const url = getFotoUrl(foto);
                        return (
                          <button
                            key={`${foto}-${index}`}
                            type="button"
                            onClick={() => setActivePhotoIndex(index)}
                            className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-1 hover:border-[#7A0C0C] transition-colors cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Foto pendukung laporan ${index + 1}`}
                              className="w-full max-h-60 object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-200"
                            />
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Alur Progres Penanganan */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#7A0C0C]" />
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">
                    Progres Penanganan Laporan
                  </p>
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
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <p className="text-xs text-slate-400">Portal Admin USD</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDetail(null);
                  setActivePhotoIndex(null);
                }}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ImagePreviewModal
        images={getFotoList(selectedDetail?.foto).map(getFotoUrl)}
        activeIndex={selectedDetail ? activePhotoIndex : null}
        onClose={() => setActivePhotoIndex(null)}
        onChangeIndex={setActivePhotoIndex}
        titlePrefix="Foto Pendukung"
      />
    </div>
  );
}
