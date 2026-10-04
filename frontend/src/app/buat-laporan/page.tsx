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
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const [kategori, setKategori] = useState("");
  const [tanggal, setTanggal] = useState(
    new Date().toISOString().split("T")[0]
  );
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
    setTanggal(new Date().toISOString().split("T")[0]);
    setJudul("");
    setLokasi("");
    setDeskripsi("");
    setSubmitted(false);
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul || !kategori || !lokasi || !deskripsi) {
      alert("Mohon lengkapi seluruh kolom formulir!");
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#F3F4F6] font-sans antialiased text-slate-800">
      {/* ------------------------------------------------------------- */}
      {/* KOMPONEN SIDEBAR (Menu Navigasi) */}
      {/* ------------------------------------------------------------- */}
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      {/* ------------------------------------------------------------- */}
      {/* MAIN WRAPPER (Navbar + Content Area) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* --------------------------------------------------------- */}
        {/* KOMPONEN NAVBAR TERSENDIRI (Judul Page Mengikuti Active Menu) */}
        {/* --------------------------------------------------------- */}
        <Navbar
          pageTitle={getPageTitle(activeMenu)}
          userName="Agustinus"
          userRole="Mahasiswa"
        />

        {/* --------------------------------------------------------- */}
        {/* AREA KONTEN UTAMA (Abu-abu Terang) */}
        {/* --------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F3F4F6]">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* ----------------------------------------------------- */}
            {/* MENU: BUAT LAPORAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "buat-laporan" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Sampaikan laporan kerusakan fasilitas atau kendala lingkungan kampus Sanata Dharma.
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 border border-slate-300">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                    Formulir Resmi USD
                  </span>
                </div>

                {/* CARD PUTIH (FORM LENGKAP) */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* GRID 2 KOLOM */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 1. Kategori Laporan */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Kategori Laporan <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={kategori}
                          onChange={(e) => setKategori(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none"
                        >
                          <option value="" disabled>
                            -- Pilih Kategori Laporan --
                          </option>
                          <option value="Fasilitas Ruang Kelas">
                            Fasilitas Ruang Kelas (Proyektor, AC, Kursi)
                          </option>
                          <option value="Kerusakan Bangunan">
                            Kerusakan Bangunan & Lift
                          </option>
                          <option value="Kebersihan & Sanitasi">
                            Kebersihan & Sanitasi Toilet
                          </option>
                          <option value="Jaringan IT & Wi-Fi">
                            Jaringan IT & Wi-Fi Kampus
                          </option>
                          <option value="Fasilitas Olahraga & Taman">
                            Fasilitas Olahraga & Taman
                          </option>
                          <option value="Lain-lain">Lain-lain</option>
                        </select>
                      </div>

                      {/* 2. Tanggal Kejadian */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Tanggal Kejadian <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={tanggal}
                          onChange={(e) => setTanggal(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 transition-all outline-none"
                        />
                      </div>

                      {/* 3. Judul Laporan */}
                      {/* <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Judul Laporan <span className="text-red-500">*</span>
                        
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Proyektor mati di Ruang K.302"
                          value={judul}
                          onChange={(e) => setJudul(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                        />
                      </div> */}

                      {/* 4. Lokasi Kejadian */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Lokasi Kejadian <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                            <MapPin className="w-5 h-5 text-[#7A0C0C]" />
                          </div>
                          <input
                            type="text"
                            placeholder="Contoh: Kampus III Paingan, Gedung Thomas Aquinas Lt. 3"
                            value={lokasi}
                            onChange={(e) => setLokasi(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* DESKRIPSI MASALAH */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Deskripsi Masalah <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Jelaskan secara rinci kondisi masalah atau kerusakan yang ditemukan..."
                        value={deskripsi}
                        onChange={(e) => setDeskripsi(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#7A0C0C] focus:border-[#7A0C0C] bg-slate-50/50 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none resize-none"
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {attachments.map((item) => (
                          <div
                            key={item.id}
                            className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-28 flex items-center justify-center shadow-xs"
                          >
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(item.id)}
                              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110"
                              title="Hapus foto"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <span className="absolute bottom-1 left-2 right-2 text-[10px] text-white truncate drop-shadow-md">
                              {item.name}
                            </span>
                          </div>
                        ))}

                        <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-[#7A0C0C] bg-slate-50 hover:bg-red-50/30 rounded-xl h-28 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#7A0C0C] transition-all group">
                          <div className="w-9 h-9 rounded-full bg-white group-hover:bg-[#7A0C0C] text-[#7A0C0C] group-hover:text-white flex items-center justify-center shadow-xs transition-colors">
                            <Upload className="w-4 h-4" />
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

                    {/* TOMBOL AKSI */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleBatal}
                        className="px-6 py-2.5 rounded-xl bg-[#8B5A2B] hover:bg-[#744A22] text-white text-sm font-semibold shadow-xs transition-all duration-200 active:scale-98"
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        disabled={submitted}
                        className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#7A0C0C] hover:bg-[#9E1B1B] text-white text-sm font-semibold shadow-md shadow-[#7A0C0C]/20 transition-all duration-200 active:scale-98 disabled:opacity-70"
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
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-50 text-[#7A0C0C] mx-auto flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Status Laporan Aktif</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Pantau proses verifikasi dan tindak lanjut laporan yang telah Anda ajukan secara real-time.
                </p>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* MENU: RIWAYAT LAPORAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "riwayat-laporan" && (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Riwayat Seluruh Pelaporan</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Daftar laporan fasilitas dan masalah lingkungan kampus yang pernah Anda selesaikan sebelumnya.
                </p>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* MENU: RUBAH PENGAJUAN */}
            {/* ----------------------------------------------------- */}
            {activeMenu === "rubah-pengajuan" && (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                  <Edit3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Rubah Pengajuan Laporan</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Sunting detail atau tambahkan lampiran pendukung untuk laporan yang sedang dalam proses review.
                </p>
              </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* FOOTER */}
            {/* --------------------------------------------------------- */}
            <footer className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <p>SiLapor USD © 2026 Universitas Sanata Dharma</p>
              <div className="flex items-center gap-4">
                <a
                  href="#privasi"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Kebijakan Privasi SiLapor USD");
                  }}
                  className="hover:text-[#7A0C0C] transition-colors"
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
                  className="hover:text-[#7A0C0C] transition-colors"
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
