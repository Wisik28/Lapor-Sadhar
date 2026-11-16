"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  User,
  Calendar,
} from "lucide-react";
import { authApi } from "@/lib/api";

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
  adminName = "Admin",
  adminRole = "Administrator",
  onLogout,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await authApi.adminLogout();
      router.replace("/admin/login");
    }
  };

  const navLinks = [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Prioritas", href: "/admin/prioritas" }, // sementara dlu, nanti dihapus kl jadi satu sm dashboard
    { label: "Ubah Status", href: "/admin/ubah-status" }, 
    { label: "Riwayat", href: "/admin/riwayat" },
    { label: "Rekap", href: "/admin/rekap" },
    { label: "Akun", href: "/admin/account" },
  ];

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
    { value: "12", label: "Desember" },
  ];

  const years = ["Semua", "2026", "2025", "2024"];

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Sisi Kiri: Logo Lapor Sadhar */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center p-1 shadow-2xs transition-transform group-hover:scale-105">
                <Image
                  src="/assets/logo_usd.png"
                  alt="Logo USD"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-[#7A0C0C] transition-colors leading-tight">
                  Lapor Sadhar
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-none hidden sm:block">
                  Admin Portal USD
                </span>
              </div>
            </Link>
          </div>

          {/* Tengah: Navigasi Menu Admin (Semua 6 Halaman dengan Pill Style) */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {navLinks.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/admin/dashboard" && pathname === "/admin");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`text-xs sm:text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-[#EBD8D8] text-[#5C0C0C] font-semibold px-4 py-1.5 rounded-full shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 font-medium px-3.5 py-1.5 rounded-full hover:bg-slate-100/70"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sisi Kanan: Filter Periode (jika ada) & Profile Avatar Admin */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Filter Periode Bulan & Tahun (khusus di halaman yang membutuhkan) */}
            {onMonthChange && onYearChange && (
              <div className="hidden xl:flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#7A0C0C]" />
                <select
                  value={selectedMonth || "Semua"}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 py-0.5 px-1 outline-none cursor-pointer text-xs"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="text-slate-300">/</span>
                <select
                  value={selectedYear || "Semua"}
                  onChange={(e) => onYearChange(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 py-0.5 px-1 outline-none cursor-pointer text-xs"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Profile Avatar & Admin Label */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex flex-col items-center justify-center group focus:outline-none cursor-pointer p-1"
                aria-label="Menu Akun Admin"
              >
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 group-hover:border-slate-400 group-hover:text-slate-900 transition-colors bg-white shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 mt-0.5 leading-none">
                  Admin
                </span>
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{adminName}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{adminRole}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/admin/account"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#7A0C0C] transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Pengaturan Akun</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar Akun</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hamburger Button for Mobile / Tablet */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 shadow-lg">
          <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">{adminName}</p>
              <p className="text-[11px] text-slate-500">{adminRole}</p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#7A0C0C]/10 text-[#7A0C0C]">
              Admin
            </span>
          </div>

          <div className="space-y-1">
            {navLinks.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/admin/dashboard" && pathname === "/admin");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-[#EBD8D8] text-[#5C0C0C]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
