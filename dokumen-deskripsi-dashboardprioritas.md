# Dokumen Deskripsi Sistem dan Alur Kerja AI
## Lapor-Sadhar: Sistem Pelaporan Kerusakan Fasilitas dan Kebersihan Kampus, dengan Dashboard Prioritas

**Versi:** 1.0
**Tanggal:** 11 November 2026
**Untuk:** AI agent pengembang (implementasi)

---

## 1. Tujuan Dokumen

Dokumen ini menjelaskan sistem Lapor-Sadhar secara utuh, termasuk alur kerja kecerdasan buatan (AI) yang mengelola Dashboard Prioritas, dan menetapkan aturan implementasi agar fitur baru tidak merombak program yang sudah ada. Dokumen ini menjadi acuan utama. Jika ada bagian yang tidak jelas, AI agent harus bertanya sebelum mengambil keputusan yang berdampak pada kode yang sudah ada.

---

## 2. Ringkasan Sistem

Lapor-Sadhar adalah sistem pelaporan permasalahan di lingkungan kampus. Seluruh civitas akademika dapat melaporkan masalah yang mereka temui. Laporan dibagi menjadi dua kategori:

1. **Kebersihan**: sampah berserakan, toilet kotor, area yang perlu dibersihkan, dan sejenisnya.
2. **Kerusakan fasilitas**: kursi rusak, lampu mati, atap bocor, pintu atau jendela rusak, AC tidak berfungsi, dan sejenisnya.

Laporan diterima dan ditindaklanjuti oleh pengelola kampus, yaitu **BLU** dan **BPS**. Dashboard Prioritas membantu pengelola melihat laporan mana yang harus ditangani lebih dulu.

---

## 3. Peran Pengguna

| Peran | Siapa | Hak Utama |
|---|---|---|
| Pelapor | Seluruh civitas akademika (mahasiswa, dosen, tenaga kependidikan) | Membuat laporan, melihat status laporan sendiri, memberi tambahan informasi |
| Admin BLU | Petugas Badan Layanan Umum | Menerima, memverifikasi, dan menindaklanjuti laporan kerusakan fasilitas dan kebersihan sesuai kewenangan |
| Admin BPS | Petugas Badan Pengelola Sarana | Menerima, memverifikasi, dan menindaklanjuti laporan sesuai kewenangan, serta mengakses Dashboard Prioritas |

**[Isi: pembagian kewenangan tepat antara BLU dan BPS, misalnya kategori mana yang ditangani masing-masing, dan apakah Dashboard Prioritas hanya untuk BPS atau juga BLU.]**

**[Isi: cara pelapor login, misalnya menggunakan akun kampus, dan apakah laporan boleh dibuat anonim.]**

---

## 4. Arsitektur Teknis

- **Basis data:** **PostgreeSQL dengan supabase**
- **Penyimpanan foto:** **Database dengan URL dari cloudinary**
- **Backend dan frontend:** **backend menggunakan laravel dan frontend next js**
- **Layanan AI:** **[Isi: model dan layanan yang dipakai untuk penilaian tingkat kerusakan dan pembuatan ringkasan, jika ada.]**

### 4.1 Model Data Eksisting (hanya dibaca, tidak diubah)

**[Isi: daftar tabel dan kolom yang sudah ada, misalnya tabel laporan, user, admin, dan status.]**

---

## 5. Alur Laporan (Eksisting)

Alur ini sudah berjalan dan tidak boleh diubah.

1. Pelapor login dan memilih kategori laporan: **kebersihan** atau **kerusakan fasilitas**.
2. Pelapor mengisi lokasi, deskripsi masalah, dan melampirkan foto.
3. Sistem menyimpan laporan dengan status awal **Baru**.
4. Admin BLU atau BPS menerima notifikasi, memverifikasi laporan, lalu mengubah status menjadi **Terkirim**, **Sedang Diproses**, **Selesai**.
5. Pelapor dapat memantau status laporannya.

**[Isi: daftar status lengkap dan siapa yang berhak mengubah masing-masing status.]**

---

## 6. Fitur Baru: Dashboard Prioritas

### 6.1 Tujuan
Membantu admin BLU dan BPS menentukan laporan mana yang harus ditangani lebih dulu. Laporan dengan tingkat kerusakan yang lebih parah diberi bobot lebih tinggi. Laporan dengan tingkat kerusakan sedang atau rendah diberi prioritas lebih rendah.

### 6.2 Tingkat Kerusakan
Setiap laporan diberi tingkat kerusakan. Tingkat ini menjadi dasar utama perhitungan prioritas.

| Tingkat | Deskripsi | Bobot Dasar |
|---|---|---|
| Berat | Membahayakan keselamatan atau menghentikan kegiatan akademik, misalnya atap bocor deras, kabel terbuka, atau fasilitas laboratorium tidak bisa digunakan | [isi, contoh: 100] |
| Sedang | Mengganggu kenyamanan atau sebagian fungsi, misalnya lampu mati di satu ruangan atau AC rusak | [isi, contoh: 50] |
| Ringan | Tidak mengganggu fungsi utama, misalnya cat mengelupas atau goresan kecil | [isi, contoh: 20] |

Untuk kategori kebersihan, tingkat dinilai dengan kriteria yang sama: **[isi kriteria kebersihan, misalnya sampah menumpuk di area umum, atau toilet tidak layak digunakan.]**

### 6.3 Penentuan Tingkat Kerusakan
1. **Penilaian awal oleh AI:** Sistem membaca deskripsi dan foto laporan, lalu mengusulkan tingkat kerusakan. Penilaian ini disimpan sebagai usulan, bukan keputusan final.
2. **Penilaian oleh admin:** Admin dapat mengubah tingkat yang diusulkan AI. Perubahan admin selalu menggantikan usulan AI.
3. **Pemakaian nilai:** Jika admin belum menilai, dashboard memakai usulan AI dan menandainya sebagai "perlu dikonfirmasi".

### 6.4 Logika Skor Prioritas
Skor prioritas dihitung dari beberapa sinyal. Tingkat kerusakan memiliki bobot terbesar.

| Sinyal | Keterangan | Bobot |
|---|---|---|
| Tingkat kerusakan | Berat, sedang, atau ringan (bagian 6.2) | [isi, disarankan paling besar] |
| Lama laporan belum ditangani | Jumlah hari sejak status Baru atau Diverifikasi | [isi] |
| Jumlah laporan serupa di lokasi yang sama | Laporan lain pada lokasi atau fasilitas yang sama dalam periode tertentu | [isi] |
| Lokasi strategis | Area yang sering dipakai, misalnya ruang kelas, perpustakaan, atau laboratorium | [isi] |

Skor akhir dihitung sebagai jumlah bobot sinyal yang sudah dinormalisasi. Rumus lengkap ditulis di file konfigurasi, bukan di kode.

**[Isi: rumus pasti, rentang skor, dan batas skor untuk setiap label prioritas, misalnya Tinggi, Sedang, Rendah.]**

### 6.5 Alur Kerja AI pada Dashboard Prioritas
1. Sistem memperbarui skor saat laporan baru masuk, saat tingkat kerusakan berubah, atau saat status berubah.
2. Sistem mengambil data sinyal dari basis data.
3. Sistem menghitung skor prioritas untuk setiap laporan yang belum selesai.
4. **[Opsional, isi jika diperlukan:]** Model bahasa membuat ringkasan singkat alasan prioritas untuk laporan teratas, misalnya "Atap bocor berat di ruang kelas, sudah 3 hari belum ditangani".
5. Dashboard menampilkan daftar laporan terurut dari skor tertinggi.

### 6.6 Antarmuka Dashboard
- Tabel laporan terurut dengan kolom: nomor laporan, kategori, lokasi, tingkat kerusakan, skor, lama menunggu, dan status.
- Filter: kategori (kebersihan atau kerusakan fasilitas), tingkat kerusakan, lokasi, rentang tanggal, dan status.
- Label visual untuk tingkat kerusakan, misalnya warna berbeda untuk Berat, Sedang, dan Ringan.
- Tombol aksi cepat menuju halaman detail laporan untuk verifikasi atau penetapan tingkat.
- **[Isi: tata letak atau referensi desain yang diinginkan.]**

### 6.7 Kriteria Penerimaan
- Laporan dengan tingkat Berat selalu berada di atas laporan Sedang dan Ringan, kecuali jika ada perbedaan skor lain yang sudah ditentukan dalam aturan.
- Skor dihitung benar untuk data uji yang sudah ditentukan.
- Dashboard memuat dalam waktu **[isi, misalnya 2 detik]** untuk **[isi jumlah laporan]** laporan.
- Hanya admin BLU dan BPS (sesuai bagian 3) yang bisa membuka dashboard. Pengguna lain menerima respons 403.
- Pelapor tidak dapat melihat skor prioritas.
- Tidak ada perubahan pada alur pelaporan yang sudah ada.

---

## 7. Aturan Implementasi (Wajib Dipatuhi)

Fitur Dashboard Prioritas harus ditambahkan **tanpa merombak program yang sudah ada**.

1. **Hanya tambah, jangan ubah.** AI agent hanya boleh membuat file dan modul baru. File yang sudah ada tidak boleh diedit, direfaktor, diganti nama, atau dihapus.
2. **Jika integrasi memerlukan perubahan pada file yang sudah ada** (misalnya mendaftarkan rute baru atau menambah item menu), agent harus **berhenti dan bertanya** terlebih dahulu. Jika disetujui, perubahan harus sekecil mungkin, hanya satu atau dua baris, dan dilaporkan secara eksplisit.
3. **Perubahan basis data hanya bersifat aditif.** Boleh menambah tabel, kolom baru yang nullable, atau indeks baru. Dilarang menghapus, mengubah tipe, atau mengganti nama kolom atau tabel yang sudah ada. Setiap migrasi harus memiliki skrip rollback.
4. **Pisahkan modul.** Seluruh kode Dashboard Prioritas ditempatkan dalam direktori tersendiri, misalnya `modules/priority_dashboard/`.
5. **Jangan mengubah alur pelaporan.** Fitur baru hanya boleh membaca data laporan. Fitur ini tidak boleh mengubah cara laporan dibuat, divalidasi, atau diubah statusnya, kecuali penetapan tingkat kerusakan oleh admin yang telah dirancang sebagai bagian baru.
6. **Penilaian AI bersifat usulan.** Hasil penilaian AI tidak boleh langsung menjadi keputusan final tanpa penetapan admin atau tanda "perlu dikonfirmasi".
7. **Konfigurasi baru disimpan terpisah.** Bobot, ambang batas, dan rumus disimpan di file konfigurasi baru.
8. **Uji regresi wajib.** Seluruh pengujian yang sudah ada harus tetap lulus tanpa perubahan. Jika ada yang gagal setelah penambahan, agent harus melaporkannya dan tidak memperbaikinya dengan mengubah kode lama.
9. **Laporan perubahan.** Di akhir pekerjaan, agent wajib menyampaikan daftar lengkap: file baru yang dibuat, file lama yang disentuh (jika ada, dengan alasan), dan migrasi yang dijalankan.

---

## 8. Struktur Direktori yang Diharapkan

```
[direktori yang sudah ada, tidak diubah]
modules/
  priority_dashboard/
    __init__.py
    config.py          # bobot, ambang batas, dan rumus skor
    severity.py        # usulan tingkat kerusakan oleh AI dan penetapan admin
    signals.py         # pengambilan data sinyal dari laporan
    scoring.py         # perhitungan skor prioritas
    service.py         # orkestrasi dan ringkasan
    routes.py          # endpoint dashboard
    templates/         # tampilan dashboard
    tests/             # pengujian modul
    migrations/        # migrasi aditif beserta rollback
```

**[Isi: sesuaikan dengan struktur proyek yang sebenarnya.]**

---

## 9. Pengujian

- **Unit test:** perhitungan skor untuk setiap tingkat kerusakan dan setiap sinyal, termasuk data kosong dan nilai batas.
- **Uji urutan:** memastikan laporan Berat selalu berada di atas Sedang dan Ringan pada kondisi data yang sama.
- **Uji penilaian AI:** memastikan usulan AI tersimpan sebagai usulan dan dapat ditimpa admin.
- **Integrasi:** pengambilan data dari basis data uji.
- **Akses:** verifikasi bahwa hanya admin BLU dan BPS yang bisa membuka dashboard.
- **Regresi:** seluruh pengujian eksisting tetap lulus.

---

