"use client";

import React, { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus,
  Eye,
  History,
  FileEdit,
  LogOut,
  X
} from "lucide-react";

export interface SidebarProps {
  activeMenu?: string;
  setActiveMenu?: (menu: string) => void;
  onLogout?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "buat-laporan", label: "Buat Laporan", icon: FilePlus, route: "/buat-laporan" },
  { id: "lihat-status", label: "Lihat Status", icon: Eye, route: "/lihat-status" },
  { id: "riwayat-laporan", label: "Riwayat Laporan", icon: History, route: "/riwayat-laporan" },
  { id: "ubah-pengajuan", label: "Ubah Pengajuan", icon: FileEdit, route: "/ubah-pengajuan" },
];

export default function Sidebar({
  activeMenu: propActiveMenu,
  setActiveMenu: propSetActiveMenu,
  onLogout,
  isOpenMobile = false,
  onCloseMobile
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Detect active menu from current pathname instead of prop
  const activeMenu = useMemo(() => {
    // First try to find menu by exact route match
    const menuItem = MENU_ITEMS.find(item => item.route === pathname);
    if (menuItem) {
      return menuItem.id;
    }
    
    // If no exact match, fallback to prop (for backward compatibility)
    return propActiveMenu || "";
  }, [pathname, propActiveMenu]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("user_session");
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
  };

  const handleSelectMenu = (id: string, route: string) => {
    if (propSetActiveMenu) {
      propSetActiveMenu(id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
    
    // Navigasi ke rute terpisah
    router.push(route);
  };

  const sidebarContent = (
    <div className="relative w-56 md:w-64 h-full text-white flex flex-col justify-between shrink-0 shadow-2xl overflow-hidden bg-[#7A0C0C]">
      {/* BACKGROUND IMAGE: sidebar.png */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transform scale-105"
        style={{ backgroundImage: "url('/assets/sidebar.png')" }}
      />

      {/* OVERLAY MERAH MARUN */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#7A0C0C]/90 via-[#7A0C0C]/85 to-[#520808]/95 backdrop-brightness-90 pointer-events-none" />

      {/* KONTEN SIDEBAR */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          {/* Header Sidebar / Brand USD */}
          <div className="px-3 py-3 md:p-5 border-b border-white/15 flex items-center justify-between gap-2 bg-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner p-0.5 md:p-1 overflow-hidden shrink-0">
                <img
                  src="/assets/logo_usd.png"
                  alt="Logo USD"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm md:text-lg leading-tight tracking-wide text-white drop-shadow-xs truncate">
                  Lapor Sadhar
                </h2>
                <p className="text-[10px] md:text-xs text-red-200/90 font-medium truncate">
                  Universitas Sanata Dharma
                </p>
              </div>
            </div>

            {/* Tombol Tutup Sidebar di Mobile */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Tutup navigasi"
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigasi Menu */}
          <nav className="p-2.5 md:p-4 space-y-1 md:space-y-2 mt-1 md:mt-2">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectMenu(item.id, item.route)}
                  className={`relative w-full min-h-[38px] md:min-h-[48px] flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl md:rounded-2xl font-medium text-xs md:text-sm transition-colors duration-200 outline-none group ${
                    isActive
                      ? "text-[#7A0C0C] font-bold"
                      : "text-red-100/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {/* HIGHLIGHT MENU AKTIF - White Background */}
                  {isActive && (
                    <motion.div
                      layoutId="active-menu-pill"
                      className="absolute inset-0 bg-[#F0F2F5] border border-white/60 rounded-xl md:rounded-2xl shadow-md backdrop-blur-md"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30
                      }}
                    />
                  )}

                  {/* Ikon & Label Menu */}
                  <div className="relative z-10 flex items-center gap-2.5 md:gap-3">
                    <Icon
                      className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-200 ${
                        isActive
                          ? "text-[#7A0C0C] scale-110"
                          : "text-red-200/80 group-hover:text-white group-hover:scale-105"
                      }`}
                    />
                    <span className={`tracking-wide text-left ${isActive ? "text-[#7A0C0C] font-bold" : "text-white"}`}>
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar: Tombol Keluar */}
        <div className="p-2.5 md:p-4 border-t border-white/15 bg-black/20">
          <button
            onClick={handleLogout}
            className="w-full min-h-[36px] md:min-h-[44px] flex items-center justify-center gap-2 md:gap-2.5 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl bg-white/10 hover:bg-white/20 text-red-100 hover:text-white text-xs md:text-sm font-medium transition-all duration-200 border border-white/10 active:scale-98 shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-200" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex relative w-64 text-white flex-col justify-between shrink-0 shadow-2xl z-20 overflow-hidden bg-[#7A0C0C]">
        {sidebarContent}
      </aside>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {isOpenMobile && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Sliding Drawer Container */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative z-10 max-w-[75vw] h-full shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}