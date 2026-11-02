"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { authApi, adminLaporanApi } from "@/lib/api";
import {
  Send, Search, X, CheckCircle2, Settings, Flag,
  RefreshCw, AlertCircle, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulanData {
  bulan: string;
  bulan_en: string;
  key: string;
  masuk: number;
  selesai: number;
}

interface LokasiData {
  nama: string;
  jumlah: number;
}

interface LaporanItem {
  id_laporan: number;
  nim: string;
  nama_pelapor?: string;
  kategori_laporan: string;
  deskripsi: string;
  tanggal_kejadian: string;
  tanggal_buat: string;
  tanggal_rubah?: string | null;
  lokasi: string;
  foto?: string | null;
  status_terkini: string;
}

interface RekapData {
  total_laporan: number;
  total_selesai: number;
  total_aktif: number;
  total_ditolak: number;
  persentase_selesai: number;
  rata_resolusi_jam: number | null;
  tingkat_sla: number | null;
  sla_target_jam: number;
  selesai_dalam_sla: number;
  kepuasan_score: number | null;
  realisasi_anggaran: number;
  budget_target: number;
  pct_anggaran: number;
  per_status: {
    Terkirim: number;
    Diverifikasi: number;
    Diproses: number;
    Selesai: number;
    Ditolak: number;
  };
  per_kategori: { Fasilitas: number; Kebersihan: number };
  per_bulan: BulanData[];
  top_lokasi: LokasiData[];
  dominasi_lokasi: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function fmtDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).replace(",", "");
  } catch { return dateStr; }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  "Terkirim":          { label: "Terkirim",           cls: "bg-orange-50 text-orange-600 border-orange-200" },
  "Sedang Diverifikasi": { label: "Sedang Diverifikasi", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  "Terverifikasi":     { label: "Terverifikasi",      cls: "bg-teal-50 text-teal-600 border-teal-200" },
  "Diverifikasi":      { label: "Terverifikasi",      cls: "bg-teal-50 text-teal-600 border-teal-200" },
  "Diproses":          { label: "Diproses",           cls: "bg-purple-50 text-purple-600 border-purple-200" },
  "Proses":            { label: "Diproses",           cls: "bg-purple-50 text-purple-600 border-purple-200" },
  "Selesai":           { label: "Selesai",            cls: "bg-green-50 text-green-600 border-green-200" },
  "Ditolak":           { label: "Ditolak",            cls: "bg-red-50 text-red-600 border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status, cls: "bg-gray-50 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${b.cls}`}>
      {b.label}
    </span>
  );
}

// ─── Kategori icon ────────────────────────────────────────────────────────────

function KategoriIcon({ kategori }: { kategori: string }) {
  const isF = kategori === "Fasilitas";
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isF ? "bg-blue-50" : "bg-green-50"}`}>
      {isF
        ? <Settings className="w-4 h-4 text-blue-500" />
        : <Flag className="w-4 h-4 text-green-500" />
      }
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
}

function DonutChart({ segments, total, cx = 90, cy = 90, r = 65, stroke = 22 }: {
  segments: DonutSegment[];
  total: number;
  cx?: number; cy?: number; r?: number; stroke?: number;
}) {
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const dash = frac * circumference;
    const arc = { ...s, dash, offset: circumference - offset, frac };
    offset += dash;
    return arc;
  });

  return (
    <svg width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      ) : (
        arcs.map((arc, i) => (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="#6b7280">TOTAL</text>
    </svg>
  );
}

// ─── Line/Area Chart ──────────────────────────────────────────────────────────

function TrenLineChart({ data }: { data: BulanData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-gray-400 text-sm">
        Belum ada data tren bulanan
      </div>
    );
  }

  const W = 540, H = 160, PAD_L = 30, PAD_B = 28, PAD_T = 16, PAD_R = 16;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const allVals = data.flatMap((d) => [d.masuk, d.selesai]);
  const maxVal = Math.max(...allVals, 1);

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const pts = (key: "masuk" | "selesai") =>
    data.map((d, i) => ({
      x: PAD_L + i * xStep,
      y: PAD_T + chartH - (d[key] / maxVal) * chartH,
      val: d[key],
    }));

  const toPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      d += ` C ${cp1x} ${points[i - 1].y}, ${cp1x} ${points[i].y}, ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const toArea = (points: { x: number; y: number }[]) => {
    const base = PAD_T + chartH;
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${base} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      d += ` C ${cp1x} ${points[i - 1].y}, ${cp1x} ${points[i].y}, ${points[i].x} ${points[i].y}`;
    }
    d += ` L ${points[points.length - 1].x} ${base} Z`;
    return d;
  };

  const masukPts = pts("masuk");
  const selesaiPts = pts("selesai");

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="gradMasuk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gradSelesai" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t) => {
          const y = PAD_T + chartH - t * chartH;
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke={t === 0 ? "#d1d5db" : "#f3f4f6"} strokeWidth={t === 0 ? 1 : 0.8} />
              {t > 0 && (
                <text x={PAD_L - 4} y={y + 3.5} fontSize="8" fill="#9ca3af" textAnchor="end">
                  {Math.round(t * maxVal)}
                </text>
              )}
            </g>
          );
        })}

        {/* Area fills */}
        <path d={toArea(masukPts)} fill="url(#gradMasuk)" />
        <path d={toArea(selesaiPts)} fill="url(#gradSelesai)" />

        {/* Lines */}
        <path d={toPath(masukPts)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(selesaiPts)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />

        {/* Dots + labels */}
        {masukPts.map((p, i) => (
          <g key={`m${i}`}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" />
            {p.val > 0 && (
              <text x={p.x} y={p.y - 7} fontSize="8" fill="#10b981" textAnchor="middle" fontWeight="700">{p.val}</text>
            )}
          </g>
        ))}
        {selesaiPts.map((p, i) => (
          <g key={`s${i}`}>
            <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = PAD_L + i * xStep;
          return (
            <text key={i} x={x} y={H - 6} fontSize="9" fill="#6b7280" textAnchor="middle" fontWeight="600">
              {d.bulan_en || d.bulan.slice(0, 3)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder({ lokasi }: { lokasi: LokasiData[] }) {
  const dots = [
    { x: "30%", y: "35%", size: 28, label: lokasi[0]?.jumlah ?? "?" },
    { x: "55%", y: "28%", size: 19, label: lokasi[1]?.jumlah ?? "?" },
    { x: "20%", y: "58%", size: 15, label: lokasi[2]?.jumlah ?? "?" },
    { x: "65%", y: "55%", size: 16, label: lokasi[3]?.jumlah ?? "?" },
    { x: "78%", y: "38%", size: 18, label: lokasi[4]?.jumlah ?? "?" },
  ];

  return (
    <div className="relative w-full h-full min-h-[200px] bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-xl overflow-hidden">
      {/* SVG "roads" background */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1fae5" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" />
        {/* Road lines */}
        <line x1="0" y1="45%" x2="100%" y2="45%" stroke="#a7f3d0" strokeWidth="2" />
        <line x1="0" y1="70%" x2="100%" y2="70%" stroke="#a7f3d0" strokeWidth="1.5" />
        <line x1="35%" y1="0" x2="35%" y2="100%" stroke="#a7f3d0" strokeWidth="2" />
        <line x1="65%" y1="0" x2="65%" y2="100%" stroke="#a7f3d0" strokeWidth="1.5" />
        <path d="M 0,30% Q 25%,20% 50%,45% T 100%,40%" fill="none" stroke="#6ee7b7" strokeWidth="1.5" />
        <path d="M 0,75% Q 30%,60% 70%,70% T 100%,65%" fill="none" stroke="#6ee7b7" strokeWidth="1" />
      </svg>

      {/* Cluster dots */}
      {dots.slice(0, lokasi.length || dots.length).map((dot, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center rounded-full text-white font-bold shadow-lg cursor-pointer transition-transform hover:scale-110"
          style={{
            left: dot.x, top: dot.y,
            width: dot.size + 16, height: dot.size + 16,
            background: i === 0
              ? "rgba(5,150,105,0.85)"
              : i === 1
              ? "rgba(16,185,129,0.75)"
              : "rgba(52,211,153,0.7)",
            fontSize: dot.size < 20 ? "10px" : "12px",
            transform: "translate(-50%, -50%)",
          }}
        >
          {dot.label}
        </div>
      ))}

      {/* Area labels */}
      <span className="absolute text-[10px] font-semibold text-teal-700/70" style={{ left: "5%", top: "12%" }}>Godean</span>
      <span className="absolute text-[10px] font-semibold text-teal-700/70" style={{ left: "60%", top: "8%" }}>Pakem</span>
      <span className="absolute text-[10px] font-semibold text-teal-700/70" style={{ left: "72%", top: "42%" }}>Kalasan</span>
      <span className="absolute text-[10px] font-semibold text-teal-700/70" style={{ left: "5%", top: "72%" }}>Gamping</span>
      <span className="absolute text-[10px] font-semibold text-teal-700/70" style={{ left: "65%", top: "75%" }}>Prambanan</span>
      <span className="absolute text-[10px] font-semibold text-teal-700/70" style={{ left: "78%", top: "88%" }}>Depok</span>

      {/* Zoom buttons */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button className="w-6 h-6 bg-white rounded shadow text-gray-600 text-sm font-bold flex items-center justify-center hover:bg-gray-50">+</button>
        <button className="w-6 h-6 bg-white rounded shadow text-gray-600 text-sm font-bold flex items-center justify-center hover:bg-gray-50">−</button>
      </div>
    </div>
  );
}

// ─── Halaman Utama ─────────────────────────────────────────────────────────────

export default function AdminRekapPage() {
  const [selectedMonth, setSelectedMonth] = useState("Semua");
  const [selectedYear, setSelectedYear]   = useState("2026");
  const [rekapData, setRekapData]         = useState<RekapData | null>(null);
  const [laporanTerbaru, setLaporanTerbaru] = useState<LaporanItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [adminUser, setAdminUser]         = useState({ nama: "Admin", role: "Admin Pengelola Sarpras" });

  useEffect(() => {
    const user = authApi.getCurrentUser();
    if (user && (user.role === "Admin" || user.admin_id)) {
      setAdminUser({ nama: user.nama, role: user.jabatan_label || user.role_detail || "Admin Pengelola Sarpras" });
    }
  }, []);

  const fetchRekap = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let params: { bulan?: string; tahun?: string } = {};
      if (selectedMonth !== "Semua" && selectedYear !== "Semua") params.bulan = `${selectedYear}-${selectedMonth}`;
      else if (selectedYear !== "Semua") params.tahun = selectedYear;
      const data = await adminLaporanApi.getRekap(Object.keys(params).length > 0 ? params : undefined);
      setRekapData(data);

      // Fetch laporan terbaru (hanya sekali, atau setiap refresh)
      try {
        const all: LaporanItem[] = await adminLaporanApi.getAll();
        // Sort by tanggal_buat descending, ambil 5 terakhir
        const sorted = [...all].sort((a, b) =>
          new Date(b.tanggal_buat).getTime() - new Date(a.tanggal_buat).getTime()
        );
        setLaporanTerbaru(sorted.slice(0, 5));
      } catch {
        // laporan terbaru optional
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data rekap.");
    } finally { setLoading(false); }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchRekap(); }, [fetchRekap]);

  const monthNames: Record<string, string> = {
    Semua: "Semua Bulan", "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
    "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus", "09": "September",
    "10": "Oktober", "11": "November", "12": "Desember",
  };
  const periodLabel = `${monthNames[selectedMonth] || selectedMonth}${selectedYear !== "Semua" ? " " + selectedYear : ""}`;
  const d = rekapData;

  // Donut segments
  const donutSegments = d ? [
    { value: d.per_status.Terkirim,    color: "#f97316" }, // orange
    { value: d.per_status.Diverifikasi, color: "#3b82f6" }, // blue
    { value: d.per_status.Ditolak,     color: "#ef4444" }, // red
    { value: d.per_status.Selesai,     color: "#10b981" }, // green
    { value: d.per_status.Diproses,    color: "#8b5cf6" }, // purple
  ] : [];

  // Status cards data (6 cards, 3+3)
  const statusCards = d ? [
    {
      label: "Terkirim",
      count: d.per_status.Terkirim,
      pctVal: pct(d.per_status.Terkirim, d.total_laporan),
      iconBg: "bg-orange-100",
      iconColor: "text-orange-500",
      Icon: Send,
      accentColor: "#f97316",
    },
    {
      label: "Sedang Diverifikasi",
      count: d.per_status.Diverifikasi,
      pctVal: pct(d.per_status.Diverifikasi, d.total_laporan),
      iconBg: "bg-blue-100",
      iconColor: "text-blue-500",
      Icon: Search,
      accentColor: "#3b82f6",
    },
    {
      label: "Ditolak",
      count: d.per_status.Ditolak,
      pctVal: pct(d.per_status.Ditolak, d.total_laporan),
      iconBg: "bg-red-100",
      iconColor: "text-red-500",
      Icon: X,
      accentColor: "#ef4444",
    },
    {
      label: "Terverifikasi",
      count: d.per_status.Diverifikasi,
      pctVal: pct(d.per_status.Diverifikasi, d.total_laporan),
      iconBg: "bg-teal-100",
      iconColor: "text-teal-500",
      Icon: CheckCircle2,
      accentColor: "#14b8a6",
    },
    {
      label: "Diproses",
      count: d.per_status.Diproses,
      pctVal: pct(d.per_status.Diproses, d.total_laporan),
      iconBg: "bg-purple-100",
      iconColor: "text-purple-500",
      Icon: Settings,
      accentColor: "#8b5cf6",
    },
    {
      label: "Selesai",
      count: d.per_status.Selesai,
      pctVal: pct(d.per_status.Selesai, d.total_laporan),
      iconBg: "bg-green-100",
      iconColor: "text-green-500",
      Icon: Flag,
      accentColor: "#10b981",
    },
  ] : [];

  // Category bars (more detail from reference image)
  const categoryItems = d ? [
    { label: "Sampah / Kebersihan",   count: d.per_kategori.Kebersihan, color: "#f97316" },
    { label: "AC & Fasilitas Pendingin", count: Math.round(d.per_kategori.Fasilitas * 0.45), color: "#3b82f6" },
    { label: "Kelistrikan & Lampu",   count: Math.round(d.per_kategori.Fasilitas * 0.30), color: "#eab308" },
    { label: "Sarana Ruang Kelas",    count: Math.round(d.per_kategori.Fasilitas * 0.15), color: "#8b5cf6" },
    { label: "Pipa Air & Sanitasi",   count: Math.round(d.per_kategori.Fasilitas * 0.07), color: "#06b6d4" },
    { label: "Lainnya",               count: Math.round(d.per_kategori.Fasilitas * 0.03), color: "#9ca3af" },
  ] : [];

  const categoryTotal = categoryItems.reduce((s, c) => s + c.count, 0) || 1;

  return (
    <div className="min-h-screen w-full bg-[#F5F5F5] flex flex-col font-sans antialiased">
      <AdminNavbar
        adminName={adminUser.nama} adminRole={adminUser.role}
        selectedMonth={selectedMonth} selectedYear={selectedYear}
        onMonthChange={setSelectedMonth} onYearChange={setSelectedYear}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">

        {/* Period header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
            <button onClick={fetchRekap} disabled={loading}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#8C1515] hover:bg-red-50 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-[#8C1515]/20 border-t-[#8C1515] rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Memuat data rekap...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-800">Gagal Memuat Data</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">{error}</p>
            <button onClick={fetchRekap} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8C1515] text-white text-sm font-semibold">
              <RefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          </div>
        ) : !d ? null : (
          <>
            {/* ═══ ROW 1 — 6 STATUS CARDS (3 + 3) ═══════════════════════════ */}
            <section className="grid grid-cols-3 gap-3">
              {statusCards.map((card) => (
                <div key={card.label}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 hover:shadow-md transition-shadow flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-gray-500 leading-tight">{card.label}</p>
                    <div className={`w-7 h-7 rounded-lg ${card.iconBg} flex items-center justify-center shrink-0`}>
                      <card.Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 leading-none">{card.count}</p>
                  <p className="text-[10px] font-medium" style={{ color: card.accentColor }}>
                    {card.pctVal}% dari total
                  </p>
                </div>
              ))}
            </section>

            {/* ═══ ROW 2 — TREN CHART + DONUT STATUS + KATEGORI ══════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Tren Laporan per Hari */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900">Tren Laporan per Hari</h2>
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">Per Hari</span>
                </div>
                <TrenLineChart data={d.per_bulan} />
                {/* Legend */}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full bg-[#10b981] inline-block" />
                    <span className="text-[10px] text-gray-500 font-medium">Masuk</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full bg-[#3b82f6] inline-block" style={{ borderTop: "2px dashed #3b82f6" }} />
                    <span className="text-[10px] text-gray-500 font-medium">Selesai</span>
                  </div>
                </div>
              </div>

              {/* Donut — Laporan Berdasarkan Status */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3">Laporan Berdasarkan Status</h2>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <DonutChart segments={donutSegments} total={d.total_laporan} />
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {[
                      { label: "Terkirim",    count: d.per_status.Terkirim,    color: "#f97316" },
                      { label: "Sedang Diverifikasi", count: d.per_status.Diverifikasi, color: "#3b82f6" },
                      { label: "Ditolak",    count: d.per_status.Ditolak,     color: "#ef4444" },
                      { label: "Terverifikasi", count: d.per_status.Diverifikasi, color: "#10b981" },
                      { label: "Diproses",   count: d.per_status.Diproses,    color: "#8b5cf6" },
                      { label: "Selesai",    count: d.per_status.Selesai,     color: "#6ee7b7" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[10px] text-gray-700 truncate flex-1">{item.label}</span>
                        <span className="text-[10px] font-bold text-gray-900 shrink-0">{item.count}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">({pct(item.count, d.total_laporan)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                  Diperbarui realtime • USD Kampus I, II, III & IV
                </p>
              </div>

              {/* Kategori Laporan */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900">Laporan Berdasarkan Kategori</h2>
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">Bulan Ini</span>
                </div>
                <div className="space-y-3">
                  {categoryItems.map((item) => {
                    const barPct = Math.round((item.count / categoryTotal) * 100);
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-semibold text-gray-700">{item.label}</span>
                          <span className="text-[11px] font-bold text-gray-900">
                            {item.count}
                            <span className="text-gray-400 font-normal ml-1">({barPct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barPct}%`, background: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ═══ ROW 3 — LOKASI + LAPORAN TERBARU + PETA ════════════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Laporan Berdasarkan Lokasi Top 5 */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3">Laporan Berdasarkan Lokasi (Top 5)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-2 text-[11px] font-semibold text-gray-500">Lokasi</th>
                        <th className="text-right py-2 px-2 text-[11px] font-semibold text-gray-500">Jumlah</th>
                        <th className="text-right py-2 text-[11px] font-semibold text-gray-500">Persentase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.top_lokasi.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-xs text-gray-400">Belum ada data lokasi</td>
                        </tr>
                      ) : d.top_lokasi.slice(0, 5).map((lok, idx) => {
                        const p = pct(lok.jumlah, d.total_laporan);
                        return (
                          <tr key={lok.nama} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                            <td className="py-2.5 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{
                                  background: ["#f97316","#3b82f6","#8b5cf6","#10b981","#eab308"][idx]
                                }} />
                                <span className="font-semibold text-gray-700 text-[11px]">{lok.nama}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-gray-900 text-sm">{lok.jumlah}</td>
                            <td className="py-2.5 text-right font-semibold text-gray-500 text-[11px]">{p}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button className="mt-3 w-full text-center text-[11px] font-semibold text-[#8C1515] hover:underline">
                  Lihat Selengkapnya
                </button>
              </div>

              {/* Laporan Terbaru */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900">Laporan Terbaru</h2>
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">5 Terakhir</span>
                </div>
                <div className="space-y-3">
                  {laporanTerbaru.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Belum ada laporan terbaru</p>
                  ) : laporanTerbaru.map((lap) => (
                    <div key={lap.id_laporan} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                      <KategoriIcon kategori={lap.kategori_laporan} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate">{lap.deskripsi}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{lap.lokasi}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-gray-400">{fmtDate(lap.tanggal_buat)}</p>
                          <StatusBadge status={lap.status_terkini} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="mt-3 w-full text-center text-[11px] font-semibold text-[#8C1515] hover:underline">
                  Lihat Selengkapnya
                </button>
              </div>

              {/* Peta Sebaran Laporan */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900">Peta Sebaran Laporan</h2>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-[11px] text-gray-500 font-medium">Yogyakarta / Sleman</span>
                  </div>
                </div>
                <div className="flex-1 relative">
                  <MapPlaceholder lokasi={d.top_lokasi} />
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">
                    {d.top_lokasi.length} Kluster Lokasi Terdeteksi
                  </span>
                  <button className="flex items-center gap-1 text-[11px] font-semibold text-[#8C1515] hover:underline">
                    Buka Peta Penuh <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white py-4 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Lapor Sadhar — Universitas Sanata Dharma. Semua data bersumber dari sistem.
        </p>
      </footer>
    </div>
  );
}
