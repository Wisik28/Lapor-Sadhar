"use client";

import React from "react";
import { Calendar } from "lucide-react";

export const PERIOD_MONTH_OPTIONS = [
  { value: "Semua", label: "Semua Bulan" },
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
] as const;

export const PERIOD_YEAR_OPTIONS = ["Semua", "2026", "2025", "2024"] as const;

export interface PeriodFilterProps {
  selectedDay?: string;
  selectedMonth: string;
  selectedYear: string;
  onDayChange?: (day: string) => void;
  onMonthChange: (month: string) => void;
  onYearChange: (year: string) => void;
}

function getDaysInMonth(month: string, year: string): number {
  if (!month || month === "Semua") return 31;
  const m = Number(month);
  if (Number.isNaN(m) || m < 1 || m > 12) return 31;
  const y = year && year !== "Semua" ? Number(year) : 2024; // 2024 kabisat agar 29 Feb tetap bisa dipilih saat tahun "Semua"
  return new Date(Number.isNaN(y) ? 2024 : y, m, 0).getDate();
}

/**
 * Reusable day, month, and year period selector used in admin report pages.
 */
export default function PeriodFilter({
  selectedDay,
  selectedMonth,
  selectedYear,
  onDayChange,
  onMonthChange,
  onYearChange,
}: PeriodFilterProps) {
  const maxDays = getDaysInMonth(selectedMonth, selectedYear);
  const dayOptions = Array.from({ length: maxDays }, (_, idx) =>
    String(idx + 1).padStart(2, "0")
  );

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
      <Calendar className="w-3.5 h-3.5 text-[#7A0C0C] shrink-0" />
      {onDayChange && (
        <>
          <select
            aria-label="Filter Tanggal"
            value={selectedDay || "Semua"}
            onChange={(e) => onDayChange(e.target.value)}
            className="bg-transparent font-medium text-slate-700 py-0.5 px-1 outline-none cursor-pointer text-xs"
          >
            <option value="Semua">Semua Tanggal</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="text-slate-300">/</span>
        </>
      )}
      <select
        aria-label="Filter Bulan"
        value={selectedMonth || "Semua"}
        onChange={(e) => onMonthChange(e.target.value)}
        className="bg-transparent font-medium text-slate-700 py-0.5 px-1 outline-none cursor-pointer text-xs"
      >
        {PERIOD_MONTH_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <span className="text-slate-300">/</span>
      <select
        aria-label="Filter Tahun"
        value={selectedYear || "Semua"}
        onChange={(e) => onYearChange(e.target.value)}
        className="bg-transparent font-medium text-slate-700 py-0.5 px-1 outline-none cursor-pointer text-xs"
      >
        {PERIOD_YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y === "Semua" ? "Semua Tahun" : y}
          </option>
        ))}
      </select>
    </div>
  );
}

