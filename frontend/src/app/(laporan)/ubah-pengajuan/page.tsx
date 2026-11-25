'use client';

import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit3,
  FileText,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Save,
  Trash2,
  Upload,
  ZoomIn,
  Camera,
  CalendarDays,
  History,
  Lock,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { NetworkErrorAlert } from '@/components/NetworkErrorAlert';
import { useAuthProtection } from '@/lib/useAuth';
import { useLaporanList } from '@/hooks/useLaporanList';
import { useUbahPengajuan, MAX_EDIT_PHOTOS } from '@/hooks/useUbahPengajuan';
import { LOKASI_KAMPUS_OPTIONS } from '@/lib/laporanCampus';
import { getThumbnailFotoUrl } from '@/lib/laporanPhoto';
import {
  normalizeLaporanStatus,
  type StatusLaporanTerkini,
} from '@/lib/laporanStatus';

const STATUS_BADGE_STYLES: Record<
  StatusLaporanTerkini,
  { badge: string; dot: string }
> = {
  Terkirim: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  'Sedang Diverifikasi': {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  Terverifikasi: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  Diproses: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  Selesai: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Ditolak: {
    badge: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
};

function formatTanggalRingkas(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function UbahPengajuanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletedSuccess, setDeletedSuccess] = useState(false);
  const [hasLoadedList, setHasLoadedList] = useState(false);
  const initializedReportIdRef = useRef<number | null>(null);

  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const currentUser = useMemo(
    () => ({
      nama: authUser?.nama || 'Pengguna',
      role:
        authUser?.role ||
        (authUser?.tipe_user === 'karyawan' ? 'Karyawan' : 'Mahasiswa'),
      nim: authUser?.nim || authUser?.nomor_identitas || '',
    }),
    [authUser]
  );

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const rawIdParam = searchParams.get('id');
  const requestedReportId = useMemo(() => {
    if (!rawIdParam) return null;
    const parsed = Number(rawIdParam);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [rawIdParam]);

  const { state: laporanState, fetch: fetchLaporan } = useLaporanList();
  const ubahPengajuan = useUbahPengajuan();
  const { selectForEdit, clearSelection } = ubahPengajuan;

  // Muat data laporan pengguna hanya jika terdapat parameter ?id= yang valid
  useEffect(() => {
    if (authLoading || !currentUser.nim || requestedReportId === null) return;
    let active = true;
    initializedReportIdRef.current = null;
    Promise.resolve()
      .then(() => fetchLaporan(currentUser.nim))
      .finally(() => {
        if (active) setHasLoadedList(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, currentUser.nim, requestedReportId, fetchLaporan]);

  // Temukan laporan spesifik yang dipilih dari Riwayat Laporan
  const targetLaporan = useMemo(() => {
    if (requestedReportId === null) return null;
    return (
      laporanState.allLaporan.find(
        (item) => item.id_laporan === requestedReportId
      ) ?? null
    );
  }, [laporanState.allLaporan, requestedReportId]);

  const targetStatus = targetLaporan
    ? normalizeLaporanStatus(targetLaporan.status_terkini)
    : null;
  const isTargetEditable = Boolean(targetLaporan && targetStatus === 'Terkirim');

  // Sinkronkan form edit secara otomatis untuk laporan terpilih (tanpa popup)
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (
        targetLaporan &&
        isTargetEditable &&
        initializedReportIdRef.current !== targetLaporan.id_laporan
      ) {
        initializedReportIdRef.current = targetLaporan.id_laporan;
        selectForEdit(targetLaporan, today);
      } else if (!targetLaporan && requestedReportId === null) {
        initializedReportIdRef.current = null;
        clearSelection();
      }
    });
    return () => {
      active = false;
    };
  }, [targetLaporan, isTargetEditable, requestedReportId, selectForEdit, clearSelection, today]);

  // Tutup konfirmasi hapus dengan Escape
  useEffect(() => {
    if (!isDeleteConfirmOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ubahPengajuan.state.deleteLoading === null) {
        setIsDeleteConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleteConfirmOpen, ubahPengajuan.state.deleteLoading]);

  const handleAddEditPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      ubahPengajuan.addEditPhotos(e.target.files);
      e.target.value = '';
    }
  };

  // Scroll ke atas jika muncul pesan error validasi/jaringan
  useEffect(() => {
    if (ubahPengajuan.state.error) {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [ubahPengajuan.state.error]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await ubahPengajuan.save(
      currentUser.nim,
      () => {
        setPreviewPhotoIndex(null);
        router.replace('/riwayat-laporan');
      },
      { keepSelection: true }
    );
  };

  const handleConfirmDelete = async () => {
    if (!ubahPengajuan.state.selectedLaporan) return;
    const idToDelete = ubahPengajuan.state.selectedLaporan.id_laporan;
    await ubahPengajuan.delete(
      idToDelete,
      () => {
        setIsDeleteConfirmOpen(false);
        setPreviewPhotoIndex(null);
        setDeletedSuccess(true);
        window.setTimeout(() => {
          router.replace('/riwayat-laporan');
        }, 1200);
      },
      { skipConfirm: true }
    );
  };

  const editPreviewImages = useMemo(
    () => ubahPengajuan.state.editPhotos.map((photo) => photo.previewUrl),
    [ubahPengajuan.state.editPhotos]
  );

  const isLoadingTarget =
    requestedReportId !== null &&
    !deletedSuccess &&
    (laporanState.loading || (!hasLoadedList && !laporanState.error));

  const statusBadgeStyle = targetStatus
    ? STATUS_BADGE_STYLES[targetStatus]
    : null;

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] md:h-screen w-full items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-medium">
            Memeriksa autentikasi...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] md:h-screen w-full overflow-hidden bg-white md:bg-[#F3F4F6] font-sans antialiased text-slate-800">
      <Sidebar
        activeMenu="ubah-pengajuan"
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Navbar
          pageTitle="Ubah Pengajuan"
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto bg-white md:bg-[#F3F4F6] p-0 md:p-6 lg:p-8"
        >
          <div className="w-full min-h-full md:min-h-0 md:max-w-3xl md:mx-auto flex flex-col">
            {/* State: Laporan Berhasil Dihapus */}
            {deletedSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Laporan Berhasil Dihapus
                  </h2>
                  <p className="text-sm text-slate-500">
                    Mengalihkan Anda kembali ke halaman Riwayat Laporan...
                  </p>
                </div>
                <Link
                  href="/riwayat-laporan"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold transition-colors"
                >
                  <History className="w-4 h-4" />
                  <span>Kembali ke Riwayat Laporan</span>
                </Link>
              </div>
            ) : requestedReportId === null ? (
              /* State: Diakses langsung tanpa memilih laporan dari Riwayat Laporan */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Edit3 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h2 className="text-lg font-bold text-slate-900">
                    Pilih Laporan dari Riwayat Laporan
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Untuk mengajukan perubahan laporan, buka menu{' '}
                    <strong className="text-slate-700">Riwayat Laporan</strong>, klik laporan
                    yang masih berstatus{' '}
                    <strong className="text-slate-700">Terkirim</strong>, lalu tekan tombol{' '}
                    <strong className="text-slate-700">Ubah Pengajuan</strong>.
                  </p>
                </div>
                <Link
                  href="/riwayat-laporan"
                  className="w-full sm:w-auto inline-flex min-h-[44px] items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  <History className="w-4 h-4" />
                  <span>Buka Riwayat Laporan</span>
                </Link>
              </div>
            ) : isLoadingTarget ? (
              /* State: Memuat Detail Laporan */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-16 bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin text-[#7A0C0C]" />
                <p className="text-sm font-medium text-slate-500">
                  Memuat detail laporan #{requestedReportId}...
                </p>
              </div>
            ) : laporanState.error && !targetLaporan ? (
              /* State: Error Jaringan saat memuat */
              <div className="flex-1 flex flex-col justify-center px-4 py-8 md:p-6 bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs space-y-4">
                <NetworkErrorAlert
                  message={laporanState.error}
                  onRetry={() => void fetchLaporan(currentUser.nim)}
                  retrying={laporanState.loading}
                />
                <Link
                  href="/riwayat-laporan"
                  className="w-full sm:w-auto self-start inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Riwayat Laporan</span>
                </Link>
              </div>
            ) : !targetLaporan ? (
              /* State: Laporan Tidak Ditemukan */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <FileText className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h2 className="text-lg font-bold text-slate-900">
                    Laporan Tidak Ditemukan
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Laporan #{requestedReportId} tidak tersedia pada akun Anda atau sudah
                    dihapus.
                  </p>
                </div>
                <Link
                  href="/riwayat-laporan"
                  className="w-full sm:w-auto inline-flex min-h-[44px] items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Riwayat Laporan</span>
                </Link>
              </div>
            ) : !isTargetEditable ? (
              /* State: Laporan Sudah Tidak Berstatus Terkirim */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2 max-w-md">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Laporan #{targetLaporan.id_laporan}
                    </span>
                    {statusBadgeStyle && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyle.badge}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusBadgeStyle.dot}`}
                        />
                        {targetStatus}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Laporan Tidak Dapat Diubah
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Perubahan laporan hanya dapat dilakukan saat status laporan masih{' '}
                    <strong className="text-slate-700">Terkirim</strong> sebelum diverifikasi
                    oleh admin.
                  </p>
                </div>
                <Link
                  href="/riwayat-laporan"
                  className="w-full sm:w-auto inline-flex min-h-[44px] items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Riwayat Laporan</span>
                </Link>
              </div>
            ) : (
              /* Form Edit Penuh (Full-screen di Mobile, Card Rapi di Desktop — Tanpa Popup) */
              <form
                onSubmit={handleSave}
                className="flex-1 flex flex-col bg-white md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xs"
              >
                {/* Header Form — ikut tergulir ke atas saat scroll ke bawah dan muncul kembali di posisi top */}
                <div className="bg-white border-b border-slate-200/80 px-4 py-3.5 md:px-6 md:py-5 md:rounded-t-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => router.push('/riwayat-laporan')}
                        aria-label="Kembali ke Riwayat Laporan"
                        className="w-10 h-10 -ml-1.5 rounded-xl flex items-center justify-center text-slate-600 hover:text-[#7A0C0C] hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 cursor-pointer"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Laporan #{targetLaporan.id_laporan}
                          </span>
                          {statusBadgeStyle && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeStyle.badge}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${statusBadgeStyle.dot}`}
                              />
                              {targetStatus}
                            </span>
                          )}
                        </div>
                        <h2 className="text-base md:text-lg font-extrabold text-slate-900 truncate">
                          Ubah Detail Laporan
                        </h2>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body Form */}
                <div className="flex-1 px-4 py-5 md:p-6 space-y-5">
                  {/* Info Ringkas Laporan Terpilih */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-[#7A0C0C] shrink-0" />
                      <span>
                        Diajukan:{' '}
                        <strong className="text-slate-800">
                          {formatTanggalRingkas(targetLaporan.tanggal_buat)}
                        </strong>
                      </span>
                    </span>
                    <span className="text-slate-300 hidden sm:inline">•</span>
                    <span className="text-amber-700 font-medium">
                      Masih dapat diubah sebelum diverifikasi admin
                    </span>
                  </div>

                  {/* Alert Error */}
                  {ubahPengajuan.state.error && (
                    <NetworkErrorAlert
                      message={ubahPengajuan.state.error}
                      onRetry={() => void handleSave()}
                      retrying={ubahPengajuan.state.saveLoading}
                      onDismiss={() => ubahPengajuan.clearError()}
                    />
                  )}

                  {/* Alert Sukses */}
                  {ubahPengajuan.state.success && (
                    <div
                      role="status"
                      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                        <span className="font-medium">
                          {ubahPengajuan.state.success}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href="/riwayat-laporan"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Ke Riwayat</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => ubahPengajuan.clearSuccess()}
                          aria-label="Tutup notifikasi sukses"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Field: Kategori & Lokasi Kampus */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="edit-kategori"
                        className="block text-sm font-semibold text-slate-700 mb-1.5"
                      >
                        Kategori Laporan <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="edit-kategori"
                        value={ubahPengajuan.state.editKategori}
                        onChange={(e) =>
                          ubahPengajuan.updateEditField('editKategori', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base md:text-sm text-slate-800 focus:ring-2 focus:ring-[#7A0C0C]/25 focus:border-[#7A0C0C] outline-none transition-all"
                      >
                        <option value="Fasilitas">Fasilitas</option>
                        <option value="Kebersihan">Kebersihan</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="edit-kampus"
                        className="block text-sm font-semibold text-slate-700 mb-1.5"
                      >
                        Lokasi Kampus <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="edit-kampus"
                        value={ubahPengajuan.state.editLokasiKampus}
                        onChange={(e) =>
                          ubahPengajuan.updateEditField(
                            'editLokasiKampus',
                            e.target.value
                          )
                        }
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base md:text-sm text-slate-800 focus:ring-2 focus:ring-[#7A0C0C]/25 focus:border-[#7A0C0C] outline-none transition-all"
                      >
                        <option value="" disabled>
                          -- Pilih Lokasi Kampus --
                        </option>
                        {LOKASI_KAMPUS_OPTIONS.map((kampus) => (
                          <option key={kampus} value={kampus}>
                            {kampus}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Field: Detail Lokasi */}
                  <div>
                    <label
                      htmlFor="edit-lokasi"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Lokasi / Ruangan <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-lokasi"
                      type="text"
                      value={ubahPengajuan.state.editLokasi}
                      onChange={(e) =>
                        ubahPengajuan.updateEditField('editLokasi', e.target.value)
                      }
                      placeholder="Contoh: Kampus III, Ruang Kelas K.205"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base md:text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#7A0C0C]/25 focus:border-[#7A0C0C] outline-none transition-all"
                    />
                  </div>

                  {/* Field: Deskripsi */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="edit-deskripsi"
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Deskripsi Masalah <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] font-medium text-slate-400">
                        {ubahPengajuan.state.editDeskripsi.trim().length} karakter
                      </span>
                    </div>
                    <textarea
                      id="edit-deskripsi"
                      rows={4}
                      value={ubahPengajuan.state.editDeskripsi}
                      onChange={(e) =>
                        ubahPengajuan.updateEditField('editDeskripsi', e.target.value)
                      }
                      placeholder="Jelaskan detail kendala yang dilaporkan..."
                      className="w-full min-h-[120px] px-3.5 py-3 rounded-xl border border-slate-300 bg-white text-base md:text-sm text-slate-800 placeholder:text-slate-400 leading-relaxed focus:ring-2 focus:ring-[#7A0C0C]/25 focus:border-[#7A0C0C] outline-none resize-y transition-all"
                    />
                  </div>

                  {/* Field: Foto / Lampiran Bukti */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Foto / Lampiran Bukti <span className="text-red-500">*</span>
                      </label>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {ubahPengajuan.state.editPhotos.length} / {MAX_EDIT_PHOTOS}
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {ubahPengajuan.state.editPhotos.map((photo, idx) => (
                        <div
                          key={photo.id}
                          className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square"
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
                            className="absolute inset-0 bg-black/25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          >
                            <span className="w-9 h-9 rounded-full bg-white/90 text-slate-800 flex items-center justify-center shadow-sm">
                              <ZoomIn className="w-4 h-4" />
                            </span>
                          </button>
                          {photo.file && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#7A0C0C]/90 text-white text-[9px] font-bold uppercase tracking-wide pointer-events-none">
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
                            className="absolute top-2 right-2 w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-red-600/95 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                          >
                            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      ))}

                      {ubahPengajuan.state.editPhotos.length < MAX_EDIT_PHOTOS && (
                        <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#7A0C0C] bg-slate-50 hover:bg-red-50/40 rounded-2xl aspect-square flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#7A0C0C] transition-colors group">
                          <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-2xs transition-colors">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold">Tambah Foto</span>
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

                    <p className="text-xs text-slate-500 mt-2">
                      Minimal 1 foto, maksimal {MAX_EDIT_PHOTOS} foto (JPG/PNG). Ketuk foto
                      untuk memperbesar.
                    </p>
                  </div>
                </div>

                {/* Footer Action Bar — Sticky di bagian bawah layar pada mobile */}
                <div className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:bg-slate-50/70 md:px-6 md:py-4 md:rounded-b-2xl">
                  <div className="flex flex-col md:flex-row-reverse items-stretch md:items-center gap-2.5">
                    <button
                      type="submit"
                      disabled={
                        ubahPengajuan.state.saveLoading ||
                        ubahPengajuan.state.deleteLoading !== null
                      }
                      className="w-full md:flex-1 min-h-[46px] px-5 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] active:bg-[#600808] text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {ubahPengajuan.state.saveLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>
                        {ubahPengajuan.state.saveLoading
                          ? 'Menyimpan...'
                          : 'Simpan Perubahan'}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 md:flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        disabled={
                          ubahPengajuan.state.saveLoading ||
                          ubahPengajuan.state.deleteLoading !== null
                        }
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200/70 text-red-700 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Hapus</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/riwayat-laporan')}
                        disabled={
                          ubahPengajuan.state.saveLoading ||
                          ubahPengajuan.state.deleteLoading !== null
                        }
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>

      {/* Modal Konfirmasi Hapus Laporan */}
      <AnimatePresence>
        {isDeleteConfirmOpen && ubahPengajuan.state.selectedLaporan && (
          <motion.div
            key="delete-confirm-backdrop"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              if (ubahPengajuan.state.deleteLoading === null) {
                setIsDeleteConfirmOpen(false);
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs"
          >
            <motion.div
              key="delete-confirm-card"
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200/80"
            >
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3
                    id="delete-confirm-title"
                    className="text-lg font-extrabold text-slate-900"
                  >
                    Hapus Laporan #{ubahPengajuan.state.selectedLaporan.id_laporan}?
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Laporan yang dihapus tidak dapat dikembalikan lagi. Pastikan Anda
                    yakin sebelum melanjutkan.
                  </p>
                </div>

                {ubahPengajuan.state.error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{ubahPengajuan.state.error}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    disabled={ubahPengajuan.state.deleteLoading !== null}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmDelete()}
                    disabled={ubahPengajuan.state.deleteLoading !== null}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {ubahPengajuan.state.deleteLoading !== null ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>
                      {ubahPengajuan.state.deleteLoading !== null
                        ? 'Menghapus...'
                        : 'Ya, Hapus'}
                    </span>
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

export default function UbahPengajuanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] md:h-screen w-full items-center justify-center bg-[#F3F4F6]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
            <p className="text-slate-600 text-sm font-medium">
              Memuat halaman ubah pengajuan...
            </p>
          </div>
        </div>
      }
    >
      <UbahPengajuanContent />
    </Suspense>
  );
}
