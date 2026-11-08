<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## Akun admin dan email

Jalankan migrasi lalu seeder admin untuk memetakan 10 akun lama ke jabatan baru dan membuat akun Wakil Rektor II:

```powershell
php artisan migrate
php artisan db:seed --class=AdminSeeder
```

Seeder memetakan 11 jabatan admin ke username yang ditetapkan di `Admin::USERNAMES`. Seeder tidak mereset kata sandi akun yang sudah ada.

Untuk mengganti username sekaligus membuat password acak baru bagi seluruh 11 akun admin, jalankan perintah berikut dari folder `backend`:

```powershell
php artisan admin:rotate-credentials
```

Perintah meminta konfirmasi, memastikan semua akun ada, lalu mengganti username, password, dan mengakhiri semua sesi admin lama dalam satu transaksi. Setiap password baru hanya ditampilkan sekali di terminal; salin dan bagikan melalui jalur pribadi yang aman. Jangan kirim password ke chat atau commit.

Untuk mengirim kode reset password dan verifikasi perubahan email melalui Gmail, konfigurasi SMTP Gmail di `backend/.env` menggunakan alamat Gmail pengirim pada `MAIL_USERNAME` dan Gmail App Password pada `MAIL_PASSWORD`. Pengaturan SMTP lainnya (`MAIL_MAILER=smtp`, `MAIL_SCHEME=smtp`, `MAIL_HOST=smtp.gmail.com`, dan `MAIL_PORT=587`) sudah tersedia di `.env.example`. Pastikan `MAIL_FROM_ADDRESS` sama dengan alamat pengirim. Jangan gunakan atau kirim kata sandi login Gmail, dan jangan commit kredensial. Jika konfigurasi Laravel pernah di-cache, jalankan `php artisan config:clear` lalu mulai ulang server backend.

Email tujuan dua akun admin awal diatur melalui `ADMIN_EMAIL_KEPALA_BLU` dan `ADMIN_EMAIL_KEPALA_BPS`; alamat email admin lainnya dapat ditambahkan ke kolom `email` tabel `admin`.

Admin dapat mengganti email di Pengaturan Akun. Kode verifikasi dikirim ke email lama sebelum alamat baru disimpan; untuk akun admin tanpa email, kode awal dikirim ke alamat baru. Kode verifikasi berlaku 10 menit dan maksimal dapat dicoba lima kali.

Perintah `php artisan admin:reset-legacy-passwords` hanya untuk mengganti password sepuluh akun admin lama tanpa mengubah WR II. Untuk rotasi semua username dan password, gunakan `php artisan admin:rotate-credentials`.

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
