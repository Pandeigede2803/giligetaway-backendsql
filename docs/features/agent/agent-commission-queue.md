# Agent Commission Queue Processing

**Status:** ✅ Active
**Updated:** 2026-02-09

## Background
Sebelumnya `createAgentBooking` dan `createAgentRoundTripBooking` langsung menghitung + menyimpan komisi agent di dalam transaksi utama. Dampaknya: request API butuh banyak query (fetch agent, fetch schedule/subschedule, insert komisi) sehingga response agent bisa >5 detik.

## Perubahan
1. **Controller hanya hitung kasar.**
   - Masih ambil data agent/subschedule untuk menghitung `preCalculatedCommission` (dipakai net discount), tapi tidak lagi memanggil `updateAgentCommissionOptimize`.
   - Response API mengembalikan `commission: { success: false, commission: 0, status: "pending", expected: <nilai perkiraan> }` dan `net_total` dihitung dari gross − expected commission.

2. **Payload queue ditambah `commission_task`.**
   - One-way dan round-trip job sekarang membawa snapshot agent, tripType, gross_total akhir, total penumpang, daftar transport.

3. **Worker menghitung komisi.**
   - Setelah seat availability + transport sukses (masih di dalam transaction Bull worker), worker memanggil `updateAgentCommissionOptimize(...)` memakai data yang dikirim dari controller.
   - Hasilnya disimpan ke DB, dicatat di log, dan disisipkan ke map round-trip untuk email.

4. **Fallback aman.**
   - Jika data kurang (agent/tripType hilang), worker log warning tapi job utama tidak gagal.
   - Komisi tetap bisa dibuat manual jika snapshot tidak tersedia.

## Dampak
- Response API lebih cepat (tidak menunggu insert komisi).
- Komisi tetap konsisten karena dikerjakan di queue yang sudah menangani seat/transport.
- Email summary masih menerima `totalCommission` karena worker menginjeksi nilai setelah komisi selesai dibuat.
