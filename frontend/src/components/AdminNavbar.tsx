"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  User,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { isReadOnlyAdmin } from "@/lib/admin-positions";

export interface AdminNavbarProps {
  adminName?: string;
  adminRole?: string;
  onLogout?: () => void;
}

export default function AdminNavbar({
  adminName = "Admin",
  adminRole = "Administrator",
  onLogout,
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

  const [sessionUser, setSessionUser] = useState<ReturnType<typeof authApi.getCurrentUser>>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setSessionUser(authApi.getCurrentUser());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isReadOnly = useMemo(() => {
    return isReadOnlyAdmin(sessionUser) || isReadOnlyAdmin({ jabatan_label: adminRole });
  }, [sessionUser, adminRole]);

  const navLinks = useMemo(() => {
    const allLinks = [
      { label: "Dashboard", href: "/admin/dashboard" },
      { label: "Prioritas", href: "/admin/prioritas" }, // sementara dlu, nanti dihapus kl jadi satu sm dashboard
      { label: "Ubah Status", href: "/admin/ubah-status" },
      { label: "Riwayat", href: "/admin/riwayat" },
      { label: "Rekap", href: "/admin/rekap" },
      { label: "Akun", href: "/admin/account" },
    ];

    if (isReadOnly) {
      return allLinks.filter(
        (item) =>
          item.href !== "/admin/dashboard" &&
          item.href !== "/admin/ubah-status" &&
          item.href !== "/admin/riwayat"
      );
    }

    return allLinks;
  }, [isReadOnly]);

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Sisi Kiri: Logo Lapor Sadhar */}
          <div className="flex items-center gap-3">
            <Link
              href={isReadOnly ? "/admin/prioritas" : "/admin/dashboard"}
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

          {/* Sisi Kanan: Profile Avatar Admin */}
          <div className="flex items-center gap-2.5 sm:gap-3">
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
