"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/components/AdminNavbar";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { NetworkErrorAlert } from "@/components/NetworkErrorAlert";
import { adminLaporanApi } from "@/lib/api";
import { formatUserFriendlyError } from "@/lib/networkError";
import { getCurrentAuthUser } from "@/lib/auth";
import { isReadOnlyAdmin } from "@/lib/admin-positions";
import {
  getFotoList,
  getFotoUrl as getBaseFotoUrl,
  getThumbnailFotoUrl,
} from "@/lib/laporanPhoto";
import {
  Search,
  FileText,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Loader2,
  Paperclip,
  X,
  MapPin,
  Edit3,
  AlertCircle,
  ShieldCheck,
  Lock,
  UserCheck,
  ZoomIn,
} from "lucide-react";

type StatusValue =
  | "Terkirim"
  | "Sedang Diverifikasi"
  | "Terverifikasi"
  | "Proses"
  | "Selesai"
  | "Ditolak";

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

const STATUS_LIST: StatusValue[] = [
  "Terkirim",
  "Sedang Diverifikasi",
  "Terverifikasi",
  "Proses",
  "Selesai",
  "Ditolak",
];

const STATUS_LABEL: Record<StatusValue, string> = {
  Terkirim: "Terkirim",
  "Sedang Diverifikasi": "Sedang Diverifikasi",
  Terverifikasi: "Terverifikasi",
  Proses: "Diproses",
  Selesai: "Selesai",
  Ditolak: "Ditolak",
};

const BULAN_OPTIONS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function normalizeStatus(value?: string): StatusValue {
  const status = (value ?? "Terkirim").trim().toLowerCase();

  if (status === "sedang diverifikasi") return "Sedang Diverifikasi";
  if (status === "terverifikasi" || status === "diverifikasi")
    return "Terverifikasi";
  if (status === "proses" || status === "diproses") return "Proses";
  if (status === "selesai") return "Selesai";
  if (status === "ditolak") return "Ditolak";

  return "Terkirim";
}

function getAllowedStatuses(current: StatusValue): StatusValue[] {
  if (current === "Selesai" || current === "Ditolak") {
    return [current];
  }

  const nextStatus: Partial<Record<StatusValue, StatusValue>> = {
    Terkirim: "Sedang Diverifikasi",
    "Sedang Diverifikasi": "Terverifikasi",
    Terverifikasi: "Proses",
    Proses: "Selesai",
  };

  const allowed: StatusValue[] = [current];

  if (nextStatus[current]) {
    allowed.push(nextStatus[current]!);
  }

  allowed.push("Ditolak");
  return allowed;
}

function getStatusBadgeStyle(status: StatusValue): {
  badge: string;
  dot: string;
} {
  switch (status) {
    case "Terkirim":
      return {
        badge: "bg-blue-100 text-blue-700 border-blue-200",
        dot: "bg-blue-600",
      };
    case "Sedang Diverifikasi":
      return {
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        dot: "bg-amber-600",
      };
    case "Terverifikasi":
      return {
        badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
        dot: "bg-indigo-600",
      };
    case "Proses":
      return {
        badge: "bg-purple-100 text-[#7A0C0C] border-purple-200",
        dot: "bg-[#7A0C0C]",
      };
    case "Selesai":
      return {
        badge: "bg-green-100 text-green-700 border-green-200",
        dot: "bg-green-600",
      };
    case "Ditolak":
      return {
        badge: "bg-red-100 text-red-700 border-red-200",
        dot: "bg-red-600",
      };
  }
}

function getRiwayatStatus(item: RiwayatStatus): string {
  return item.status_laporan ?? item.status ?? "Terkirim";
}

function getRiwayatTanggal(item: RiwayatStatus): string {
  return item.tanggal_merubah ?? item.tanggal ?? "";
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

function formatTanggalDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

export default function AdminRiwayatLaporanPage() {
  const router = useRouter();
  const [isRestrictedRole] = useState(() => isReadOnlyAdmin(getCurrentAuthUser()));
  const [adminUser, setAdminUser] = useState({
    nama: "Admin Lapor Sadhar",
    role: "Administrator",
  });

  useEffect(() => {
    if (isRestrictedRole) {
      router.replace("/admin/prioritas");
    }
  }, [isRestrictedRole, router]);

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
  const [fetchError, setFetchError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterKampus, setFilterKampus] = useState("Semua Kampus");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterBulan, setFilterBulan] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [selectedDetail, setSelectedDetail] = useState<LaporanItem | null>(null);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [statusBaru, setStatusBaru] = useState<StatusValue>("Terkirim");
  const [pesanTanggapan, setPesanTanggapan] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  const selectedFotoList = useMemo(() => {
    if (!selectedDetail) return [];
    return getFotoList(selectedDetail.foto)
      .map(resolveFotoUrl)
      .filter((url) => url.length > 0);
  }, [selectedDetail]);

  const checkCanEditStatus = useCallback(
    (laporan: LaporanItem): boolean => {
      const role = (adminUser.role || "").trim().toLowerCase();

      // 1. Akses penuh semua unit & semua kampus
      if (
        role.includes("wakil rektor") ||
        role.includes("wr ii") ||
        role.includes("administrator")
      ) {
        return true;
      }

      const kategori = (laporan.kategori_laporan || "").trim().toLowerCase();
      const isBPS =
        kategori === "bps" || kategori.includes("fasilitas");
      const isBLU =
        kategori === "blu" || kategori.includes("kebersihan");

      // Deteksi unit pada nama role
      const roleIsBPS =
        /\bbps\b/i.test(role) ||
        role.includes("sarana") ||
        role.includes("prasarana");
      const roleIsBLU =
        /\bblu\b/i.test(role) || role.includes("layanan umum");

      if (!roleIsBPS && !roleIsBLU) return false;
      if (roleIsBPS && !isBPS) return false;
      if (roleIsBLU && !isBLU) return false;

      // Deteksi pembatasan kampus pada nama role (misal: "BPS 3" atau "BPS Kampus III")
      const roleKampus1 = /\b(kampus\s*)?(i|1)\b/i.test(role);
      const roleKampus2 = /\b(kampus\s*)?(ii|2)\b/i.test(role);
      const roleKampus3 = /\b(kampus\s*)?(iii|3)\b/i.test(role);
      const roleKampus4 = /\b(kampus\s*)?(iv|4)\b/i.test(role);

      const punyaBatasanKampus =
        roleKampus1 || roleKampus2 || roleKampus3 || roleKampus4;

      // 2. Jika Kepala Biro (tidak terikat nomor kampus), boleh akses semua kampus sesuai unitnya
      if (!punyaBatasanKampus) {
        return true;
      }

      // 3. Jika Kepala Bagian / Staf kampus tertentu, cocokkan dengan lokasi kejadian laporan
      const lokasi = (laporan.lokasi || "").toLowerCase();
      const lokasiKampus1 = /\bkampus\s*(i|1)\b|\bmrican\b/i.test(lokasi);
      const lokasiKampus2 = /\bkampus\s*(ii|2)\b|\bmrican\b/i.test(lokasi);
      const lokasiKampus3 = /\bkampus\s*(iii|3)\b|\bpaingan\b/i.test(lokasi);
      const lokasiKampus4 = /\bkampus\s*(iv|4)\b/i.test(lokasi);

      if (roleKampus1 && lokasiKampus1) return true;
      if (roleKampus2 && lokasiKampus2) return true;
      if (roleKampus3 && lokasiKampus3) return true;
      if (roleKampus4 && lokasiKampus4) return true;

      return false;
    },
    [adminUser.role]
  );

  const fetchAllLaporanAdmin = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await adminLaporanApi.getAll();
      const data = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.laporan)
            ? res.laporan
            : [];

      const normalizedData: LaporanItem[] = (data as LaporanItem[])
        .map((item) => ({
          ...item,
          status_terkini: normalizeStatus(
            item.status_terkini ?? item.status_laporan
          ),
          riwayat_status: Array.isArray(item.riwayat_status)
            ? item.riwayat_status
            : [],
        }))
        .sort((a, b) => b.id_laporan - a.id_laporan);

      setLaporanList(normalizedData);

      setSelectedDetail((prev) => {
        if (!prev) return null;
        return (
          normalizedData.find((item) => item.id_laporan === prev.id_laporan) ??
          null
        );
      });
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
  }, []);

  useEffect(() => {
    if (isRestrictedRole) return;
    fetchAllLaporanAdmin();
  }, [fetchAllLaporanAdmin, isRestrictedRole]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterKampus, filterStatus, filterKategori, filterBulan]);

  const totalLaporan = laporanList.length;
  const masukCount = laporanList.filter(
    (l) => normalizeStatus(l.status_terkini) === "Terkirim"
  ).length;
  const diprosesCount = laporanList.filter((l) =>
    ["Sedang Diverifikasi", "Terverifikasi", "Proses"].includes(
      normalizeStatus(l.status_terkini)
    )
  ).length;
  const selesaiCount = laporanList.filter(
    (l) => normalizeStatus(l.status_terkini) === "Selesai"
  ).length;

  const filteredList = useMemo(() => {
    return laporanList.filter((item) => {
      const searchLow = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === "" ||
        (item.deskripsi && item.deskripsi.toLowerCase().includes(searchLow)) ||
        (item.lokasi && item.lokasi.toLowerCase().includes(searchLow)) ||
        (item.nim && item.nim.toLowerCase().includes(searchLow)) ||
        String(item.id_laporan).includes(searchLow);

      const itemStatus = normalizeStatus(
        item.status_terkini ?? item.status_laporan
      );
      const matchesStatus =
        filterStatus === "Semua" ||
        itemStatus === normalizeStatus(filterStatus);
      const matchesKategori =
        filterKategori === "Semua" || item.kategori_laporan === filterKategori;

      let matchesKampus = true;
      if (filterKampus !== "Semua Kampus") {
        const lokasi = (item.lokasi || "").toLowerCase();
        if (filterKampus === "Kampus I") {
          matchesKampus = /\bkampus\s*(i|1)\b/i.test(lokasi);
        } else if (filterKampus === "Kampus II") {
          matchesKampus = /\bkampus\s*(ii|2)\b/i.test(lokasi);
        } else if (filterKampus === "Kampus III") {
          matchesKampus = /\bkampus\s*(iii|3)\b/i.test(lokasi);
        } else if (filterKampus === "Kampus IV") {
          matchesKampus = /\bkampus\s*(iv|4)\b/i.test(lokasi);
        } else {
          matchesKampus = lokasi.includes(filterKampus.toLowerCase());
        }
      }

      let matchesBulan = true;
      if (filterBulan !== "Semua") {
        const rawTanggal = (
          item.tanggal_buat ||
          item.tanggal_kejadian ||
          ""
        ).trim();
        if (!rawTanggal) {
          matchesBulan = false;
        } else {
          const matchIso = rawTanggal.match(/^\d{4}-(\d{2})/);
          if (matchIso) {
            matchesBulan = matchIso[1] === filterBulan;
          } else {
            const parsedDate = new Date(rawTanggal);
            matchesBulan = !Number.isNaN(parsedDate.getTime())
              ? String(parsedDate.getMonth() + 1).padStart(2, "0") === filterBulan
              : false;
          }
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesKategori &&
        matchesKampus &&
        matchesBulan
      );
    });
  }, [
    laporanList,
    searchTerm,
    filterStatus,
    filterKategori,
    filterKampus,
    filterBulan,
  ]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedData = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderStatusBadge = (rawStatus?: string) => {
    const status = normalizeStatus(rawStatus);
    const style = getStatusBadgeStyle(status);

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
        {STATUS_LABEL[status]}
      </span>
    );
  };

  const statusSekarang = normalizeStatus(
    selectedDetail?.status_terkini ?? selectedDetail?.status_laporan
  );
  const pilihanStatus = getAllowedStatuses(statusSekarang);

  const handleUpdateStatus = async () => {
    if (!selectedDetail || !statusBaru) return;

    if (!checkCanEditStatus(selectedDetail)) {
      setModalError(
        "Anda tidak memiliki hak akses untuk mengubah status laporan ini."
      );
      return;
    }

    if (statusBaru === "Ditolak" && !pesanTanggapan.trim()) {
      setModalError(
        "Isi alasan penolakan sebelum menyimpan status Ditolak."
      );
      return;
    }

    if (
      statusBaru !== statusSekarang &&
      !pilihanStatus.includes(statusBaru)
    ) {
      setModalError("Perubahan status tidak sesuai urutan yang diperbolehkan.");
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

      setModalSuccess("Status laporan berhasil diperbarui.");
      await fetchAllLaporanAdmin();
    } catch (err) {
      setModalError(
        formatUserFriendlyError(
          err,
          "submit",
          "Gagal memperbarui status laporan. Silakan coba lagi."
        )
      );
    } finally {
      setUpdateLoading(false);
    }
  };

  const stepsProgres: { key: StatusValue; label: string; num: number }[] = [
    { key: "Terkirim", label: "Terkirim", num: 1 },
    { key: "Sedang Diverifikasi", label: "Sedang Diverifikasi", num: 2 },
    { key: "Terverifikasi", label: "Terverifikasi", num: 3 },
    { key: "Proses", label: "Diproses", num: 4 },
    { key: "Selesai", label: "Selesai", num: 5 },
  ];

  if (isRestrictedRole) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-[#F3F4F6] font-sans text-slate-800 flex flex-col">
      <AdminNavbar
        adminName={adminUser.nama}
        adminRole={adminUser.role}
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

          {/* Banner Error Koneksi / Gagal Memuat */}
          {fetchError && (
            <NetworkErrorAlert
              message={fetchError}
              onRetry={() => void fetchAllLaporanAdmin()}
              retrying={loading}
              onDismiss={() => setFetchError("")}
            />
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  TOTAL KESELURUHAN
                </p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                  {totalLaporan}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Laporan terdaftar
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#7A0C0C] flex items-center justify-center border border-red-100 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  LAPORAN MASUK
                </p>
                <h3 className="text-2xl font-extrabold text-blue-600 mt-1">
                  {masukCount}
                </h3>
                <p className="text-[11px] text-blue-600/80 mt-1">
                  Status: Terkirim
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  SEDANG DITANGANI
                </p>
                <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
                  {diprosesCount}
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
                  SELESAI DITANGANI
                </p>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {selesaiCount}
                </h3>
                <p className="text-[11px] text-emerald-600/80 mt-1">
                  Masalah Tuntas
                </p>
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
                <option value="Kampus IV">Kampus IV (Kentungan)</option>
              </select>

              <select
                value={filterBulan}
                onChange={(e) => setFilterBulan(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Semua">Bulan: Semua Bulan</option>
                {BULAN_OPTIONS.map((bln) => (
                  <option key={bln.value} value={bln.value}>
                    {bln.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Semua">Status: Semua</option>
                {STATUS_LIST.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </select>

              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="Semua">Unit: Semua Unit</option>
                <option value="Fasilitas">Fasilitas (BPS)</option>
                <option value="Kebersihan">Kebersihan (BLU)</option>
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
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">
                      Unit/Kategori
                    </th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">
                      Status saat ini
                    </th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-center">
                      Akses Kelola
                    </th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">
                      Aksi Admin
                    </th>
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
                        <tr
                          key={lap.id_laporan}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="px-4 py-3.5 align-middle whitespace-nowrap text-xs text-slate-500">
                            <span className="font-bold text-slate-900 block">
                              NIM: {lap.nim || "-"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ID Laporan #{lap.id_laporan}
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
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                                lap.kategori_laporan === "Fasilitas"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {lap.kategori_laporan} (
                              {lap.kategori_laporan === "Fasilitas" ? "BPS" : "BLU"})
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                            {renderStatusBadge(
                              lap.status_terkini ?? lap.status_laporan
                            )}
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
                                setStatusBaru(
                                  normalizeStatus(
                                    lap.status_terkini ?? lap.status_laporan
                                  )
                                );
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
                Menampilkan{" "}
                {paginatedData.length > 0
                  ? (currentPage - 1) * itemsPerPage + 1
                  : 0}{" "}
                - {Math.min(currentPage * itemsPerPage, filteredList.length)} dari{" "}
                {filteredList.length} total laporan admin
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
                {renderStatusBadge(statusSekarang)}
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
                    <span>Perbarui Status Laporan</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pilih status berikutnya sesuai tahapan penanganan laporan.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {STATUS_LIST.map((status) => {
                      const diizinkan = pilihanStatus.includes(status);
                      const dipilih = statusBaru === status;

                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={!diizinkan || updateLoading}
                          onClick={() => setStatusBaru(status)}
                          className={`rounded-xl border p-3 text-left transition ${
                            dipilih
                              ? "border-purple-500 bg-[#7A0C0C]/5 ring-2 ring-purple-100"
                              : "border-slate-200 bg-white"
                          } ${
                            !diizinkan
                              ? "cursor-not-allowed opacity-40"
                              : "hover:border-[#7A0C0C]/40 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                                dipilih
                                  ? "border-[#7A0C0C] bg-[#7A0C0C] text-white"
                                  : "border-slate-300"
                              }`}
                            >
                              {dipilih ? "✓" : ""}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {STATUS_LABEL[status]}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {(statusBaru === "Ditolak" ||
                    statusBaru !== statusSekarang) && (
                    <div className="rounded-xl bg-amber-100/70 border border-amber-200 p-3 text-xs leading-5 text-amber-900">
                      {statusBaru === "Ditolak"
                        ? "Alasan penolakan wajib diisi agar pelapor mengetahui penyebab laporan ditolak."
                        : `Status akan diubah dari ${STATUS_LABEL[statusSekarang]} menjadi ${STATUS_LABEL[statusBaru]}.`}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pesan Tanggapan Admin{" "}
                      {statusBaru === "Ditolak" && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <textarea
                      rows={3}
                      value={pesanTanggapan}
                      onChange={(e) => setPesanTanggapan(e.target.value)}
                      maxLength={2000}
                      placeholder="Tuliskan hasil verifikasi, tindak lanjut, atau alasan penolakan..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 outline-none focus:border-[#7A0C0C] resize-y"
                    />
                    <p className="mt-1 text-right text-[11px] text-slate-400">
                      {pesanTanggapan.length}/2000 karakter
                    </p>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <button
                      type="button"
                      disabled={updateLoading}
                      onClick={() => {
                        setStatusBaru(statusSekarang);
                        setPesanTanggapan(selectedDetail.pesan_tanggapan || "");
                        setModalError("");
                        setModalSuccess("");
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                    >
                      Batalkan Perubahan
                    </button>

                    <button
                      type="button"
                      onClick={handleUpdateStatus}
                      disabled={
                        updateLoading ||
                        (statusBaru === statusSekarang &&
                          pesanTanggapan.trim() ===
                            (selectedDetail.pesan_tanggapan || "").trim())
                      }
                      className="px-5 py-2 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {updateLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Simpan Perubahan</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 flex items-center gap-2.5 text-slate-600 text-xs">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Role Anda (<strong>{adminUser.role}</strong>) hanya memiliki
                    hak akses untuk <strong>melihat laporan ini</strong> dan
                    tidak dapat mengubah statusnya.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">
                    NIM / Nama Pelapor
                  </p>
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
                    {selectedDetail.kategori_laporan === "Fasilitas"
                      ? "BPS"
                      : "BLU"}
                    )
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">
                    Tanggal Kejadian
                  </p>
                  <p className="font-bold text-slate-800">
                    {formatTanggalLong(selectedDetail.tanggal_kejadian)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">
                    Tanggal Dibuat
                  </p>
                  <p className="font-bold text-slate-800">
                    {formatTanggalLong(selectedDetail.tanggal_buat)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium mb-0.5">
                    Lokasi Kejadian
                  </p>
                  <p className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{selectedDetail.lokasi || "-"}</span>
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-medium mb-1.5">
                  Deskripsi Masalah
                </p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-slate-700 text-xs sm:text-sm leading-relaxed">
                  {selectedDetail.deskripsi}
                </div>
              </div>

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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-400 font-medium">
                    Foto Bukti Pendukung
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
                          onClick={() => setPreviewPhotoIndex(idx)}
                          className="block w-full relative group cursor-zoom-in focus:outline-none"
                          title="Klik untuk memperbesar foto"
                        >
                          <img
                            src={getThumbnailFotoUrl(fotoUrl, 640)}
                            alt={`Foto pendukung laporan ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full max-h-64 object-contain rounded-xl transition-opacity group-hover:opacity-90"
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

                        <div className="hidden w-full flex-col items-center justify-center py-8 px-4 text-center gap-2.5 rounded-xl border border-dashed border-slate-200 bg-white">
                          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200/80">
                            <Paperclip className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700">
                              Gambar tidak dapat dimuat
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Pratinjau gagal ditampilkan langsung di halaman ini
                            </p>
                          </div>
                          {!fotoUrl.startsWith("data:") && (
                            <a
                              href={fotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#7A0C0C] border border-red-200/80 text-[11px] font-bold transition-colors"
                            >
                              <span>Buka Tautan Foto Asli</span>
                              <span>↗</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs italic text-center">
                    Pelapor tidak mengunggah foto pendukung.
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#7A0C0C]" />
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">
                    Progres Penanganan Laporan
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {stepsProgres.map((st) => {
                    const isCurrent = statusSekarang === st.key;
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

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#7A0C0C]" />
                    <p className="font-bold text-slate-800 text-xs sm:text-sm">
                      Riwayat Status
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {(selectedDetail.riwayat_status ?? []).length} catatan
                  </span>
                </div>

                {(selectedDetail.riwayat_status ?? []).length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 border border-slate-100">
                    Belum ada riwayat status yang tersedia.
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {[...(selectedDetail.riwayat_status ?? [])]
                      .sort((a, b) => {
                        const tanggalA = new Date(
                          getRiwayatTanggal(a) || 0
                        ).getTime();
                        const tanggalB = new Date(
                          getRiwayatTanggal(b) || 0
                        ).getTime();
                        return tanggalA - tanggalB;
                      })
                      .map((item, index, arr) => {
                        const itemStatus = normalizeStatus(
                          getRiwayatStatus(item)
                        );

                        return (
                          <li
                            key={
                              item.id_status ??
                              `${getRiwayatTanggal(item)}-${index}`
                            }
                            className="flex gap-3"
                          >
                            <div className="flex flex-col items-center">
                              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#7A0C0C] ring-4 ring-[#7A0C0C]/15" />
                              {index < arr.length - 1 && (
                                <span className="mt-1.5 min-h-6 w-px flex-1 bg-slate-200" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 pb-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {renderStatusBadge(itemStatus)}
                                <span className="text-[11px] text-slate-400">
                                  {formatTanggalDateTime(
                                    getRiwayatTanggal(item)
                                  )}
                                </span>
                              </div>

                              {item.keterangan && (
                                <p className="mt-1.5 text-xs leading-5 text-slate-600">
                                  {item.keterangan}
                                </p>
                              )}

                              {item.pesan && (
                                <p className="mt-1.5 text-xs leading-5 text-slate-600">
                                  {item.pesan}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ol>
                )}
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

      {/* Lightbox Pratinjau Foto Ukuran Tetap */}
      <ImagePreviewModal
        images={selectedFotoList}
        activeIndex={selectedDetail ? previewPhotoIndex : null}
        onClose={() => setPreviewPhotoIndex(null)}
        onChangeIndex={setPreviewPhotoIndex}
        titlePrefix="Foto Bukti"
      />

      <footer className="border-t border-slate-200 bg-white py-4 text-center mt-auto">
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} Lapor Sadhar — Universitas Sanata Dharma. Hak cipta dilindungi.
        </p>
      </footer>
    </div>
  );
}