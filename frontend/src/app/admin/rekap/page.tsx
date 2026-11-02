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
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-gray-400 text-sm">
        Belum ada data tren bulanan
      </div>
    );
  }

  const W = 560, H = 210, PAD_L = 38, PAD_B = 34, PAD_T = 24, PAD_R = 16;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const allVals = data.flatMap((d) => [d.masuk, d.selesai]);
  const maxVal = Math.max(...allVals, 1);
  const totalMasuk = data.reduce((s, d) => s + d.masuk, 0);
  const totalSelesai = data.reduce((s, d) => s + d.selesai, 0);

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  const pts = (key: "masuk" | "selesai") =>
    data.map((d, i) => ({
      x: PAD_L + i * xStep,
      y: PAD_T + chartH - (d[key] / maxVal) * chartH,
      val: d[key],
      label: d.bulan_en || d.bulan.slice(0, 3),
    }));

  const toPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
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

  // Rounded y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i / yTickCount);

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Summary pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-[10px] font-semibold text-emerald-700">Total Masuk</span>
          <span className="text-[13px] font-extrabold text-emerald-800 ml-0.5">{totalMasuk}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span className="text-[10px] font-semibold text-blue-700">Total Selesai</span>
          <span className="text-[13px] font-extrabold text-blue-800 ml-0.5">{totalSelesai}</span>
        </div>
        {totalMasuk > 0 && (
          <div className="ml-auto text-[10px] font-semibold text-gray-400">
            Selesai:{" "}
            <span className="text-gray-700 font-bold">
              {Math.round((totalSelesai / totalMasuk) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-semibold w-fit">
          <span className="text-gray-400">{hovered.bulan_en || hovered.bulan}</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Masuk: <b>{hovered.masuk}</b>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Selesai: <b>{hovered.selesai}</b>
          </span>
        </div>
      )}
      {!hovered && (
        <div className="text-[10px] text-gray-400 italic">Arahkan kursor ke titik data untuk detail</div>
      )}

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="gradMasukV2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="gradSelesaiV2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Chart background */}
          <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH}
            fill="#fafafa" rx="6" />

          {/* Horizontal grid lines + Y labels */}
          {yTicks.map((t) => {
            const y = PAD_T + chartH - t * chartH;
            const val = Math.round(t * maxVal);
            return (
              <g key={t}>
                <line
                  x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke={t === 0 ? "#d1d5db" : "#e5e7eb"}
                  strokeWidth={t === 0 ? 1.2 : 0.7}
                  strokeDasharray={t > 0 ? "4 3" : ""}
                />
                <text x={PAD_L - 6} y={y + 4}
                  fontSize="10" fill="#9ca3af" textAnchor="end" fontWeight="600">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Vertical guide per column */}
          {masukPts.map((p, i) => (
            <line key={`vg${i}`}
              x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + chartH}
              stroke={hoveredIdx === i ? "#d1d5db" : "#f3f4f6"}
              strokeWidth={hoveredIdx === i ? 1.2 : 0.6} />
          ))}

          {/* Area fills */}
          <path d={toArea(masukPts)} fill="url(#gradMasukV2)" />
          <path d={toArea(selesaiPts)} fill="url(#gradSelesaiV2)" />

          {/* Lines */}
          <path d={toPath(masukPts)} fill="none" stroke="#10b981"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toPath(selesaiPts)} fill="none" stroke="#3b82f6"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="6 3" />

          {/* Masuk dots + value labels */}
          {masukPts.map((p, i) => (
            <g key={`m${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "pointer" }}>
              {/* Invisible hit area */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
              {/* Glow on hover */}
              {hoveredIdx === i && (
                <circle cx={p.x} cy={p.y} r="9" fill="#10b981" fillOpacity="0.15" />
              )}
              {/* Dot */}
              <circle cx={p.x} cy={p.y} r="4.5" fill="#10b981"
                stroke="#fff" strokeWidth="2" />
              {/* Value label above */}
              <text x={p.x} y={p.y - 10}
                fontSize="11" fill="#059669"
                textAnchor="middle" fontWeight="800">
                {p.val}
              </text>
            </g>
          ))}

          {/* Selesai dots + value labels */}
          {selesaiPts.map((p, i) => (
            <g key={`s${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
              {hoveredIdx === i && (
                <circle cx={p.x} cy={p.y} r="8" fill="#3b82f6" fillOpacity="0.12" />
              )}
              <circle cx={p.x} cy={p.y} r="4"
                fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
              {p.val > 0 && (
                <text x={p.x} y={p.y + 18}
                  fontSize="11" fill="#2563eb"
                  textAnchor="middle" fontWeight="800">
                  {p.val}
                </text>
              )}
            </g>
          ))}

          {/* X-axis bulan labels */}
          {data.map((d, i) => {
            const x = PAD_L + i * xStep;
            return (
              <text key={i} x={x} y={H - 10}
                fontSize="11" fill={hoveredIdx === i ? "#374151" : "#6b7280"}
                textAnchor="middle" fontWeight={hoveredIdx === i ? "800" : "600"}>
                {d.bulan_en || d.bulan.slice(0, 3)}
              </text>
            );
          })}

          {/* X-axis baseline */}
          <line x1={PAD_L} y1={PAD_T + chartH}
            x2={W - PAD_R} y2={PAD_T + chartH}
            stroke="#d1d5db" strokeWidth="1.2" />
        </svg>
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

  // Hanya 2 kategori real sesuai data sistem
  const categoryItems = d ? [
    { label: "Fasilitas",  count: d.per_kategori.Fasilitas,  color: "#3b82f6" },
    { label: "Kebersihan", count: d.per_kategori.Kebersihan, color: "#f97316" },
  ] : [];

  const categoryTotal = d ? (d.per_kategori.Fasilitas + d.per_kategori.Kebersihan) || 1 : 1;

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
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col gap-2 overflow-hidden"
                  style={{ borderLeft: `3px solid ${card.accentColor}` }}>
                  <div className="p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{card.label}</p>
                      <div className={`w-8 h-8 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                        <card.Icon className={`w-4 h-4 ${card.iconColor}`} />
                      </div>
                    </div>
                    <p className="text-3xl font-black text-gray-900 leading-none">{card.count}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${card.pctVal}%`, background: card.accentColor, opacity: 0.7 }} />
                      </div>
                      <p className="text-[10px] font-bold shrink-0" style={{ color: card.accentColor }}>
                        {card.pctVal}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* ═══ ROW 2 — TREN CHART + DONUT STATUS + KATEGORI ══════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Tren Laporan per Bulan */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Tren Laporan per Bulan</h2>
                    <p className="text-[10px] text-gray-400 mt-0.5">Masuk vs Selesai</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">Per Bulan</span>
                </div>
                <TrenLineChart data={d.per_bulan} />
              </div>

              {/* Donut — Laporan Berdasarkan Status */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Laporan Berdasarkan Status</h2>
                    <p className="text-[10px] text-gray-400 mt-0.5">Distribusi semua status</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <DonutChart segments={donutSegments} total={d.total_laporan} />
                  </div>
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {[
                      { label: "Terkirim",    count: d.per_status.Terkirim,    color: "#f97316" },
                      { label: "Diverifikasi", count: d.per_status.Diverifikasi, color: "#3b82f6" },
                      { label: "Ditolak",    count: d.per_status.Ditolak,     color: "#ef4444" },
                      { label: "Terverifikasi", count: d.per_status.Diverifikasi, color: "#10b981" },
                      { label: "Diproses",   count: d.per_status.Diproses,    color: "#8b5cf6" },
                      { label: "Selesai",    count: d.per_status.Selesai,     color: "#6ee7b7" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 group">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[10px] text-gray-600 truncate flex-1 group-hover:text-gray-900 transition-colors">{item.label}</span>
                        <span className="text-[11px] font-extrabold text-gray-900 shrink-0">{item.count}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">({pct(item.count, d.total_laporan)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 pt-3 border-t border-gray-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                  Diperbarui realtime • USD Kampus I, II, III &amp; IV
                </p>
              </div>

              {/* Kategori Laporan */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Laporan per Kategori</h2>
                    <p className="text-[10px] text-gray-400 mt-0.5">Distribusi jenis laporan</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">Semua Waktu</span>
                </div>
                <div className="space-y-3.5">
                  {categoryItems.map((item) => {
                    const barPct = Math.round((item.count / categoryTotal) * 100);
                    return (
                      <div key={item.label} className="group">
                        <div className="flex justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="text-[11px] font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">{item.label}</span>
                          </div>
                          <span className="text-[11px] font-extrabold text-gray-900 tabular-nums">
                            {item.count}
                            <span className="text-gray-400 font-normal ml-1">({barPct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barPct}%`, background: item.color, opacity: 0.85 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ═══ ROW 3 — LOKASI + LAPORAN TERBARU ════════════════════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Laporan Berdasarkan Lokasi Top 5 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Laporan per Lokasi</h2>
                    <p className="text-[10px] text-gray-400 mt-0.5">Top 5 lokasi terbanyak</p>
                  </div>
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg">Top 5</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Lokasi</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Jumlah</th>
                        <th className="text-right py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.top_lokasi.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-xs text-gray-400">Belum ada data lokasi</td>
                        </tr>
                      ) : d.top_lokasi.slice(0, 5).map((lok, idx) => {
                        const p = pct(lok.jumlah, d.total_laporan);
                        const colors = ["#f97316","#3b82f6","#8b5cf6","#10b981","#eab308"];
                        return (
                          <tr key={lok.nama} className="group border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors rounded-lg">
                            <td className="py-3 pr-2">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                                  style={{ background: colors[idx] }}>
                                  {idx + 1}
                                </span>
                                <span className="font-semibold text-gray-700 text-[11px] group-hover:text-gray-900 transition-colors">{lok.nama}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right font-black text-gray-900 text-sm tabular-nums">{lok.jumlah}</td>
                            <td className="py-3 text-right">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{ color: colors[idx], background: colors[idx] + "18" }}>
                                {p}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button className="mt-4 w-full py-2 text-center text-[11px] font-bold text-[#8C1515] bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors">
                  Lihat Selengkapnya
                </button>
              </div>

              {/* Laporan Terbaru */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Laporan Terbaru</h2>
                    <p className="text-[10px] text-gray-400 mt-0.5">Aktivitas laporan terkini</p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">5 Terakhir</span>
                </div>
                <div className="space-y-1">
                  {laporanTerbaru.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Belum ada laporan terbaru</p>
                  ) : laporanTerbaru.map((lap, i) => (
                    <div key={lap.id_laporan}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer"
                      style={{ borderLeft: i === 0 ? "2px solid #8C1515" : "2px solid transparent" }}>
                      <KategoriIcon kategori={lap.kategori_laporan} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate group-hover:text-gray-900">{lap.deskripsi}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{lap.lokasi}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] text-gray-400 tabular-nums">{fmtDate(lap.tanggal_buat)}</p>
                          <StatusBadge status={lap.status_terkini} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full py-2 text-center text-[11px] font-bold text-[#8C1515] bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors">
                  Lihat Selengkapnya
                </button>
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
