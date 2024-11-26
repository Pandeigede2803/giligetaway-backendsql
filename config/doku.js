


const crypto = require("crypto");



// Digest adalah hasil hash SHA256 dari body JSON yang dikirim ke DOKU
const generateDigest = (body) => {
  const hash = crypto.createHash("sha256"); // Membuat hash menggunakan algoritma SHA256
  hash.update(JSON.stringify(body)); // Mengubah body JSON menjadi string dan menghitung hash-nya
  return hash.digest("base64"); // Menghasilkan hash dalam format base64
};

// Fungsi untuk membuat Signature
// Signature adalah tanda tangan digital yang memastikan permintaan aman dan valid
const generateSignature = (body, requestId, timestamp, requestTarget) => {
  const CLIENT_ID = process.env.DOKU_CLIENT_ID; // Client ID dari DOKU Dashboard
  const SECRET_KEY = process.env.DOKU_SECRET_KEY; // Secret Key dari DOKU Dashboard

  // Langkah 1: Buat Digest dari body
  const digest = generateDigest(body);

  // Langkah 2: Susun komponen Signature dalam format yang diharapkan
  const rawSignature = `Client-Id:${CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

  // Langkah 3: Hitung Signature menggunakan HMAC-SHA256 dengan Secret Key
  const hmac = crypto.createHmac("sha256", SECRET_KEY); // Gunakan HMAC dengan algoritma SHA256
  const signature = hmac.update(rawSignature).digest("base64"); // Enkripsi rawSignature dan ubah menjadi base64

  // Langkah 4: Tambahkan prefix "HMACSHA256=" pada hasil Signature
  return `HMACSHA256=${signature}`;
};

module.exports = { generateSignature };
