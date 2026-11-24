"use client";

import React from "react";

export type AdminDashboardStatus =
  | "Terkirim"
  | "Diverifikasi"
  | "Diproses"
  | "Ditolak"
  | "Selesai";

export function normalizeAdminStatus(val?: string | null): AdminDashboardStatus {
  const s = (val || "Terkirim").trim().toLowerCase();
  if (s.includes("tolak")) return "Ditolak";
  if (s.includes("selesai")) return "Selesai";
  if (s.includes("proses") || s.includes("kerja")) return "Diproses";
  if (s.includes("verifikasi")) return "Diverifikasi";
  return "Terkirim";
}

const STATUS_STYLE_MAP: Record<
  AdminDashboardStatus,
  { badge: string; dot: string; label: string }
> = {
  Terkirim: {
    badge: "bg-blue-50 text-[#3B82F6] border-blue-200/60",
    dot: "bg-[#3B82F6]",
    label: "Terkirim",
  },
  Diverifikasi: {
    badge: "bg-indigo-50 text-indigo-600 border-indigo-200/60",
    dot: "bg-indigo-600",
    label: "Diverifikasi",
  },
  Diproses: {
    badge: "bg-amber-50 text-[#F59E0B] border-amber-200/60",
    dot: "bg-[#F59E0B]",
    label: "Diproses",
  },
  Ditolak: {
    badge: "bg-red-50 text-[#EF4444] border-red-200/60",
    dot: "bg-[#EF4444]",
    label: "Ditolak",
  },
  Selesai: {
    badge: "bg-emerald-50 text-[#10B981] border-emerald-200/60",
    dot: "bg-[#10B981]",
    label: "Selesai",
  },
};

export interface AdminStatusBadgeProps {
  status?: string | null;
  className?: string;
}

/**
 * Badge status laporan terpadu untuk konsistensi antara /admin/dashboard dan /admin/prioritas.
 */
export function AdminStatusBadge({ status, className = "" }: AdminStatusBadgeProps) {
  const normalized = normalizeAdminStatus(status);
  const style = STATUS_STYLE_MAP[normalized];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style.badge} ${className}`.trim()}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      {style.label}
    </span>
  );
}

