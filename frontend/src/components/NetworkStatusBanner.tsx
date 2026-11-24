'use client';

import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Banner global ringan yang muncul otomatis saat koneksi internet terputus
 * dan memberi notifikasi singkat ketika koneksi kembali tersedia.
 */
export function NetworkStatusBanner() {
  const { isOnline, justReconnected } = useOnlineStatus();

  if (isOnline && !justReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-100 px-4 py-2 text-xs sm:text-sm font-semibold shadow-md transition-colors ${
        !isOnline
          ? 'bg-amber-600 text-white'
          : 'bg-emerald-600 text-white'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Koneksi internet terputus. Periksa jaringan Anda; isian form laporan tetap tersimpan sebagai draf.
            </span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 shrink-0" />
            <span>Koneksi internet kembali tersambung. Anda dapat melanjutkan atau mencoba lagi.</span>
          </>
        )}
      </div>
    </div>
  );
}
