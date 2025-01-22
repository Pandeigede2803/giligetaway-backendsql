// controllers/csvUploadController.js

const fs = require("fs");
const { parse } = require("fast-csv");
const { Booking, Passenger, TransportBooking } = require("../models"); 
// ^^^ Pastikan ini mengarah ke model Sequelize/ORM Anda

// Fungsi bantu untuk parse CSV
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(parse({ headers: true }))
      .on("error", (error) => reject(error))
      .on("data", (data) => rows.push(data))
      .on("end", () => resolve(rows));
  });
}

// Controller utama
exports.uploadMultipleCsv = async (req, res) => {
  try {
    // 1. Ambil path file dari Multer
    const bookingsFilePath = req.files.bookingsCsv[0].path;
    const passengersFilePath = req.files.passengersCsv[0].path;
    const transportsFilePath = req.files.transportsCsv[0].path;

    // 2. Parse isi CSV
    const bookingsData = await parseCsvFile(bookingsFilePath);
    const passengersData = await parseCsvFile(passengersFilePath);
    const transportsData = await parseCsvFile(transportsFilePath);

    // 3. Lakukan Insert ke DB (urutan: bookings -> passengers -> transports)
    //    Gunakan "ticket_id" sebagai relasi
    //    Di contoh ini kita tidak pakai transaction. Anda bisa menambahkan transaksi Sequelize sendiri.

    // Buat map ticket_id -> bookingId
    const bookingIdMap = {};

    // 3a) Insert Bookings
    for (const row of bookingsData) {
      // Contoh minimal create booking
      const createdBooking = await Booking.create({
        ticket_id: row.ticket_id,
        schedule_id: row.schedule_id,
        subschedule_id: row.subschedule_id,
        total_passengers: row.total_passengers,
        booking_date: row.booking_date,
        agent_id: row.agent_id,
        ticket_total: row.ticket_total,
        payment_status: row.payment_status,
        contact_name: row.contact_name,
        contact_phone: row.contact_phone,
        contact_passport_id: row.contact_passport_id,
        contact_nationality: row.contact_nationality,
        contact_email: row.contact_email,
        payment_method: row.payment_method,
        booking_source: row.booking_source,
        adult_passengers: row.adult_passengers,
        child_passengers: row.child_passengers,
        infant_passengers: row.infant_passengers,
        bank_fee: row.bank_fee,
        currency: row.currency,
        gross_total_in_usd: row.gross_total_in_usd,
        exchange_rate: row.exchange_rate,
      });

      bookingIdMap[row.ticket_id] = createdBooking.id;
    }

    // 3b) Insert Passengers
    for (const row of passengersData) {
      // cari bookingId
      const bId = bookingIdMap[row.ticket_id];
      if (!bId) {
        // handle error (jika CSV passenger ada ticket_id yang tidak ada di booking)
        continue;
      }

      await Passenger.create({
        booking_id: bId,
        name: row.name,
        nationality: row.nationality,
        passport_id: row.passport_id,
        passenger_type: row.passenger_type,
      });
    }

    // 3c) Insert Transports
    for (const row of transportsData) {
      const bId = bookingIdMap[row.ticket_id];
      if (!bId) continue;

      await TransportBooking.create({
        booking_id: bId,
        transport_id: row.transport_id,
        quantity: row.quantity,
        transport_price: row.transport_price,
        transport_type: row.transport_type,
        note: row.note,
      });
    }

    return res.json({
      success: true,
      message: "Data imported successfully!",
      detail: {
        bookingsInserted: bookingsData.length,
        passengersInserted: passengersData.length,
        transportsInserted: transportsData.length,
      },
    });
  } catch (error) {
    console.error("CSV Import Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};