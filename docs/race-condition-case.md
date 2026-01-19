📘 DOKUMENTASI KASUS

Round Trip Booking – Email Terkirim Terlalu Dini

⸻

1. Ringkasan Masalah

Pada proses pembayaran round trip booking, sistem selalu menjalankan handler ketika DOKU menyatakan pembayaran valid.
Namun, pada kondisi tertentu, email round trip gagal dikirim dengan error seperti:
	•	socket hang up
	•	No transaction for booking
	•	Error sending round trip notification

Masalah ini bukan terjadi secara acak, dan bukan karena DOKU atau SMTP error murni.

⸻

2. Kronologi yang Terjadi (Fakta Lapangan)

Urutan kejadian berdasarkan log:
	1.	DOKU mengembalikan response SUCCESS
	2.	Sistem langsung menjalankan handler round trip
	3.	Booking status mulai diperbarui menjadi paid
	4.	Transaksi belum tersedia atau belum berstatus paid
	5.	Sistem tetap mencoba mengirim email round trip
	6.	Email gagal → koneksi SMTP terputus (socket hang up)

📌 Pada titik ini:
	•	Sistem menganggap pembayaran sudah final
	•	Padahal data transaksi belum stabil

⸻

3. Akar Masalah (Root Cause)

Masalah utama adalah race condition antara:
	•	Event “payment valid” (DOKU response)
dan
	•	Event “transaction committed & settled” (database ready)

Secara sistem:

Pembayaran dinyatakan valid lebih cepat daripada transaksi benar-benar tersedia di database.

Akibatnya:
	•	Handler jalan terlalu dini
	•	Data yang dibutuhkan email belum lengkap
	•	Proses kirim email menjadi tidak stabil

⸻

4. Mengapa Fungsi “Selalu Jalan”

Ini perilaku yang benar secara teknis, bukan bug.

Handler memang harus dijalankan setiap kali:
	•	DOKU mengirimkan response valid
	•	Tidak ada error request

Namun:
	•	Menjalankan handler ≠ mengirim email
	•	Email adalah tahap terakhir, bukan bagian awal flow

⸻

5. Dampak Jika Tidak Dikontrol

Tanpa kontrol kondisi:
	•	Email bisa terkirim dengan data setengah matang
	•	Email bisa gagal tanpa retry
	•	User tidak menerima tiket meskipun pembayaran sukses
	•	Error sulit direproduksi karena bergantung timing

Dalam traffic tinggi, kasus ini pasti berulang.

⸻

6. Aturan (CASE) yang Harus Berlaku

Sebelum email round trip boleh dikirim, SEMUA kondisi berikut wajib terpenuhi:

Case 1 — Status Booking
	•	Kedua booking (pergi & pulang) harus berstatus paid

Case 2 — Keberadaan Transaksi
	•	Kedua booking harus memiliki transaksi
	•	Tidak boleh kosong

Case 3 — Status Transaksi
	•	Transaksi harus sudah paid
	•	Bukan sekadar dibuat

📌 Jika salah satu kondisi gagal:
	•	Email TIDAK DIKIRIM
	•	Proses berhenti dengan aman
	•	Tidak ada error fatal
	•	Tidak ada retry paksa

⸻

7. Prinsip Desain yang Diterapkan
	•	Payment valid ≠ payment settled
	•	Email adalah side effect, bukan core transaction
	•	Data harus stabil sebelum side effect dijalankan
	•	Lebih baik delay email daripada kirim email salah

⸻

8. Kesimpulan

Masalah ini bukan bug implementasi, melainkan kurangnya guard condition pada proses asynchronous.

Dengan menerapkan aturan kondisi yang jelas:
	•	Sistem tetap responsif
	•	Tidak ada race condition
	•	Email hanya dikirim saat data benar-benar siap
	•	Error SMTP akibat payload tidak stabil dapat dihindari

⸻

9. Catatan Penting

Solusi ini tidak mematikan flow, tidak menunda payment, dan tidak mengubah logika DOKU.
Solusi hanya memastikan bahwa email round trip tidak dijadikan indikator keberhasilan pembayaran.

⸻

✅ Verdict Akhir

Pembayaran kamu aman.
Masalahnya hanya timing.
Dan timing harus dijaga dengan aturan, bukan asumsi.

Kalau mau, langkah berikutnya bisa:
	•	dokumentasi arsitektur event-driven
	•	atau SOP retry email berbasis status transaksi

Tapi sebagai fondasi, dokumentasi ini sudah cukup solid.