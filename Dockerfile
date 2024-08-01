# Gunakan image Node.js sebagai basis
FROM node:20

# Buat direktori kerja
WORKDIR /usr/src/app

# Salin file package.json dan package-lock.json
COPY package*.json ./

# Install dependensi aplikasi
RUN npm install

# Salin seluruh kode aplikasi
COPY . .

# Expose port yang digunakan oleh aplikasi
EXPOSE 8000

# Perintah untuk menjalankan aplikasi
CMD ["node", "app.js"]
