# Refactoring Modular Pelaporan - Dokumentasi

## Perubahan Struktur

### Frontend (Next.js)

#### 1. Organisasi API
- **`src/lib/api/types.ts`** - Type definitions terpusat
- **`src/lib/api/laporan.ts`** - Laporan API client (shared)
- **`src/lib/api/index.ts`** - Export terpusat

#### 2. Custom Hooks (Business Logic)
- **`src/hooks/useBuatLaporan.ts`** - State & logic untuk membuat laporan
- **`src/hooks/useUbahPengajuan.ts`** - State & logic untuk ubah/hapus laporan
- **`src/hooks/useLaporanList.ts`** - State & logic untuk list laporan dengan filter

#### 3. Komponen Reusable
- **`src/components/laporan/LaporanCard.tsx`** - Card display laporan dengan status badge
- **`STATUS_CONFIG`** - Konfigurasi status colors & labels (reusable)

#### 4. Routes Terpisah (Route Group)
```
src/app/(laporan)/
├── layout.tsx                  // Shared layout
├── buat-laporan/
│   └── page.tsx               // Feature: Buat Laporan Baru
├── status-laporan/
│   └── page.tsx               // Feature: Lihat Status Laporan Aktif
├── riwayat-laporan/
│   └── page.tsx               // Feature: Riwayat Laporan (Selesai/Ditolak)
└── ubah-pengajuan/
    └── page.tsx               // Feature: Ubah/Hapus Pengajuan (Status Terkirim)
```

#### 5. Navigasi Sidebar
- Updated `src/components/Sidebar.tsx` dengan route mapping
- Setiap menu item memiliki URL path tersendiri

### Backend (Laravel)

#### 1. Service Layer
- **`app/Services/LaporanService.php`** - Centralized business logic
  - `createLaporan()` - Buat laporan + initial status
  - `getAllLaporanByNim()` - Ambil semua laporan user
  - `getLaporanById()` - Detail laporan
  - `updateLaporan()` - Update dengan validasi status
  - `deleteLaporan()` - Hapus dengan validasi status
  - `getAllLaporanForAdmin()` - Semua laporan untuk admin
  - `updateStatusLaporan()` - Update status + pesan (admin)
  - `getRekapLaporanByNim()` - Statistik laporan

#### 2. Form Requests (Validasi)
```
app/Http/Requests/Laporan/
├── StoreLaporanRequest.php       // Validasi: Buat laporan
├── UpdateLaporanRequest.php      // Validasi: Update laporan
└── UpdateStatusLaporanRequest.php // Validasi: Update status (admin)
```

#### 3. Controller Refactored
- **`app/Http/Controllers/LaporanController.php`** - Diperbaharui
  - Menggunakan dependency injection (LaporanService)
  - Menggunakan Form Requests untuk validasi otomatis
  - Error handling yang konsisten
  - Response format yang seragam

### API Endpoints (Tetap Sama)

```
POST   /api/laporan                    → store()
GET    /api/laporan?nim=xxx            → index()
GET    /api/laporan/{id}               → show()
PUT    /api/laporan/{id}               → update()
DELETE /api/laporan/{id}               → destroy()
GET    /api/laporan/rekap?nim=xxx      → rekap()
GET    /api/admin/laporan              → adminIndex()
PATCH  /api/admin/laporan/{id}/status  → adminUpdateStatus()
```

## Keuntungan Refactoring

### Frontend
✅ **Separation of Concerns**
- API logic terpisah dari komponen
- Business logic terpisah di custom hooks
- Komponen hanya fokus pada UI rendering

✅ **Reusability**
- `LaporanCard` dapat digunakan di 3 halaman berbeda
- Custom hooks dapat digunakan ulang
- `STATUS_CONFIG` terpusat

✅ **Maintainability**
- Setiap fitur punya halaman & hook sendiri
- Mudah menemukan & modify logic
- Testing lebih mudah

✅ **Scalability**
- Struktur modular siap untuk fitur baru
- Route group memudahkan penambahan fitur
- Hook pattern mudah di-extend

### Backend
✅ **Separation of Concerns**
- Controller hanya handle HTTP (request/response)
- Service handle business logic
- Form Request handle validasi

✅ **Reusability**
- Service methods dapat dipanggil dari berbagai controller
- Validasi tidak perlu di-repeat
- Error handling terpusat

✅ **Testability**
- Service dapat ditest independently
- Mock-friendly design
- Clear dependencies

✅ **Maintainability**
- Business logic terkonsentrasi di Service
- Validasi rules jelas di Form Request
- Controller tetap clean

## Konsistensi Frontend-Backend

| Aspek | Frontend | Backend | Konsistensi |
|-------|----------|---------|------------|
| Routes | `/buat-laporan`, `/status-laporan`, `/riwayat-laporan`, `/ubah-pengajuan` | `/api/laporan`, `/api/admin/laporan` | ✅ API endpoints tetap sama |
| Validasi | Field-level di form | Server-side di Form Request | ✅ Server always validates |
| Status | Enum via `LaporanStatus` type | Enum strings | ✅ Same status values |
| Response Format | `{status, data, message}` | `{status, data, message}` | ✅ Consistent JSON structure |
| Error Handling | Try-catch hooks | Try-catch service | ✅ Both catch errors properly |
| Auth | useAuthProtection hook | Auth middleware (existing) | ✅ Protected endpoints |

## Migration Guide

### Untuk Developer Baru
1. **Buat Fitur Laporan Baru:**
   - Tambah method di `LaporanService.php`
   - Buat Form Request di `app/Http/Requests/Laporan/`
   - Tambah controller method yang delegasi ke service
   - Di frontend: buat custom hook + page

2. **Menambah Validasi:**
   - Edit Form Request class
   - Tidak perlu touch controller atau service

3. **Menambah Status:**
   - Edit `LaporanStatus` type di frontend
   - Ubah validasi di Form Request
   - Update `STATUS_CONFIG` di `LaporanCard.tsx`

## Testing Checklist

- [ ] Buat Laporan: POST /api/laporan dengan data valid
- [ ] Buat Laporan Invalid: POST /api/laporan dengan data invalid (400 error)
- [ ] Lihat Laporan: GET /api/laporan?nim=xxx (return array)
- [ ] Lihat Detail: GET /api/laporan/{id} (return single)
- [ ] Update Laporan: PUT /api/laporan/{id} dengan status Terkirim (200 ok)
- [ ] Update Laporan Invalid Status: PUT /api/laporan/{id} dengan status Diverifikasi (403 forbidden)
- [ ] Hapus Laporan: DELETE /api/laporan/{id} dengan status Terkirim (200 ok)
- [ ] Hapus Invalid Status: DELETE /api/laporan/{id} dengan status Diproses (403 forbidden)
- [ ] Frontend Route: /buat-laporan, /status-laporan, /riwayat-laporan, /ubah-pengajuan
- [ ] Sidebar Navigation: Klik menu navigate ke route yang benar
- [ ] Error Handling: Test invalid input di form
- [ ] Auth Protection: Test protected endpoints tanpa token

## File Structure Summary

**Frontend Changes:**
```
src/
├── app/(laporan)/
│   ├── layout.tsx
│   ├── buat-laporan/page.tsx
│   ├── status-laporan/page.tsx
│   ├── riwayat-laporan/page.tsx
│   └── ubah-pengajuan/page.tsx
├── hooks/
│   ├── useBuatLaporan.ts
│   ├── useUbahPengajuan.ts
│   └── useLaporanList.ts
├── lib/api/
│   ├── types.ts
│   ├── laporan.ts
│   └── index.ts
└── components/laporan/
    └── LaporanCard.tsx
```

**Backend Changes:**
```
app/
├── Services/
│   └── LaporanService.php
├── Http/
│   ├── Controllers/
│   │   └── LaporanController.php (refactored)
│   └── Requests/Laporan/
│       ├── StoreLaporanRequest.php
│       ├── UpdateLaporanRequest.php
│       └── UpdateStatusLaporanRequest.php
```

## Next Steps

1. ✅ Refactoring Complete
2. → Build & verify no errors
3. → Run tests
4. → Deploy to staging
5. → Test on staging environment
