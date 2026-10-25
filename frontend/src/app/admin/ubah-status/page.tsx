"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { adminLaporanApi } from "@/lib/api";

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
  foto?: string | string[] | null;
  pesan_tanggapan?: string | null;
  status_terkini?: string;
  status_laporan?: string;
  riwayat_status?: RiwayatStatus[];
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
  "Sedang Diverifikasi": "Sedang Diverifikasi",
  Terverifikasi: "Terverifikasi",
  Proses: "DIproses",
  Selesai: "Selesai",
  Ditolak: "Ditolak",
};

// Pilihan bulan untuk filter periode laporan.
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

// Membaca tanggal laporan.
// Mendukung tanggal ISO dan format tanggal MySQL.
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

// Mengelompokkan kategori menjadi Kebersihan atau Fasilitas.
function getKategoriFilter(kategori?: string): string {
  const nilai = (kategori ?? "").trim().toLowerCase();

  if (nilai.includes("kebersihan")) return "Kebersihan";
  if (nilai.includes("fasilitas")) return "Fasilitas";

  return "Lainnya";
}

function normalizeStatus(value?: string): StatusValue {
  const status = (value ?? "Terkirim").trim().toLowerCase();

  if (status === "sedang diverifikasi") return "Sedang Diverifikasi";
  if (status === "terverifikasi" || status === "diverifikasi")
    return "Terverifikasi";
  if (
    status === "proses" ||
    status === "diproses" ||
    status === "Diproses"
  )
    return "Proses";
  if (status === "selesai") return "Selesai";
  if (status === "ditolak") return "Ditolak";

  return "Terkirim";
}

function formatTanggal(value?: string) {
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
      return "bg-purple-100 text-purple-700";
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

function getFotoList(foto?: string | string[] | null): string[] {
  if (!foto) return [];

  if (Array.isArray(foto)) {
    return foto.filter((item) => typeof item === "string" && item.trim());
  }

  try {
    const parsed = JSON.parse(foto);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => typeof item === "string" && item.trim()
      );
    }
  } catch {
    // Foto berupa satu alamat/path, bukan JSON.
  }

  return foto.trim() ? [foto] : [];
}

function getRiwayatStatus(item: RiwayatStatus): string {
  return item.status_laporan ?? item.status ?? "Terkirim";
}

function getRiwayatTanggal(item: RiwayatStatus): string {
  return item.tanggal_merubah ?? item.tanggal ?? "";
}

export default function UbahStatusLaporanPage() {
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [laporanTerpilih, setLaporanTerpilih] =
    useState<Laporan | null>(null);

  const [pencarian, setPencarian] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");

  // TAMBAHAN: State filter kategori, bulan, dan tahun.
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterBulan, setFilterBulan] = useState("Semua");
  const [filterTahun, setFilterTahun] = useState("Semua");

  const [statusBaru, setStatusBaru] = useState<StatusValue>("Terkirim");
  const [pesanTanggapan, setPesanTanggapan] = useState("");

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState("");
  const [sukses, setSukses] = useState("");
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

      setLaporanTerpilih((sebelumnya) => {
        if (!sebelumnya) return null;

        return (
          daftar.find(
            (item) => item.id_laporan === sebelumnya.id_laporan
          ) ?? null
        );
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data laporan."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

        setLaporanTerpilih((sebelumnya) => {
          if (!sebelumnya) return null;

          return (
            daftar.find(
              (item) => item.id_laporan === sebelumnya.id_laporan
            ) ?? null
          );
        });
      } catch (err) {
        if (!aktif) return;

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data laporan."
        );
      } finally {
        if (aktif) setLoading(false);
      }
    };

    void ambilData();

    return () => {
      aktif = false;
    };
  }, []);

  // Membuat daftar tahun berdasarkan tanggal laporan yang tersedia.
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

      // Filter status yang sudah ada.
      const cocokStatus =
        filterStatus === "Semua" ||
        status === normalizeStatus(filterStatus);

      // TAMBAHAN: Filter kategori.
      const kategori = getKategoriFilter(item.kategori_laporan);

      const cocokKategori =
        filterKategori === "Semua" ||
        kategori === filterKategori;

      // TAMBAHAN: Filter bulan dan tahun berdasarkan tanggal laporan dibuat.
      const tanggalLaporan = getTanggalLaporan(item.tanggal_buat);

      const cocokBulan =
        filterBulan === "Semua" ||
        (tanggalLaporan !== null &&
          tanggalLaporan.getMonth() + 1 === Number(filterBulan));

      const cocokTahun =
        filterTahun === "Semua" ||
        (tanggalLaporan !== null &&
          tanggalLaporan.getFullYear() === Number(filterTahun));

      // Pencarian yang sudah ada tetap dipertahankan.
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

    return {
      total: laporan.length,
      terkirim: jumlahStatus("Terkirim"),
      verifikasi: jumlahStatus("Sedang Diverifikasi"),
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

  async function simpanStatus() {
    if (!laporanTerpilih) {
      setError("Pilih laporan terlebih dahulu.");
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
      await adminLaporanApi.updateStatus(
        laporanTerpilih.id_laporan,
        statusBaru,
        pesanTanggapan.trim()
      );

      setSukses("Status laporan berhasil diperbarui.");
      await muatLaporan();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan perubahan status."
      );
    } finally {
      setMenyimpan(false);
    }
  }

  function pilihLaporan(item: Laporan) {
  setLaporanTerpilih(item);

  setStatusBaru(
    normalizeStatus(
      item.status_terkini ?? item.status_laporan
    )
  );

  setPesanTanggapan(item.pesan_tanggapan ?? "");
  setError("");
  setSukses("");
}

  // TAMBAHAN: Mengembalikan semua filter ke kondisi awal.
  function resetFilter() {
    setPencarian("");
    setFilterStatus("Semua");
    setFilterKategori("Semua");
    setFilterBulan("Semua");
    setFilterTahun("Semua");
  }

  const fotoList = getFotoList(laporanTerpilih?.foto);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavbar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-purple-700">
              ADMINISTRATOR
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Status Laporan
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Periksa laporan, perbarui status, dan berikan tanggapan kepada
              pelapor.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void muatLaporan()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memuat..." : "↻ Muat Ulang"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {sukses && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {sukses}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total Laporan", value: statistik.total, color: "text-slate-900" },
            { label: "Terkirim", value: statistik.terkirim, color: "text-blue-700" },
            { label: "Verifikasi", value: statistik.verifikasi, color: "text-amber-700" },
            { label: "Diproses", value: statistik.proses, color: "text-purple-700" },
            { label: "Selesai", value: statistik.selesai, color: "text-green-700" },
            { label: "Ditolak", value: statistik.ditolak, color: "text-red-700" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                {item.label}
              </p>
              <p className={`mt-2 text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold text-slate-900">Daftar Laporan</h2>

              <div className="mt-4 space-y-3">
                <input
                  type="search"
                  value={pencarian}
                  onChange={(event) => setPencarian(event.target.value)}
                  placeholder="Cari nama, NIM, kategori, lokasi..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                />

                <select
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                >
                  <option value="Semua">Semua Status</option>
                  {STATUS_LIST.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>

                {/* Filter kategori laporan. */}
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="Semua">Semua Kategori</option>
                    <option value="Kebersihan">Kebersihan</option>
                    <option value="Fasilitas">Fasilitas</option>
                  </select>
                </div>

                {/* Filter periode bulan dan tahun. */}
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
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

                {/* Jumlah hasil dan tombol reset filter. */}
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
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-50"
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

                  return (
                    <button
                      key={item.id_laporan}
                      type="button"
                      onClick={() => pilihLaporan(item)}
                      className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-purple-300 hover:shadow-md ${
                        aktif
                          ? "border-purple-500 ring-2 ring-purple-100"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-purple-700">
                            LAPORAN #{item.id_laporan}
                          </p>
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

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>NIM: {item.nim || "-"}</span>
                        <span>{formatTanggal(item.tanggal_buat)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-7">
            {!laporanTerpilih ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-2xl">
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
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-purple-700">
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

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Nama Pelapor</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {laporanTerpilih.nama_pelapor || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">NIM</p>
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
                          <a
                            key={`${foto}-${index}`}
                            href={foto}
                            target="_blank"
                            rel="noreferrer"
                            className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                          >
                            <img
                              src={foto}
                              alt={`Bukti laporan ${index + 1}`}
                              className="h-36 w-full object-cover transition group-hover:scale-105"
                            />
                            <p className="p-2 text-center text-xs text-purple-700">
                              Lihat foto
                            </p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
                              ? "border-purple-500 bg-purple-50 ring-2 ring-purple-100"
                              : "border-slate-200 bg-white"
                          } ${
                            !diizinkan
                              ? "cursor-not-allowed opacity-40"
                              : "hover:border-purple-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                                dipilih
                                  ? "border-purple-600 bg-purple-600 text-white"
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
                      className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
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
                      className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {menyimpan ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>
                  </div>

                  {laporanTerpilih.pesan_tanggapan && (
                    <div className="mt-5 rounded-xl border border-purple-100 bg-purple-50 p-4">
                      <p className="text-sm font-semibold text-purple-900">
                        Tanggapan Tersimpan
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-purple-800">
                        {laporanTerpilih.pesan_tanggapan}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
                                <span className="mt-1 h-3 w-3 rounded-full bg-purple-600 ring-4 ring-purple-100" />
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
                                    {formatTanggal(
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
    </div>
  );
}