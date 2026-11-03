'use client';

import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, X, Upload, Send, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { useAuthProtection } from '@/lib/useAuth';
import { useBuatLaporan } from '@/hooks/useBuatLaporan';

export default function BuatLaporanPage() {
  // ✅ ALL HOOKS AT TOP LEVEL - BEFORE ANY CONDITIONS
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth hooks
  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const [currentUser, setCurrentUser] = useState({ nama: 'Pengguna', role: 'Mahasiswa', nim: '' });

  // Stable today value
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ✅ CUSTOM HOOK CALLED AT TOP LEVEL - NEVER CONDITIONALLY
  const { state, clearError, clearSuccess, updateField, addAttachment, removeAttachment, submit } = useBuatLaporan(today);

  // Update current user when auth changes
  React.useEffect(() => {
    if (!authLoading && authUser) {
      setCurrentUser({
        nama: authUser.nama,
        role: authUser.role || (authUser.tipe_user === 'karyawan' ? 'Karyawan' : 'Mahasiswa'),
        nim: authUser.nim || authUser.nomor_identitas || '',
      });
    }
  }, [authLoading, authUser]);

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      addAttachment(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit(currentUser.nim);
  };

  // ✅ EARLY RETURN IS NOW AFTER ALL HOOKS
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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      <Sidebar isOpenMobile={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Navbar
          pageTitle="Buat Laporan"
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 bg-[#F3F4F6]">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {state.error && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{state.error}</span>
                <button onClick={() => clearError()} className="ml-auto shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {state.success && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{state.success}</span>
                <button onClick={() => clearSuccess()} className="ml-auto shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Kategori */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Kategori Laporan <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={state.kategori}
                      onChange={(e) => updateField('kategori', e.target.value)}
                      required
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none"
                    >
                      <option value="" disabled>
                        -- Pilih Kategori Laporan --
                      </option>
                      <option value="Fasilitas">Fasilitas</option>
                      <option value="Kebersihan">Kebersihan</option>
                    </select>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Tanggal Kejadian <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={state.tanggal}
                      max={today}
                      onChange={(e) => {
                        if (e.target.value > today) return;
                        updateField('tanggal', e.target.value);
                      }}
                      required
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none"
                    />
                  </div>

                  {/* Lokasi */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Lokasi Kejadian <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kampus III, Ruang Kelas K.205"
                      value={state.lokasi}
                      onChange={(e) => updateField('lokasi', e.target.value)}
                      required
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Deskripsi Masalah <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Contoh: Kipas menyala tetapi baling-balingnya tidak dapat berputar"
                    value={state.deskripsi}
                    onChange={(e) => updateField('deskripsi', e.target.value)}
                    required
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none resize-y min-h-[100px]"
                  />
                </div>

                {/* Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Foto / Lampiran</label>
                  <p className="text-xs text-slate-500 mb-3">Unggah bukti foto kerusakan (Maksimal 5 foto, format JPG/PNG).</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {state.attachments.map((item) => (
                      <div key={item.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-28 sm:h-32">
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button
                          type="button"
                          onClick={() => removeAttachment(item.id)}
                          className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                          <span className="block text-[11px] text-white truncate px-1">{item.name}</span>
                        </div>
                      </div>
                    ))}

                    {state.attachments.length < 5 && (
                      <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#7A0C0C] bg-slate-50 hover:bg-red-50/30 rounded-xl h-28 sm:h-32 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#7A0C0C] transition-all group">
                        <div className="w-10 h-10 rounded-full bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-xs transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold">Tambahkan</span>
                        <input type="file" accept="image/*" onChange={handleAddAttachment} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Tombol */}
                <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => (window.location.href = '/')}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8B5A2B] hover:bg-[#744A22] text-white text-sm font-semibold shadow-xs transition-all duration-200 active:scale-98 flex items-center justify-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={state.loading}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/20 transition-all duration-200 active:scale-98 disabled:opacity-70"
                  >
                    {state.loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <span>Kirim Laporan</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
