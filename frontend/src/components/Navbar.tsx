"use client";

import React from "react";
import { User, Menu } from "lucide-react";

export interface NavbarProps {
  pageTitle: string;
  userName?: string;
  userRole?: string;
  onToggleSidebar?: () => void;
}

export default function Navbar({
  pageTitle,
  userName = "Agustinus",
  userRole = "Mahasiswa",
  onToggleSidebar
}: NavbarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20 shadow-xs">
      {/* Left Side: Mobile Menu Button & Dynamic Page Title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Buka menu navigasi"
            className="md:hidden flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-slate-700 hover:text-[#7A0C0C] hover:bg-slate-100 active:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A0C0C]"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        <div className="flex flex-col">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Lapor Sadhar - Universitas Sanata Dharma
          </p>
        </div>
      </div>

      {/* Right Side: Profile Icon & User Info */}
      <div className="flex items-center gap-2 sm:gap-3 pl-3 sm:pl-4 border-l border-slate-200">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-800 leading-none">
            {userName}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {userRole}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-[#7A0C0C]/30 flex items-center justify-center text-[#7A0C0C] shadow-xs">
          <User className="w-5 h-5" />
        </div>
      </div>
    </header>
  );
}
