"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MapPin,
  User,
  Info,
  Clock,
  Send,
  History,
  FileText,
  ImageIcon,
  Eye,
  ExternalLink
} from "lucide-react";
import {
  priorityApi,
  PriorityReportItem,
  PriorityDetailData,
  SeverityLevel
} from "@/lib/priorityApi";
import { PriorityScoreBadge, SeverityBadge } from "./PriorityScoreBadge";

interface PriorityDetailModalProps {
  report: PriorityReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  hideAiAnalysis?: boolean;
  hideScoreBreakdown?: boolean;
  hideHandlingInfo?: boolean;
}

function getFotoList(fotoSource: any): string[] {
  if (!fotoSource) return [];

  if (Array.isArray(fotoSource)) {
    return fotoSource
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") return (item.url || item.path || "").trim();
        return "";
      })
      .filter((url) => url.length > 0);
  }

  if (typeof fotoSource === "string") {
    const trimmed = fotoSource.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              if (typeof item === "string") return item.trim();
              if (item && typeof item === "object") return (item.url || item.path || "").trim();
              return "";
            })
            .filter((url) => url.length > 0);
        }
      } catch {
        // Fallback jika bukan JSON valid
      }
    }

    if (trimmed.includes(",")) {
      const parts = trimmed.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
      if (parts.length > 1) {
        return parts;
      }
    }

    return [trimmed];
  }

  return [];
}

export function PriorityDetailModal({
  report,
  isOpen,
  onClose,
  onUpdated,
  hideAiAnalysis = false,
  hideScoreBreakdown = false,
  hideHandlingInfo = false,
}: PriorityDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState<PriorityDetailData | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel>("sedang");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const rawFoto =
    detailData?.laporan?.foto ||
    (report as any)?.fotos ||
    (report as any)?.attachments ||
    report?.foto;

  const fotoList = useMemo(() => getFotoList(rawFoto), [rawFoto]);

  useEffect(() => {
    if (isOpen && report) {
      setSelectedSeverity(report.admin_severity || report.severity_level || "sedang");
      setAdminNotes(report.admin_notes || "");
      setSaveSuccess(false);
      setErrorMessage(null);
      setActivePhotoIndex(null);
      loadDetail(report.id_laporan);
    } else {
      setDetailData(null);
      setActivePhotoIndex(null);
    }
  }, [isOpen, report]);

  const loadDetail = async (id: number) => {
    try {
      setLoading(true);
      const data = await priorityApi.getReportDetail(id);
      setDetailData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !report) return null;

  const handleSaveSeverity = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await priorityApi.updateSeverity(report.id_laporan, selectedSeverity, adminNotes);
      setSaveSuccess(true);
      onUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan penetapan prioritas.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#8C1515] text-white rounded-xl text-xs font-bold tracking-wider">
              #{report.id_laporan}
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {hideAiAnalysis ? "Detail Laporan" : "Penetapan Prioritas & Verifikasi AI"}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Kategori: <span className="font-semibold text-gray-700">{report.kategori_laporan}</span> • Status:{" "}
                <span className="font-semibold text-gray-700">{report.status_terkini}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Tingkat kerusakan dan skor prioritas berhasil diperbarui!</span>
            </div>
          )}

          {/* Info Laporan */}
          <div className="space-y-3">
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Deskripsi Laporan Civitas:
              </p>
              <p className="text-sm text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">
                {report.deskripsi}
              </p>
            </div>

            {/* Lokasi Kejadian (Sama persis seperti yang diinputkan user) */}
            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#8C1515]" />
                  Lokasi Kejadian (Input Pengguna):
                </span>
                {/* Konteks Kategori Sistem Backend */}
                {(report.kategori_lokasi || detailData?.laporan?.kategori_lokasi) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <span>Kategori Sistem:</span>
                    <span className="text-[#8C1515]">
                      {detailData?.laporan?.kategori_lokasi || report.kategori_lokasi}
                    </span>
                    {(report.tingkat_keparahan_lokasi || detailData?.laporan?.tingkat_keparahan) && (
                      <span className="text-slate-500 font-medium">
                        • {detailData?.laporan?.tingkat_keparahan || report.tingkat_keparahan_lokasi}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 break-words leading-snug">
                {detailData?.laporan?.lokasi || report.lokasi || "Lokasi tidak dicantumkan."}
              </p>
            </div>

            {/* Pelapor, Tanggal, dan Lama Menunggu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-gray-600">
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                <User className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] text-gray-400 font-medium">Pelapor</span>
                  <span className="truncate font-semibold text-gray-800 block">{report.nama_pelapor}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] text-gray-400 font-medium">Waktu Buat</span>
                  <span className="truncate font-semibold text-gray-800 block">{report.lama_menunggu}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] text-gray-400 font-medium">Lama Menunggu</span>
                  <span className="truncate font-semibold text-gray-800 block">{report.lama_menunggu_hari} hari</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lampiran Seluruh Foto Bukti */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#8C1515]" />
                <span>Foto Bukti Kerusakan ({fotoList.length} Foto)</span>
              </p>
              {fotoList.length > 0 && (
                <span className="text-[11px] text-gray-400 font-medium">
                  Klik foto untuk melihat ukuran penuh
                </span>
              )}
            </div>

            {fotoList.length === 0 ? (
              <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-gray-50 border border-gray-200/80 text-gray-400 text-xs">
                <FileText className="w-5 h-5 opacity-60 shrink-0" />
                <span>Tidak ada foto terlampir pada laporan ini.</span>
              </div>
            ) : (
              <div
                className={`grid gap-3.5 ${
                  fotoList.length === 1
                    ? "grid-cols-1 sm:grid-cols-2 max-w-xl"
                    : fotoList.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                }`}
              >
                {fotoList.map((fotoUrl, idx) => (
                  <div
                    key={`${fotoUrl}-${idx}`}
                    onClick={() => setActivePhotoIndex(idx)}
                    className="group relative h-48 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotoUrl}
                      alt={`Bukti foto ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-xl bg-white/95 text-gray-900 text-xs font-bold shadow-md flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-[#8C1515]" />
                        Lihat Foto
                      </span>
                    </div>
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white shadow-xs">
                      Foto #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kartu Analisis AI */}
          {!hideAiAnalysis && (
            <div className="p-5 bg-linear-to-br from-purple-50/80 to-indigo-50/50 rounded-2xl border border-purple-100/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Usulan Analisis AI (Sistem Cerdas)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  Tingkat Keyakinan: {Math.round(report.confidence * 100)}%
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-semibold text-gray-700">Alasan Analisis AI:</p>
                <ul className="space-y-1 text-xs text-gray-700">
                  {report.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {report.safety_flags && report.safety_flags.length > 0 && (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-xs font-bold text-red-700 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    Indikator Bahaya Langsung:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {report.safety_flags.map((flag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-red-100 border border-red-300 text-red-800 text-[11px] font-bold"
                      >
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Breakdown Faktor Skor */}
          {!hideScoreBreakdown && detailData?.breakdown && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Rincian Kontribusi Skor Prioritas
                </span>
                <span className="text-xs font-bold text-[#8C1515]">
                  Total Skor: {report.priority_score} / 100 ({report.priority_level.toUpperCase()})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {Object.entries(detailData.breakdown).map(([factor, val]) => (
                  <div
                    key={factor}
                    className="bg-white p-2 rounded-xl border border-gray-200 flex flex-col justify-between"
                  >
                    <span className="text-gray-500 font-medium capitalize text-[11px]">
                      {factor.replace(/_/g, " ")}
                    </span>
                    <span className="font-bold text-gray-900 mt-1">+{val} poin</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Penetapan / Override oleh Admin (Hanya untuk Admin) */}
          {typeof window !== "undefined" && localStorage.getItem("admin_token") ? (
            <div className="p-5 bg-white rounded-2xl border-2 border-[#8C1515]/20 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>Penetapan Tingkat Kerusakan oleh Admin</span>
                  <span className="text-[11px] font-medium text-gray-500">
                    (Menggantikan usulan AI secara otomatis)
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pilih tingkat kerusakan yang sesuai berdasarkan hasil verifikasi lapangan atau foto:
                </p>
              </div>

              {/* Opsi Radio Tingkat Kerusakan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "berat",
                    label: "Berat (100 Poin)",
                    sub: "Bahaya keselamatan / henti operasional",
                    border: "border-red-300",
                    activeBg: "bg-red-50 border-red-500 ring-2 ring-red-500/20 text-red-900",
                  },
                  {
                    id: "sedang",
                    label: "Sedang (50 Poin)",
                    sub: "Gangguan fungsi sebagian / kenyamanan",
                    border: "border-amber-300",
                    activeBg: "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900",
                  },
                  {
                    id: "ringan",
                    label: "Ringan (20 Poin)",
                    sub: "Minor, tidak mengganggu fungsi utama",
                    border: "border-blue-300",
                    activeBg: "bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900",
                  },
                ].map((opt) => {
                  const isSelected = selectedSeverity === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedSeverity(opt.id as SeverityLevel)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? opt.activeBg
                          : `bg-white hover:bg-gray-50 text-gray-700 border-gray-200`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.label}</span>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-current" : "border-gray-300"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">{opt.sub}</p>
                    </button>
                  );
                })}
              </div>

              {/* Catatan Admin */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Catatan Verifikasi / Alasan Penetapan Admin (Opsional):
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Contoh: Sudah dicek petugas lapangan, plafon memang rawan runtuh sehingga diprioritaskan darurat..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8C1515] focus:border-[#8C1515] transition-all bg-gray-50 focus:bg-white"
                />
              </div>
            </div>
          ) : !hideHandlingInfo ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3 text-xs text-amber-800">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Informasi Penanganan Laporan</p>
                <p className="mt-0.5 text-amber-700 leading-relaxed">
                  Skor dan tingkat prioritas dihitung secara otomatis untuk memandu antrean penanganan oleh pengelola sarana dan prasarana (BLU / BPS). Penetapan prioritas final dan perubahan status dikelola langsung oleh tim admin.
                </p>
              </div>
            </div>
          ) : null}

          {/* Riwayat Koreksi Sebelumnya */}
          {detailData?.feedback && detailData.feedback.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-gray-500" />
                Riwayat Penetapan Admin Sebelumnya
              </span>
              <div className="space-y-2">
                {detailData.feedback.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs text-gray-700 space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        Diubah dari <span className="uppercase text-gray-500">{item.original_level}</span> →{" "}
                        <span className="uppercase font-bold text-[#8C1515]">
                          {item.corrected_level}
                        </span>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(item.created_at).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    {item.note && <p className="text-gray-600 italic text-[11px]">"{item.note}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Tutup
          </button>
          {typeof window !== "undefined" && localStorage.getItem("admin_token") && (
            <button
              type="button"
              onClick={handleSaveSeverity}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#8C1515] hover:bg-[#701010] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Simpan Penetapan Prioritas</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Lightbox / Preview Ukuran Penuh Foto */}
      {activePhotoIndex !== null && fotoList[activePhotoIndex] && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setActivePhotoIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <span className="text-sm font-bold">
                Foto Bukti #{activePhotoIndex + 1} dari {fotoList.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={fotoList[activePhotoIndex]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePhotoIndex(null)}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative w-full max-h-[75vh] flex items-center justify-center bg-black/50 rounded-2xl overflow-hidden border border-white/10 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoList[activePhotoIndex]}
                alt={`Preview Foto ${activePhotoIndex + 1}`}
                className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {fotoList.length > 1 && (
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev !== null ? (prev - 1 + fotoList.length) % fotoList.length : 0
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Sebelumnya
                </button>
                <div className="flex gap-1.5">
                  {fotoList.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActivePhotoIndex(i)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        i === activePhotoIndex ? "bg-white w-6" : "bg-white/40 w-2.5"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev !== null ? (prev + 1) % fotoList.length : 0
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

