Saya ingin mengimplementasikan fitur deteksi laporan serupa, eskalasi prioritas otomatis, dan pengelompokan (grouping) tiket pada modul Dashboard Prioritas menggunakan pendekatan **Hybrid (Pre-filter Database Lokal + Verifikasi AI Multimodal)**.

Sebelum menulis kode, periksa terlebih dahulu struktur codebase, skema database (tabel laporan, status, user), konfigurasi AI service yang sudah ada, serta logika SPK/prioritas saat ini agar implementasi selaras dengan arsitektur proyek.

### 1. Mekanisme Deteksi Laporan Serupa (Pendekatan Hybrid)
Ketika ada laporan baru yang masuk, jalankan proses deteksi dalam 2 tahap:

- **Tahap 1 — Pre-filter Lokal di Database (Tanpa AI):**
  - Cari kandidat laporan lain di database yang:
    1. Statusnya **belum selesai** (bukan `Selesai` dan bukan `Ditolak`).
    2. Memiliki **Kategori Laporan yang sama**.
    3. Memiliki **Lokasi yang sama**.
    4. Memiliki **Detail lokasi / Ruangan yang sama** (normalisasi teks: *case-insensitive*, trim spasi; boleh menggunakan pencocokan persis atau kemiripan lokasi ketat).
    5. Dikirim oleh **pelapor yang berbeda** (`user_id / nim` berbeda).
  - **Jika tidak ada kandidat** dari Tahap 1, langsung hentikan proses deteksi (tidak perlu memanggil API AI) dan simpan laporan seperti biasa.
  - Jika kandidat sudah tergabung dalam sebuah grup, cukup ambil **1 laporan representatif (tiket utama)** per grup agar pemanggilan AI tetap hemat.

- **Tahap 2 — Verifikasi Kemiripan via AI Multimodal:**
  - Kirim data laporan baru (deskripsi + foto bukti) bersama data kandidat dari Tahap 1 (deskripsi + foto bukti) ke model AI multimodal yang sudah terintegrasi di proyek.
  - Instruksikan model AI untuk mengembalikan output terstruktur (JSON), misalnya:
    `{ "is_similar": boolean, "confidence": number, "reason": string }`
  - Kriteria prompt ke AI: tentukan apakah kedua laporan merujuk pada **objek kerusakan/masalah fisik yang sama** di lokasi tersebut, meskipun gaya penulisan deskripsi berbeda atau foto diambil dari sudut/pencahayaan/HP yang berbeda.
  - Gunakan *threshold* keyakinan yang wajar (misal `is_similar === true` dan `confidence >= 0.75`).
  - **Fallback wajib:** Jika pemanggilan API AI gagal, *timeout*, atau terkena *rate limit*, **jangan gagalkan pengiriman laporan mahasiswa**. Tetap simpan laporan secara normal tanpa grouping dan catat error di log.

### 2. Aturan Eskalasi Prioritas & Grouping (Database)
- Tambahkan skema relasi pengelompokan pada database (misalnya kolom `group_id` atau tabel `laporan_groups` yang berelasi ke tabel `laporan`), lengkap dengan file migrasinya.
- Jika Tahap 2 menyatakan laporan baru serupa dengan kandidat:
  - Gabungkan laporan baru ke dalam grup yang sama dengan kandidat tersebut (buat grup baru jika kandidat belum punya grup).
- **Trigger Eskalasi Prioritas:**
  - Hitung jumlah **pelapor unik (`COUNT(DISTINCT nim/user_id)`)** yang tergabung dalam grup tersebut.
  - Jika jumlah pelapor unik mencapai **minimal 3 pelapor berbeda** (misal: Laporan A, B, dan C):
    - Naikkan prioritas **seluruh laporan dalam grup tersebut (A, B, dan C)** secara bersamaan menjadi **prioritas tertinggi (`Tinggi` / Urgent)** dengan skor prioritas tertinggi agar tampil di posisi paling atas.
  - Jika masuk laporan ke-4 (D) yang serupa dari pelapor berbeda, otomatis masukkan ke grup yang sama dengan prioritas tertinggi juga.
  - Jika 1 user yang sama mengirim laporan serupa berkali-kali, tetap dihitung sebagai 1 pelapor unik.

### 3. Tampilan Dashboard Prioritas (Grouping UI)
- Pada halaman **Dashboard Prioritas Admin**, jangan tampilkan laporan dalam satu grup sebagai baris-baris terpisah.
- Tampilkan **1 baris utama** yang mewakili grup tersebut (gunakan laporan paling awal/pertama sebagai representasi agar waktu tunggu/SLA akurat).
- Tampilkan indikator/badge yang jelas pada baris tersebut, misalnya: **`3 Laporan Serupa`**.
- Ketika Admin klik **Detail**, tampilkan informasi laporan utama beserta daftar/tab ringkas seluruh anggota grup (nama pelapor, waktu lapor, deskripsi, dan foto bukti masing-masing) dalam satu halaman.
- Pertahankan gaya desain UI yang sudah ada (bersih, fungsional, tanpa nested card berlebihan).

### 4. Sinkronisasi Status Penanganan
- Ketika Admin BLU/BPS mengubah status pada tiket utama yang tergabung dalam grup:
  - Perubahan status dan catatan tanggapan Admin harus **otomatis disinkronkan** ke seluruh laporan lain di grup yang sama (A, B, C, dst.), termasuk pencatatan pada riwayat status masing-masing laporan.
  - Seluruh pelapor di grup tersebut harus bisa melihat pembaruan status secara real-time pada menu **Lihat Status** dan **Riwayat Laporan**.
- Tetap jaga aturan bisnis yang berlaku: prioritas bersifat *read-only* bagi Admin dan urutan status tidak boleh melompat langsung dari `Terkirim` ke `Selesai`.

### 5. Batasan Pengerjaan
- Jangan mengubah atau merusak alur fitur lain yang tidak berkaitan (Registrasi, Login, Rekap Laporan, dll.).
- Paparkan rencana perubahan (skema database, alur service AI + fallback, endpoint backend, dan komponen UI) terlebih dahulu sebelum memodifikasi kode.