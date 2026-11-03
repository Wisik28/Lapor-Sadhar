'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Edit3, RefreshCw, FileText, Loader2, AlertCircle, CheckCircle2, X, MapPin, Save, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { useAuthProtection } from '@/lib/useAuth';
import { useLaporanList } from '@/hooks/useLaporanList';
import { useUbahPengajuan } from '@/hooks/useUbahPengajuan';

export default function UbahPengajuanPage() {
  // All hooks at top level
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const [currentUser, setCurrentUser] = useState({ nama: 'Pengguna', role: 'Mahasiswa', nim: '' });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Laporan and edit hooks
  const laporanList = useLaporanList();
  const ubahPengajuan = useUbahPengajuan();

  useEffect(() => {
    if (!authLoading && authUser) {
      setCurrentUser({
        nama: authUser.nama,
        role: authUser.role || (authUser.tipe_user === 'karyawan' ? 'Karyawan' : 'Mahasiswa'),
        nim: authUser.nim || authUser.nomor_identitas || '',
      });
    }
  }, [authLoading, authUser]);

  useEffect(() => {
    if (currentUser.nim) {
      laporanList.fetch(currentUser.nim);
    }
  }, [currentUser.nim, laporanList]);

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

  const editableLaporan = laporanList.getEditableLaporan();

  const handleSelectEdit = (lap: any) => {
    ubahPengajuan.selectForEdit(lap, today);
  };

  const handleSave = async () => {
    await ubahPengajuan.save(currentUser.nim, () => {
      laporanList.fetch(currentUser.nim);
    });
  };

  const handleDelete = async (id: number) => {
    await ubahPengajuan.delete(id, () => {
      laporanList.fetch(currentUser.nim);
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      <Sidebar isOpenMobile={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Navbar
          pageTitle="Ubah Pengajuan Laporan"
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 bg-[#F3F4F6]">
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-slate-900">Ubah Pengajuan</h1>
                  <p className="text-xs text-slate-500">Edit laporan yang masih berstatus Terkirim</p>
                </div>
              </div>
              <button
                onClick={() => laporanList.fetch(currentUser.nim)}
                disabled={laporanList.state.loading}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${laporanList.state.loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Error Alert */}
            {ubahPengajuan.state.error && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ubahPengajuan.state.error}</span>
                <button onClick={() => ubahPengajuan.clearError()} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Success Alert */}
            {ubahPengajuan.state.success && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{ubahPengajuan.state.success}</span>
                <button onClick={() => ubahPengajuan.clearSuccess()} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* List Laporan Editable */}
            {laporanList.state.loading ? (
              <div className="flex h-64 items-center justify-center bg-white rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
              </div>
            ) : editableLaporan.length > 0 ? (
              <div className="space-y-3">
                {editableLaporan.map((laporan: any) => (
                  <div
                    key={laporan.id_laporan}
                    className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800">{laporan.kategori_laporan}</p>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {laporan.status_terkini}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{laporan.deskripsi}</p>
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {laporan.lokasi}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSelectEdit(laporan)}
                        className="px-3 py-2 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-medium transition-all"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center bg-white rounded-2xl flex-col gap-3">
                <FileText className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 text-sm">Tidak ada laporan yang dapat diubah</p>
              </div>
            )}

            {/* Edit Form */}
            {ubahPengajuan.state.selectedLaporan && (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
                <h2 className="font-bold text-slate-900 mb-4">Edit Laporan</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori</label>
                    <select
                      value={ubahPengajuan.state.editKategori}
                      onChange={(e) => ubahPengajuan.updateEditField('editKategori', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C]"
                    >
                      <option value="Fasilitas">Fasilitas</option>
                      <option value="Kebersihan">Kebersihan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Lokasi</label>
                    <input
                      type="text"
                      value={ubahPengajuan.state.editLokasi}
                      onChange={(e) => ubahPengajuan.updateEditField('editLokasi', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi</label>
                    <textarea
                      rows={3}
                      value={ubahPengajuan.state.editDeskripsi}
                      onChange={(e) => ubahPengajuan.updateEditField('editDeskripsi', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C]"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={ubahPengajuan.state.saveLoading}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {ubahPengajuan.state.saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Simpan
                    </button>
                    <button
                      onClick={() => handleDelete(ubahPengajuan.state.selectedLaporan!.id_laporan)}
                      disabled={ubahPengajuan.state.deleteLoading === ubahPengajuan.state.selectedLaporan?.id_laporan}
                      className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {ubahPengajuan.state.deleteLoading === ubahPengajuan.state.selectedLaporan?.id_laporan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Hapus
                    </button>
                    <button
                      onClick={() => ubahPengajuan.clearSelection()}
                      className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
