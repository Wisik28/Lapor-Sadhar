"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import { authApi, laporanApi, type LaporanItem } from "@/lib/api";
import {
  MapPin,
  Send,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Edit3,
  Loader2,
  RefreshCw,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  Eye,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Terkirim:     { label: "Terkirim",     color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     dot: "bg-blue-500"    },
  Diverifikasi: { label: "Diverifikasi", color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-500"  },
  Diproses:     { label: "Diproses",     color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500"   },
  Selesai:      { label: "Selesai",      color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500" },
  Ditolak:      { label: "Ditolak",      color: "text-red-700",     bg: "bg-red-50 border-red-200",       dot: "bg-red-500"     },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Terkirim"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatTanggal(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return dateStr; }
}

interface Attachment { id: string; url: string; name: string; }

// ─── Komponen Laporan Card ────────────────────────────────────────────────────

function LaporanCard({ lap, expandedId, setExpandedId }: {
  lap: LaporanItem;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
}) {
  const isExpanded = expandedId === lap.id_laporan;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
      <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lap.kategori_laporan === "Fasilitas" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
              {lap.kategori_laporan}
            </span>
            <StatusBadge status={lap.status_terkini} />
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">{lap.lokasi}</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatTanggal(lap.tanggal_kejadian)} · ID #{lap.id_laporan}</p>
        </div>
        <button
          onClick={() => setExpandedId(isExpanded ? null : lap.id_laporan)}
          className="min-h-[36px] w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Deskripsi</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">{lap.deskripsi}</p>
          </div>
          {lap.riwayat_status && lap.riwayat_status.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Riwayat Status</p>
              <div className="space-y-1.5">
                {lap.riwayat_status.map((s) => {
                  const cfg = STATUS_CONFIG[s.status_laporan] ?? STATUS_CONFIG["Terkirim"];
                  return (
                    <div key={s.id_status} className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>{s.status_laporan}</span>
                      <span className="text-xs text-slate-400">{formatTanggal(s.tanggal_merubah)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Dibuat: {formatTanggal(lap.tanggal_buat)}</span>
            {lap.tanggal_rubah && (<><span>·</span><span>Diperbarui: {formatTanggal(lap.tanggal_rubah)}</span></>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component Utama ──────────────────────────────────────────────────────────

export default function BuatLaporanPage() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("buat-laporan");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Auth User ──
  const [currentUser, setCurrentUser] = useState({ nama: "Pengguna", role: "Mahasiswa", nim: "" });

  useEffect(() => {
    const user = authApi.getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUser({
      nama: user.nama,
      role: user.role || (user.tipe_user === "karyawan" ? "Karyawan" : "Mahasiswa"),
      nim: user.nim || user.nomor_identitas || "",
    });
  }, [router]);

  // ── Shared laporan state (untuk semua menu yang membutuhkan list laporan) ──
  const [allLaporan, setAllLaporan] = useState<LaporanItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const listFetchedRef = useRef(false);

  const fetchAllLaporan = useCallback(async (nim: string) => {
    if (!nim) return;
    setListLoading(true);
    const res = await laporanApi.getAll(nim);
    if (res.status === "success" && Array.isArray(res.data)) {
      setAllLaporan(res.data as LaporanItem[]);
    }
    setListLoading(false);
  }, []);

  // Fetch laporan saat NIM tersedia pertama kali
  useEffect(() => {
    if (currentUser.nim && !listFetchedRef.current) {
      listFetchedRef.current = true;
      fetchAllLaporan(currentUser.nim);
    }
  }, [currentUser.nim, fetchAllLaporan]);

  // Fetch data saat menu aktif berubah
  useEffect(() => {
    if (!currentUser.nim) return;
    if (activeMenu === "rubah-pengajuan" || activeMenu === "lihat-status" || activeMenu === "riwayat-laporan") {
      fetchAllLaporan(currentUser.nim);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  // ─── Buat Laporan State ────────────────────────────────────────────────────

  const today = new Date().toISOString().split("T")[0];
  const [kategori, setKategori] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [lokasi, setLokasi] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [buatLoading, setBuatLoading] = useState(false);
  const [buatError, setBuatError] = useState("");
  const [buatSuccess, setBuatSuccess] = useState("");

  const handleRemoveAttachment = (id: string) =>
    setAttachments(attachments.filter((item) => item.id !== id));

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachments([...attachments, {
        id: Date.now().toString(),
        name: file.name,
        url: URL.createObjectURL(file),
      }]);
    }
  };

  const handleBatal = () => {
    setKategori(""); setTanggal(today); setLokasi(""); setDeskripsi("");
    setAttachments([]); setBuatError(""); setBuatSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuatError(""); setBuatSuccess("");
    if (!kategori || !lokasi || !deskripsi) { setBuatError("Mohon lengkapi seluruh kolom formulir!"); return; }
    if (tanggal > today) { setBuatError("Tanggal kejadian tidak boleh melebihi hari ini!"); return; }
    if (!currentUser.nim) { setBuatError("Sesi login tidak ditemukan. Silakan login ulang."); return; }

    setBuatLoading(true);
    try {
      const res = await laporanApi.create({
        nim: currentUser.nim,
        kategori_laporan: kategori,
        deskripsi,
        tanggal_kejadian: tanggal,
        lokasi,
        foto: attachments[0]?.url ?? undefined,
      });
      if (res.status === "success") {
        setBuatSuccess("Laporan berhasil dikirim ke pihak pengelola USD!");
        handleBatal();
        // Refresh list laporan di background
        fetchAllLaporan(currentUser.nim);
      } else {
        setBuatError(res.message || "Gagal mengirim laporan.");
      }
    } catch {
      setBuatError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setBuatLoading(false);
    }
  };

  // ─── Rubah Pengajuan State ─────────────────────────────────────────────────

  const [selectedLaporan, setSelectedLaporan] = useState<LaporanItem | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editKategori, setEditKategori] = useState("");
  const [editTanggal, setEditTanggal] = useState("");
  const [editLokasi, setEditLokasi] = useState("");
  const [editDeskripsi, setEditDeskripsi] = useState("");
  const [rubahError, setRubahError] = useState("");
  const [rubahSuccess, setRubahSuccess] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // Filter laporan yang bisa diubah (status Terkirim)
  const laporanEditable = allLaporan.filter((l) => l.status_terkini === "Terkirim");
  // Filter laporan yang sudah selesai atau ditolak (untuk riwayat)
  const laporanRiwayat = allLaporan.filter((l) =>
    l.status_terkini === "Selesai" || l.status_terkini === "Ditolak"
  );
  // Filter laporan aktif (Terkirim, Diverifikasi, Diproses) untuk lihat-status
  const laporanAktif = allLaporan.filter((l) =>
    ["Terkirim", "Diverifikasi", "Diproses"].includes(l.status_terkini)
  );

  const [expandedRiwayatId, setExpandedRiwayatId] = useState<number | null>(null);
  const [expandedAktifId, setExpandedAktifId] = useState<number | null>(null);

  const handleSelectEdit = (lap: LaporanItem) => {
    setSelectedLaporan(lap);
    setEditKategori(lap.kategori_laporan);
    setEditTanggal(lap.tanggal_kejadian?.split("T")[0] ?? today);
    setEditLokasi(lap.lokasi);
    setEditDeskripsi(lap.deskripsi);
    setRubahError(""); setRubahSuccess("");
  };

  const handleSaveRubah = async () => {
    if (!selectedLaporan) return;
    setRubahError(""); setRubahSuccess("");
    if (!editKategori || !editLokasi || !editDeskripsi) {
      setRubahError("Semua kolom wajib diisi!"); return;
    }
    setSaveLoading(true);
    const res = await laporanApi.update(selectedLaporan.id_laporan, {
      kategori_laporan: editKategori,
      deskripsi: editDeskripsi,
      tanggal_kejadian: editTanggal,
      lokasi: editLokasi,
    });
    if (res.status === "success") {
      setRubahSuccess("Laporan berhasil diperbarui!");
      setSelectedLaporan(null);
      fetchAllLaporan(currentUser.nim);
    } else {
      setRubahError(res.message || "Gagal memperbarui laporan.");
    }
    setSaveLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setDeleteLoading(id);
    const res = await laporanApi.delete(id);
    if (res.status === "success") {
      setRubahSuccess("Laporan berhasil dihapus.");
      if (selectedLaporan?.id_laporan === id) setSelectedLaporan(null);
      fetchAllLaporan(currentUser.nim);
    } else {
      setRubahError(res.message || "Gagal menghapus laporan.");
    }
    setDeleteLoading(null);
  };

  // ─── Page Title ────────────────────────────────────────────────────────────
  const getPageTitle = (menu: string) => {
    switch (menu) {
      case "buat-laporan":    return "Buat Laporan";
      case "lihat-status":    return "Lihat Status Laporan";
      case "riwayat-laporan": return "Riwayat Laporan";
      case "rubah-pengajuan": return "Rubah Pengajuan Laporan";
      default: return "Buat Laporan";
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      <Sidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Navbar
          pageTitle={getPageTitle(activeMenu)}
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 bg-[#F3F4F6]">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            {/* ════════════════════════════════════════════════════════
                MENU: BUAT LAPORAN
            ════════════════════════════════════════════════════════ */}
            {activeMenu === "buat-laporan" && (
              <>
                {buatError && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{buatError}</span>
                    <button onClick={() => setBuatError("")} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                )}
                {buatSuccess && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{buatSuccess}</span>
                    <button onClick={() => setBuatSuccess("")} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {/* Kategori */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Kategori Laporan <span className="text-red-500">*</span>
                        </label>
                        <select value={kategori} onChange={(e) => setKategori(e.target.value)} required
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none">
                          <option value="" disabled>-- Pilih Kategori Laporan --</option>
                          <option value="Fasilitas">Fasilitas</option>
                          <option value="Kebersihan">Kebersihan</option>
                        </select>
                      </div>

                      {/* Tanggal */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Tanggal Kejadian <span className="text-red-500">*</span>
                        </label>
                        <input type="date" value={tanggal} max={today}
                          onChange={(e) => { if (e.target.value > today) return; setTanggal(e.target.value); }}
                          required
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none" />
                      </div>

                      {/* Lokasi */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Lokasi Kejadian <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <MapPin className="absolute left-3.5 w-5 h-5 text-[#7A0C0C] pointer-events-none" />
                          <input type="text" placeholder="Contoh: Kampus III, Ruang Kelas K.205"
                            value={lokasi} onChange={(e) => setLokasi(e.target.value)} required
                            className="w-full min-h-[44px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Deskripsi */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Deskripsi Masalah <span className="text-red-500">*</span>
                      </label>
                      <textarea rows={4} placeholder="Contoh: Kipas menyala tetapi baling-balingnya tidak dapat berputar"
                        value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} required
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none resize-y min-h-[100px]" />
                    </div>

                    {/* Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Foto / Lampiran</label>
                      <p className="text-xs text-slate-500 mb-3">Unggah bukti foto kerusakan (Maksimal 5 foto, format JPG/PNG).</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                        {attachments.map((item) => (
                          <div key={item.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-28 sm:h-32">
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button type="button" onClick={() => handleRemoveAttachment(item.id)}
                              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95">
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                              <span className="block text-[11px] text-white truncate px-1">{item.name}</span>
                            </div>
                          </div>
                        ))}
                        {attachments.length < 5 && (
                          <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#7A0C0C] bg-slate-50 hover:bg-red-50/30 rounded-xl h-28 sm:h-32 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#7A0C0C] transition-all group">
                            <div className="w-10 h-10 rounded-full bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-xs transition-colors">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold">Tambahkan</span>
                            <input type="file" accept="image/*" onChange={handleAddAttachment} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Tombol */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
                      <button type="button" onClick={handleBatal}
                        className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8B5A2B] hover:bg-[#744A22] text-white text-sm font-semibold shadow-xs transition-all duration-200 active:scale-98 flex items-center justify-center">
                        Batal
                      </button>
                      <button type="submit" disabled={buatLoading}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/20 transition-all duration-200 active:scale-98 disabled:opacity-70">
                        {buatLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Mengirim...</span></>) : (<><span>Kirim Laporan</span><Send className="w-4 h-4" /></>)}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {/* ════════════════════════════════════════════════════════
                MENU: LIHAT STATUS LAPORAN
            ════════════════════════════════════════════════════════ */}
            {activeMenu === "lihat-status" && (
              <div className="space-y-5">
                {/* Header info alur */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                      <Eye className="w-5 h-5 text-[#7A0C0C]" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 text-sm sm:text-base">Status Laporan Aktif</h2>
                      <p className="text-xs text-slate-500">Pantau laporan yang sedang dalam proses penanganan.</p>
                    </div>
                  </div>
                  {/* Alur Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-center">
                    {["Terkirim","Diverifikasi","Diproses","Selesai"].map((s, i) => {
                      const cfg = STATUS_CONFIG[s];
                      const desc = ["Laporan masuk sistem","Review admin/sarpras","Pengerjaan teknisi","Fasilitas tuntas"][i];
                      return (
                        <div key={s} className={`p-3 rounded-xl border shadow-2xs space-y-0.5 ${cfg.bg}`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
                          <p className={`text-xs font-bold ${cfg.color}`}>{i+1}. {s}</p>
                          <p className="text-[10px] text-slate-500">{desc}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-red-50/50 p-3 rounded-xl border border-red-100">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      <span className="font-bold text-red-700">Jalur Penolakan:</span>
                      <span className="text-slate-600 text-[11px]">Jika laporan tidak valid, status berubah menjadi <strong>Ditolak</strong> dan tidak diproses.</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 shrink-0">Status Akhir: Ditolak</span>
                  </div>
                </div>

                {/* Laporan Aktif Milik User */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Laporan Anda yang Sedang Diproses</h3>
                    <button onClick={() => fetchAllLaporan(currentUser.nim)} disabled={listLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-all">
                      <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>

                  {listLoading && <div className="flex justify-center py-8"><Loader2 className="w-7 h-7 animate-spin text-[#7A0C0C]" /></div>}

                  {!listLoading && laporanAktif.length === 0 && (
                    <div className="text-center py-8 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">Tidak ada laporan aktif</p>
                      <p className="text-xs text-slate-400">Semua laporan Anda sudah selesai atau belum ada laporan yang dibuat.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {!listLoading && laporanAktif.map((lap) => (
                      <LaporanCard key={lap.id_laporan} lap={lap} expandedId={expandedAktifId} setExpandedId={setExpandedAktifId} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                MENU: RIWAYAT LAPORAN
            ════════════════════════════════════════════════════════ */}
            {activeMenu === "riwayat-laporan" && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <History className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 text-sm sm:text-base">Riwayat Seluruh Pelaporan</h2>
                      <p className="text-xs text-slate-500">Laporan yang sudah berstatus <strong className="text-emerald-600">Selesai</strong> atau <strong className="text-red-600">Ditolak</strong>.</p>
                    </div>
                  </div>
                  <button onClick={() => fetchAllLaporan(currentUser.nim)} disabled={listLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-all shrink-0">
                    <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {listLoading && <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" /></div>}

                {!listLoading && laporanRiwayat.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                      <History className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-600">Belum ada riwayat laporan</p>
                    <p className="text-xs text-slate-400">Laporan yang sudah selesai ditangani atau ditolak akan muncul di sini.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {!listLoading && laporanRiwayat.map((lap) => (
                    <LaporanCard key={lap.id_laporan} lap={lap} expandedId={expandedRiwayatId} setExpandedId={setExpandedRiwayatId} />
                  ))}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                MENU: RUBAH PENGAJUAN
            ════════════════════════════════════════════════════════ */}
            {activeMenu === "rubah-pengajuan" && (
              <div className="space-y-5">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                      <Edit3 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 text-sm sm:text-base">Rubah Pengajuan Laporan</h2>
                      <p className="text-xs text-slate-500">Hanya laporan berstatus <strong className="text-blue-600">Terkirim</strong> yang dapat diubah atau dihapus.</p>
                    </div>
                  </div>
                  <button onClick={() => fetchAllLaporan(currentUser.nim)} disabled={listLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-all shrink-0">
                    <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {/* Alerts */}
                {rubahError && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{rubahError}</span>
                    <button onClick={() => setRubahError("")} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                )}
                {rubahSuccess && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{rubahSuccess}</span>
                    <button onClick={() => setRubahSuccess("")} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {listLoading && (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
                  </div>
                )}

                {!listLoading && laporanEditable.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
                      <FileText className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-600">Tidak ada laporan yang bisa diubah</p>
                    <p className="text-xs text-slate-400">Hanya laporan dengan status <strong>Terkirim</strong> yang dapat diubah. Laporan yang sedang diverifikasi atau diproses tidak dapat diedit.</p>
                  </div>
                )}

                {/* Laporan List */}
                {!listLoading && laporanEditable.map((lap) => {
                  const isExpanded = expandedId === lap.id_laporan;
                  const isEditing = selectedLaporan?.id_laporan === lap.id_laporan;
                  return (
                    <div key={lap.id_laporan}
                      className={`bg-white rounded-2xl border shadow-xs transition-all duration-200 overflow-hidden ${isEditing ? "border-[#7A0C0C]/30 ring-2 ring-[#7A0C0C]/10" : "border-slate-200/80"}`}>

                      {/* Card Header */}
                      <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lap.kategori_laporan === "Fasilitas" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                              {lap.kategori_laporan}
                            </span>
                            <StatusBadge status={lap.status_terkini} />
                          </div>
                          <p className="text-sm font-medium text-slate-800 truncate">{lap.lokasi}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatTanggal(lap.tanggal_kejadian)} · ID #{lap.id_laporan}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => { isEditing ? setSelectedLaporan(null) : handleSelectEdit(lap); setRubahError(""); setRubahSuccess(""); }}
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${isEditing ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-[#7A0C0C] text-white hover:bg-[#9E1B1B]"}`}>
                            <Edit3 className="w-3.5 h-3.5" />
                            {isEditing ? "Batal Edit" : "Edit"}
                          </button>
                          <button
                            onClick={() => handleDelete(lap.id_laporan)}
                            disabled={deleteLoading === lap.id_laporan}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all flex items-center gap-1.5 disabled:opacity-60">
                            {deleteLoading === lap.id_laporan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Hapus
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : lap.id_laporan)}
                            className="min-h-[36px] w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && !isEditing && (
                        <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-3 space-y-2">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Deskripsi</p>
                          <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">{lap.deskripsi}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Dibuat: {formatTanggal(lap.tanggal_buat)}</span>
                            {lap.tanggal_rubah && (<><span>·</span><span>Diperbarui: {formatTanggal(lap.tanggal_rubah)}</span></>)}
                          </div>
                        </div>
                      )}

                      {/* Edit Form */}
                      {isEditing && (
                        <div className="px-4 sm:px-5 pb-5 border-t border-[#7A0C0C]/10 pt-4 space-y-4 bg-red-50/20">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-4 rounded-full bg-[#7A0C0C]" />
                            <p className="text-xs font-bold text-[#7A0C0C] uppercase tracking-wide">Mode Edit Laporan</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kategori</label>
                              <select value={editKategori} onChange={e => setEditKategori(e.target.value)}
                                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm outline-none">
                                <option value="Fasilitas">Fasilitas</option>
                                <option value="Kebersihan">Kebersihan</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Kejadian</label>
                              <input type="date" value={editTanggal} max={today}
                                onChange={e => setEditTanggal(e.target.value)}
                                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm outline-none" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lokasi</label>
                              <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A0C0C]" />
                                <input type="text" value={editLokasi} onChange={e => setEditLokasi(e.target.value)}
                                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm outline-none" />
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deskripsi</label>
                              <textarea rows={3} value={editDeskripsi} onChange={e => setEditDeskripsi(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-white text-sm outline-none resize-y" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 pt-1">
                            <button onClick={() => setSelectedLaporan(null)}
                              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                              Batal
                            </button>
                            <button onClick={handleSaveRubah} disabled={saveLoading}
                              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#7A0C0C] text-white hover:bg-[#9E1B1B] shadow-md shadow-[#7A0C0C]/20 transition-all disabled:opacity-70">
                              {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              Simpan Perubahan
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Info laporan tidak bisa diubah */}
                {!listLoading && allLaporan.filter(l => l.status_terkini !== "Terkirim").length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-semibold mb-0.5">Anda memiliki {allLaporan.filter(l => l.status_terkini !== "Terkirim").length} laporan lainnya</p>
                      <p>Laporan dengan status <strong>Diverifikasi</strong>, <strong>Diproses</strong>, <strong>Selesai</strong>, atau <strong>Ditolak</strong> tidak dapat diubah. Lihat di menu <strong>Lihat Status</strong> atau <strong>Riwayat Laporan</strong>.</p>
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* Footer */}
            <footer className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 text-center sm:text-left">
              <p>Lapor Sadhar © 2026 Universitas Sanata Dharma</p>
              <div className="flex items-center gap-4">
                <a href="#privasi" onClick={(e) => { e.preventDefault(); alert("Kebijakan Privasi Lapor Sadhar"); }}
                  className="hover:text-[#7A0C0C] transition-colors py-1 inline-block">Kebijakan Privasi</a>
                <span className="text-slate-300">•</span>
                <a href="#bantuan" onClick={(e) => { e.preventDefault(); alert("Bantuan & FAQ Lapor Sadhar"); }}
                  className="hover:text-[#7A0C0C] transition-colors py-1 inline-block">Bantuan & FAQ</a>
              </div>
            </footer>

          </div>
        </main>
      </div>
    </div>
  );
}
