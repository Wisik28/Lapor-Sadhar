# Lapor-Sadhar

Sistem Pelaporan Masalah Lingkungan & Kerusakan Fasilitas Universitas Sanata Dharma.

## Tech Stack

- Backend: Laravel 13 (PHP 8.3)
- Frontend: Next.js (React, TypeScript)
- Database: PostgreSQL (Supabase)

## Prasyarat

- PHP 8.3+ (ekstensi pdo_pgsql aktif)
- Composer
- Node.js (v18+) & npm

## Setup Dependensi

Setiap anggota tim yang melakukan clone repositori ini cukup menjalankan langkah berikut tanpa perlu menginstall ulang project dari awal:

### 1. Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Sesuaikan konfigurasi database Supabase di file `backend/.env`:

```env
DB_CONNECTION=pgsql
DB_HOST=db.xxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=password_supabase_anda
DB_SSLMODE=require
```

Jalankan database migration:

```bash
php artisan migrate
```

Jalankan server backend:

```bash
php artisan serve
```
Backend berjalan pada `http://localhost:8000`.

### 2. Frontend (Next.js)

Buka terminal baru:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Jalankan server frontend:

```bash
npm run dev
```
Frontend berjalan pada `http://localhost:3000`.

## Menjalankan Aplikasi

1. Terminal 1 (Backend): `cd backend && php artisan serve`
2. Terminal 2 (Frontend): `cd frontend && npm run dev`
