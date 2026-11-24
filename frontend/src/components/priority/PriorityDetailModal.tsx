"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Paperclip,
} from "lucide-react";
import {
  priorityApi,
  PriorityReportItem,
  PriorityDetailData,
  SeverityLevel,
} from "@/lib/priorityApi";
import { getFotoUrl as getBaseFotoUrl, getThumbnailFotoUrl } from "@/lib/laporanPhoto";
import { AdminStatusBadge } from "@/components/AdminStatusBadge";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { NetworkErrorAlert } from "@/components/NetworkErrorAlert";
import { authApi } from "@/lib/api";
import { isReadOnlyAdmin } from "@/lib/admin-positions";
import { formatUserFriendlyError } from "@/lib/networkError";

interface PriorityDetailModalProps {
  report: PriorityReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  hideAiAnalysis?: boolean;
  hideScoreBreakdown?: boolean;
  hideHandlingInfo?: boolean;
  readOnly?: boolean;
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

function extractRawFotoList(fotoSource: unknown): string[] {
  if (!fotoSource) return [];

  if (Array.isArray(fotoSource)) {
    return fotoSource
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as { url?: string; path?: string };
          return (obj.url || obj.path || "").trim();
        }
        return "";
      })
      .filter((url) => url.length > 0);
  }

  if (typeof fotoSource === "string") {
    const trimmed = fotoSource.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              if (typeof item === "string") return item.trim();
              if (item && typeof item === "object") {
                const obj = item as { url?: string; path?: string };
                return (obj.url || obj.path || "").trim();
              }
              return "";
            })
            .filter((url) => url.length > 0);
        }
      } catch {
        // Lanjut sebagai teks biasa jika bukan JSON valid
      }
    }

    if (!trimmed.startsWith("data:image/") && trimmed.includes(",")) {
      const parts = trimmed
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
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
  readOnly = false,
}: PriorityDetailModalProps) {
  const [detailData, setDetailData] = useState<PriorityDetailData | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel>("sedang");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const reportExtra = report as PriorityReportItem & {
    fotos?: unknown;
    attachments?: unknown;
  };

  const rawFoto =
    detailData?.laporan?.foto ||
    reportExtra?.fotos ||
    reportExtra?.attachments ||
    report?.foto;

  const rawFotoItems = useMemo(() => extractRawFotoList(rawFoto), [rawFoto]);
  const hasBlobOnly = useMemo(
    () =>
      rawFotoItems.length > 0 &&
      rawFotoItems.every((item) => item.startsWith("blob:")),
    [rawFotoItems]
  );

  const fotoList = useMemo(
    () => rawFotoItems.map(resolveFotoUrl).filter((url) => url.length > 0),
    [rawFotoItems]
  );

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
      const data = await priorityApi.getReportDetail(id);
      setDetailData(data);
    } catch (err) {
      setErrorMessage(
        formatUserFriendlyError(
          err,
          "load",
          "Gagal memuat detail laporan. Silakan coba lagi."
        )
      );
    }
  };

  if (!isOpen || !report) return null;

  const canEditSeverity =
    !readOnly &&
    typeof window !== "undefined" &&
    Boolean(localStorage.getItem("admin_token")) &&
    !isReadOnlyAdmin(authApi.getCurrentUser());

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
    } catch (err) {
      setErrorMessage(
        formatUserFriendlyError(
          err,
          "submit",
          "Gagal menyimpan penetapan prioritas. Silakan coba lagi."
        )
      );
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
              <div className="text-xs text-gray-500 font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
                <span>
                  Kategori:{" "}
                  <span className="font-semibold text-gray-700">
                    {report.kategori_laporan}
                  </span>
                </span>
                <span>•</span>
                <span>Status:</span>
                <AdminStatusBadge status={report.status_terkini} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <NetworkErrorAlert
              message={errorMessage}
              onRetry={() => {
                setErrorMessage(null);
                void loadDetail(report.id_laporan);
              }}
              retrying={isSaving}
              onDismiss={() => setErrorMessage(null)}
            />
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

            {/* Lokasi Kejadian */}
            <div className="p-3.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#8C1515]" />
                  Lokasi Kejadian (Input Pengguna):
                </span>
                {(report.kategori_lokasi || detailData?.laporan?.kategori_lokasi) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <span>Kategori Sistem:</span>
                    <span className="text-[#8C1515]">
                      {detailData?.laporan?.kategori_lokasi || report.kategori_lokasi}
                    </span>
                    {(report.tingkat_keparahan_lokasi ||
                      detailData?.laporan?.tingkat_keparahan) && (
                      <span className="text-slate-500 font-medium">
                        •{" "}
                        {detailData?.laporan?.tingkat_keparahan ||
                          report.tingkat_keparahan_lokasi}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 break-words leading-snug">
                {detailData?.laporan?.lokasi ||
                  report.lokasi ||
                  "Lokasi tidak dicantumkan."}
              </p>
            </div>

            {/* Pelapor, Tanggal, dan Lama Menunggu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-gray-600">
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                <User className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] text-gray-400 font-medium">
                    Pelapor
                  </span>
                  <span className="truncate font-semibold text-gray-800 block">
                    {report.nama_pelapor}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] text-gray-400 font-medium">
                    Waktu Buat
                  </span>
                  <span className="truncate font-semibold text-gray-800 block">
                    {report.lama_menunggu}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] text-gray-400 font-medium">
                    Lama Menunggu
                  </span>
                  <span className="truncate font-semibold text-gray-800 block">
                    {report.lama_menunggu_hari} hari
                  </span>
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
              hasBlobOnly ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  Foto pada laporan ini gagal tersimpan ke server saat pengajuan awal.
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-gray-50 border border-gray-200/80 text-gray-400 text-xs">
                  <FileText className="w-5 h-5 opacity-60 shrink-0" />
                  <span>Tidak ada foto terlampir pada laporan ini.</span>
                </div>
              )
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
                    className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className="group relative block w-full h-48 cursor-pointer focus:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getThumbnailFotoUrl(fotoUrl, 600)}
                        alt={`Bukti foto ${idx + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-xl bg-white/95 text-gray-900 text-xs font-bold shadow-md flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-[#8C1515]" />
                          Lihat Foto
                        </span>
                      </div>
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white shadow-xs">
                        Foto #{idx + 1}
                      </span>
                    </button>

                    {/* Fallback jika file tidak ditemukan di storage lokal */}
                    <div className="hidden h-48 w-full flex-col items-center justify-center p-4 text-center gap-2 bg-white">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Paperclip className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        Gambar tidak dapat dimuat
                      </p>
                      <p className="text-[11px] text-slate-400">
                        File foto tidak tersedia di penyimpanan lokal
                      </p>
                      {!fotoUrl.startsWith("data:") && (
                        <a
                          href={fotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-[#8C1515] hover:underline"
                        >
                          Buka Tautan Asli ↗
                        </a>
                      )}
                    </div>
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
                <p className="text-xs font-semibold text-gray-700">
                  Alasan Analisis AI:
                </p>
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
                  Total Skor: {report.priority_score} / 100 (
                  {report.priority_level.toUpperCase()})
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

          {/* Form Penetapan / Override oleh Admin */}
          {canEditSeverity ? (
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "berat",
                    label: "Berat (100 Poin)",
                    sub: "Bahaya keselamatan / henti operasional",
                    activeBg:
                      "bg-red-50 border-red-500 ring-2 ring-red-500/20 text-red-900",
                  },
                  {
                    id: "sedang",
                    label: "Sedang (50 Poin)",
                    sub: "Gangguan fungsi sebagian / kenyamanan",
                    activeBg:
                      "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900",
                  },
                  {
                    id: "ringan",
                    label: "Ringan (20 Poin)",
                    sub: "Minor, tidak mengganggu fungsi utama",
                    activeBg:
                      "bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900",
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
                          : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.label}</span>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-current" : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-current" />
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                        {opt.sub}
                      </p>
                    </button>
                  );
                })}
              </div>

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
                <p className="font-bold text-amber-900">
                  Informasi Penanganan Laporan
                </p>
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
                        Diubah dari{" "}
                        <span className="uppercase text-gray-500">
                          {item.original_level}
                        </span>{" "}
                        →{" "}
                        <span className="uppercase font-bold text-[#8C1515]">
                          {item.corrected_level}
                        </span>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(item.created_at).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-gray-600 italic text-[11px]">
                        &ldquo;{item.note}&rdquo;
                      </p>
                    )}
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
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
          {canEditSeverity && (
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
      <ImagePreviewModal
        images={fotoList}
        activeIndex={activePhotoIndex}
        onClose={() => setActivePhotoIndex(null)}
        onChangeIndex={setActivePhotoIndex}
        titlePrefix="Foto Bukti"
      />
    </div>
  );
}