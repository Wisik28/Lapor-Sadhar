"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { PriorityLevel, SeverityLevel } from "@/lib/priorityApi";

interface PriorityScoreBadgeProps {
  score: number;
  level: PriorityLevel;
  size?: "sm" | "md" | "lg";
}

export function PriorityScoreBadge({ score, level, size = "md" }: PriorityScoreBadgeProps) {
  const config = {
    kritis: {
      bg: "bg-red-50 text-red-700 border-red-200",
      barBg: "bg-red-600",
      label: "Kritis",
      icon: ShieldAlert,
    },
    tinggi: {
      bg: "bg-orange-50 text-orange-700 border-orange-200",
      barBg: "bg-orange-500",
      label: "Tinggi",
      icon: AlertTriangle,
    },
    sedang: {
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      barBg: "bg-amber-500",
      label: "Sedang",
      icon: Clock,
    },
    rendah: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      barBg: "bg-emerald-500",
      label: "Rendah",
      icon: CheckCircle2,
    },
  }[level] || {
    bg: "bg-gray-50 text-gray-700 border-gray-200",
    barBg: "bg-gray-400",
    label: "Sedang",
    icon: Clock,
  };

  const Icon = config.icon;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${config.bg}`}
      >
        <span className="font-mono">{score}</span>
        <span className="text-[10px] opacity-75">/ 100</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs ${config.bg}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="font-mono text-sm leading-none">{score}</span>
        <span className="uppercase text-[10px] tracking-wider font-extrabold ml-0.5">
          {config.label}
        </span>
      </div>
      {/* Progress mini indicator */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${config.barBg}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

interface SeverityBadgeProps {
  severity: SeverityLevel;
  source?: "ai" | "admin" | "rule_fallback";
  needsReview?: boolean;
}

export function SeverityBadge({ severity, source = "ai", needsReview = false }: SeverityBadgeProps) {
  const sevConfig = {
    berat: {
      bg: "bg-red-100 text-red-800 border-red-300",
      dot: "bg-red-600",
      label: "Berat",
      desc: "Bahaya Keselamatan / Gangguan Total",
    },
    sedang: {
      bg: "bg-amber-100 text-amber-800 border-amber-300",
      dot: "bg-amber-500",
      label: "Sedang",
      desc: "Gangguan Sebagian / Kenyamanan",
    },
    ringan: {
      bg: "bg-blue-100 text-blue-800 border-blue-300",
      dot: "bg-blue-500",
      label: "Ringan",
      desc: "Minor / Kosmetik",
    },
  }[severity] || {
    bg: "bg-gray-100 text-gray-800 border-gray-300",
    dot: "bg-gray-400",
    label: "Sedang",
    desc: "-",
  };

  return (
    <div className="flex flex-col gap-1 items-start">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${sevConfig.bg}`}
        title={sevConfig.desc}
      >
        <span className={`w-2 h-2 rounded-full ${sevConfig.dot}`} />
        <span>{sevConfig.label}</span>
      </span>

      {needsReview ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
          <Sparkles className="w-3 h-3 text-purple-600" />
          <span>Usulan AI (Perlu Konfirmasi)</span>
        </span>
      ) : source === "admin" ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Ditetapkan Admin</span>
        </span>
      ) : null}
    </div>
  );
}

