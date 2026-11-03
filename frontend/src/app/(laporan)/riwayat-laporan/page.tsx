'use client';

import React, { useState } from 'react';
import { History, RefreshCw, FileText, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { useAuthProtection } from '@/lib/useAuth';
import { useLaporanList } from '@/hooks/useLaporanList';

export default function RiwayatLaporanPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const [currentUser, setCurrentUser] = useState({ nama: 'Pengguna', role: 'Mahasiswa', nim: '' });

  const { state: laporanState, fetch, getHistoryLaporan } = useLaporanList();

  React.useEffect(() => {
    if (!authLoading && authUser) {
      setCurrentUser({
        nama: authUser.nama,
        role: authUser.role || (authUser.tipe_user === 'karyawan' ? 'Karyawan' : 'Mahasiswa'),
        nim: authUser.nim || authUser.nomor_identitas || '',
      });
    }
  }, [authLoading, authUser]);

  React.useEffect(() => {
    if (currentUser.nim) {
      fetch(currentUser.nim);
    }
  }, [currentUser.nim, fetch]);

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-medium">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  const historyLaporans = getHistoryLaporan();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      <Sidebar isOpenMobile={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Navbar
          pageTitle="Riwayat Laporan"
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 bg-[#F3F4F6]">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <History className="w-6 h-6 text-[#7A0C0C]" />
                Riwayat Laporan
              </h1>
              <button
                onClick={() => fetch(currentUser.nim)}
                disabled={laporanState.loading}
                className="px-4 py-2 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${laporanState.loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {laporanState.error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {laporanState.error}
              </div>
            )}

            {laporanState.loading ? (
              <div className="flex h-64 items-center justify-center bg-white rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
              </div>
            ) : historyLaporans.length > 0 ? (
              <div className="space-y-3">
                {historyLaporans.map((laporan: any) => (
                  <div key={laporan.id_laporan} className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{laporan.kategori_laporan}</p>
                        <p className="text-sm text-slate-600 mt-1">{laporan.deskripsi}</p>
                        <p className="text-xs text-slate-500 mt-2">Lokasi: {laporan.lokasi}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        laporan.status_terkini === 'Selesai' 
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {laporan.status_terkini}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center bg-white rounded-lg flex-col gap-3">
                <FileText className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 text-sm">Tidak ada riwayat laporan</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
