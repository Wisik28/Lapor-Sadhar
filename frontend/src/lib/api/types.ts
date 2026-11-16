/**
 * Type definitions untuk Laporan API
 */

export interface StatusLaporan {
  id_status: number;
  id_laporan: number;
  status_laporan: 'Terkirim' | 'Diverifikasi' | 'Sedang Diverifikasi' | 'Terverifikasi' | 'Proses' | 'Diproses' | 'Selesai' | 'Ditolak';
  tanggal_merubah: string;
}

export interface LaporanItem {
  id_laporan: number;
  nim: string;
  nama_pelapor?: string;
  kategori_laporan: 'Fasilitas' | 'Kebersihan';
  deskripsi: string;
  tanggal_kejadian: string;
  tanggal_buat: string;
  tanggal_rubah?: string | null;
  lokasi: string;
  foto?: string | null;
  status_terkini: 'Terkirim' | 'Diverifikasi' | 'Sedang Diverifikasi' | 'Terverifikasi' | 'Proses' | 'Diproses' | 'Selesai' | 'Ditolak';
  riwayat_status: StatusLaporan[];
  pesan_tanggapan?: string | null;
}

export interface LaporanResponse {
  status: 'success' | 'error';
  message?: string;
  data?: LaporanItem | LaporanItem[];
  total?: number;
  errors?: Record<string, string[]>;
}

export type LaporanStatus = 'Terkirim' | 'Diverifikasi' | 'Diproses' | 'Selesai' | 'Ditolak';
export type LaporanKategori = 'Fasilitas' | 'Kebersihan';

/**
 * Attachment interface untuk file handling
 */
export interface Attachment {
  id: string;
  url: string;
  name: string;
  file: File;
}
