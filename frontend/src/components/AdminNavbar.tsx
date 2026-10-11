"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Calendar
} from "lucide-react";

export interface AdminNavbarProps {
  adminName?: string;
  adminRole?: string;
  onLogout?: () => void;
  selectedMonth?: string;
  selectedYear?: string;
  onMonthChange?: (month: string) => void;
  onYearChange?: (year: string) => void;
}

export default function AdminNavbar({
  adminName = "Bapak Hendro",
  adminRole = "Admin Pengelola Sarpras",
  onLogout,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange
}: AdminNavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const months = [
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
    { value: "12", label: "Desember" }
  ];

  const years = ["Semua", "2026", "2025", "2024"];

  const navLinks = [
    {
      label: "Dashboard",
      href: "/admin/dashboard"
    },
    {
      label: "Ubah Status",
      href: "/admin/ubah-status"
    },
    {
      label: "Riwayat",
      href: "/admin/riwayat"
    },
    {
      label: "Rekap",
      href: "/admin/rekap"
    }
  ];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      alert("Anda telah keluar dari akun Administrator SiLapor.");
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-gray-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Sisi Kiri: Logo USD & Nama SiLapor */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C1515] rounded-xl"
            >
              <div className="w-10 h-10 rounded-xl bg-[#8C1515] flex items-center justify-center p-1.5 shadow-xs transition-transform group-hover:scale-105">
                <img
                  src="/assets/logo_usd.png"
                  alt="Logo USD"
                  className="w-full h-full object-contain filter brightness-0 invert"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-gray-900 group-hover:text-[#8C1515] transition-colors leading-tight">
                  SiLapor
                </span>
                <span className="text-[11px] font-medium text-gray-500 hidden sm:block leading-none">
                  Universitas Sanata Dharma
                </span>
              </div>
            </Link>
          </div>

          {/* Tengah: Navigasi Menu Admin (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-gray-50/80 p-1.5 rounded-2xl border border-gray-200/60">
            {navLinks.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/admin/dashboard" && pathname === "/admin");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-[#8C1515] text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/80"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sisi Kanan: Filter Periode & Profil Admin */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Filter Periode Bulan & Tahun Menggunakan Dropdown Interaktif */}
            {onMonthChange && onYearChange && (
              <div className="hidden sm:flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-gray-300 shadow-2xs hover:border-[#8C1515] transition-colors">
                <div className="flex items-center gap-1 pl-1 text-gray-500 pointer-events-none">
                  <Calendar className="w-3.5 h-3.5 text-[#8C1515]" />
                  <span className="text-[11px] font-bold text-gray-600 hidden md:inline">
                    Periode:
                  </span>
                </div>
                
                {/* Dropdown Input Bulan */}
                <select
                  value={selectedMonth || "Semua"}
                  onChange={(e) => onMonthChange(e.target.value)}
                  aria-label="Pilih Bulan Laporan"
                  className="bg-gray-50 text-xs font-semibold text-gray-800 py-1.5 px-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8C1515] focus:bg-white cursor-pointer transition-all"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <span className="text-gray-300 font-bold">/</span>

                {/* Dropdown Input Tahun */}
                <select
                  value={selectedYear || "Semua"}
                  onChange={(e) => onYearChange(e.target.value)}
                  aria-label="Pilih Tahun Laporan"
                  className="bg-gray-50 text-xs font-semibold text-gray-800 py-1.5 px-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8C1515] focus:bg-white cursor-pointer transition-all"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y === "Semua" ? "Semua Tahun" : y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-bold text-gray-900 leading-tight">
                    {adminName}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#8C1515]/10 text-[#8C1515] uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {adminRole}
                </p>
              </div>

              {/* Avatar Icon */}
              <div className="w-10 h-10 rounded-full bg-red-50 border-2 border-[#8C1515]/20 flex items-center justify-center text-[#8C1515] shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Tombol Logout Desktop */}
            <button
              onClick={handleLogout}
              type="button"
              title="Keluar dari akun admin"
              className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Hamburger Mobile Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu navigasi"
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl text-gray-700 hover:text-[#8C1515] hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-800" />
              ) : (
                <Menu className="w-6 h-6 text-gray-800" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">{adminName}</p>
              <p className="text-xs text-gray-500">{adminRole}</p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#8C1515]/10 text-[#8C1515]">
              Admin
            </span>
          </div>

          {/* Filter Periode Bulan & Tahun di Mobile Drawer */}
          {onMonthChange && onYearChange && (
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Filter Periode Laporan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedMonth || "Semua"}
                  onChange={(e) => onMonthChange(e.target.value)}
                  aria-label="Filter Bulan Mobile"
                  className="min-h-[44px] px-3 py-2 bg-white rounded-xl border border-gray-200 text-xs font-semibold text-gray-800"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear || "Semua"}
                  onChange={(e) => onYearChange(e.target.value)}
                  aria-label="Filter Tahun Mobile"
                  className="min-h-[44px] px-3 py-2 bg-white rounded-xl border border-gray-200 text-xs font-semibold text-gray-800"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y === "Semua" ? "Semua Thn" : y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1 pt-1">
            {navLinks.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/admin/dashboard" && pathname === "/admin");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                    isActive
                      ? "bg-[#8C1515] text-white"
                      : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
