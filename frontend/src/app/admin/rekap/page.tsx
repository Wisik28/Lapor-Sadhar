"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { authApi, adminLaporanApi } from "@/lib/api";
import {
  Timer, Star, ShieldCheck, CheckCircle2, AlertCircle,
  Clock, Inbox, Wrench, MapPin, RefreshCw, Layers, TrendingUp, Wallet,
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
  per_status: { Terkirim: number; Diverifikasi: number; Diproses: number; Selesai: number; Ditolak: number };
  per_kategori: { Fasilitas: number; Kebersihan: number };
  per_bulan: BulanData[];
  top_lokasi: LokasiData[];
  dominasi_lokasi: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function formatRupiah(val: number): string {
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
  if (val >= 1_000_000)     return `Rp ${(val / 1_000_000).toFixed(1)} jt`;
  if (val >= 1_000)         return `Rp ${(val / 1_000).toFixed(0)} rb`;
  return `Rp ${val}`;
}

// ─── Chart Tren Masuk vs Selesai ─────────────────────────────────────────────

function DualBarChart({ data }: { data: BulanData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-gray-400 text-sm">
        Belum ada data tren bulanan
      </div>
    );
  }

  const MIN_SLOTS = 5;
  const slots = Math.max(data.length, MIN_SLOTS);

  const slotArr = Array.from({ length: slots }, (_, i) => {
    if (i < data.length) {
      return { label: data[i].bulan_en || data[i].bulan.slice(0,3), masuk: data[i].masuk, selesai: data[i].selesai, hasData: true, key: data[i].key };
    }
    const monthIdx = data.length > 0 ? (parseInt(data[0].key.split("-")[1],10) - 1 + i) % 12 : i % 12;
    return { label: SHORT_MONTHS[monthIdx], masuk: 0, selesai: 0, hasData: false, key: `e-${i}` };
  });

  const maxVal = Math.max(...slotArr.flatMap(s => [s.masuk, s.selesai]), 1);
  const chartH = 150;
  const BAR_W  = 16;
  const BAR_GAP = 4;   // jarak antar 2 bar dalam 1 bulan
  const SLOT_W  = BAR_W * 2 + BAR_GAP;
  const SLOT_PAD = 20;
  const LEFT = 28;
  const totalW = LEFT + slots * (SLOT_W + SLOT_PAD);

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      <div className="flex items-center gap-5 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: "#8C1515" }} />
          <span className="text-xs font-semibold text-black">Laporan Selesai</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm border border-gray-400" style={{ background: "#e5e7eb" }} />
          <span className="text-xs font-semibold text-black">Laporan Masuk</span>
        </div>
      </div>

      <svg
        width="100%"
        height={chartH + 44}
        viewBox={`0 0 ${totalW} ${chartH + 44}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = r === 0 ? chartH : chartH - r * chartH;
          return (
            <g key={r}>
              <line
                x1={LEFT} y1={y} x2={totalW} y2={y}
                stroke={r === 0 ? "#000" : "#e5e7eb"}
                strokeWidth={r === 0 ? 1 : 0.8}
              />
              {r > 0 && (
                <text x={LEFT - 5} y={y + 3.5} fontSize="9" fill="#6b7280" textAnchor="end">
                  {Math.round(r * maxVal)}
                </text>
              )}
            </g>
          );
        })}

        {/* Bars */}
        {slotArr.map((slot, i) => {
          const xBase  = LEFT + i * (SLOT_W + SLOT_PAD) + SLOT_PAD / 2;
          const xMasuk   = xBase;
          const xSelesai = xBase + BAR_W + BAR_GAP;

          const hMasuk   = slot.masuk   > 0 ? Math.max(4, (slot.masuk   / maxVal) * chartH) : 0;
          const hSelesai = slot.selesai > 0 ? Math.max(4, (slot.selesai / maxVal) * chartH) : 0;

          const labelY = chartH + 18;

          return (
            <g key={slot.key}>
              {/* Masuk bar — abu-abu muda, border gelap */}
              {slot.hasData && hMasuk > 0 ? (
                <rect
                  x={xMasuk} y={chartH - hMasuk} width={BAR_W} height={hMasuk}
                  fill="#e5e7eb"
                  stroke="#9ca3af"
                  strokeWidth="1"
                  rx="3"
                />
              ) : (
                <rect x={xMasuk} y={4} width={BAR_W} height={chartH - 4} fill="#f9fafb" stroke="#f0f0f0" strokeWidth="0.5" rx="3" />
              )}
              {slot.masuk > 0 && (
                <text x={xMasuk + BAR_W / 2} y={chartH - hMasuk - 5} fontSize="9" fill="#374151" textAnchor="middle" fontWeight="600">
                  {slot.masuk}
                </text>
              )}

              {/* Selesai bar — merah solid */}
              {slot.selesai > 0 ? (
                <>
                  <rect
                    x={xSelesai} y={chartH - hSelesai} width={BAR_W} height={hSelesai}
                    fill="#8C1515" rx="3"
                  />
                  <text x={xSelesai + BAR_W / 2} y={chartH - hSelesai - 5} fontSize="9" fill="#8C1515" textAnchor="middle" fontWeight="700">
                    {slot.selesai}
                  </text>
                </>
              ) : (
                <rect x={xSelesai} y={4} width={BAR_W} height={chartH - 4} fill="#f9fafb" stroke="#f0f0f0" strokeWidth="0.5" rx="3" />
              )}

              {/* Month label */}
              <text
                x={xBase + SLOT_W / 2} y={labelY}
                fontSize="10" fill={slot.hasData ? "#111" : "#d1d5db"}
                textAnchor="middle" fontWeight={slot.hasData ? "600" : "400"}
              >
                {slot.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${score >= s ? "text-yellow-400 fill-yellow-400" : score >= s-0.5 ? "text-yellow-300 fill-yellow-100" : "text-gray-200 fill-gray-100"}`} />
      ))}
    </div>
  );
}

// ─── Halaman Utama ─────────────────────────────────────────────────────────────

export default function AdminRekapPage() {
  const [selectedMonth, setSelectedMonth] = useState("Semua");
  const [selectedYear, setSelectedYear]   = useState("2026");
  const [rekapData, setRekapData]         = useState<RekapData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [adminUser, setAdminUser]         = useState({ nama: "Admin", role: "Admin Pengelola Sarpras" });

  useEffect(() => {
    const user = authApi.getCurrentUser();
    if (user && (user.role === "Admin" || user.admin_id)) {
      setAdminUser({ nama: user.nama, role: (user as any).role_detail || "Admin Pengelola Sarpras" });
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data rekap.");
    } finally { setLoading(false); }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchRekap(); }, [fetchRekap]);

  const monthNames: Record<string,string> = {
    Semua:"Semua Bulan","01":"Januari","02":"Februari","03":"Maret","04":"April",
    "05":"Mei","06":"Juni","07":"Juli","08":"Agustus","09":"September",
    "10":"Oktober","11":"November","12":"Desember",
  };
  const periodLabel = `${monthNames[selectedMonth] || selectedMonth}${selectedYear !== "Semua" ? " "+selectedYear : ""}`;
  const d = rekapData;

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB] flex flex-col font-sans antialiased">
      <AdminNavbar
        adminName={adminUser.nama} adminRole={adminUser.role}
        selectedMonth={selectedMonth} selectedYear={selectedYear}
        onMonthChange={setSelectedMonth} onYearChange={setSelectedYear}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white px-4 py-3 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8C1515]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rekap &amp; Analitik Laporan</span>
            <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">{periodLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Ringkasan performa penanganan sarana prasarana.</span>
            <button onClick={fetchRekap} disabled={loading} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#8C1515] hover:bg-red-50 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Loading */}
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
            {/* ═══ BARIS 1 — 4 KPI CARDS ══════════════════════════════════════ */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

              {/* Card 1 — Rata-rata Waktu Resolusi */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-[3px] bg-[#8C1515]" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Rata-rata Waktu Resolusi</p>
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                      <Timer className="w-4 h-4" />
                    </div>
                  </div>
                  {d.rata_resolusi_jam !== null ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">{d.rata_resolusi_jam.toFixed(1)}</span>
                        <span className="text-sm font-semibold text-gray-500">Jam</span>
                      </div>
                      <div className="mt-2">
                        {d.rata_resolusi_jam <= d.sla_target_jam ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8C1515] bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Tercapai (Target &lt; {d.sla_target_jam}j)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            Target &lt; {d.sla_target_jam} jam
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-extrabold text-gray-200 mt-1">—</p>
                      <p className="text-[10px] text-gray-400 mt-1">Belum ada data selesai</p>
                    </>
                  )}
                </div>
              </div>

              {/* Card 2 — Kepuasan Pelapor */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-[3px] bg-[#8C1515]" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Kepuasan Pelapor</p>
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                      <Star className="w-4 h-4" />
                    </div>
                  </div>
                  {d.kepuasan_score !== null ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">{d.kepuasan_score.toFixed(1)}</span>
                        <span className="text-sm font-semibold text-gray-500">/ 5.0</span>
                      </div>
                      <StarRating score={d.kepuasan_score} />
                      <p className="text-[10px] text-gray-400 mt-1">Berdasarkan {d.total_selesai} laporan selesai</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-extrabold text-gray-200 mt-1">—</p>
                      <p className="text-[10px] text-gray-400 mt-1">Belum ada data selesai</p>
                    </>
                  )}
                </div>
              </div>

              {/* Card 3 — Tingkat Ketepatan SLA */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-[3px] bg-[#8C1515]" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Tingkat Ketepatan SLA</p>
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  {d.tingkat_sla !== null ? (
                    <>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">{d.tingkat_sla.toFixed(1)}</span>
                        <span className="text-lg font-bold text-gray-500">%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#8C1515] transition-all duration-700"
                          style={{ width: `${d.tingkat_sla}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        {d.selesai_dalam_sla} dari {d.total_selesai} tiket selesai
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-extrabold text-gray-200 mt-1">—</p>
                      <p className="text-[10px] text-gray-400 mt-1">Belum ada data selesai</p>
                    </>
                  )}
                </div>
              </div>

              {/* Card 4 — Realisasi Anggaran */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-[3px] bg-[#8C1515]" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Realisasi Anggaran</p>
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-extrabold text-gray-900">
                      {formatRupiah(d.realisasi_anggaran)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#8C1515] transition-all duration-700"
                      style={{ width: `${Math.min(d.pct_anggaran, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    {d.pct_anggaran.toFixed(1)}% dari {formatRupiah(d.budget_target)} target
                  </p>
                </div>
              </div>
            </section>

            {/* ═══ BARIS 2 — CHART + KATEGORI ════════════════════════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Chart Tren */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#8C1515]" />
                      Tren Laporan Masuk vs. Selesai
                    </h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Perbandingan kuantitas perbaikan semester berjalan
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                    {d.per_bulan.filter(b => b.masuk > 0).length} Bulan
                  </span>
                </div>

                <DualBarChart data={d.per_bulan} />

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-[11px]">
                  <span className="text-gray-400">
                    Rata-rata tingkat penyelesaian tiket:{" "}
                    <span className="font-bold text-gray-700">{d.persentase_selesai}%</span>
                  </span>
                  {d.persentase_selesai >= 80 && (
                    <span className="text-[#8C1515] font-semibold">Kapasitas penanganan optimal</span>
                  )}
                </div>
              </div>

              {/* Kategori + Lokasi */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-0.5">Kategori Laporan</h2>
                <p className="text-[11px] text-gray-400 mb-4">Sebaran masalah utama</p>

                <div className="space-y-4">
                  {[
                    { label: "Fasilitas",  count: d.per_kategori.Fasilitas  },
                    { label: "Kebersihan", count: d.per_kategori.Kebersihan },
                  ].map((item) => {
                    const pct = d.total_laporan > 0 ? Math.round((item.count / d.total_laporan) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-800">{item.label}</span>
                          <span className="text-xs font-bold text-gray-900">{item.count}</span>
                        </div>
                        <div className="h-2 rounded-sm bg-gray-100 overflow-hidden">
                          <div className="h-full bg-[#8C1515] transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{pct}% dari total</p>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 my-4" />

                <h3 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#8C1515]" />
                  Lokasi Terbanyak
                </h3>
                {d.top_lokasi.length === 0 ? (
                  <p className="text-xs text-gray-400">Belum ada data lokasi</p>
                ) : (
                  <div className="space-y-3">
                    {d.top_lokasi.map((lok) => {
                      const pct = d.total_laporan > 0 ? Math.round((lok.jumlah / d.total_laporan) * 100) : 0;
                      return (
                        <div key={lok.nama}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[11px] font-semibold text-gray-700 truncate max-w-[72%]" title={lok.nama}>{lok.nama}</span>
                            <span className="text-[11px] font-bold text-gray-900 shrink-0 ml-1">{lok.jumlah}</span>
                          </div>
                          <div className="h-1.5 rounded-sm bg-gray-100 overflow-hidden">
                            <div className="h-full bg-[#8C1515] transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.dominasi_lokasi && (
                  <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                    Dominasi laporan: <span className="font-semibold text-gray-700">{d.dominasi_lokasi}</span>
                  </p>
                )}
              </div>
            </section>

            {/* ═══ BARIS 3 — REKAP STATUS ═════════════════════════════════════ */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#8C1515]" />
                    Rekap Status Laporan
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Rincian jumlah dan persentase per status dalam periode ini</p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                  Total: {d.total_laporan}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Jumlah</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Proporsi</th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {([
                      { key:"Terkirim",     label:"Terkirim",     icon:<Inbox className="w-3.5 h-3.5"/>,         count: d.per_status.Terkirim },
                      { key:"Diverifikasi", label:"Diverifikasi", icon:<Clock className="w-3.5 h-3.5"/>,         count: d.per_status.Diverifikasi },
                      { key:"Diproses",     label:"Diproses",     icon:<Wrench className="w-3.5 h-3.5"/>,       count: d.per_status.Diproses },
                      { key:"Selesai",      label:"Selesai",      icon:<CheckCircle2 className="w-3.5 h-3.5"/>,  count: d.per_status.Selesai },
                      { key:"Ditolak",      label:"Ditolak",      icon:<AlertCircle className="w-3.5 h-3.5"/>,   count: d.per_status.Ditolak },
                    ] as const).map((s) => {
                      const pct = d.total_laporan > 0 ? Math.round((s.count / d.total_laporan) * 100) : 0;
                      return (
                        <tr key={s.key} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-700">
                              {s.icon} {s.label}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="text-base font-extrabold text-gray-900">{s.count}</span>
                          </td>
                          <td className="px-5 py-3.5 min-w-[120px]">
                            <div className="h-2 rounded-sm bg-gray-100 overflow-hidden">
                              <div className="h-full bg-[#8C1515] transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-gray-700 text-sm">{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-5 py-3 font-bold text-gray-900 text-sm">Total Keseluruhan</td>
                      <td className="px-5 py-3 text-center font-extrabold text-gray-900 text-base">{d.total_laporan}</td>
                      <td className="px-5 py-3">
                        <div className="h-2 rounded-sm bg-[#8C1515] opacity-30" />
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">100%</td>
                    </tr>
                  </tbody>
                </table>
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
