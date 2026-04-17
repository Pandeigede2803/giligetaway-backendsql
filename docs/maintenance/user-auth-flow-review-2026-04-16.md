# Review Flow Auth User Route

Tanggal review: 2026-04-16

## Scope

Audit ini fokus pada flow auth dan user management berikut:

- `routes/user.js`
- `controllers/userController.js`
- `middleware/authenticate.js`
- `models/user.js`

Route yang dicakup:

- `GET /api/users`
- `PUT /api/users/:id`
- `POST /api/users/forgot-password`
- `POST /api/users/reset-password`
- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/change-password`

## Kesimpulan Singkat

Flow saat ini belum memenuhi standar industri untuk auth production.

Dasar teknisnya sudah ada:

- password di-hash dengan `bcrypt`
- login memakai JWT
- protected route memakai middleware `authenticate`

Namun, implementasinya masih punya gap penting pada:

- authorization
- password reset security
- data exposure
- request validation
- rate limiting
- password handling

Status praktis: masih layak dianggap prototype atau internal basic auth, belum auth flow yang hardened untuk production.

## Temuan Utama

### 1. `forgot-password` membocorkan reset token ke client

Lokasi:

- `controllers/userController.js:67`
- `controllers/userController.js:71`
- `controllers/userController.js:104`

Masalah:

- endpoint membuat reset token JWT
- endpoint membentuk `resetUrl`
- endpoint mengembalikan `resetUrl` di response JSON

Efek:

- siapa pun yang tahu email user bisa memanggil endpoint ini
- jika email valid, caller langsung memperoleh link reset tanpa perlu akses inbox
- ini membuat flow reset password tidak aman

Tambahan masalah:

- endpoint memberi `404 User not found` untuk email yang tidak ada
- ini membuka user enumeration

Standar industri:

- response harus generic, misalnya `If the account exists, a reset link has been sent`
- reset token atau reset URL tidak boleh dikembalikan ke client

### 2. Authorization belum ada untuk route user management

Lokasi:

- `routes/user.js:10`
- `routes/user.js:13`
- `routes/user.js:23`
- `controllers/userController.js:232`
- `controllers/userController.js:254`

Masalah:

- `GET /api/users` hanya butuh login
- `PUT /api/users/:id` hanya butuh login
- `POST /api/users/register` juga hanya butuh login

Efek:

- user biasa berpotensi membaca daftar semua user
- user biasa berpotensi mengubah data user lain
- user biasa berpotensi membuat user baru
- karena `role` diterima mentah dari body, caller juga bisa mencoba membuat user dengan role arbitrer

Standar industri:

- route seperti list user, update user lain, dan create user internal harus memakai role-based authorization
- contoh minimal: `authenticate + authorizeRole('admin')`

### 3. Password hash berpotensi ikut keluar di response API

Lokasi:

- `controllers/userController.js:10`
- `controllers/userController.js:11`
- `controllers/userController.js:234`
- `models/user.js:20`

Masalah:

- `createUser()` mereturn object `user` langsung
- `getUsers()` mereturn hasil `User.findAll()` langsung
- model `User` memiliki field `password`

Efek:

- hash password bisa terekspos ke client
- walau bukan plaintext, hash tetap secret dan tidak boleh keluar lewat API

Standar industri:

- selalu pakai serializer atau explicit field allowlist
- contoh field aman: `id`, `name`, `email`, `role`, `created_at`, `updated_at`

### 4. Password plaintext masih ditulis ke log

Lokasi:

- `controllers/userController.js:7`

Masalah:

- `createUser()` melakukan `console.log` terhadap `{ name, email, password, role }`

Efek:

- password masuk ke server log
- ini pelanggaran security hygiene yang serius

Standar industri:

- jangan pernah log plaintext password
- untuk audit, log hanya metadata aman seperti `email`, `userId`, `requestId`, `ip`

### 5. `change-password` memakai `email` dari request body

Lokasi:

- `routes/user.js:25`
- `controllers/userController.js:209`
- `controllers/userController.js:212`
- `middleware/authenticate.js:13`

Masalah:

- endpoint memang diproteksi auth
- tetapi target user tetap diambil dari `email` yang dikirim client
- identitas dari token pada `req.user` tidak dipakai

Efek:

- trust boundary salah
- caller menentukan sendiri akun mana yang diubah
- walau masih harus tahu old password, desain ini tidak standar dan mudah salah berkembang di masa depan

Standar industri:

- `change-password` harus memakai `req.user.id`
- body cukup berisi `oldPassword` dan `newPassword`

### 6. Reset password token belum one-time-use

Lokasi:

- `controllers/userController.js:67`
- `controllers/userController.js:25`
- `controllers/userController.js:29`

Masalah:

- reset token dibuat sebagai JWT biasa dengan secret global
- token tidak disimpan hashed di database
- token tidak punya status `used`
- token bisa dipakai ulang selama belum expired

Efek:

- jika token bocor, token dapat dipakai berulang
- tidak ada mekanisme invalidate per token

Standar industri:

- pakai random opaque token
- simpan hash token di database
- simpan expiry
- simpan status `used_at`
- invalid setelah sekali dipakai

### 7. `login` memakai token cache in-memory

Lokasi:

- `controllers/userController.js:135`
- `controllers/userController.js:141`
- `controllers/userController.js:188`

Masalah:

- token disimpan dalam `Map()` global di memory backend
- login berikutnya bisa mengembalikan token yang sama selama masih valid

Efek:

- tidak konsisten jika app dijalankan di banyak instance
- token cache hilang saat restart
- tidak memberi nilai security yang nyata
- menambah kompleksitas tanpa manfaat yang jelas

Standar industri:

- issue token baru saat login berhasil
- jika butuh session panjang, pakai refresh token flow
- jangan andalkan in-memory token cache untuk auth state

### 8. Tidak ada validasi request pada endpoint auth utama

Lokasi:

- `routes/user.js`
- `validation/validation.js:1`

Masalah:

- endpoint auth belum memakai validator untuk email, password, role, token, dan payload wajib
- padahal project sudah punya `express-validator`

Efek:

- payload buruk bisa lolos lebih jauh ke controller
- error handling jadi inkonsisten
- input security hygiene lemah

Standar industri:

- validasi request wajib untuk:
  - `login`
  - `register`
  - `forgot-password`
  - `reset-password`
  - `change-password`

### 9. Tidak ada rate limiting khusus auth endpoint

Lokasi:

- `routes/user.js`
- `middleware/rateLimiter.js:17`

Masalah:

- endpoint login dan forgot password belum diproteksi rate limiting
- middleware rate limiter ada di project, tetapi tidak dipasang di route user ini

Efek:

- brute force login lebih mudah
- forgot-password dapat disalahgunakan untuk spam atau enumeration

Standar industri:

- pasang rate limit ketat untuk `login`
- pasang rate limit untuk `forgot-password`
- pertimbangkan logging dan alert untuk repeated failed login

## Catatan Per Route

### `POST /api/users/register`

Saat ini route ini diproteksi `authenticate`.

Interpretasi yang mungkin:

1. Ini sebenarnya endpoint admin create user.
2. Ini ingin dijadikan public signup, tetapi implementasinya salah.

Kalau ini admin flow:

- rename endpoint agar jelas, misalnya `POST /api/admin/users`
- tambahkan `authorizeRole('admin')`
- jangan izinkan `role` bebas dari client tanpa policy

Kalau ini public signup:

- endpoint tidak boleh diproteksi auth
- role harus dipaksa ke default aman, misalnya `user`

### `POST /api/users/login`

Yang sudah benar:

- verifikasi user berdasarkan email
- verifikasi password dengan bcrypt
- JWT memakai expiry

Yang perlu diubah:

- hapus token cache in-memory
- tambahkan validation
- tambahkan rate limiting
- konsistenkan response error

### `POST /api/users/change-password`

Yang perlu diubah:

- ambil user dari `req.user.id`
- jangan pakai `email` dari body
- validasi panjang dan kualitas password baru
- pertimbangkan revoke session lama setelah password berubah

### `POST /api/users/forgot-password`

Yang perlu diubah:

- jangan return reset URL
- jangan expose apakah email ada atau tidak
- pakai one-time reset token yang disimpan hashed
- pasang rate limiting

### `POST /api/users/reset-password`

Yang perlu diubah:

- validasi token dan password baru
- pastikan token single-use
- pertimbangkan invalidasi token login aktif setelah reset password

## Gap Terhadap Standar Industri

Checklist ringkas:

- Password hashing: sudah ada
- Access token JWT: sudah ada
- Middleware authentication: sudah ada
- Role-based authorization: belum ada
- Request validation: belum ada
- Rate limiting auth endpoints: belum ada
- Secure forgot-password response: belum ada
- One-time reset token: belum ada
- Safe user serialization: belum ada
- No plaintext password logging: belum ada
- Password change berbasis authenticated identity: belum ada

## Rekomendasi Prioritas

### Prioritas 1

- hapus `resetUrl` dari response `forgot-password`
- ganti response menjadi generic
- hapus semua log plaintext password
- ubah `change-password` agar pakai `req.user.id`
- jangan return field `password` di response mana pun

### Prioritas 2

- tambahkan middleware authorization role
- batasi `GET /api/users`, `PUT /api/users/:id`, dan create user hanya untuk admin
- tambahkan request validation untuk semua auth endpoint
- tambahkan rate limiter untuk `login` dan `forgot-password`

### Prioritas 3

- hapus `tokenCache`
- redesign password reset menjadi one-time-use token flow
- pertimbangkan access token + refresh token jika memang perlu session lebih panjang

## Rekomendasi Arsitektur Minimal

Flow minimal yang lebih aman:

1. `POST /login`
   - validasi email dan password
   - cek bcrypt
   - issue access token baru

2. `POST /change-password`
   - `authenticate`
   - ambil user dari `req.user.id`
   - verifikasi `oldPassword`
   - hash `newPassword`
   - update password

3. `POST /forgot-password`
   - validasi email
   - selalu return response generic
   - generate random reset token
   - simpan hash token + expiry di DB
   - kirim link via email

4. `POST /reset-password`
   - validasi token dan password baru
   - cari hash token di DB
   - pastikan belum expired dan belum used
   - update password
   - mark token sebagai used

## Penutup

Kesimpulan akhirnya:

- flow auth ini belum standar industri jika targetnya production-grade backend
- masalah terbesarnya ada di password reset exposure, kurangnya authorization, dan response user yang belum aman
- refactor masih cukup terjangkau karena struktur route/controller saat ini masih sederhana
