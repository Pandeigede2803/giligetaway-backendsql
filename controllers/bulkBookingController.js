const {
  sequelize,
  Booking,
  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  //   AgentCommission,
  Agent,
  BookingSeatAvailability,
  Boat,
  BulkBookingResult,
  BulkBookingUpload,
  User,
} = require("../models");
const validateSeatAvailability = require("../util/validateSeatAvailability");
const validateSeatAvailabilitySingleTrip = require("../util/validateSeatAvailabilitySingleTrip");
const bookingQueue = require("../queue/bookingQueue");
const { Op } = require("sequelize");
const { body } = require("express-validator");

// controllers/bulkBookingController.js
const { IncomingForm } = require("formidable");
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { createSeatAvailability } = require("../util/seatAvailabilityUtils");

// Disable default body parser for file uploads
const uploadDir = path.join(__dirname, "../uploads/temp");
// Pastikan direktori ada
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

// Helper to save uploaded file
// Helper to save uploaded file
const saveFile = (file) => {
  // Tambahkan log untuk melihat struktur file
  console.log("File object structure:", JSON.stringify(file, null, 2));

  // Cek apakah file adalah array
  if (Array.isArray(file)) {
    file = file[0]; // Ambil file pertama jika berbentuk array
  }

  // Tentukan path file sumber berdasarkan properti yang tersedia
  const filePath = file.filepath || file.path;

  if (!filePath) {
    throw new Error("File path not found in file object");
  }

  // Buat nama file baru
  const newFilename = `${Date.now()}-${
    file.originalFilename || file.name || "unnamed"
  }`;
  const newPath = path.join(uploadDir, newFilename);

  return new Promise((resolve, reject) => {
    fs.copyFile(filePath, newPath, (err) => {
      if (err) return reject(err);
      console.log(`File saved successfully: ${newPath}`);
      resolve(newPath);
    });
  });
};

// Main bulk booking controller
const bulkBookingFromMultiCSV = async (req, res) => {
  try {
    console.log("[1] Parsing form with files...");

    // Gunakan formidable dengan benar
    const form = new formidable.IncomingForm({
      multiples: true,
      keepExtensions: true,
      uploadDir: uploadDir,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("[1.1] Error parsing form:", err);
          reject(err);
          return;
        }
        console.log("[1.2] Form parsed successfully");
        resolve([fields, files]);
      });
    });

    console.log("[2] Files parsed:", Object.keys(files));

    // Validate required files
    if (!files.bookings || !files.passengers) {
      // Helper to save uploaded file
      const saveFile = (file) => {
        // Tambahkan log untuk melihat struktur file
        console.log("File object structure:", JSON.stringify(file, null, 2));

        // Cek apakah file adalah array
        if (Array.isArray(file)) {
          file = file[0]; // Ambil file pertama jika berbentuk array
        }

        // Tentukan path file sumber berdasarkan properti yang tersedia
        const filePath = file.filepath || file.path;

        if (!filePath) {
          throw new Error("File path not found in file object");
        }

        // Buat nama file baru
        const newFilename = `${Date.now()}-${
          file.originalFilename || file.name || "unnamed"
        }`;
        const newPath = path.join(uploadDir, newFilename);

        return new Promise((resolve, reject) => {
          fs.copyFile(filePath, newPath, (err) => {
            if (err) return reject(err);
            console.log(`File saved successfully: ${newPath}`);
            resolve(newPath);
          });
        });
      };
      console.warn("[2.1] Missing required files");
      return res.status(400).json({
        error: "Missing required files",
        message: "Both bookings and passengers files are required",
      });
    }

    // Save uploaded files
    console.log("[3] Saving uploaded files...");
    const savedFiles = {};
    savedFiles.bookings = await saveFile(files.bookings);
    savedFiles.passengers = await saveFile(files.passengers);

    if (files.transports) {
      savedFiles.transports = await saveFile(files.transports);
    }

    try {
      console.log("[4] Parsing CSV files...");
      const bookingsData = await parseCSV(savedFiles.bookings);
      const passengersData = await parseCSV(savedFiles.passengers);
      const transportsData = files.transports
        ? await parseCSV(savedFiles.transports)
        : [];

      console.log(
        `[4.1] Parsed CSV: bookings=${bookingsData.length}, passengers=${passengersData.length}, transports=${transportsData.length}`
      );

      if (bookingsData.length > 10) {
        console.warn("[4.2] Too many bookings");
        Object.values(savedFiles).forEach((filePath) => {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        });

        return res.status(400).json({
          error: "Too many bookings",
          message: "Maximum 10 bookings allowed per upload",
        });
      }

      console.log("[5] Validating CSV data...");
      // Di fungsi assembleBookingData
console.log("CSV booking data:", bookingsData);
// Pastikan agent_id dan payment_status diambil dari CSV dan disertakan dalam objek yang dikembalikan
      const validationResult = validateMultiCSVData(
        bookingsData,
        passengersData,
        transportsData
      );
      if (!validationResult.isValid) {
        console.warn("[5.1] Validation failed:", validationResult.error);
        Object.values(savedFiles).forEach((filePath) => {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        });

        return res.status(400).json({
          error: "Invalid data format",
          message: validationResult.error,
        });
      }

      console.log("[6] Assembling booking data...");
      const processedBookings = assembleBookingData(
        bookingsData,
        passengersData,
        transportsData
      );

      console.log("[7] Creating bulk upload record...");
      const bulkUpload = await BulkBookingUpload.create({
        user_id: req.user ? req.user.id : null,
        total_bookings: processedBookings.length,
        successful_bookings: 0,
        failed_bookings: 0,
        status: "processing",
      });

      console.log("[8] Processing each booking...");
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const booking of processedBookings) {
        try {
          console.log(`[8.1] Processing booking ${booking.ticket_id}`);
          const result = await processBooking(booking);

          await BulkBookingResult.create({
            bulk_upload_id: bulkUpload.id,
            ticket_id: booking.ticket_id,
            booking_id: result.booking.id,
            status: "success",
          });

          results.push({
            ticket_id: booking.ticket_id,
            status: "success",
            booking_id: result.booking.id,
          });

          successCount++;
        } catch (error) {
          console.error(
            `[8.2] Booking failed: ${booking.ticket_id} -`,
            error.message
          );

          await BulkBookingResult.create({
            bulk_upload_id: bulkUpload.id,
            ticket_id: booking.ticket_id,
            status: "failed",
            error_message: error.message,
          });

          results.push({
            ticket_id: booking.ticket_id,
            status: "failed",
            error: error.message,
          });

          failCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log("[9] Updating bulk upload result...");
      await bulkUpload.update({
        successful_bookings: successCount,
        failed_bookings: failCount,
        status: "completed",
      });

      console.log("[10] Cleaning up uploaded files...");
      Object.values(savedFiles).forEach((filePath) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      });

      console.log("[11] All done. Sending response...");
      return res.status(200).json({
        message: "Bulk booking processing completed",
        processed: processedBookings.length,
        successful: successCount,
        failed: failCount,
        results,
        bulkUploadId: bulkUpload.id,
      });
    } catch (error) {
      console.error("[E1] Error during CSV processing:", error.message);

      Object.values(savedFiles).forEach((filePath) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      });

      throw error;
    }
  } catch (error) {
    console.error("[E2] Error processing bulk booking:", error);
    return res.status(500).json({
      error: "Server error",
      message: error.message || "An unexpected error occurred",
    });
  }
};

// Validate CSV data format and relations
const validateMultiCSVData = (bookings, passengers, transports) => {
  // Validate basic booking data
  for (const booking of bookings) {
    if (
      !booking.ticket_id ||
      !booking.schedule_id ||
      !booking.booking_date ||
      !booking.total_passengers
    ) {
      return {
        isValid: false,
        error:
          "Booking data missing required fields (ticket_id, schedule_id, booking_date, total_passengers)",
      };
    }

    // Validate passenger counts
    const adultCount = parseInt(booking.adult_passengers) || 0;
    const childCount = parseInt(booking.child_passengers) || 0;
    const totalPassengers = parseInt(booking.total_passengers);

    if (adultCount + childCount !== totalPassengers) {
      return {
        isValid: false,
        error: `Passenger count mismatch for ticket ${booking.ticket_id}. Sum of adult (${adultCount}), child (${childCount}) passengers does not match total (${totalPassengers})`,
      };
    }
  }

  // Validate passenger data
  const ticketIds = new Set(bookings.map((b) => b.ticket_id));
  const passengerCounts = {};

  for (const passenger of passengers) {
    if (!passenger.ticket_id || !passenger.name || !passenger.passenger_type) {
      return {
        isValid: false,
        error:
          "Passenger data missing required fields (ticket_id, name, passenger_type)",
      };
    }

    if (!ticketIds.has(passenger.ticket_id)) {
      return {
        isValid: false,
        error: `Passenger with ticket_id ${passenger.ticket_id} does not match any booking`,
      };
    }

    // Count passengers per booking
    passengerCounts[passenger.ticket_id] =
      (passengerCounts[passenger.ticket_id] || 0) + 1;
  }

  // Validate passenger counts match total_passengers in bookings
  for (const booking of bookings) {
    const expectedPassengers = parseInt(booking.total_passengers);
    const actualPassengers = passengerCounts[booking.ticket_id] || 0;

    if (actualPassengers !== expectedPassengers) {
      return {
        isValid: false,
        error: `Passenger count mismatch for ticket ${booking.ticket_id}: expected ${expectedPassengers}, found ${actualPassengers}`,
      };
    }
  }

  // Validate transport data if provided
  if (transports && transports.length > 0) {
    for (const transport of transports) {
      if (
        !transport.ticket_id ||
        !transport.transport_id ||
        !transport.transport_price ||
        !transport.transport_type
      ) {
        return {
          isValid: false,
          error:
            "Transport data missing required fields (ticket_id, transport_id, transport_price, transport_type)",
        };
      }

      if (!ticketIds.has(transport.ticket_id)) {
        return {
          isValid: false,
          error: `Transport with ticket_id ${transport.ticket_id} does not match any booking`,
        };
      }
    }
  }

  return { isValid: true };
};

// Assemble booking data from CSV files
const assembleBookingData = (bookings, passengers, transports) => {
  const passengersByTicket = {};
  passengers.forEach((passenger) => {
    if (!passengersByTicket[passenger.ticket_id]) {
      passengersByTicket[passenger.ticket_id] = [];
    }
    passengersByTicket[passenger.ticket_id].push({
      name: passenger.name,
      nationality: passenger.nationality,
      passport_id: passenger.passport_id,
      passenger_type: passenger.passenger_type,
      seat_number: passenger.seat_number || "",
    });
  });

  const transportsByTicket = {};
  transports.forEach((transport) => {
    if (!transportsByTicket[transport.ticket_id]) {
      transportsByTicket[transport.ticket_id] = [];
    }
    transportsByTicket[transport.ticket_id].push({
      transport_id: parseInt(transport.transport_id),
      quantity: parseInt(transport.quantity || 1),
      transport_price: parseFloat(transport.transport_price),
      transport_type: transport.transport_type,
      note: transport.note || "",
    });
  });

  return bookings.map((booking) => ({
    schedule_id: parseInt(booking.schedule_id),
    subschedule_id:
      booking.subschedule_id && booking.subschedule_id !== ""
        ? parseInt(booking.subschedule_id)
        : null,
    total_passengers: parseInt(booking.total_passengers),
    booking_date: booking.booking_date,
    agent_id: parseInt(booking.agent_id),
    ticket_total: parseFloat(booking.ticket_total),
    payment_status: booking.payment_status,
    contact_name: booking.contact_name,
    contact_phone: booking.contact_phone,
    contact_passport_id: booking.contact_passport_id,
    contact_nationality: booking.contact_nationality,
    contact_email: booking.contact_email,
    payment_method: booking.payment_method,
    booking_source: booking.booking_source,
    adult_passengers: parseInt(booking.adult_passengers) || 0,
    child_passengers: parseInt(booking.child_passengers) || 0,
    infant_passengers: parseInt(booking.infant_passengers) || 0,
    ticket_id: booking.ticket_id,
    note: booking.note || "",
    passengers: passengersByTicket[booking.ticket_id] || [],
    transports: transportsByTicket[booking.ticket_id] || [],
  }));
};



const processBooking = async (bookingData) => {
  console.log("Processing booking data:");
  return await sequelize.transaction(async (t) => {
    try {
      const {
        schedule_id,
        subschedule_id,
        total_passengers,
        booking_date,
        passengers,
        agent_id,
        ticket_total,
        payment_status,
        transports,
        contact_name,
        contact_phone,
        contact_passport_id,
        contact_nationality,
        contact_email,
        payment_method,
        booking_source,
        adult_passengers,
        child_passengers,
        infant_passengers,
        ticket_id,
        note,
      } = bookingData;

      console.log(`🚀 Processing booking: ${ticket_id}`);

      // Check for duplicate ticket
      const existingBooking = await Booking.findOne({ where: { ticket_id } });
      if (existingBooking) {
        console.warn(`The ticket ID '${ticket_id}' is already in use.`);
        throw new Error(`The ticket ID '${ticket_id}' is already in use.`);
      }

      // Step 1: Check if SeatAvailability exists
      const seatAvailabilityFilter = {
        schedule_id,
        date: booking_date,
        ...(subschedule_id ? { subschedule_id } : { subschedule_id: null }),
      };

      let seatAvailability = await SeatAvailability.findOne({
        where: seatAvailabilityFilter,
        transaction: t,
      });

      if (seatAvailability) {
        console.log(`✅ SeatAvailability exists with ID: ${seatAvailability.id}`);
      }

      // Step 2: Create SeatAvailability if it doesn't exist
      if (!seatAvailability) {
        console.log("🚨 SeatAvailability not found, creating...");
        await createSeatAvailability({
          schedule_id,
          date: booking_date,
          subschedule_id,
          transit_id: null,
          qty: 0,
        });

        // Fetch again after creating
        seatAvailability = await SeatAvailability.findOne({
          where: seatAvailabilityFilter,
          transaction: t,
        });

        if (!seatAvailability) {
          throw new Error("SeatAvailability could not be created.");
        }
      }

      // Step 3: Validate available seats
      if (seatAvailability.available_seats < total_passengers) {
        throw new Error(`Not enough seats available. Required: ${total_passengers}, Available: ${seatAvailability.available_seats}`);
      }

      // Step 4: Reduce available seats
      await seatAvailability.update({
        available_seats: seatAvailability.available_seats - total_passengers
      }, { transaction: t });

      // Step 5: Calculate transport total
      const transportTotal = Array.isArray(transports)
        ? transports.reduce((total, transport) =>
            total + parseFloat(transport.transport_price) * transport.quantity
          , 0)
        : 0;

      const totalAmount = parseFloat(ticket_total) + transportTotal;

      // Step 6: Create booking
      const booking = await Booking.create({
        schedule_id,
        subschedule_id,
        total_passengers,
        booking_date,
        agent_id,
        bank_fee: 0,
        gross_total: totalAmount,
        ticket_total: parseFloat(ticket_total),
        payment_status,
        contact_name,
        contact_phone,
        contact_passport_id,
        contact_nationality,
        contact_email,
        payment_method,
        booking_source,
        adult_passengers,
        child_passengers,
        infant_passengers,
        ticket_id,
        note,
        expiration_time: new Date(Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000),
      }, { transaction: t });

      console.log("start booking queueue");
      // Step 7: Add to queue (optional)
      bookingQueue.add({
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers,
        passengers,
        transports,
        booking_id: booking.id,
        agent_id,
        gross_total: totalAmount,
        payment_status,
      });

      console.log("✅ Booking created:", booking.id);
      return { booking };

    } catch (error) {
      console.error("❌ Error in processBooking:", error.message);
      throw error;
    }
  });
};

module.exports = processBooking;

// Bulk booking history controller
const getBulkBookingHistory = async (req, res) => {
  try {
    const history = await BulkBookingUpload.findAll({
      order: [["created_at", "DESC"]],
      limit: 20,
      include: [
        {
          model: User,
          attributes: ["name"],
          as: "User",
        },
      ],
    });

    const formattedHistory = history.map((item) => ({
      id: item.id,
      created_at: item.created_at,
      username: item.user ? item.user.name : "System",
      total_bookings: item.total_bookings,
      successful: item.successful_bookings,
      failed: item.failed_bookings,
      status: item.status,
    }));

    return res.status(200).json({ data: formattedHistory });
  } catch (error) {
    console.error("Error fetching bulk booking history:", error);
    return res
      .status(500)
      .json({ error: "Server error", message: error.message });
  }
};

// Bulk booking details controller
const getBulkBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid ID parameter" });
    }

    const uploadId = parseInt(id);

    const upload = await BulkBookingUpload.findByPk(uploadId, {
      include: [
        {
          model: User,
          attributes: ["name"],
          as: "User",
        },
      ],
    });

    if (!upload) {
      return res.status(404).json({ error: "Bulk upload not found" });
    }

    const results = await BulkBookingResult.findAll({
      where: { bulk_upload_id: uploadId },
      order: [["created_at", "ASC"]],
    });

    return res.status(200).json({
      upload,
      results,
    });
  } catch (error) {
    console.error("Error fetching bulk booking details:", error);
    return res
      .status(500)
      .json({ error: "Server error", message: error.message });
  }
};

// Export CSV template controllers
const getBookingsTemplate = (req, res) => {
  const headers =
    "schedule_id,subschedule_id,total_passengers,booking_date,agent_id,ticket_total,payment_status,contact_name,contact_phone,contact_passport_id,contact_nationality,contact_email,payment_method,booking_source,adult_passengers,child_passengers,infant_passengers,ticket_id,note";
  const sampleRow =
    "37,40,3,2024-01-20,1,270000.00,pending,John Doe,1234567890,A12345678,USA,john.doe@example.com,paypal,website,2,1,0,GG-OW-382037,Sample booking";

  const csvContent = `${headers}\n${sampleRow}`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="bookings_template.csv"'
  );

  return res.status(200).send(csvContent);
};

const getPassengersTemplate = (req, res) => {
  const headers = "ticket_id,name,nationality,passport_id,passenger_type,seat_number";
  const sampleRows = [
    "GG-OW-382037,John Doe,USA,12345678,adult,A1",
    "GG-OW-382037,Jane Doe,USA,87654321,adult,A2",
    "GG-OW-382037,Billy Doe,USA,23456789,child,B3",
  ].join("\n");

  const csvContent = `${headers}\n${sampleRows}`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="passengers_template.csv"'
  );

  return res.status(200).send(csvContent);
};

const getTransportsTemplate = (req, res) => {
  const headers =
    "ticket_id,transport_id,quantity,transport_price,transport_type,note";
  const sampleRows = [
    "GG-OW-382037,48,1,100000.00,pickup,pickup at hotel",
    "GG-OW-382037,48,1,150000.00,dropoff,drop at restaurant",
  ].join("\n");

  const csvContent = `${headers}\n${sampleRows}`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="transports_template.csv"'
  );

  return res.status(200).send(csvContent);
};

module.exports = {
  bulkBookingFromMultiCSV,
  getBulkBookingHistory,
  getBulkBookingDetails,

  getBookingsTemplate,
  getPassengersTemplate,
  getTransportsTemplate,
};
