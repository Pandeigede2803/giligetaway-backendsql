// queue/bookingQueue.js
const Bull = require("bull");
const {
  Booking,
  BookingSeatAvailability,
  SeatAvailability,
  Passenger,
  TransportBooking,
  AgentCommission,
  sequelize,
} = require("../models");

const {
  addTransportBookings,
  addPassengers,
  addTransportBookings2,
} = require("../util/bookingUtil");
const handleMainScheduleBooking = require("../util/handleMainScheduleBooking");
const releaseSeats = require("../util/releaseSeats"); // Adjust the path based on your project structure
const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");

const Queue = require("bull");
// const bookingQueue = new Queue("bookingQueue"); // Inisialisasi Bull Queue
const {
  updateAgentCommission,
  updateAgentCommissionBulk,
} = require("../util/updateAgentComission");

const bookingQueue = new Bull("bookingQueue", {
  settings: {
    lockDuration: 30000, // 30 detik
    stalledInterval: 15000, // Cek job stalled setiap 15 detik
    maxStalledCount: 3, // Coba ulang job stalled maksimal 3 kali
    removeOnComplete: 100, // Simpan 100 job terakhir yang selesai
    removeOnFail: false, // Jangan hapus job yang gagal
  },
});

// queue/bookingQueue.js
// Process queue items
bookingQueue.process(async (job, done) => {
  const {
    schedule_id,
    subschedule_id,
    booking_date,
    total_passengers,
    passengers,
    transports,
    transit_details,
    booking_id,
    agent_id,
    gross_total,
    payment_status,
    commission_processed, // Flag baru untuk menandai komisi sudah diproses
    transport_processed, // Flag baru untuk menandai transport sudah diproses
  } = job.data;

  console.log("---START OF JOB---");
  console.log(`Processing booking ${booking_id}`);
  console.log("DEBUG schedule_id:", schedule_id);
  console.log("DEBUG subschedule_id:", subschedule_id);
  console.log("DEBUG booking_date:", booking_date);
  console.log("DEBUG total_passengers:", total_passengers);

  const transaction = await sequelize.transaction();
  try {
    // Step 1: Handle Seat Availability
    let remainingSeatAvailabilities;
    if (subschedule_id) {
      console.log(
        `Processing sub-schedule booking for subschedule_id ${subschedule_id}`
      );
      remainingSeatAvailabilities = await handleSubScheduleBooking(
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers,
        transit_details,
        transaction
      );
    } else {
      console.log(
        `Processing main schedule booking for schedule_id ${schedule_id}`
      );
      remainingSeatAvailabilities = await handleMainScheduleBooking(
        schedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    }

    console.log(
      "Remaining Seat Availabilities:",
      remainingSeatAvailabilities
    );
    
    // ======================
    // Step 2: Buat Record Pivot BookingSeatAvailability
    // ======================
    if (remainingSeatAvailabilities && remainingSeatAvailabilities.length > 0) {
      // Siapkan data pivot
      const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(
        (sa) => ({
          booking_id,
          seat_availability_id: sa.id,
        })
      );

      console.log(
        "=======Data to Insert into BookingSeatAvailability:=======",
        bookingSeatAvailabilityData
      );

      // Eksekusi bulkCreate
      const result = await BookingSeatAvailability.bulkCreate(
        bookingSeatAvailabilityData,
        { transaction }
      );

      // Log hasil
      console.log(
        `Successfully created ${result.length} BookingSeatAvailability records.`
      );
      console.log(
        "Created BookingSeatAvailability entries with seat_availability_id values:",
        result.map((record) => record.seat_availability_id)
      );
    } else {
      console.log("No seat availabilities found.");
    }

    // Step 3: Add Passengers
    console.log(`Adding passengers for booking_id ${booking_id}`);
    await addPassengers(passengers, booking_id, transaction);

    // Step 4: Add Transport Bookings (skipped if already processed)
    if (transport_processed) {
      console.log(`✅ Transport bookings for booking ${booking_id} were already processed directly in processBooking`);
    } else if (Array.isArray(transports) && transports.length > 0) {
      console.log(`Adding transport bookings for booking_id ${booking_id}`);
      const createdTransports = await addTransportBookings2(
        transports,
        booking_id,
        total_passengers,
        transaction
      );
      console.log(`Added ${createdTransports} transport bookings`);
    } else {
      console.log(`No transport bookings to add for booking ${booking_id}`);
    }

    // Step 5: Update Agent Commission (skipped if already processed)
    if (commission_processed) {
      console.log(`✅ Agent commission for booking ${booking_id} was already processed directly in processBooking`);
    } else if (!agent_id || !(payment_status === 'paid' || payment_status === 'invoiced')) {
      console.log(
        `Skipping commission calculation for booking ${booking_id} as agent_id is ${
          agent_id ? 'present' : 'absent'
        } or payment status is not "paid" or "invoiced" (currently ${payment_status}).`
      );
    } else {
      console.log(`Processing commission for agent_id ${agent_id}`);
      try {
        const commissionResponse = await updateAgentCommission(
          agent_id,
          gross_total,
          total_passengers,
          payment_status,
          schedule_id,
          subschedule_id,
          booking_id,
          transaction,
          []  // Empty array since transports should be processed separately
        );
        console.log("Agent commission result:", commissionResponse);
      } catch (commError) {
        console.error(`Error processing agent commission:`, commError);
        // Don't throw here - we don't want to fail the whole job if just commission fails
      }
    }

    console.log("Booking ID:", booking_id);

    await transaction.commit(); // Commit the transaction if successful
    console.log(`Booking queue success for booking ${booking_id}`);
    done(); // Mark the job as done
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if any error occurs
    console.error("Error processing booking queue:", error.message);
    done(error); // Mark the job as failed
  }
});
// Booking queue worker to handle all logic



// Tambahkan event listeners untuk debugging
bookingQueue.on("error", (error) => {
  console.error("Bull queue error:", error);
});

bookingQueue.on("failed", (job, error) => {
  console.error(
    `Job ${job.id} failed processing booking ${job.data.booking_id}:`,
    error
  );
});

bookingQueue.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed successfully for booking ${job.data.booking_id}`
  );
});

// Tambahkan penanganan job yang stalled
bookingQueue.on("stalled", (job) => {
  console.warn(
    `Job ${job.id} for booking ${job.data?.booking_id} has stalled and will be retried`
  );
});
module.exports = bookingQueue;
