"use client";

import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import {
  MapPin,
  Send,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Edit3
} from "lucide-react";

interface Attachment {
  id: string;
  url: string;
  name: string;
}

export default function BuatLaporanPage() {
  const [activeMenu, setActiveMenu] = useState("buat-laporan");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const today = new Date().toISOString().split("T")[0];
  const [kategori, setKategori] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [judul, setJudul] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [deskripsi, setDeskripsi] = useState("");

  // Default Mock Thumbnails
  const [attachments, setAttachments] = useState<Attachment[]>([
    {
      id: "1",
      name: "proyektor_rusak.jpg",
      url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: "2",
      name: "kursi_patah.jpg",
      url: "https://images.unsplash.com/photo-1580481072645-022f9a6d83d0?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: "3",
      name: "lampu_mati.jpg",
      url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80"
    }
  ]);

  // Remove thumbnail handler
  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter((item) => item.id !== id));
  };

  // Add new photo handler
  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newAttachment: Attachment = {
        id: Date.now().toString(),
        name: file.name,
        url: URL.createObjectURL(file)
      };
      setAttachments([...attachments, newAttachment]);
    }
  };

  // Reset Form
  const handleBatal = () => {
    setKategori("");
    setTanggal(today);
    setJudul("");
    setLokasi("");
    setDeskripsi("");
    setSubmitted(false);
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kategori || !lokasi || !deskripsi) {
      alert("Mohon lengkapi seluruh kolom formulir!");
      return;
    }
    if (tanggal > today) {
      alert("Tanggal kejadian tidak boleh melebihi tanggal hari ini!");
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      handleBatal();
      alert("Laporan Anda berhasil dikirim ke pihak pengelola USD!");
    }, 2000);
  };

  // Title Mapper berdasarkan Menu Aktif
  const getPageTitle = (menu: string) => {
    switch (menu) {
      case "buat-laporan":
        return "Buat Laporan";
      case "lihat-status":
        return "Lihat Status Laporan";
      case "riwayat-laporan":
        return "Riwayat Laporan";
      case "rubah-pengajuan":
        return "Rubah Pengajuan Laporan";
      default:
        return "Buat Laporan";
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      {/* ------------------------------------------------------------- */}
      {/* KOMPONEN SIDEBAR (Menu Navigasi Desktop & Mobile Drawer) */}
      {/* ------------------------------------------------------------- */}
      <Sidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* ------------------------------------------------------------- */}
      {/* MAIN WRAPPER (Navbar + Content Area) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* --------------------------------------------------------- */}
        {/* KOMPONEN NAVBAR TERSENDIRI (Judul Page & Hamburger Menu) */}
        {/* --------------------------------------------------------- */}
        <Navbar
          pageTitle={getPageTitle(activeMenu)}
          userName="Agustinus"
          userRole="Mahasiswa"
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        {/* --------------------------------------------------------- */}
        {/* AREA KONTEN UTAMA */}
        {/* --------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 md:p-8 bg-[#F3F4F6]">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* ----------------------------------------------------- */}
            {/* MENU: BUAT LAPORAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "buat-laporan" && (
              <>
                {/* CARD PUTIH (FORM LENGKAP) */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    {/* GRID FORM: 1 Kolom di Mobile, 2 Kolom di Tablet & Desktop */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {/* 1. Kategori Laporan */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">
                          Kategori Laporan <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={kategori}
                          onChange={(e) => setKategori(e.target.value)}
                          required
                          className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none"
                        >
                          <option value="" disabled>
                            -- Pilih Kategori Laporan --
                          </option>
                          <option value="Fasilitas">
                            Fasilitas
                          </option>
                          <option value="Kebersihan">
                            Kebersihan
                          </option>
                        </select>
                      </div>

                      {/* 2. Tanggal Kejadian */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">
                          Tanggal Kejadian <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={tanggal}
                          max={today}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            if (selectedDate > today) {
                              alert("Tanggal kejadian tidak boleh melebihi hari ini!");
                              return;
                            }
                            setTanggal(selectedDate);
                          }}
                          required
                          className="w-full min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none"
                        />
                      </div>

                      {/* 3. Lokasi Kejadian (Span 2 kolom di tablet/desktop jika diinginkan) */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">
                          Lokasi Kejadian <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                            <MapPin className="w-5 h-5 text-[#7A0C0C]" />
                          </div>
                          <input
                            type="text"
                            placeholder="Contoh: Kampus III, Ruang Kelas K.205"
                            value={lokasi}
                            onChange={(e) => setLokasi(e.target.value)}
                            required
                            className="w-full min-h-[44px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* DESKRIPSI MASALAH */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">
                        Deskripsi Masalah <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Contoh: Kipas menyala tetapi baling-balingnya tidak dapat berputar"
                        value={deskripsi}
                        onChange={(e) => setDeskripsi(e.target.value)}
                        required
                        className="w-full px-3.5 sm:px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none resize-y min-h-[100px]"
                      ></textarea>
                    </div>

                    {/* UPLOAD AREA (FOTO/LAMPIRAN) */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Foto / Lampiran
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        Unggah bukti foto kerusakan (Maksimal 5 foto, format JPG/PNG).
                      </p>

                      {/* Responsif: 2 kolom di mobile kecil, 3 di mobile sedang, 4 di sm/desktop */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                        {attachments.map((item) => (
                          <div
                            key={item.id}
                            className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-28 sm:h-32 flex items-center justify-center shadow-xs"
                          >
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(item.id)}
                              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
                              title="Hapus foto"
                              aria-label={`Hapus ${item.name}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                              <span className="block text-[11px] text-white truncate px-1 drop-shadow-xs">
                                {item.name}
                              </span>
                            </div>
                          </div>
                        ))}

                        <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#7A0C0C] bg-slate-50 hover:bg-red-50/30 rounded-xl h-28 sm:h-32 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#7A0C0C] transition-all group active:scale-98">
                          <div className="w-10 h-10 rounded-full bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-xs transition-colors">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold">Tambahkan</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAddAttachment}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* TOMBOL AKSI: Full width / stacked di mobile kecil, inline di layar lebih besar */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={handleBatal}
                        className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8B5A2B] hover:bg-[#744A22] active:bg-[#5E3B1B] text-white text-sm font-semibold shadow-xs transition-all duration-200 active:scale-98 flex items-center justify-center"
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        disabled={submitted}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] active:bg-[#600808] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/20 transition-all duration-200 active:scale-98 disabled:opacity-70"
                      >
                        {submitted ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 animate-bounce text-white" />
                            <span>Mengirim...</span>
                          </>
                        ) : (
                          <>
                            <span>Kirim</span>
                            <Send className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {/* ----------------------------------------------------- */}
            {/* MENU: LIHAT STATUS LAPORAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "lihat-status" && (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-2 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-[#7A0C0C] mx-auto flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Status Laporan Aktif</h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Pantau proses verifikasi dan tindak lanjut laporan yang telah Anda ajukan secara real-time.
                  </p>
                </div>

                {/* STEPPER STATUS BERPERCABANGAN: Terkirim -> Diverifikasi -> (Diproses -> Selesai) ATAU (Ditolak) */}
                <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/70 max-w-3xl mx-auto space-y-4">
                  <div className="text-center sm:text-left">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Alur Status Penanganan Laporan (Eksklusif)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Laporan yang telah <strong>Diproses</strong> tidak dapat ditolak, dan laporan yang <strong>Ditolak</strong> tidak akan diproses ke tahap pengerjaan.
                    </p>
                  </div>

                  {/* Jalur Utama: Terkirim -> Diverifikasi -> Diproses -> Selesai */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Jalur Persetujuan & Perbaikan:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-center">
                      <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs space-y-0.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                        <p className="text-xs font-bold text-blue-700">1. Terkirim</p>
                        <p className="text-[10px] text-slate-500">Laporan masuk</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs space-y-0.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                        <p className="text-xs font-bold text-indigo-700">2. Diverifikasi</p>
                        <p className="text-[10px] text-slate-500">Review admin/sarpras</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs space-y-0.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                        <p className="text-xs font-bold text-amber-700">3. Diproses</p>
                        <p className="text-[10px] text-slate-500">Pengerjaan teknisi</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-0.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        <p className="text-xs font-bold text-emerald-700">4. Selesai</p>
                        <p className="text-[10px] text-slate-500">Fasilitas tuntas</p>
                      </div>
                    </div>

                    {/* Jalur Alternatif: Ditolak */}
                    <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 bg-red-50/50 p-3 rounded-xl border border-red-100">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                        <span className="font-bold text-red-700">Jalur Penolakan (Alternatif dari Diverifikasi):</span>
                        <span className="text-slate-600 text-[11px]">
                          Jika laporan tidak valid, status berubah menjadi <strong>Ditolak</strong> dan tidak dapat diproses lagi.
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 shrink-0">
                        Status Akhir: Ditolak
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* MENU: RIWAYAT LAPORAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "riwayat-laporan" && (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 sm:p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Riwayat Seluruh Pelaporan</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Daftar laporan fasilitas dan masalah lingkungan kampus yang pernah Anda selesaikan sebelumnya.
                </p>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* MENU: RUBAH PENGAJUAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "rubah-pengajuan" && (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 sm:p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                  <Edit3 className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Rubah Pengajuan Laporan</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Sunting detail atau tambahkan lampiran pendukung untuk laporan yang sedang dalam proses review.
                </p>
              </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* FOOTER */}
            {/* --------------------------------------------------------- */}
            <footer className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 text-center sm:text-left">
              <p>SiLapor USD © 2026 Universitas Sanata Dharma</p>
              <div className="flex items-center gap-4">
                <a
                  href="#privasi"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Kebijakan Privasi SiLapor USD");
                  }}
                  className="hover:text-[#7A0C0C] transition-colors py-1 inline-block"
                >
                  Kebijakan Privasi
                </a>
                <span className="text-slate-300">•</span>
                <a
                  href="#bantuan"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Bantuan & FAQ SiLapor USD");
                  }}
                  className="hover:text-[#7A0C0C] transition-colors py-1 inline-block"
                >
                  Bantuan & FAQ
                </a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
