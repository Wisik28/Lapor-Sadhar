"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Layers, Lock, Trash2, UserCheck } from "lucide-react";
import AdminNavbar from "@/components/AdminNavbar";
import {
  DeleteRejectedReportModal,
  type DeleteRejectedReportTarget,
} from "@/components/DeleteRejectedReportModal";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { NetworkErrorAlert } from "@/components/NetworkErrorAlert";
import { adminLaporanApi } from "@/lib/api";
import { formatUserFriendlyError } from "@/lib/networkError";
import { getCurrentAuthUser } from "@/lib/auth";
import {
  canAdminManageLaporan,
  isReadOnlyAdmin,
} from "@/lib/admin-positions";
import { getFotoList, getFotoUrl, getThumbnailFotoUrl } from "@/lib/laporanPhoto";
import { getReporterIdentityLabel } from "@/lib/reporterIdentity";

type StatusValue =
  | "Terkirim"
  | "Sedang Diverifikasi"
  | "Terverifikasi"
  | "Proses"
  | "Selesai"
  | "Ditolak";

type RiwayatStatus = {
  id_status?: number;
  status_laporan?: string;
  status?: string;
  tanggal_merubah?: string;
  tanggal?: string;
  keterangan?: string;
  pesan?: string;
};

type Laporan = {
  id_laporan: number;
  nim?: string;
  nama_pelapor?: string;
  kategori_laporan?: string;
  deskripsi?: string;
  tanggal_kejadian?: string;
  tanggal_buat?: string;
  tanggal_rubah?: string;
  lokasi?: string;
  lokasi_kampus?: string;
  foto?: string | string[] | null;
  pesan_tanggapan?: string | null;
  status_terkini?: string;
  status_laporan?: string;
  riwayat_status?: RiwayatStatus[];
  group_id?: number | null;
  group_member_count?: number;
  group_unique_reporters?: number;
  group_primary_laporan_id?: number | null;
  is_group_escalated?: boolean;
};

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
  "Sedang Diverifikasi": "Diverifikasi",
  Terverifikasi: "Terverifikasi",
  Proses: "Diproses",
  Selesai: "Selesai",
  Ditolak: "Ditolak",
};

const BULAN_LIST = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function getTanggalLaporan(value?: string): Date | null {
  if (!value) return null;

  const teks = value.trim();
  if (!teks) return null;

  const tanggalISO = teks.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/
  );

  if (tanggalISO) {
    const tahun = Number(tanggalISO[1]);
    const bulan = Number(tanggalISO[2]);
    const hari = Number(tanggalISO[3]);

    const tanggal = new Date(tahun, bulan - 1, hari);

    if (
      tanggal.getFullYear() !== tahun ||
      tanggal.getMonth() !== bulan - 1 ||
      tanggal.getDate() !== hari
    ) {
      return null;
    }

    return tanggal;
  }

  const tanggal = new Date(teks);
  return Number.isNaN(tanggal.getTime()) ? null : tanggal;
}

function getKategoriFilter(kategori?: string): string {
  const nilai = (kategori ?? "").trim().toLowerCase();

  if (nilai.includes("kebersihan")) return "Kebersihan";
  if (nilai.includes("fasilitas")) return "Fasilitas";

  return "Lainnya";
}

function normalizeStatus(value?: string): StatusValue {
  const status = (value ?? "Terkirim").trim().toLowerCase();

  if (status === "sedang diverifikasi" || status === "diverifikasi")
    return "Sedang Diverifikasi";
  if (status === "terverifikasi")
    return "Terverifikasi";
  if (status === "proses" || status === "diproses") return "Proses";
  if (status === "selesai") return "Selesai";
  if (status === "ditolak") return "Ditolak";

  return "Terkirim";
}

function formatTanggal(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    dateStyle: "medium",
  });
}

function formatTanggalWaktu(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusColor(status: StatusValue) {
  switch (status) {
    case "Terkirim":
      return "bg-blue-100 text-blue-700";
    case "Sedang Diverifikasi":
      return "bg-amber-100 text-amber-700";
    case "Terverifikasi":
      return "bg-indigo-100 text-indigo-700";
    case "Proses":
      return "bg-purple-100 text-[#7A0C0C]";
    case "Selesai":
      return "bg-green-100 text-green-700";
    case "Ditolak":
      return "bg-red-100 text-red-700";
  }
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

function getRiwayatStatus(item: RiwayatStatus): string {
  return item.status_laporan ?? item.status ?? "Terkirim";
}

function getRiwayatTanggal(item: RiwayatStatus): string {
  return item.tanggal_merubah ?? item.tanggal ?? "";
}

function getStatusUpdateErrorMessage(err: unknown): string {
  return formatUserFriendlyError(
    err,
    "submit",
    "Gagal menyimpan pembaruan. Silakan coba kembali."
  );
}

function UbahStatusLaporanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRestrictedRole] = useState(() => isReadOnlyAdmin(getCurrentAuthUser()));
  const rawIdParam = searchParams.get("id");
  const requestedReportId = useMemo(() => {
    if (!rawIdParam) return null;
    const parsed = Number(rawIdParam);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [rawIdParam]);
  const isDirectReportMode = requestedReportId !== null;

  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [laporanTerpilih, setLaporanTerpilih] =
    useState<Laporan | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [deletedReportId, setDeletedReportId] = useState<number | null>(null);

  useEffect(() => {
    if (isRestrictedRole) {
      router.replace("/admin/prioritas");
    }
  }, [isRestrictedRole, router]);

  const [authUser] = useState(() => getCurrentAuthUser());
  const [adminName] = useState(
    () => authUser?.nama || authUser?.username || "Admin"
  );
  const [adminRole] = useState(
    () => authUser?.jabatan_label || authUser?.jabatan || "Administrator"
  );

  const [pencarian, setPencarian] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterBulan, setFilterBulan] = useState("Semua");
  const [filterTahun, setFilterTahun] = useState("Semua");

  const [statusBaru, setStatusBaru] = useState<StatusValue>("Terkirim");
  const [pesanTanggapan, setPesanTanggapan] = useState("");

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState("");
  const [sukses, setSukses] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteRejectedReportTarget | null>(null);

  const checkCanEditStatus = useCallback(
    (item: Laporan): boolean => canAdminManageLaporan(authUser, item),
    [authUser]
  );

  const muatLaporan = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await adminLaporanApi.getAll();

      const data = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.laporan)
            ? response.laporan
            : [];

      const daftar: Laporan[] = data.map((item: Laporan) => ({
        ...item,
        status_terkini: normalizeStatus(
          item.status_terkini ?? item.status_laporan
        ),
        riwayat_status: Array.isArray(item.riwayat_status)
          ? item.riwayat_status
          : [],
      }));

      setLaporan(daftar);

      let nextSelected: Laporan | null = null;
      if (requestedReportId !== null) {
        nextSelected =
          daftar.find((item) => item.id_laporan === requestedReportId) ?? null;
        setLaporanTerpilih(nextSelected);
        if (!nextSelected) {
          setError(
            `Laporan #${requestedReportId} tidak ditemukan atau berada di luar cakupan wilayah kelola Anda.`
          );
        }
      } else {
        setLaporanTerpilih((sebelumnya) => {
          if (!sebelumnya) return null;

          nextSelected =
            daftar.find((item) => item.id_laporan === sebelumnya.id_laporan) ??
            null;
          return nextSelected;
        });
      }

      if (nextSelected) {
        setStatusBaru(
          normalizeStatus(
            nextSelected.status_terkini ?? nextSelected.status_laporan
          )
        );
        setPesanTanggapan(nextSelected.pesan_tanggapan ?? "");
      }
    } catch (err) {
      setError(
        formatUserFriendlyError(
          err,
          "load",
          "Gagal memuat data laporan. Silakan coba lagi."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [requestedReportId]);

  useEffect(() => {
    if (isRestrictedRole) return;
    let aktif = true;

    const ambilData = async () => {
      setError("");

      try {
        const response = await adminLaporanApi.getAll();

        const data = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.laporan)
              ? response.laporan
              : [];

        if (!aktif) return;

        const daftar: Laporan[] = data.map((item: Laporan) => ({
          ...item,
          status_terkini: normalizeStatus(
            item.status_terkini ?? item.status_laporan
          ),
          riwayat_status: Array.isArray(item.riwayat_status)
            ? item.riwayat_status
            : [],
        }));

        setLaporan(daftar);

        if (requestedReportId !== null) {
          const matched =
            daftar.find((item) => item.id_laporan === requestedReportId) ?? null;
          setLaporanTerpilih(matched);
          if (matched) {
            setStatusBaru(
              normalizeStatus(matched.status_terkini ?? matched.status_laporan)
            );
            setPesanTanggapan(matched.pesan_tanggapan ?? "");
          } else {
            setError(
              `Laporan #${requestedReportId} tidak ditemukan atau berada di luar cakupan wilayah kelola Anda.`
            );
          }
        } else {
          setLaporanTerpilih((sebelumnya) => {
            if (!sebelumnya) return null;

            return (
              daftar.find(
                (item) => item.id_laporan === sebelumnya.id_laporan
              ) ?? null
            );
          });
        }
      } catch (err) {
        if (!aktif) return;

        setError(
          formatUserFriendlyError(
            err,
            "load",
            "Gagal memuat data laporan. Silakan coba lagi."
          )
        );
      } finally {
        if (aktif) setLoading(false);
      }
    };

    void ambilData();

    const handleNotificationRefresh = (event: Event) => {
      const custom = event as CustomEvent<{ idLaporan?: number }>;
      if (
        requestedReportId !== null &&
        custom.detail?.idLaporan === requestedReportId
      ) {
        void muatLaporan();
      }
    };
    window.addEventListener("lapor-sadhar:open-report", handleNotificationRefresh);

    return () => {
      aktif = false;
      window.removeEventListener(
        "lapor-sadhar:open-report",
        handleNotificationRefresh
      );
    };
  }, [isRestrictedRole, requestedReportId, muatLaporan]);

  const daftarTahun = useMemo(() => {
    const tahun = laporan
      .map((item) => getTanggalLaporan(item.tanggal_buat))
      .filter((tanggal): tanggal is Date => tanggal !== null)
      .map((tanggal) => tanggal.getFullYear());

    return Array.from(new Set(tahun)).sort((a, b) => b - a);
  }, [laporan]);

  const laporanTersaring = useMemo(() => {
    const keyword = pencarian.trim().toLowerCase();

    return laporan.filter((item) => {
      const status = normalizeStatus(
        item.status_terkini ?? item.status_laporan
      );

      const cocokStatus =
        filterStatus === "Semua" ||
        status === normalizeStatus(filterStatus);

      const kategori = getKategoriFilter(item.kategori_laporan);

      const cocokKategori =
        filterKategori === "Semua" ||
        kategori === filterKategori;

      const tanggalLaporan = getTanggalLaporan(item.tanggal_buat);

      const cocokBulan =
        filterBulan === "Semua" ||
        (tanggalLaporan !== null &&
          tanggalLaporan.getMonth() + 1 === Number(filterBulan));

      const cocokTahun =
        filterTahun === "Semua" ||
        (tanggalLaporan !== null &&
          tanggalLaporan.getFullYear() === Number(filterTahun));

      const teks = [
        item.id_laporan,
        item.nim,
        item.nama_pelapor,
        item.kategori_laporan,
        item.lokasi,
        item.deskripsi,
      ]
        .join(" ")
        .toLowerCase();

      const cocokPencarian = !keyword || teks.includes(keyword);

      return (
        cocokStatus &&
        cocokKategori &&
        cocokBulan &&
        cocokTahun &&
        cocokPencarian
      );
    });
  }, [
    laporan,
    pencarian,
    filterStatus,
    filterKategori,
    filterBulan,
    filterTahun,
  ]);

  const statistik = useMemo(() => {
    const jumlahStatus = (status: StatusValue) =>
      laporan.filter(
        (item) =>
          normalizeStatus(
            item.status_terkini ?? item.status_laporan
          ) === status
      ).length;
    const jumlahSudahTerverifikasi = laporan.filter((item) =>
      ["Terverifikasi", "Proses", "Selesai"].includes(
        normalizeStatus(item.status_terkini ?? item.status_laporan)
      )
    ).length;

    return {
      total: laporan.length,
      terkirim: jumlahStatus("Terkirim"),
      terverifikasi: jumlahSudahTerverifikasi,
      proses: jumlahStatus("Proses"),
      selesai: jumlahStatus("Selesai"),
      ditolak: jumlahStatus("Ditolak"),
    };
  }, [laporan]);

  const statusSekarang = normalizeStatus(
    laporanTerpilih?.status_terkini ??
      laporanTerpilih?.status_laporan
  );

  const pilihanStatus = getAllowedStatuses(statusSekarang);
  const canEditTerpilih = laporanTerpilih
    ? checkCanEditStatus(laporanTerpilih)
    : false;

  async function simpanStatus() {
    if (!laporanTerpilih) {
      setError("Pilih laporan terlebih dahulu.");
      return;
    }

    if (!checkCanEditStatus(laporanTerpilih)) {
      setError("Anda tidak memiliki hak akses untuk mengubah status laporan ini.");
      return;
    }

    if (statusSekarang === "Ditolak") {
      setError("Laporan yang berstatus Ditolak tidak dapat ditindaklanjuti atau diubah statusnya lagi.");
      return;
    }

    if (statusBaru === "Ditolak" && !pesanTanggapan.trim()) {
      setError("Isi alasan penolakan sebelum menyimpan status Ditolak.");
      return;
    }

    if (
      statusBaru !== statusSekarang &&
      !pilihanStatus.includes(statusBaru)
    ) {
      setError("Perubahan status tidak sesuai urutan yang diperbolehkan.");
      return;
    }

    setMenyimpan(true);
    setError("");
    setSukses("");

    try {
      const response = await adminLaporanApi.updateStatus(
        laporanTerpilih.id_laporan,
        statusBaru,
        pesanTanggapan.trim()
      );

      setSukses(
        (response && typeof response.message === "string" && response.message) ||
          "Status laporan berhasil diperbarui."
      );
    } catch (err) {
      setError(getStatusUpdateErrorMessage(err));
      return;
    } finally {
      setMenyimpan(false);
    }

    await muatLaporan();
  }

  function pilihLaporan(item: Laporan) {
    setLaporanTerpilih(item);
    setActivePhotoIndex(null);

    setStatusBaru(
      normalizeStatus(
        item.status_terkini ?? item.status_laporan
      )
    );

    setPesanTanggapan(item.pesan_tanggapan ?? "");
    setError("");
    setSukses("");
  }

  function resetFilter() {
    setPencarian("");
    setFilterStatus("Semua");
    setFilterKategori("Semua");
    setFilterBulan("Semua");
    setFilterTahun("Semua");
  }

  const fotoList = getFotoList(laporanTerpilih?.foto);

  if (isRestrictedRole) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans">
      <AdminNavbar
        adminName={adminName}
        adminRole={adminRole}
      />

      <main
        className={`mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 ${
          isDirectReportMode ? "max-w-4xl" : "max-w-7xl"
        }`}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            {isDirectReportMode && (
              <button
                type="button"
                onClick={() => router.push("/admin/dashboard")}
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A0C0C] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Dashboard</span>
              </button>
            )}
            <p className="text-xs font-bold uppercase tracking-wider text-[#7A0C0C]">
              ADMINISTRATOR
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              {isDirectReportMode
                ? `Tindak Lanjut Laporan #${String(requestedReportId).padStart(3, "0")}`
                : "Status Laporan"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDirectReportMode && (
              <button
                type="button"
                onClick={() => router.push("/admin/ubah-status")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-100 cursor-pointer"
              >
                Semua Daftar Laporan
              </button>
            )}
            <button
              type="button"
              onClick={() => void muatLaporan()}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Memuat..." : "↻ Muat Ulang"}
            </button>
          </div>
        </div>

        {error && (
          <NetworkErrorAlert
            message={error}
            onRetry={() => void muatLaporan()}
            retrying={loading}
            onDismiss={() => setError("")}
          />
        )}

        {sukses && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {sukses}
          </div>
        )}

        {!isDirectReportMode && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Total Laporan", value: statistik.total, color: "text-slate-900" },
            { label: "Terkirim", value: statistik.terkirim, color: "text-blue-700" },
            { label: "Terverifikasi", value: statistik.terverifikasi, color: "text-amber-700" },
            { label: "Diproses", value: statistik.proses, color: "text-[#7A0C0C]" },
            { label: "Selesai", value: statistik.selesai, color: "text-green-700" },
            { label: "Ditolak", value: statistik.ditolak, color: "text-red-700" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-2xs"
            >
              <p className="text-sm font-medium text-slate-500">
                {item.label}
              </p>

              <p className={`mt-2 text-3xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </section>
        )}

        <section
          className={
            isDirectReportMode
              ? "space-y-6"
              : "grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
          }
        >
          {!isDirectReportMode && (
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <h2 className="font-bold text-slate-900">Daftar Laporan</h2>

              <div className="mt-4 space-y-3">
                <input
                  type="search"
                  value={pencarian}
                  onChange={(event) => setPencarian(event.target.value)}
                  placeholder="Cari nama, NIM/NIP, kategori, lokasi..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10"
                />

                <select
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7A0C0C]"
                >
                  <option value="Semua">Semua Status</option>
                  {STATUS_LIST.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>

                <div>
                  <label
                    htmlFor="filterKategori"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Kategori Laporan
                  </label>
                  <select
                    id="filterKategori"
                    value={filterKategori}
                    onChange={(event) => setFilterKategori(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10"
                  >
                    <option value="Semua">Semua Kategori</option>
                    <option value="Kebersihan">Kebersihan</option>
                    <option value="Fasilitas">Fasilitas</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="filterBulan"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Periode Bulan
                    </label>
                    <select
                      id="filterBulan"
                      value={filterBulan}
                      onChange={(event) => setFilterBulan(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10"
                    >
                      <option value="Semua">Semua Bulan</option>
                      {BULAN_LIST.map((bulan) => (
                        <option key={bulan.value} value={bulan.value}>
                          {bulan.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="filterTahun"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Periode Tahun
                    </label>
                    <select
                      id="filterTahun"
                      value={filterTahun}
                      onChange={(event) => setFilterTahun(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10"
                    >
                      <option value="Semua">Semua Tahun</option>
                      {daftarTahun.map((tahun) => (
                        <option key={tahun} value={String(tahun)}>
                          {tahun}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">
                    Menampilkan{" "}
                    <span className="font-semibold text-slate-700">
                      {laporanTersaring.length}
                    </span>{" "}
                    dari {laporan.length} laporan
                  </p>

                  <button
                    type="button"
                    onClick={resetFilter}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-[#7A0C0C] transition hover:bg-[#7A0C0C]/10"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {loading && laporan.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Memuat data laporan...
                </div>
              ) : laporanTersaring.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <p className="font-semibold text-slate-700">
                    Tidak ada laporan
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Coba ubah kata kunci, status, kategori, atau periode laporan.
                  </p>
                </div>
              ) : (
                laporanTersaring.map((item) => {
                  const status = normalizeStatus(
                    item.status_terkini ?? item.status_laporan
                  );
                  const aktif =
                    laporanTerpilih?.id_laporan === item.id_laporan;
                  const canEdit = checkCanEditStatus(item);

                  return (
                    <button
                      key={item.id_laporan}
                      type="button"
                      onClick={() => pilihLaporan(item)}
                      className={`w-full rounded-2xl border bg-white p-4 text-left shadow-2xs transition hover:border-[#7A0C0C]/40 hover:shadow-md ${
                        aktif
                          ? "border-[#7A0C0C] ring-2 ring-[#7A0C0C]/15"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-semibold text-[#7A0C0C]">
                              LAPORAN #{item.id_laporan}
                            </p>
                            {(item.group_member_count ?? 1) > 1 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#7A0C0C] border border-red-200">
                                <Layers className="w-3 h-3 shrink-0" />
                                {item.group_member_count} Serupa
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 truncate font-bold text-slate-900">
                            {item.kategori_laporan || "Laporan lingkungan"}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.nama_pelapor || "Nama tidak tersedia"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(status)}`}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                        {item.deskripsi || "Tidak ada deskripsi."}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>{getReporterIdentityLabel(item.nim)}: {item.nim || "-"}</span>
                          <span>{formatTanggal(item.tanggal_buat)}</span>
                        </div>

                        {canEdit ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <UserCheck className="w-3 h-3 shrink-0" /> Bisa Diubah
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <Lock className="w-3 h-3 shrink-0" /> Lihat Saja
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          )}

          <div
            className={`space-y-6 ${
              isDirectReportMode ? "" : "lg:col-span-7"
            }`}
          >
            {!laporanTerpilih ? (
              isDirectReportMode && loading ? (
                <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
                  <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    Memuat detail laporan #{requestedReportId}...
                  </p>
                </div>
              ) : isDirectReportMode ? (
                <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <h2 className="font-bold text-slate-800">
                    {deletedReportId === requestedReportId
                      ? `Laporan #${requestedReportId} Telah Dihapus`
                      : `Laporan #${requestedReportId} Tidak Tersedia`}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {deletedReportId === requestedReportId
                      ? "Laporan berstatus Ditolak ini telah dihapus permanen dari sistem."
                      : "Laporan tidak ditemukan atau tidak berada dalam cakupan wilayah kelola Anda."}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => router.push("/admin/dashboard")}
                      className="rounded-xl bg-[#7A0C0C] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#600909] transition cursor-pointer"
                    >
                      Kembali ke Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/ubah-status")}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Lihat Semua Laporan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7A0C0C]/5 text-2xl">
                    📋
                  </div>
                  <h2 className="mt-4 font-bold text-slate-800">
                    Pilih Laporan
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Pilih salah satu laporan dari daftar untuk melihat detail,
                    mengubah status, dan menulis tanggapan.
                  </p>
                </div>
              )
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#7A0C0C]">
                        DETAIL LAPORAN #{laporanTerpilih.id_laporan}
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-slate-900">
                        {laporanTerpilih.kategori_laporan ||
                          "Laporan lingkungan"}
                      </h2>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusColor(statusSekarang)}`}
                    >
                      {STATUS_LABEL[statusSekarang]}
                    </span>
                  </div>

                  {(laporanTerpilih.group_member_count ?? 1) > 1 && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900">
                      <Layers className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Tiket ini tergabung dalam grup{" "}
                        <strong>{laporanTerpilih.group_member_count} laporan serupa</strong>{" "}
                        ({laporanTerpilih.group_unique_reporters ?? 1} pelapor berbeda). Perubahan status dan catatan tanggapan yang Anda simpan akan <strong>otomatis disinkronkan</strong> ke seluruh laporan dalam grup ini.
                      </p>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Nama Pelapor</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {laporanTerpilih.nama_pelapor || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        {getReporterIdentityLabel(laporanTerpilih.nim)}
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {laporanTerpilih.nim || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Tanggal Kejadian
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatTanggal(laporanTerpilih.tanggal_kejadian)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Tanggal Laporan</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatTanggal(laporanTerpilih.tanggal_buat)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700">
                      Lokasi Kejadian
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {laporanTerpilih.lokasi || "Lokasi tidak dicantumkan."}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700">
                      Deskripsi Laporan
                    </p>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {laporanTerpilih.deskripsi || "Tidak ada deskripsi."}
                    </p>
                  </div>

                  {fotoList.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-semibold text-slate-700">
                        Foto Bukti
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {fotoList.map((foto, index) => (
                          <button
                            key={`${foto}-${index}`}
                            type="button"
                            onClick={() => setActivePhotoIndex(index)}
                            className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left cursor-pointer hover:border-[#7A0C0C] transition-colors"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getThumbnailFotoUrl(foto, 480)}
                              alt={`Bukti laporan ${index + 1}`}
                              loading="lazy"
                              decoding="async"
                              className="h-36 w-full object-cover transition group-hover:scale-105"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                                const fallback =
                                  event.currentTarget.nextElementSibling;
                                if (fallback instanceof HTMLElement)
                                  fallback.style.display = "block";
                              }}
                            />
                            <p className="hidden p-3 text-center text-xs text-red-700">
                              Foto tidak dapat dimuat dari penyimpanan.
                            </p>
                            <p className="p-2 text-center text-xs font-medium text-[#7A0C0C]">
                              Lihat foto
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {canEditTerpilih && statusSekarang === "Ditolak" && (
                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-medium text-red-700">
                        Laporan ini berstatus Ditolak dan dapat dihapus permanen dari sistem.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id_laporan: laporanTerpilih.id_laporan,
                            deskripsi: laporanTerpilih.deskripsi,
                            lokasi: laporanTerpilih.lokasi,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Laporan</span>
                      </button>
                    </div>
                  )}
                </section>

                {canEditTerpilih && statusSekarang === "Ditolak" ? (
                  <section className="rounded-2xl border border-red-200/80 bg-white p-5 shadow-2xs sm:p-6 space-y-4">
                    <div className="bg-red-50/80 p-4 rounded-2xl border border-red-200 flex items-center gap-3 text-red-800 text-sm">
                      <Lock className="w-5 h-5 text-red-600 shrink-0" />
                      <span>
                        Laporan ini berstatus <strong>Ditolak</strong> sehingga tidak dapat ditindaklanjuti atau diubah statusnya lagi. Anda dapat menghapus laporan ini melalui tombol <strong>Hapus Laporan</strong> pada detail di atas.
                      </span>
                    </div>

                    {laporanTerpilih.pesan_tanggapan && (
                      <div className="rounded-xl border border-[#7A0C0C]/20 bg-[#7A0C0C]/5 p-4">
                        <p className="text-sm font-semibold text-[#7A0C0C]">
                          Tanggapan Tersimpan
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7A0C0C]">
                          {laporanTerpilih.pesan_tanggapan}
                        </p>
                      </div>
                    )}
                  </section>
                ) : canEditTerpilih ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Perbarui Status Laporan
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Pilih status berikutnya sesuai tahapan penanganan
                        laporan.
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {STATUS_LIST.map((status) => {
                        const diizinkan = pilihanStatus.includes(status);
                        const dipilih = statusBaru === status;

                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={!diizinkan || menyimpan}
                            onClick={() => setStatusBaru(status)}
                            className={`rounded-xl border p-3 text-left transition ${
                              dipilih
                                ? "border-purple-500 bg-[#7A0C0C]/5 ring-2 ring-purple-100"
                                : "border-slate-200 bg-white"
                            } ${
                              !diizinkan
                                ? "cursor-not-allowed opacity-40"
                                : "hover:border-[#7A0C0C]/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                                  dipilih
                                    ? "border-[#7A0C0C] bg-[#7A0C0C] text-white"
                                    : "border-slate-300"
                                }`}
                              >
                                {dipilih ? "✓" : ""}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">
                                {STATUS_LABEL[status]}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {(statusBaru === "Ditolak" ||
                      statusBaru !== statusSekarang) && (
                      <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                        {statusBaru === "Ditolak"
                          ? "Alasan penolakan wajib diisi agar pelapor mengetahui penyebab laporan ditolak."
                          : `Status akan diubah dari ${STATUS_LABEL[statusSekarang]} menjadi ${STATUS_LABEL[statusBaru]}.`}
                      </div>
                    )}

                    <div className="mt-5">
                      <label
                        htmlFor="pesanTanggapan"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Pesan Tanggapan
                        {statusBaru === "Ditolak" && (
                          <span className="ml-1 text-red-600">*</span>
                        )}
                      </label>

                      <textarea
                        id="pesanTanggapan"
                        value={pesanTanggapan}
                        onChange={(event) =>
                          setPesanTanggapan(event.target.value)
                        }
                        maxLength={2000}
                        rows={4}
                        placeholder="Tuliskan hasil verifikasi, tindak lanjut, atau alasan penolakan..."
                        className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#7A0C0C] focus:ring-1 focus:ring-[#7A0C0C]/10"
                      />

                      <p className="mt-1 text-right text-xs text-slate-400">
                        {pesanTanggapan.length}/2000 karakter
                      </p>
                    </div>

                    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={menyimpan}
                        onClick={() => {
                          setStatusBaru(statusSekarang);
                          setPesanTanggapan(
                            laporanTerpilih.pesan_tanggapan ?? ""
                          );
                          setError("");
                          setSukses("");
                        }}
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Batalkan Perubahan
                      </button>

                      <button
                        type="button"
                        disabled={
                          menyimpan ||
                          (statusBaru === statusSekarang &&
                            pesanTanggapan.trim() ===
                              (laporanTerpilih.pesan_tanggapan ?? "").trim())
                        }
                        onClick={() => void simpanStatus()}
                        className="rounded-xl bg-[#7A0C0C] px-5 py-3 text-sm font-semibold text-white shadow-2xs transition hover:bg-[#600909] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {menyimpan ? "Menyimpan..." : "Simpan Perubahan"}
                      </button>
                    </div>

                    {laporanTerpilih.pesan_tanggapan && (
                      <div className="mt-5 rounded-xl border border-[#7A0C0C]/20 bg-[#7A0C0C]/5 p-4">
                        <p className="text-sm font-semibold text-[#7A0C0C]">
                          Tanggapan Tersimpan
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7A0C0C]">
                          {laporanTerpilih.pesan_tanggapan}
                        </p>
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-4">
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex items-center gap-3 text-slate-600 text-sm">
                      <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                      <span>
                        Role Anda (<strong>{adminRole}</strong>) hanya memiliki
                        hak akses untuk <strong>melihat laporan ini</strong> dan
                        tidak dapat mengubah statusnya.
                      </span>
                    </div>

                    {laporanTerpilih.pesan_tanggapan && (
                      <div className="rounded-xl border border-[#7A0C0C]/20 bg-[#7A0C0C]/5 p-4">
                        <p className="text-sm font-semibold text-[#7A0C0C]">
                          Tanggapan Tersimpan
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7A0C0C]">
                          {laporanTerpilih.pesan_tanggapan}
                        </p>
                      </div>
                    )}
                  </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Riwayat Status
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Urutan perubahan status laporan.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {(laporanTerpilih.riwayat_status ?? []).length} catatan
                    </span>
                  </div>

                  {(laporanTerpilih.riwayat_status ?? []).length === 0 ? (
                    <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                      Belum ada riwayat status yang tersedia.
                    </div>
                  ) : (
                    <ol className="mt-5 space-y-4">
                      {[...(laporanTerpilih.riwayat_status ?? [])]
                        .sort((a, b) => {
                          const tanggalA = new Date(
                            getRiwayatTanggal(a) || 0
                          ).getTime();
                          const tanggalB = new Date(
                            getRiwayatTanggal(b) || 0
                          ).getTime();
                          return tanggalA - tanggalB;
                        })
                        .map((item, index) => {
                          const status = normalizeStatus(
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
                                <span className="mt-1 h-3 w-3 rounded-full bg-[#7A0C0C] ring-4 ring-[#7A0C0C]/15" />
                                {index <
                                  (laporanTerpilih.riwayat_status ?? [])
                                    .length -
                                    1 && (
                                  <span className="mt-2 min-h-8 w-px flex-1 bg-slate-200" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1 pb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(status)}`}
                                  >
                                    {STATUS_LABEL[status]}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {formatTanggalWaktu(
                                      getRiwayatTanggal(item)
                                    )}
                                  </span>
                                </div>

                                {item.keterangan && (
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {item.keterangan}
                                  </p>
                                )}

                                {item.pesan && (
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {item.pesan}
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                    </ol>
                  )}
                </section>
              </>
            )}
          </div>
        </section>
      </main>

      <DeleteRejectedReportModal
        report={deleteTarget}
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(deletedId) => {
          setDeleteTarget(null);
          setDeletedReportId(deletedId);
          setLaporanTerpilih(null);
          setActivePhotoIndex(null);
          setLaporan((prev) =>
            prev.filter((item) => item.id_laporan !== deletedId)
          );
          setError("");
          setSukses(
            `Laporan #${deletedId} yang berstatus Ditolak berhasil dihapus dari sistem.`
          );
        }}
      />

      <ImagePreviewModal
        images={fotoList.map(getFotoUrl)}
        activeIndex={activePhotoIndex}
        onClose={() => setActivePhotoIndex(null)}
        onChangeIndex={setActivePhotoIndex}
        titlePrefix="Foto Bukti"
      />
    </div>
  );
}

export default function UbahStatusLaporanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F9FA]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
            <p className="text-slate-600 text-sm font-medium">
              Memuat halaman status laporan...
            </p>
          </div>
        </div>
      }
    >
      <UbahStatusLaporanContent />
    </Suspense>
  );
}