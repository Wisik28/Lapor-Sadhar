# Catatan Integrasi Fitur Dashboard Prioritas (Lapor-Sadhar)

Dokumen ini mendokumentasikan pemetaan modul, tabel database, titik integrasi, dan batasan hak akses sesuai dokumen acuan `dokumen-deskripsi-dashboardprioritas.md` dan `backend/dashboard-prioritas.MD`.

---

## 1. Pemetaan Tabel dan Model Eksisting

Fitur Dashboard Prioritas **tidak mengubah atau memodifikasi tabel lama**. Seluruh data lama hanya dibaca (read-only).

| Tabel Lama | Model Terkait | Penggunaan pada Fitur Prioritas |
|---|---|---|
| `laporan` | `App\Models\Laporan` | Dibaca untuk menghitung skor prioritas: deskripsi, kategori, lokasi, tanggal_buat, foto. |
| `status` | `App\Models\Status` | Status laporan terkini diambil untuk filter dan tampilan dashboard. |
| `admin` | `App\Models\Admin` | Autentikasi sesi admin (BLU & BPS) dan pencatatan id admin yang melakukan penetapan prioritas. |
| `admin_sessions` | `App\Models\AdminSession` | Validasi bearer token admin melalui middleware `admin.session`. |
| `user_mahasiswa` / `user_pegawai` | Pelapor | Ditampilkan nama pelapor (read-only) untuk keperluan verifikasi admin. |

---

## 2. Tabel Baru (Aditif dengan awalan `priority_`)

| Tabel Baru | Model Terkait | Keterangan |
|---|---|---|
| `priority_assessments` | `App\Models\Priority\PriorityAssessment` | Menyimpan penilaian prioritas, tingkat kerusakan (usulan AI dan penetapan admin), skor prioritas (0-100), dimensi, safety flags, alasan, dan status konfirmasi. |
| `priority_feedback` | `App\Models\Priority\PriorityFeedback` | Menyimpan catatan audit setiap kali admin mengubah/menetapkan tingkat kerusakan untuk evaluasi model. |

---

## 3. Titik Integrasi Minimal yang Diizinkan

Untuk menghubungkan modul baru ke aplikasi secara aman tanpa merusak kode lama:

1. **Backend Routing / Service Provider**:
   - File baru: `backend/routes/priority.php`
   - Provider baru: `backend/app/Providers/PriorityServiceProvider.php`
   - Titik integrasi: Mendaftarkan `App\Providers\PriorityServiceProvider::class` pada `backend/bootstrap/providers.php` (1 baris tambahan) ATAU memuat `require __DIR__.'/priority.php';` pada `backend/routes/api.php`.
2. **Event Trigger Penilaian Baru**:
   - Observer baru: `backend/app/Observers/PriorityLaporanObserver.php`
   - Terpasang otomatis pada event `created` model `Laporan` via `PriorityServiceProvider`.
3. **Frontend Navigasi Admin**:
   - Komponen Navbar: `frontend/src/components/AdminNavbar.tsx`
   - Titik integrasi: Menambahkan tautan `{ label: "Prioritas", href: "/admin/prioritas" }` pada array `navLinks`.

---

## 4. Keamanan dan Pembatasan Hak Akses

- **Hanya Admin**: Seluruh endpoint `/api/admin/priority/*` dilindungi middleware `admin.session` yang memeriksa token aktif pada tabel `admin_sessions` dengan role `BLU`, `BPS`, atau `BOTH`.
- **Pelapor Dilarang**: Endpoint pelapor (`/api/laporan`, `/api/laporan/{id}`) **tidak** memuat skor prioritas atau tingkat kerusakan.
- **Frontend Guard**: Halaman `/admin/prioritas` diletakkan di dalam route group `/admin/*` yang dilindungi oleh `ProtectedLayout allowedRoles={['Admin']}`. Pengguna non-admin (pelapor/mahasiswa/karyawan) yang mencoba membuka halaman ini otomatis dialihkan atau ditolak.

---

## 5. Rumus & Logika Skor Prioritas

- Sesuai spesifikasi, tingkat kerusakan **Berat** diberi bobot terbesar (100), **Sedang** (50), dan **Ringan** (20).
- Rumus deterministik di `backend/config/priority.php`:
  - Fasilitas: `0.30*safety_risk + 0.25*damage_level + 0.20*operational_impact + 0.10*location_weight + 0.10*duplicate_factor + 0.05*aging_factor`
  - Kebersihan: `0.30*health_risk + 0.25*volume_area + 0.15*pollution_type + 0.15*location_weight + 0.10*duplicate_factor + 0.05*aging_factor`
- **Safety Override**: Jika ditemukan indikasi bahaya keselamatan langsung (kabel terbuka, risiko runtuh, api/asap, gas, limbah B3), skor dipaksa bernilai minimal 81 (Kritis).
- **Penetapan Admin**: Usulan AI ditandai `needs_review = true` (perlu dikonfirmasi). Jika admin menetapkan tingkat kerusakan, keputusan admin menggantikan usulan AI dan dicatat di `priority_feedback`.

