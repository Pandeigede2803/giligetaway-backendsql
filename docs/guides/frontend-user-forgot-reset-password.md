# Frontend Guide: User Forgot Password & Reset Password

Tanggal: 2026-04-17

Dokumen ini menjelaskan bagaimana frontend sebaiknya mengintegrasikan flow:

- `Forgot Password`
- `Reset Password`

Flow ini mengacu ke implementasi backend saat ini pada:

- `POST /api/users/forgot-password`
- `POST /api/users/reset-password`

## 1. Ringkasan Flow

Frontend perlu menyediakan 2 halaman:

1. Halaman `Forgot Password`
2. Halaman `Reset Password`

Alur lengkapnya:

1. User membuka halaman `Forgot Password`
2. User mengisi email
3. Frontend memanggil `POST /api/users/forgot-password`
4. Backend mengirim email berisi link reset password ke email user
5. User klik link dari email
6. User masuk ke halaman frontend `reset-password` dengan query `token`
7. Frontend membaca token dari URL
8. User mengisi password baru
9. Frontend memanggil `POST /api/users/reset-password`
10. Backend memverifikasi token dan menyimpan password baru

## 2. Endpoint Backend

Base route user di backend:

- `/api/users`

Endpoint yang dipakai frontend:

### 2.1 Forgot Password

- Method: `POST`
- URL: `/api/users/forgot-password`
- Auth: tidak perlu login

Request body:

```json
{
  "email": "user@example.com"
}
```

Response sukses saat email ditemukan:

```json
{
  "message": "Reset password link sent to email",
  "resetUrl": "http://localhost:3000/reset-password?token=..."
}
```

Catatan penting:

- `resetUrl` saat ini masih ikut dikembalikan oleh backend.
- Frontend tidak perlu menampilkan `resetUrl` ke user.
- Frontend cukup menampilkan pesan sukses.
- Link reset utama tetap diambil user dari email yang diterima.

Response jika email tidak ditemukan:

```json
{
  "message": "User not found"
}
```

Status code yang perlu ditangani:

- `200` sukses
- `404` email tidak terdaftar
- `500` error server / email gagal dikirim

### 2.2 Reset Password

- Method: `POST`
- URL: `/api/users/reset-password`
- Auth: tidak perlu login

Request body:

```json
{
  "token": "jwt-reset-token",
  "newPassword": "new-password-user"
}
```

Response sukses:

```json
{
  "message": "Password reset successfully"
}
```

Status code yang perlu ditangani:

- `200` password berhasil diubah
- `400` token expired
- `404` user tidak ditemukan
- `500` token invalid / error server lain

Contoh response saat token expired:

```json
{
  "message": "Token has expired"
}
```

## 3. Halaman Frontend Yang Dibutuhkan

### 3.1 Page `Forgot Password`

Contoh route frontend:

- `/forgot-password`

Komponen minimum:

- email input
- submit button
- loading state
- success message
- error message
- link kembali ke halaman login

Perilaku yang disarankan:

- validasi format email sebelum submit
- disable tombol saat request berjalan
- tampilkan pesan sukses jika response `200`
- tampilkan pesan error yang ramah jika `404` atau `500`

Contoh UX message:

- sukses: `If the email is registered, a reset link has been sent to the inbox.`
- email tidak ditemukan: `Email is not registered.`
- gagal kirim email: `Failed to send reset email. Please try again.`

Catatan:

- Walaupun backend saat ini membedakan `404 User not found`, FE tetap boleh memakai copy yang lebih generic bila ingin UX lebih aman.

### 3.2 Page `Reset Password`

Contoh route frontend:

- `/reset-password?token=...`

Komponen minimum:

- password baru input
- konfirmasi password input
- submit button
- loading state
- success message
- error message

Perilaku yang disarankan:

- baca `token` dari query string
- jika `token` tidak ada, langsung tampilkan state error
- validasi password baru dan konfirmasi password sebelum submit
- setelah sukses, redirect ke halaman login

Contoh UX message:

- token tidak ada: `Invalid reset link.`
- token expired: `Reset link has expired. Please request a new one.`
- reset sukses: `Password updated successfully. Please log in with your new password.`

## 4. Kontrak URL Reset

Backend saat ini membentuk link email seperti ini:

```text
${FRONTEND_URL}/reset-password?token=${resetToken}
```

Artinya frontend harus menyediakan route:

```text
/reset-password
```

dan menerima query:

```text
token
```

Contoh URL yang diterima frontend:

```text
https://your-frontend-domain.com/reset-password?token=eyJhbGci...
```

## 5. Validasi Frontend Yang Disarankan

Backend saat ini belum punya validasi password yang ketat di flow reset. Karena itu frontend sebaiknya menambahkan guard sendiri.

Minimal validasi frontend:

- email wajib diisi
- email harus valid
- `token` wajib ada
- `newPassword` minimal 8 karakter
- `confirmPassword` harus sama dengan `newPassword`

Rekomendasi tambahan:

- wajib ada huruf besar
- wajib ada huruf kecil
- wajib ada angka

## 6. Contoh Integrasi Frontend

Contoh helper:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function requestResetPassword(email: string) {
  const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to request password reset");
  }

  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  const response = await fetch(`${API_BASE_URL}/api/users/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to reset password");
  }

  return data;
}
```

Contoh submit handler `Forgot Password`:

```ts
async function handleForgotPassword(email: string) {
  try {
    await requestResetPassword(email);
    setSuccess("If the email is registered, a reset link has been sent to the inbox.");
  } catch (error: any) {
    setError(error.message || "Failed to send reset email.");
  }
}
```

Contoh submit handler `Reset Password`:

```ts
async function handleResetPassword(token: string, newPassword: string) {
  try {
    await resetPassword(token, newPassword);
    setSuccess("Password updated successfully.");
    router.push("/login");
  } catch (error: any) {
    setError(error.message || "Failed to reset password.");
  }
}
```

## 7. State Handling Yang Disarankan

Untuk halaman `Forgot Password`:

- `idle`
- `submitting`
- `success`
- `error`

Untuk halaman `Reset Password`:

- `invalid-token`
- `idle`
- `submitting`
- `success`
- `error`

## 8. Error Handling Yang Harus Ditangani Frontend

### Forgot Password

- `404 User not found`
- `500 Internal server error`
- network error

### Reset Password

- token tidak ada di URL
- `400 Token has expired`
- `404 User not found`
- `500 Internal server error`
- network error

Mapping message yang disarankan:

| Kondisi | Message |
|--------|---------|
| token tidak ada | `Invalid reset link.` |
| token expired | `Reset link has expired. Please request a new one.` |
| user tidak ditemukan | `Account not found.` |
| server error | `Something went wrong. Please try again.` |
| network error | `Unable to reach server. Please check your connection.` |

## 9. Catatan Integrasi Penting

### 9.1 Frontend URL harus sesuai environment backend

Backend mengirim link email berdasarkan `FRONTEND_URL`.

Jadi untuk environment production, backend harus memakai domain frontend production yang benar. Kalau tidak, user akan menerima link yang salah.

### 9.2 CORS frontend domain harus di-whitelist

Backend memakai whitelist origin. Domain frontend harus masuk ke salah satu env berikut:

- `CORS_ORIGIN`
- `CORS_ORIGIN_1`
- `CORS_ORIGIN_2`
- `CORS_ORIGIN_3`
- `CORS_ORIGIN_4`

Kalau domain frontend belum terdaftar, request dari browser akan gagal karena CORS.

### 9.3 Jangan simpan token reset di localStorage

Frontend cukup:

- baca token dari query
- pakai token saat submit reset password
- simpan token hanya di memory state bila perlu

Tidak perlu menyimpan token reset ke localStorage atau cookie permanen.

## 10. Rekomendasi UX

Untuk pengalaman user yang lebih rapi:

- gunakan halaman sukses setelah forgot-password submit
- tampilkan instruksi `check your email`
- sediakan tombol `back to login`
- setelah reset sukses, redirect otomatis ke login
- beri indikator password strength pada form reset

## 11. Kontrak Minimum Untuk Tim Frontend

Frontend cukup mengimplementasikan ini:

1. Page `/forgot-password`
2. Page `/reset-password?token=...`
3. POST `/api/users/forgot-password`
4. POST `/api/users/reset-password`
5. Validasi password + confirm password
6. Error handling untuk token invalid atau expired

## 12. Catatan Backend Saat Ini

Per 2026-04-17, kondisi backend saat ini:

- email reset user sudah dikirim via Brevo
- link reset dibentuk dari `FRONTEND_URL`
- endpoint forgot-password masih mengembalikan `resetUrl` di response
- endpoint forgot-password masih mengembalikan `404` jika email tidak ditemukan

Untuk frontend, implementasi tetap bisa jalan dengan aman selama:

- FE tidak menampilkan `resetUrl` ke user
- FE menampilkan UX message yang aman
- FE menangani token dari query string
