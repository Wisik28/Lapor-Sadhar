'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Send,
  Loader2,
  Wrench,
  Sparkles,
  MapPin,
  Building2,
  Camera,
  ZoomIn,
  Check,
  Lightbulb,
  RotateCcw,
  ArrowRight,
  Navigation,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { useAuthProtection } from '@/lib/useAuth';
import { useBuatLaporan } from '@/hooks/useBuatLaporan';

const KATEGORI_OPTIONS = [
  {
    value: 'Fasilitas',
    label: 'Fasilitas',
    subtitle: 'Kerusakan ruang kelas, AC, proyektor, listrik, furnitur, atau peralatan kampus.',
    icon: Wrench,
    accentActive:
      'border-[#7A0C0C] bg-gradient-to-br from-[#7A0C0C]/[0.07] via-rose-50/80 to-amber-50/40 shadow-md shadow-[#7A0C0C]/10 ring-1 ring-[#7A0C0C]/20',
    iconBgActive: 'bg-gradient-to-br from-[#7A0C0C] to-[#A61B1B] text-white shadow-md shadow-[#7A0C0C]/25',
    iconBgIdle: 'bg-rose-50 text-[#7A0C0C] group-hover:bg-[#7A0C0C]/10',
    checkBg: 'bg-[#7A0C0C]',
    badge: 'bg-rose-100 text-[#7A0C0C] border-rose-200',
  },
  {
    value: 'Kebersihan',
    label: 'Kebersihan',
    subtitle: 'Sampah menumpuk, toilet kotor, kebocoran, area berbau, atau kebersihan taman.',
    icon: Sparkles,
    accentActive:
      'border-emerald-600 bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-white shadow-md shadow-emerald-600/10 ring-1 ring-emerald-500/25',
    iconBgActive: 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25',
    iconBgIdle: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100/80',
    checkBg: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
] as const;

const KAMPUS_OPTIONS = [
  { value: 'Kampus I', code: 'K-I', label: 'Kampus 1', area: 'Mrican' },
  { value: 'Kampus II', code: 'K-II', label: 'Kampus 2', area: 'Mrican' },
  { value: 'Kampus III', code: 'K-III', label: 'Kampus 3', area: 'Paingan' },
  { value: 'Kampus IV', code: 'K-IV', label: 'Kampus 4', area: 'Kentungan' },
] as const;

const LOKASI_PRESETS = [
  'Ruang Kelas',
  'Toilet',
  'Koridor',
  'Laboratorium',
  'Perpustakaan',
  'Area Parkir',
];

export default function BuatLaporanPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const detailLokasiInputRef = useRef<HTMLInputElement>(null);

  // Auth hooks
  const { isLoading: authLoading, user: authUser } = useAuthProtection();
  const currentUser = useMemo(() => {
    if (!authLoading && authUser) {
      return {
        nama: authUser.nama,
        role: authUser.role || (authUser.tipe_user === 'karyawan' ? 'Karyawan' : 'Mahasiswa'),
        nim: authUser.nim || authUser.nomor_identitas || '',
      };
    }
    return { nama: 'Pengguna', role: 'Mahasiswa', nim: '' };
  }, [authLoading, authUser]);

  // Tanggal otomatis hari ini untuk tampilan pratinjau (tanggal submit aktual ditentukan saat dikirim)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const {
    state,
    reset,
    clearError,
    clearSuccess,
    updateField,
    addAttachment,
    removeAttachment,
    submit,
  } = useBuatLaporan(today);

  // Smooth scroll to top when error banner appears
  useEffect(() => {
    if (state.error) {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.error]);

  // Close success popup with Escape key
  useEffect(() => {
    if (!state.success) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSuccess();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.success, clearSuccess]);

  // Compute live form progress
  const checklist = useMemo(
    () => [
      { key: 'kategori', label: 'Kategori laporan', done: Boolean(state.kategori) },
      {
        key: 'lokasi',
        label: 'Kampus & detail lokasi',
        done: Boolean(state.lokasiKampus.trim() && state.detailLokasi.trim()),
      },
      {
        key: 'deskripsi',
        label: 'Deskripsi masalah',
        done: state.deskripsi.trim().length > 0,
      },
      {
        key: 'foto',
        label: 'Bukti foto (min. 1)',
        done: state.attachments.length > 0,
      },
    ],
    [state.kategori, state.lokasiKampus, state.detailLokasi, state.deskripsi, state.attachments.length]
  );

  const completedCount = useMemo(
    () => checklist.filter((item) => item.done).length,
    [checklist]
  );
  const progressPercent = Math.round((completedCount / checklist.length) * 100);
  const isReadyToSubmit = completedCount === checklist.length;
  const hasAnyInput = Boolean(
    state.kategori ||
      state.lokasiKampus ||
      state.detailLokasi ||
      state.deskripsi ||
      state.attachments.length > 0
  );

  const previewImages = useMemo(
    () => state.attachments.map((item) => item.url),
    [state.attachments]
  );

  const queueFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const remainingSlots = Math.max(0, 5 - state.attachments.length);
    if (remainingSlots === 0) return;

    const validImages = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remainingSlots);

    validImages.forEach((file, idx) => {
      if (idx === 0) {
        addAttachment(file);
      } else {
        // Stagger slightly so Date.now() IDs in useBuatLaporan remain unique
        setTimeout(() => addAttachment(file), idx * 10);
      }
    });
  };

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    queueFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    queueFiles(e.dataTransfer.files);
  };

  const handleSelectLokasiPreset = (preset: string) => {
    const current = state.detailLokasi.trim();
    const startsWithPreset = LOKASI_PRESETS.some((p) =>
      current.toLowerCase().startsWith(p.toLowerCase())
    );
    if (!current || startsWithPreset) {
      updateField('detailLokasi', `${preset} `);
    } else {
      updateField('detailLokasi', `${preset} - ${current}`);
    }
    detailLokasiInputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit(currentUser.nim);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-[#F9F6F2] via-[#F3F4F6] to-[#F3ECE6]">
        <div className="flex flex-col items-center gap-3.5 bg-white/80 backdrop-blur-md px-8 py-6 rounded-2xl border border-slate-200/80 shadow-lg">
          <div className="w-10 h-10 border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C] rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-semibold">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F3F0] font-sans antialiased text-slate-800">
      <Sidebar isOpenMobile={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Navbar
          pageTitle="Buat Laporan"
          userName={currentUser.nama}
          userRole={currentUser.role}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <main
          ref={mainRef}
          className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 md:px-8 md:py-8 bg-gradient-to-br from-[#F8F5F1] via-[#F3F4F6] to-[#F4EDE6]"
        >
          {/* Decorative Ambient Background Glows */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            <div className="absolute -top-24 right-[10%] w-80 h-80 rounded-full bg-[#7A0C0C]/[0.05] blur-3xl" />
            <div className="absolute bottom-0 left-[25%] w-96 h-96 rounded-full bg-[#C88A3B]/[0.07] blur-3xl" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto space-y-6 sm:space-y-7 pb-8">
            {/* Page Header — menyatu dengan background page */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="pt-1 pb-5 border-b border-slate-300/70"
            >
              <div className="space-y-2.5 max-w-2xl">
                <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-snug text-slate-900">
                  Halo, <span className="text-[#7A0C0C]">{currentUser.nama.split(' ')[0]}</span>! Ada kendala di sekitar kampus?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                  Laporkan kerusakan fasilitas atau masalah kebersihan dengan jelas beserta bukti foto agar tim pengelola Universitas Sanata Dharma dapat menindaklanjuti lebih cepat.
                </p>
              </div>
            </motion.section>

            {/* Error Alert */}
            <AnimatePresence mode="wait">
              {state.error && (
                <motion.div
                  key="error-alert"
                  initial={{ opacity: 0, y: -8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start sm:items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-50/95 border border-red-200/90 text-red-800 text-sm shadow-sm"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pt-0.5 sm:pt-0">
                    <p className="font-semibold text-red-900 text-xs uppercase tracking-wider mb-0.5">
                      Periksa Kembali Formulir
                    </p>
                    <p className="text-sm text-red-700">{state.error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => clearError()}
                    aria-label="Tutup pesan kesalahan"
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Single-Column Workspace */}
            <div className="space-y-8">
              {/* FORM (Tanpa Card, dipisahkan dengan penanda & garis pembatas) */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
              >
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* SECTION 1: KATEGORI LAPORAN */}
                  <section aria-labelledby="section-kategori" className="space-y-4">
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A0C0C] to-[#A61B1B] text-white text-xs font-bold flex items-center justify-center shadow-xs shrink-0">
                        01
                      </span>
                      <div className="min-w-0">
                        <h3 id="section-kategori" className="text-base font-bold text-slate-900">
                          Kategori Laporan
                        </h3>
                      </div>
                    </div>

                    {/* Kategori Interactive Buttons */}
                    <div className="pl-0 sm:pl-11">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {KATEGORI_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const isSelected = state.kategori === option.value;
                          return (
                            <motion.button
                              key={option.value}
                              type="button"
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.985 }}
                              aria-pressed={isSelected}
                              onClick={() => updateField('kategori', option.value)}
                              className={`group relative text-left rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#7A0C0C] ${
                                isSelected
                                  ? option.accentActive
                                  : 'border-slate-200/90 bg-white/80 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                              }`}
                            >
                              <div className="flex items-start gap-3.5">
                                <div
                                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                                    isSelected ? option.iconBgActive : option.iconBgIdle
                                  }`}
                                >
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0 pr-5">
                                  <p className="font-bold text-sm text-slate-900">{option.label}</p>
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    {option.subtitle}
                                  </p>
                                </div>
                              </div>

                              {/* Check indicator */}
                              <div
                                className={`absolute top-3.5 right-3.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                                  isSelected
                                    ? `${option.checkBg} text-white scale-100`
                                    : 'border-2 border-slate-300 bg-white scale-90 group-hover:border-slate-400'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {/* Pembatas Kelompok 01 -> 02 */}
                  <div className="h-px w-full bg-gradient-to-r from-[#7A0C0C]/25 via-slate-300/80 to-transparent" />

                  {/* SECTION 2: LOKASI KEJADIAN */}
                  <section aria-labelledby="section-lokasi" className="space-y-5">
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A0C0C] to-[#A61B1B] text-white text-xs font-bold flex items-center justify-center shadow-xs shrink-0">
                        02
                      </span>
                      <div>
                        <h3 id="section-lokasi" className="text-base font-bold text-slate-900">
                          Lokasi Kejadian
                        </h3>
                      </div>
                    </div>

                    <div className="pl-0 sm:pl-11 space-y-5">
                      {/* Campus Selector Grid */}
                      <div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                          {KAMPUS_OPTIONS.map((kampus) => {
                            const isSelected = state.lokasiKampus === kampus.value;
                            return (
                              <motion.button
                                key={kampus.value}
                                type="button"
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                aria-pressed={isSelected}
                                onClick={() => updateField('lokasiKampus', kampus.value)}
                                className={`group relative rounded-2xl border-2 p-3 sm:p-3.5 text-left transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#7A0C0C] ${
                                  isSelected
                                    ? 'border-[#7A0C0C] bg-gradient-to-b from-[#7A0C0C] to-[#5E0808] text-white shadow-md shadow-[#7A0C0C]/25'
                                    : 'border-slate-200/90 bg-white/80 text-slate-800 hover:bg-white hover:border-[#7A0C0C]/40 hover:shadow-xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  {/* <span
                                    className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${
                                      isSelected
                                        ? 'bg-white/20 text-amber-200'
                                        : 'bg-amber-100/80 text-[#8B5A2B]'
                                    }`}
                                  >
                                    {kampus.code}
                                  </span> */}
                                  <Building2
                                    className={`w-4 h-4 ${
                                      isSelected ? 'text-amber-300' : 'text-slate-400 group-hover:text-[#7A0C0C]'
                                    }`}
                                  />
                                </div>
                                <p
                                  className={`text-sm font-bold leading-tight ${
                                    isSelected ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {kampus.label}
                                </p>
                                <p
                                  className={`text-[11px] mt-0.5 flex items-center gap-1 ${
                                    isSelected ? 'text-red-100/90' : 'text-slate-500'
                                  }`}
                                >
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>{kampus.area}</span>
                                </p>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detail Lokasi Input + Quick Chips */}
                      <div className="space-y-2.5">
                        <label
                          htmlFor="detail-lokasi"
                          className="block text-sm font-semibold text-slate-800"
                        >
                          Detail Lokasi / Ruangan <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <input
                            ref={detailLokasiInputRef}
                            id="detail-lokasi"
                            type="text"
                            placeholder="Ruang Kelas K.205"
                            value={state.detailLokasi}
                            onChange={(e) => updateField('detailLokasi', e.target.value)}
                            required
                            className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300/80 bg-white/90 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#7A0C0C]/25 focus:border-[#7A0C0C] text-sm text-slate-800 placeholder:text-slate-400 shadow-2xs transition-all outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {LOKASI_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleSelectLokasiPreset(preset)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/80 hover:bg-[#7A0C0C]/10 text-slate-600 hover:text-[#7A0C0C] border border-slate-200 hover:border-[#7A0C0C]/30 transition-colors cursor-pointer"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Pembatas Kelompok 02 -> 03 */}
                  <div className="h-px w-full bg-gradient-to-r from-[#7A0C0C]/25 via-slate-300/80 to-transparent" />

                  {/* SECTION 3: DESKRIPSI & FOTO */}
                  <section aria-labelledby="section-deskripsi" className="space-y-6">
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A0C0C] to-[#A61B1B] text-white text-xs font-bold flex items-center justify-center shadow-xs shrink-0">
                        03
                      </span>
                      <div>
                        <h3 id="section-deskripsi" className="text-base font-bold text-slate-900">
                          Deskripsi &amp; Bukti Foto
                        </h3>
                      </div>
                    </div>

                    <div className="pl-0 sm:pl-11 space-y-6">
                      {/* Deskripsi */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label
                            htmlFor="deskripsi-masalah"
                            className="block text-sm font-semibold text-slate-800"
                          >
                            Deskripsi Masalah <span className="text-red-500">*</span>
                          </label>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              state.deskripsi.trim().length >= 20
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-white/80 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {state.deskripsi.trim().length} karakter
                            {/* {state.deskripsi.trim().length >= 20 ? ' • Detail baik' : ''} */}
                          </span>
                        </div>
                        <div className="relative">
                          <textarea
                            id="deskripsi-masalah"
                            rows={4}
                            placeholder="Tuliskan deskripsi permasalahan yang anda temukan di sini..."
                            value={state.deskripsi}
                            onChange={(e) => updateField('deskripsi', e.target.value)}
                            required
                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-300/80 bg-white/90 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#7A0C0C]/25 focus:border-[#7A0C0C] text-sm text-slate-800 placeholder:text-slate-400 shadow-2xs transition-all outline-none resize-y min-h-[120px] leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Upload Foto */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label className="block text-sm font-semibold text-slate-800">
                              Foto / Lampiran Bukti <span className="text-red-500">*</span>
                            </label>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              state.attachments.length > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{state.attachments.length} / 5</span>
                          </span>
                        </div>

                        {/* Dropzone when empty */}
                        {state.attachments.length === 0 ? (
                          <label
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`group cursor-pointer relative flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed px-6 py-9 transition-all duration-200 ${
                              isDragging
                                ? 'border-[#7A0C0C] bg-[#7A0C0C]/[0.06] scale-[1.01]'
                                : 'border-slate-300 hover:border-[#7A0C0C] bg-white/75 hover:bg-white'
                            }`}
                          >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7A0C0C]/10 to-[#C88A3B]/15 text-[#7A0C0C] group-hover:from-[#7A0C0C] group-hover:to-[#A61B1B] group-hover:text-white flex items-center justify-center shadow-xs mb-3 transition-all duration-200 group-hover:scale-105">
                              <Upload className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-bold text-slate-800 group-hover:text-[#7A0C0C] transition-colors">
                              Seret foto ke sini atau klik untuk memilih<br></br>(JPG, PNG)
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleAddAttachment}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-3.5">
                            <AnimatePresence>
                              {state.attachments.map((item, idx) => (
                                <motion.div
                                  key={`${item.id}-${idx}`}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.85 }}
                                  transition={{ duration: 0.2 }}
                                  className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square shadow-xs"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.url}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />

                                  {/* Hover overlay with zoom button */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/15 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewIndex(idx)}
                                      aria-label={`Perbesar ${item.name}`}
                                      className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                                    >
                                      <ZoomIn className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Index badge */}
                                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                                    #{idx + 1}
                                  </span>

                                  {/* Remove button */}
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(item.id)}
                                    aria-label={`Hapus ${item.name}`}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>

                                  {/* File name caption */}
                                  <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                    <span className="block text-[11px] font-medium text-white truncate">
                                      {item.name}
                                    </span>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {state.attachments.length < 5 && (
                              <label
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`cursor-pointer border-2 border-dashed rounded-2xl aspect-square flex flex-col items-center justify-center gap-2 transition-all group ${
                                  isDragging
                                    ? 'border-[#7A0C0C] bg-[#7A0C0C]/10 text-[#7A0C0C]'
                                    : 'border-slate-300 hover:border-[#7A0C0C] bg-white/75 hover:bg-white text-slate-500 hover:text-[#7A0C0C]'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-xs transition-colors">
                                  <Upload className="w-5 h-5" />
                                </div>
                                <div className="text-center px-2">
                                  <span className="block text-xs font-bold">Tambah Foto</span>
                                  <span className="block text-[10px] text-slate-400">
                                    Sisa {5 - state.attachments.length} slot
                                  </span>
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleAddAttachment}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-6 border-t border-slate-300/70 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push('/')}
                            className="flex-1 sm:flex-none min-h-[46px] px-5 py-2.5 rounded-xl border border-[#8B5A2B]/30 bg-[#8B5A2B]/10 hover:bg-[#8B5A2B] text-[#744A22] hover:text-white text-sm font-semibold transition-all duration-200 active:scale-[0.98] flex items-center justify-center cursor-pointer"
                          >
                            Batal
                          </button>
                          {hasAnyInput && (
                            <button
                              type="button"
                              onClick={reset}
                              disabled={state.loading}
                              className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300/80 bg-white/90 hover:bg-white text-slate-600 text-sm font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title="Bersihkan seluruh isian formulir"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span className="hidden sm:inline">Reset</span>
                            </button>
                          )}
                        </div>

                        <motion.button
                          whileHover={{ scale: state.loading ? 1 : 1.015 }}
                          whileTap={{ scale: state.loading ? 1 : 0.985 }}
                          type="submit"
                          disabled={state.loading}
                          className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2.5 px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#7A0C0C] via-[#941212] to-[#B01E1E] hover:from-[#650909] hover:to-[#991515] text-white text-sm font-bold shadow-lg shadow-[#7A0C0C]/25 transition-all duration-200 disabled:opacity-70 cursor-pointer"
                        >
                          {state.loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Mengirim Laporan...</span>
                            </>
                          ) : (
                            <>
                              <span>Kirim Laporan</span>
                              <Send className="w-4 h-4" />
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </section>
                </form>
              </motion.div>

              {/* Pembatas menuju Tips di paling bawah */}
              <div className="h-px w-full bg-gradient-to-r from-[#7A0C0C]/25 via-slate-300/80 to-transparent" />

              {/* BOTTOM SECTION: TIPS MENYATU DENGAN PAGE */}
              <motion.aside
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 }}
                className="pt-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#7A0C0C]/10 text-[#7A0C0C] flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Tips Agar Cepat Diproses</h4>
                      <p className="text-[11px] text-slate-500">Panduan singkat pelaporan efektif</p>
                    </div>
                  </div>

                  <ul className="grid grid-cols-1 md:grid-cols-3 gap-3.5 md:gap-5 text-xs text-slate-600 leading-relaxed">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#7A0C0C]/10 text-[#7A0C0C] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        <strong className="text-slate-800">Sebutkan lokasi spesifik</strong> seperti nama gedung, lantai, dan nomor ruangan.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#7A0C0C]/10 text-[#7A0C0C] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        <strong className="text-slate-800">Ambil foto yang jelas</strong> dengan pencahayaan cukup agar kerusakan mudah diidentifikasi.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#7A0C0C]/10 text-[#7A0C0C] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        <strong className="text-slate-800">Jelaskan dampak kendala</strong> (misal: mengganggu perkuliahan atau membahayakan pengguna).
                      </span>
                    </li>
                  </ul>
                </div>
              </motion.aside>
            </div>
          </div>
        </main>

        {/* Bottom Persistent Progress Bar — selalu mengikuti scroll di paling bawah layar */}
        <div className="shrink-0 z-20 bg-white/92 backdrop-blur-md border-t border-slate-200/85 shadow-[0_-6px_24px_-10px_rgba(15,23,42,0.12)] px-4 sm:px-6 md:px-8 py-3">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-slate-800">Kelengkapan Form</span>
                <span className="text-[11px] font-medium text-slate-500">
                  ({completedCount} dari {checklist.length} bagian terisi)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1.5">
                  {checklist.map((item) => (
                    <span
                      key={`bar-${item.key}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                        item.done
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200/80'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 ${
                          item.done ? 'text-emerald-600 stroke-[2.75]' : 'text-slate-300'
                        }`}
                      />
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isReadyToSubmit
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-[#7A0C0C]/10 text-[#7A0C0C]'
                  }`}
                >
                  {isReadyToSubmit && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  <span>{progressPercent}%</span>
                  {isReadyToSubmit && <span className="hidden sm:inline">• Siap Kirim</span>}
                </span>
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-200/85 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  isReadyToSubmit
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400'
                    : 'bg-gradient-to-r from-[#5E0808] via-[#7A0C0C] to-[#B91C1C]'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Success Popup Modal */}
      <AnimatePresence>
        {state.success && (
          <motion.div
            key="success-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => clearSuccess()}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs"
          >
            <motion.div
              key="success-modal-card"
              initial={{ opacity: 0, scale: 0.92, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200/80"
            >
              <button
                type="button"
                onClick={() => clearSuccess()}
                aria-label="Tutup popup notifikasi"
                className="absolute top-4 right-4 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 sm:p-7 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-[#7A0C0C]/[0.08] border border-[#7A0C0C]/15 flex items-center justify-center shadow-inner">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7A0C0C] to-[#A61B1B] text-white flex items-center justify-center shadow-md shadow-[#7A0C0C]/25">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3
                    id="success-modal-title"
                    className="text-lg sm:text-xl font-extrabold text-slate-900"
                  >
                    Laporan Berhasil Terkirim!
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {state.success}
                  </p>
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => clearSuccess()}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                  <Link
                    href="/lihat-status"
                    onClick={() => clearSuccess()}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7A0C0C] to-[#9E1B1B] hover:from-[#650909] hover:to-[#8B1515] text-white text-sm font-bold shadow-md shadow-[#7A0C0C]/20 transition-all"
                  >
                    <span>Pantau Status</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Image Preview Modal */}
      <ImagePreviewModal
        images={previewImages}
        activeIndex={previewIndex}
        onClose={() => setPreviewIndex(null)}
        onChangeIndex={setPreviewIndex}
        titlePrefix="Pratinjau Lampiran"
      />
    </div>
  );
}
