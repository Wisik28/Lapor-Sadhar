"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  X,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  Info,
  Clock,
  History,
  FileText,
  ImageIcon,
  Eye,
  Paperclip,
  Trash2,
  Layers,
  Users,
  ExternalLink,
} from "lucide-react";
import {
  priorityApi,
  PriorityReportItem,
  PriorityDetailData,
} from "@/lib/priorityApi";
import { getFotoUrl as getBaseFotoUrl, getThumbnailFotoUrl } from "@/lib/laporanPhoto";
import {
  AdminStatusBadge,
  normalizeAdminStatus,
} from "@/components/AdminStatusBadge";
import { DeleteRejectedReportModal } from "@/components/DeleteRejectedReportModal";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { NetworkErrorAlert } from "@/components/NetworkErrorAlert";
import { authApi } from "@/lib/api";
import { canAdminManageLaporan, isReadOnlyAdmin } from "@/lib/admin-positions";
import { getReporterIdentityLabel } from "@/lib/reporterIdentity";
import { formatUserFriendlyError } from "@/lib/networkError";

interface PriorityDetailModalProps {
  report: PriorityReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: (deletedId: number) => void;
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

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function PriorityDetailModal({
  report,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
  hideAiAnalysis = false,
  hideScoreBreakdown = false,
  hideHandlingInfo = false,
  readOnly = false,
}: PriorityDetailModalProps) {
  const [detailData, setDetailData] = useState<PriorityDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"utama" | "grup">("utama");
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[];
    index: number;
    titlePrefix: string;
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

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

  const reportId = report?.id_laporan ?? null;

  useEffect(() => {
    if (!isOpen || reportId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      setDetailData(null);
      setErrorMessage(null);
      setActiveTab("utama");
      setPreviewGallery(null);
      setIsDeleteModalOpen(false);
      setLoadingDetail(true);
    });

    priorityApi
      .getReportDetail(reportId, controller.signal)
      .then((data) => {
        if (active) {
          setDetailData(data);
        }
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setErrorMessage(
          formatUserFriendlyError(
            err,
            "load",
            "Gagal memuat detail laporan. Silakan coba lagi."
          )
        );
      })
      .finally(() => {
        if (active) {
          setLoadingDetail(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isOpen, reportId, reloadNonce]);

  if (!isOpen || !report) return null;

  const currentAdmin =
    typeof window !== "undefined" ? authApi.getCurrentUser() : null;
  const hasAdminToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("admin_token"));

  const currentStatus = normalizeAdminStatus(report.status_terkini);
  const isRejectedReport = currentStatus === "Ditolak";

  const groupInfo = detailData?.group ?? null;
  const groupMembers = groupInfo?.members ?? [];
  const totalGroupCount =
    groupInfo?.total_laporan_count ?? report.group_member_count ?? 1;
  const uniqueReportersCount =
    groupInfo?.unique_reporter_count ?? report.group_unique_reporters ?? 1;
  const isGroupEscalated = Boolean(
    groupInfo?.is_escalated ?? report.is_group_escalated
  );
  const hasGroup = totalGroupCount > 1;
  const primaryReportId = groupInfo?.primary_laporan_id ?? report.id_laporan;

  const canFollowUpStatus =
    !readOnly &&
    hasAdminToken &&
    !isReadOnlyAdmin(currentAdmin) &&
    !isRejectedReport &&
    canAdminManageLaporan(currentAdmin, {
      kategori_laporan:
        detailData?.laporan?.kategori_laporan ?? report.kategori_laporan,
      lokasi_kampus:
        detailData?.laporan?.lokasi_kampus ?? report.lokasi_kampus,
      lokasi: detailData?.laporan?.lokasi ?? report.lokasi,
    });

  const canDeleteRejected =
    !readOnly &&
    hasAdminToken &&
    isRejectedReport &&
    canAdminManageLaporan(currentAdmin, {
      kategori_laporan:
        detailData?.laporan?.kategori_laporan ?? report.kategori_laporan,
      lokasi_kampus:
        detailData?.laporan?.lokasi_kampus ?? report.lokasi_kampus,
      lokasi: detailData?.laporan?.lokasi ?? report.lokasi,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-3 py-1 bg-[#8C1515] text-white rounded-xl text-xs font-bold tracking-wider shrink-0">
              #{String(report.id_laporan).padStart(3, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {hasGroup
                    ? "Detail Grup Laporan Serupa"
                    : hideAiAnalysis
                      ? "Detail Laporan"
                      : "Detail Prioritas Laporan"}
                </h2>
                {hasGroup && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      isGroupEscalated
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    <Layers className="w-3 h-3 shrink-0" />
                    <span>{totalGroupCount} Laporan Serupa</span>
                  </span>
                )}
              </div>
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
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher Ringkas untuk Tiket Tergabung */}
        {hasGroup && (
          <div className="px-6 pt-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("utama")}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "utama"
                    ? "border-[#8C1515] text-[#8C1515]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Tiket Utama
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("grup")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "grup"
                    ? "border-[#8C1515] text-[#8C1515]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Anggota Grup ({groupMembers.length || totalGroupCount})</span>
              </button>
            </div>
            <div className="pb-2 flex items-center gap-2 text-[11px] font-semibold">
              <span className="text-slate-600">
                {uniqueReportersCount} pelapor berbeda
              </span>
              {isGroupEscalated && (
                <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">
                  Eskalasi Otomatis
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <NetworkErrorAlert
              message={errorMessage}
              onRetry={() => {
                setErrorMessage(null);
                setReloadNonce((n) => n + 1);
              }}
              retrying={loadingDetail}
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          {/* Banner Eskalasi Otomatis untuk Grup (>= 3 pelapor berbeda) */}
          {hasGroup && isGroupEscalated && (
            <div className="px-4 py-3 bg-red-50/80 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-900">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">
                  Prioritas Dieskalasi Otomatis ke Tingkat Tertinggi (Skor {report.priority_score})
                </p>
                <p className="text-red-800/90 leading-relaxed">
                  Tercatat <strong>{uniqueReportersCount} pelapor berbeda</strong> ({totalGroupCount} laporan serupa) melaporkan kerusakan/masalah fisik yang sama di lokasi ini. Perubahan status pada tiket utama otomatis disinkronkan ke seluruh anggota grup.
                </p>
              </div>
            </div>
          )}

          {activeTab === "grup" && hasGroup ? (
            /* Daftar Ringkas Seluruh Anggota Grup (bersih, tanpa nested card berlebihan) */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  Seluruh laporan yang terdeteksi merujuk pada masalah fisik yang sama:
                </p>
                {groupInfo?.similarity_confidence != null && (
                  <span className="text-[11px] text-slate-500">
                    Keyakinan verifikasi AI:{" "}
                    <strong className="text-slate-700">
                      {Math.round(groupInfo.similarity_confidence * 100)}%
                    </strong>
                  </span>
                )}
              </div>

              {loadingDetail && groupMembers.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <div className="w-6 h-6 border-2 border-[#8C1515]/20 border-t-[#8C1515] rounded-full animate-spin" />
                  <span>Memuat daftar anggota grup...</span>
                </div>
              ) : groupMembers.length === 0 ? (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-500">
                  Data anggota grup tidak tersedia.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white overflow-hidden">
                  {groupMembers.map((member, memberIdx) => {
                    const memberPhotos = extractRawFotoList(member.foto)
                      .map(resolveFotoUrl)
                      .filter((url) => url.length > 0);

                    return (
                      <div key={member.id_laporan} className="p-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#8C1515]">
                              #{String(member.id_laporan).padStart(3, "0")}
                            </span>
                            {member.is_primary && (
                              <span className="px-2 py-0.5 rounded-md bg-[#8C1515]/10 text-[#8C1515] text-[10px] font-bold">
                                Tiket Utama
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-900">
                              {member.nama_pelapor}
                            </span>
                            {member.nim && (
                              <span className="text-[11px] font-mono text-slate-500">
                                ({getReporterIdentityLabel(member.nim)}: {member.nim})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{formatDateTime(member.tanggal_buat)}</span>
                            {member.status_terkini && (
                              <AdminStatusBadge status={member.status_terkini} />
                            )}
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {member.deskripsi || "-"}
                        </p>

                        {member.similarity_reason && !member.is_primary && (
                          <p className="text-[11px] text-slate-500 italic">
                            Catatan pencocokan AI: {member.similarity_reason}
                          </p>
                        )}

                        {memberPhotos.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {memberPhotos.map((photoUrl, photoIdx) => (
                              <button
                                key={`${member.id_laporan}-${photoIdx}`}
                                type="button"
                                onClick={() =>
                                  setPreviewGallery({
                                    images: memberPhotos,
                                    index: photoIdx,
                                    titlePrefix: `Foto Bukti #${String(member.id_laporan).padStart(3, "0")}`,
                                  })
                                }
                                className="group relative w-24 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8C1515]"
                                title="Klik untuk melihat ukuran penuh"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getThumbnailFotoUrl(photoUrl, 300)}
                                  alt={`Foto pelapor ${memberIdx + 1} #${photoIdx + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                <span className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-4 h-4 text-white" />
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            Tidak ada lampiran foto pada laporan ini.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab Tiket Utama */
            <>
              {/* Info Laporan */}
              <div className="space-y-3">
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Deskripsi Laporan Civitas:
                    </p>
                    {hasGroup && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("grup")}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#8C1515] hover:underline cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Lihat {groupMembers.length || totalGroupCount} laporan serupa →</span>
                      </button>
                    )}
                  </div>
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
                        {hasGroup ? "Pelapor Pertama" : "Pelapor"}
                      </span>
                      <span className="truncate font-semibold text-gray-800 block">
                        {report.nama_pelapor}
                      </span>
                      {report.nim && (
                        <span className="truncate text-[10px] text-gray-500 font-mono block">
                          {getReporterIdentityLabel(report.nim)}: {report.nim}
                        </span>
                      )}
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

              {/* Lampiran Seluruh Foto Bukti Tiket Utama */}
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
                          onClick={() =>
                            setPreviewGallery({
                              images: fotoList,
                              index: idx,
                              titlePrefix: "Foto Bukti",
                            })
                          }
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
                      <span>Analisis Prioritas Otomatis</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                      Tingkat Keyakinan: {Math.round(report.confidence * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-gray-700">
                      Dasar Penilaian Sistem:
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

              {/* Info Status Ditolak atau Read-Only Prioritas */}
              {isRejectedReport && canDeleteRejected ? (
                <div className="p-4 bg-red-50/80 rounded-2xl border border-red-200 flex items-start gap-3 text-xs text-red-800">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900">
                      Laporan Berstatus Ditolak
                    </p>
                    <p className="mt-0.5 text-red-700 leading-relaxed">
                      Laporan yang sudah berstatus Ditolak tidak dapat ditindaklanjuti lagi. Anda dapat menghapus laporan ini dari sistem melalui tombol <strong>Hapus Laporan</strong> di bawah.
                    </p>
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
                      Skor dan tingkat prioritas dihitung serta dieskalasi secara otomatis oleh sistem (bersifat read-only) untuk memandu antrean penanganan oleh pengelola sarana dan prasarana (BLU / BPS).
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Riwayat Koreksi Sebelumnya (jika ada data historis) */}
              {detailData?.feedback && detailData.feedback.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-gray-500" />
                    Riwayat Penetapan Sebelumnya
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
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Skor prioritas bersifat otomatis (read-only).
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            {canDeleteRejected && (
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Laporan</span>
              </button>
            )}
            {canFollowUpStatus && (
              <Link
                href={`/admin/ubah-status?id=${primaryReportId}`}
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#8C1515] hover:bg-[#701010] text-white text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {hasGroup ? "Tindak Lanjuti Grup" : "Tindak Lanjuti Tiket"}
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Laporan Ditolak */}
      <DeleteRejectedReportModal
        report={{
          id_laporan: report.id_laporan,
          deskripsi: report.deskripsi,
          lokasi: detailData?.laporan?.lokasi || report.lokasi,
        }}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleted={(deletedId) => {
          setIsDeleteModalOpen(false);
          setPreviewGallery(null);
          if (onDeleted) {
            onDeleted(deletedId);
          } else {
            onUpdated();
          }
          onClose();
        }}
      />

      {/* Lightbox / Preview Ukuran Penuh Foto */}
      <ImagePreviewModal
        images={previewGallery?.images ?? []}
        activeIndex={previewGallery?.index ?? null}
        onClose={() => setPreviewGallery(null)}
        onChangeIndex={(nextIdx) =>
          setPreviewGallery((prev) =>
            prev ? { ...prev, index: nextIdx } : null
          )
        }
        titlePrefix={previewGallery?.titlePrefix ?? "Foto Bukti"}
      />
    </div>
  );
}
