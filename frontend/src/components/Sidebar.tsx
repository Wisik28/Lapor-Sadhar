"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  FilePlus,
  Eye,
  History,
  FileEdit,
  LogOut
} from "lucide-react";

export interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onLogout?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "buat-laporan", label: "Buat Laporan", icon: FilePlus },
  { id: "lihat-status", label: "Lihat Status", icon: Eye },
  { id: "riwayat-laporan", label: "Riwayat Laporan", icon: History },
  { id: "rubah-pengajuan", label: "Rubah Pengajuan", icon: FileEdit }
];

export default function Sidebar({
  activeMenu,
  setActiveMenu,
  onLogout
}: SidebarProps) {
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      alert("Anda telah keluar dari akun.");
    }
  };

  return (
    <aside className="relative w-64 text-white flex flex-col justify-between shrink-0 shadow-2xl z-20 overflow-hidden bg-[#7A0C0C]">
      {/* ------------------------------------------------------------- */}
      {/* BACKGROUND IMAGE: sidebar.png */}
      {/* ------------------------------------------------------------- */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transform scale-105"
        style={{ backgroundImage: "url('/assets/sidebar.png')" }}
      />

      {/* ------------------------------------------------------------- */}
      {/* OVERLAY MERAH MARUN (Maroon Overlay) */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#7A0C0C]/85 via-[#7A0C0C]/80 to-[#520808]/90 backdrop-brightness-90 pointer-events-none" />

      {/* ------------------------------------------------------------- */}
      {/* KONTEN SIDEBAR (Z-10 di atas overlay) */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          {/* Header Sidebar / Brand USD */}
          <div className="p-5 border-b border-white/15 flex items-center gap-3 bg-white/5 backdrop-blur-xs">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner p-1 overflow-hidden shrink-0">
              <img
                src="/assets/logo_usd.png"
                alt="Logo USD"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight tracking-wide text-white drop-shadow-xs">
                Lapor Sadhar
              </h2>
              <p className="text-xs text-red-200/90 font-medium">
                Universitas Sanata Dharma
              </p>
            </div>
          </div>

          {/* Navigasi Menu dengan Animasi Active Indicator */}
          <nav className="p-4 space-y-2.5 mt-2">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={`relative w-full flex items-center justify-between px-4 py-3 rounded-2xl font-medium text-sm transition-colors duration-200 outline-none group ${
                    isActive
                      ? "text-[#7A0C0C] font-bold"
                      : "text-red-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {/* HIGHLIGHT MENU AKTIF BERWARNA ABU-ABU TERANG (#F0F2F5 Sesuai Gambar Sampel) */}
                  {isActive && (
                    <motion.div
                      layoutId="active-menu-pill"
                      className="absolute inset-0 bg-[#F0F2F5] border border-white/60 rounded-2xl shadow-md backdrop-blur-md"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30
                      }}
                    />
                  )}

                  {/* Ikon & Label Menu */}
                  <div className="relative z-10 flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isActive
                          ? "text-[#7A0C0C] scale-110"
                          : "text-red-200/80 group-hover:text-white group-hover:scale-105"
                      }`}
                    />
                    <span className={`tracking-wide ${isActive ? "text-[#7A0C0C] font-bold" : "text-white"}`}>
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar: Tombol Keluar */}
        <div className="p-4 border-t border-white/15 bg-black/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-red-100 hover:text-white text-sm font-medium transition-all duration-200 border border-white/10 active:scale-98 shadow-xs"
          >
            <LogOut className="w-4 h-4 text-red-200" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
