'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit3, RefreshCw, FileText, Loader2, AlertCircle, CheckCircle2, X, MapPin, Save, Trash2, Upload, ZoomIn, Camera } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { NetworkErrorAlert } from '@/components/NetworkErrorAlert';
import { useAuthProtection } from '@/lib/useAuth';
import { useLaporanList } from '@/hooks/useLaporanList';
import { useUbahPengajuan, MAX_EDIT_PHOTOS } from '@/hooks/useUbahPengajuan';
import { LaporanItem } from '@/lib/api';
import { LOKASI_KAMPUS_OPTIONS } from '@/lib/laporanCampus';
import { getThumbnailFotoUrl } from '@/lib/laporanPhoto';

export default function UbahPengajuanPage() {
  // All hooks at top level
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const currentUser = useMemo(() => ({
    nama: authUser?.nama || 'Pengguna',
    role: authUser?.role || (authUser?.tipe_user === 'karyawan' ? 'Karyawan' : 'Mahasiswa'),
    nim: authUser?.nim || authUser?.nomor_identitas || '',
  }), [authUser]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Laporan and edit hooks
  const { state: laporanState, fetch: fetchLaporan, getEditableLaporan } = useLaporanList();
  const ubahPengajuan = useUbahPengajuan();

  const [currentPage, setCurrentPage] = useState(1);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const itemsPerPage = 10;
  const editableLaporan = getEditableLaporan();
  const totalPages = Math.ceil(editableLaporan.length / itemsPerPage) || 1;
  const paginatedEditable = useMemo(() => {
    return editableLaporan.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [editableLaporan, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!currentUser.nim) return;
    fetchLaporan(currentUser.nim);
  }, [currentUser.nim, fetchLaporan]);

  const handleSelectEdit = (lap: LaporanItem) => {
    setPreviewPhotoIndex(null);
    ubahPengajuan.selectForEdit(lap, today);
  };

  const handleAddEditPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      ubahPengajuan.addEditPhotos(e.target.files);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    await ubahPengajuan.save(currentUser.nim, () => {
      setPreviewPhotoIndex(null);
      fetchLaporan(currentUser.nim);
    });
  };

  const handleDelete = async (id: number) => {
    await ubahPengajuan.delete(id, () => {
      setPreviewPhotoIndex(null);
      fetchLaporan(currentUser.nim);
    });
  };

  const editPreviewImages = useMemo(
    () => ubahPengajuan.state.editPhotos.map((photo) => photo.previewUrl),
    [ubahPengajuan.state.editPhotos]
  );

  // Tutup popup edit mobile dengan tombol Escape (kecuali saat preview foto terbuka)
  useEffect(() => {
    if (!ubahPengajuan.state.selectedLaporan || previewPhotoIndex !== null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !ubahPengajuan.state.saveLoading &&
        ubahPengajuan.state.deleteLoading === null
      ) {
        ubahPengajuan.clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    ubahPengajuan.state.selectedLaporan,
    ubahPengajuan.state.saveLoading,
    ubahPengajuan.state.deleteLoading,
    previewPhotoIndex,
    ubahPengajuan,
  ]);

  const renderEditFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori</label>
        <select
          value={ubahPengajuan.state.editKategori}
          onChange={(e) => ubahPengajuan.updateEditField('editKategori', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] outline-none"
        >
          <option value="Fasilitas">Fasilitas</option>
          <option value="Kebersihan">Kebersihan</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Lokasi Kampus</label>
        <select
          value={ubahPengajuan.state.editLokasiKampus}
          onChange={(e) => ubahPengajuan.updateEditField('editLokasiKampus', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] outline-none"
        >
          <option value="" disabled>-- Pilih Lokasi Kampus --</option>
          {LOKASI_KAMPUS_OPTIONS.map((kampus) => (
            <option key={kampus} value={kampus}>
              {kampus}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Lokasi</label>
        <input
          type="text"
          value={ubahPengajuan.state.editLokasi}
          onChange={(e) => ubahPengajuan.updateEditField('editLokasi', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi</label>
        <textarea
          rows={3}
          value={ubahPengajuan.state.editDeskripsi}
          onChange={(e) => ubahPengajuan.updateEditField('editDeskripsi', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] outline-none"
        />
      </div>

      {/* Edit Foto / Lampiran Bukti */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Foto / Lampiran Bukti
          </label>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Camera className="w-3 h-3" />
            <span>
              {ubahPengajuan.state.editPhotos.length} / {MAX_EDIT_PHOTOS}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {ubahPengajuan.state.editPhotos.map((photo, idx) => (
            <div
              key={photo.id}
              className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getThumbnailFotoUrl(photo.previewUrl, 400)}
                alt={photo.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <button
                type="button"
                onClick={() => setPreviewPhotoIndex(idx)}
                aria-label={`Perbesar ${photo.name}`}
                className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <span className="w-8 h-8 rounded-full bg-white/90 text-slate-800 flex items-center justify-center shadow-sm">
                  <ZoomIn className="w-4 h-4" />
                </span>
              </button>
              {photo.file && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#7A0C0C]/90 text-white text-[9px] font-bold uppercase tracking-wide pointer-events-none">
                  Baru
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (previewPhotoIndex === idx) setPreviewPhotoIndex(null);
                  ubahPengajuan.removeEditPhoto(photo.id);
                }}
                aria-label={`Hapus ${photo.name}`}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {ubahPengajuan.state.editPhotos.length < MAX_EDIT_PHOTOS && (
            <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#7A0C0C] bg-slate-50 hover:bg-red-50/40 rounded-xl aspect-square flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#7A0C0C] transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-2xs transition-colors">
                <Upload className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold">Tambah</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddEditPhotos}
                className="hidden"
              />
            </label>
          )}
        </div>

        <p className="text-[11px] text-slate-500 mt-1.5">
          Minimal 1 foto, maksimal {MAX_EDIT_PHOTOS} foto (JPG/PNG). Hapus atau tambahkan foto baru lalu klik Simpan.
        </p>
      </div>
    </div>
  );

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
                onClick={() => fetchLaporan(currentUser.nim)}
                disabled={laporanState.loading}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${laporanState.loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Error Alert */}
            {laporanState.error && (
              <NetworkErrorAlert
                message={laporanState.error}
                onRetry={() => void fetchLaporan(currentUser.nim)}
                retrying={laporanState.loading}
              />
            )}

            {ubahPengajuan.state.error && (
              <NetworkErrorAlert
                message={ubahPengajuan.state.error}
                onRetry={
                  ubahPengajuan.state.selectedLaporan
                    ? () => void handleSave()
                    : undefined
                }
                retrying={ubahPengajuan.state.saveLoading}
                onDismiss={() => ubahPengajuan.clearError()}
              />
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
            {laporanState.loading ? (
              <div className="flex h-64 items-center justify-center bg-white rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
              </div>
            ) : editableLaporan.length > 0 ? (
              <div className="space-y-3">
                {paginatedEditable.map((laporan: LaporanItem) => (
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
                          {laporan.lokasi_kampus ? `${laporan.lokasi_kampus} — ` : ''}{laporan.lokasi}
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

                {/* Pagination Controls */}
                {editableLaporan.length > itemsPerPage && (
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                    <p>
                      Menampilkan {(currentPage - 1) * itemsPerPage + 1}–
                      {Math.min(currentPage * itemsPerPage, editableLaporan.length)} dari{" "}
                      {editableLaporan.length} laporan
                    </p>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-xs"
                      >
                        Sebelumnya
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-6 h-6 rounded-md font-bold text-xs transition-colors cursor-pointer flex items-center justify-center ${
                            currentPage === p
                              ? "bg-[#7A0C0C] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-xs"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center bg-white rounded-2xl flex-col gap-3">
                <FileText className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 text-sm">Tidak ada laporan yang dapat diubah</p>
              </div>
            )}

            {/* Edit Form — Desktop (dipertahankan) */}
            {ubahPengajuan.state.selectedLaporan && (
              <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
                <h2 className="font-bold text-slate-900 mb-4">Edit Laporan</h2>
                <div className="space-y-4">
                  {renderEditFields()}

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={ubahPengajuan.state.saveLoading}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {ubahPengajuan.state.saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Simpan
                    </button>
                    <button
                      onClick={() => handleDelete(ubahPengajuan.state.selectedLaporan!.id_laporan)}
                      disabled={ubahPengajuan.state.deleteLoading === ubahPengajuan.state.selectedLaporan?.id_laporan}
                      className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {ubahPengajuan.state.deleteLoading === ubahPengajuan.state.selectedLaporan?.id_laporan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Hapus
                    </button>
                    <button
                      onClick={() => ubahPengajuan.clearSelection()}
                      className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all cursor-pointer"
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

      {/* Edit Form Popup — Mobile (< md) */}
      <AnimatePresence>
        {ubahPengajuan.state.selectedLaporan && (
          <motion.div
            key="mobile-edit-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-edit-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!ubahPengajuan.state.saveLoading && ubahPengajuan.state.deleteLoading === null) {
                ubahPengajuan.clearSelection();
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs md:hidden"
          >
            <motion.div
              key="mobile-edit-card"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[84dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
            >
              {/* Header Popup */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 shrink-0">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Laporan #{ubahPengajuan.state.selectedLaporan.id_laporan}
                  </p>
                  <h2 id="mobile-edit-title" className="text-base font-bold text-slate-900">
                    Edit Laporan
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => ubahPengajuan.clearSelection()}
                  disabled={ubahPengajuan.state.saveLoading || ubahPengajuan.state.deleteLoading !== null}
                  aria-label="Tutup form edit"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {ubahPengajuan.state.error && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{ubahPengajuan.state.error}</span>
                    <button
                      type="button"
                      onClick={() => ubahPengajuan.clearError()}
                      aria-label="Tutup pesan kesalahan"
                      className="shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {renderEditFields()}
              </div>

              {/* Footer Action Buttons */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 space-y-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={ubahPengajuan.state.saveLoading}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {ubahPengajuan.state.saveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Simpan</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(ubahPengajuan.state.selectedLaporan!.id_laporan)}
                    disabled={ubahPengajuan.state.deleteLoading === ubahPengajuan.state.selectedLaporan?.id_laporan}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {ubahPengajuan.state.deleteLoading === ubahPengajuan.state.selectedLaporan?.id_laporan ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Hapus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => ubahPengajuan.clearSelection()}
                    disabled={ubahPengajuan.state.saveLoading || ubahPengajuan.state.deleteLoading !== null}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Pratinjau Foto */}
      <ImagePreviewModal
        images={editPreviewImages}
        activeIndex={previewPhotoIndex}
        onClose={() => setPreviewPhotoIndex(null)}
        onChangeIndex={setPreviewPhotoIndex}
        titlePrefix="Foto Laporan"
      />
    </div>
  );
}
