"use client";

import React from "react";
import { User } from "lucide-react";

export interface NavbarProps {
  pageTitle: string;
  userName?: string;
  userRole?: string;
}

export default function Navbar({
  pageTitle,
  userName = "Agustinus",
  userRole = "Mahasiswa"
}: NavbarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-xs">
      {/* Left Side: Dynamic Page Title */}
      <div className="flex flex-col">
        <h1 className="text-base font-bold text-slate-900 leading-tight">
          {pageTitle}
        </h1>
        <p className="text-xs text-slate-500 hidden sm:block">
          Lapor Sadhar - Universitas Sanata Dharma
        </p>
      </div>

      {/* Right Side: Profile Icon & User Info */}
      <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
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
