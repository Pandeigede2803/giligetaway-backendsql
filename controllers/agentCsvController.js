// controllers/agentCsvController.js

const fs = require("fs");
const { parse } = require("fast-csv");
const { Agent } = require("../models"); // Pastikan path sesuai folder model Anda

/**
 * Fungsi helper untuk parse CSV
 * filePath = path fisik file CSV yang di-upload
 */
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(parse({ headers: true })) // headers: true → baris pertama dianggap header
      .on("error", (error) => reject(error))
      .on("data", (data) => {
        rows.push(data);
      })
      .on("end", () => {
        resolve(rows);
      });
  });
}

/**
 * Controller utama untuk upload CSV agent
 */
exports.uploadAgentCsv = async (req, res) => {
  try {
    // 1. Dapatkan file path dari Multer (field: "agentCsv")
    //    req.file dihasilkan oleh upload.single("agentCsv") di route
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No CSV file uploaded" });
    }

    const filePath = req.file.path;

    // 2. Parse file CSV → array object
    const agentsData = await parseCsvFile(filePath);

    // 3. Insert ke database (tabel Agent) 
    //    - Tergantung kolom di CSV, pastikan cocok dengan kolom model Agent
    //    - Contoh: CSV punya header: name,contact_person,email,password,phone,commission_rate,commission_long,commission_mid,commission_short,commission_transport
    //    - Jika kolomnya beda, sesuaikan logika di sini

    let insertedCount = 0;
    for (const row of agentsData) {
      // Contoh row = { name: "XXX", email: "YYY", ... }
      // Buat record di tabel Agent
      // (Pastikan data yang dipakai sesuai with model fields)
      await Agent.create({
        name: row.name,
        contact_person: row.contact_person,
        email: row.email,
        password: row.password, // Pastikan handling hashing password di tempat lain, jika perlu
        phone: row.phone,
        commission_rate: row.commission_rate || 0,
        commission_long: row.commission_long || 0,
        commission_mid: row.commission_mid || 0,
        commission_short: row.commission_short || 0,
        commission_transport: row.commission_transport || 0,
        // created_at dan last_login bisa dihandle oleh Sequelize hooks / default value
      });
      insertedCount++;
    }

    // 4. Respon sukses
    return res.json({
      success: true,
      message: `CSV uploaded. Inserted ${insertedCount} Agents`,
    });
  } catch (error) {
    console.error("Error uploading agent CSV:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};