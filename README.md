# 📢 Lapor-Sadhar

> Sistem Pelaporan Masalah Lingkungan & Kerusakan Fasilitas di Universitas Sanata Dharma.  
> Tugas Mata Kuliah **Proyek Informatika**.

---

## 🛠️ Tech Stack

- **Backend**: [Laravel](https://laravel.com/) (PHP 8.3)
- **Frontend**: [Next.js](https://nextjs.org/) (React, TypeScript / JavaScript)
- **Database**: PostgreSQL (Hosted on [Supabase](https://supabase.com/))

---

## 📁 Struktur Direktori Project

Project ini disarankan menggunakan struktur monorepo terpisah (`backend` dan `frontend`) dalam satu repositori utama:

```text
Lapor-Sadhar/
├── backend/            # Laravel API (PHP 8.3)
├── frontend/           # Next.js Application
└── README.md           # Panduan Instalasi & Penggunaan
```

---

## ⚙️ Prasyarat (Prerequisites)

Pastikan perangkat Anda sudah terpasang dependensi berikut:

1. **PHP 8.3+**
   - Pastikan extension PHP berikut aktif: `pdo_pgsql`, `pgsql`, `openssl`, `mbstring`, `curl`, `xml`, `zip`.
   - Cek versi PHP: `php -v`
2. **Composer** (v2.x+)
   - Cek versi Composer: `composer -v`
3. **Node.js** (v18.x / v20.x+) & **npm**
   - Cek versi Node: `node -v`
4. **Git**
5. **Akun Supabase** (untuk PostgreSQL Database)

---

## 🚀 Panduan Instalasi & Setup

### 1. Setup Database di Supabase

1. Login ke [Supabase Console](https://supabase.com/dashboard).
2. Buat project baru (pilih nama project & atur password database).
3. Buka menu **Project Settings** > **Database**.
4. Catat kredensial koneksi berikut:
   - **Host** (contoh: `db.xxxxxxxxxxxx.supabase.co`)
   - **Database Name** (default: `postgres`)
   - **Port** (default: `5432` atau `6543` untuk connection pooling)
   - **User** (default: `postgres`)
   - **Password** (password yang dibuat saat buat project)

---

### 2. Setup Backend (Laravel & PHP 8.3)

#### A. Membuat Project Laravel
Jika folder `backend` belum ada, jalankan perintah berikut di root folder project:
```bash
composer create-project laravel/laravel backend
cd backend
```

#### B. Konfigurasi Environment (`.env`)
Salin `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Buka file `.env` di folder `backend` dan sesuaikan konfigurasi database ke Supabase:
```env
APP_NAME=Lapor-Sadhar
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

# Konfigurasi Database Supabase (PostgreSQL)
DB_CONNECTION=pgsql
DB_HOST=db.xxxxxxxxxxxx.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=YOUR_SUPABASE_PASSWORD
DB_SSLMODE=require
```

#### C. Generate Application Key & Menjalankan Migration
```bash
# Generate APP_KEY Laravel
php artisan key:generate

# Jalankan Database Migration
php artisan migrate
```

#### D. Setup CORS & API Authorization
Akses Next.js dari domain terpisah memerlukan aturan CORS.
Buka `config/cors.php` (atau atur di middleware/Sanctum) dan pastikan `allowed_origins` mengizinkan alamat frontend:
```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_origins' => ['http://localhost:3000'],
'supports_credentials' => true,
```

#### E. Menjalankan Backend Server
```bash
php artisan serve --port=8000
```
Server Backend Laravel akan berjalan di `http://localhost:8000`.

---

### 3. Setup Frontend (Next.js)

#### A. Membuat Project Next.js
Jika folder `frontend` belum ada, kembali ke root folder dan buat project Next.js:
```bash
cd ..
npx create-next-app@latest frontend
cd frontend
```
*(Pilih opsi: TypeScript/JavaScript, ESLint, Tailwind CSS, App Router sesuai kebutuhan).*

#### B. Konfigurasi Environment (`.env.local`)
Buat file `.env.local` di dalam folder `frontend`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

#### C. Menjalankan Frontend Server
```bash
npm run dev
# atau: pnpm dev / yarn dev / bun dev
```
Server Frontend Next.js akan berjalan di `http://localhost:3000`.

---

## 🔄 Menjalankan Project (Development Mode)

Untuk menjalankan seluruh sistem secara bersamaan:

1. **Terminal 1 (Backend - Laravel)**:
   ```bash
   cd backend
   php artisan serve
   ```
2. **Terminal 2 (Frontend - Next.js)**:
   ```bash
   cd frontend
   npm run dev
   ```

Akses aplikasi web di browser: **[http://localhost:3000](http://localhost:3000)**.

---

## ❓ Troubleshooting

<details>
<summary><b>1. Error: <code>PDOException: Driver [pgsql] not found</code></b></summary>

Pastikan extension `pdo_pgsql` dan `pgsql` telah diaktifkan di file `php.ini` Anda:
```ini
extension=pdo_pgsql
extension=pgsql
```
Lalu restart terminal dan web server.
</details>

<details>
<summary><b>2. Error SSL Connection Supabase pada Laravel</b></summary>

Pastikan parameter `DB_SSLMODE=require` sudah diset pada `.env`. Jika masih bermasalah pada PHP Windows/Linux, pastikan cert CA terbaru terinstall atau tambahkan opsi SSL pada `config/database.php` pada driver `pgsql`:
```php
'pgsql' => [
    // ...
    'sslmode' => env('DB_SSLMODE', 'require'),
],
```
</details>

<details>
<summary><b>3. Error CORS saat Next.js melakukan fetch ke Laravel API</b></summary>

Pastikan `http://localhost:3000` dimasukkan ke dalam `allowed_origins` pada `backend/config/cors.php` dan headers `Accept: application/json` selalu dikirim dari Next.js.
</details>

---

## 👥 Tim Pengembang

- Project Lapor-Sadhar - Proyek Informatika Universitas Sanata Dharma.
