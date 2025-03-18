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
} = require("../models");
const { fn, col } = require("sequelize");
const nodemailer = require("nodemailer");

const { Op } = require("sequelize");
const { updateAgentMetrics } = require("../util/updateAgentMetrics");
const { addTransportBookings, addPassengers } = require("../util/bookingUtil");
const handleMainScheduleBooking = require("../util/handleMainScheduleBooking");
const releaseSeats = require("../util/releaseSeats"); // Adjust the path based on your project structure
const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");
const calculateDepartureAndArrivalTimes = require("../util/calculateDepartureAndArrivalTime");
const moment = require("moment"); // Use moment.js for date formatting
const cronJobs = require("../util/cronJobs");
const { createTransaction } = require("../util/transactionUtils");
const Queue = require("bull");
const bookingQueue = new Queue("bookingQueue"); // Inisialisasi Bull Queue
const bookingQueueMultiple = new Queue("bookingQueueMultiple");
const bookingRoundQueue = new Queue("bookingRoundQueue");
const {
  sendPaymentEmail,
  sendEmailNotification,
} = require("../util/sendPaymentEmail");

const { createPayPalOrder } = require("../util/payment/paypal"); // PayPal utility
const {
  generateMidtransToken,
} = require("../util/payment/generateMidtransToken"); // MidTrans utility
const {
  handleMultipleSeatsBooking,
} = require("../util/handleMultipleSeatsBooking");
const validateSeatAvailability = require("../util/validateSeatAvailability");
const validateSeatAvailabilitySingleTrip = require("../util/validateSeatAvailabilitySingleTrip");
const AgentCommission = require("../models/AgentComission");
const { buildRouteFromSchedule } = require("../util/buildRoute");
const { findRelatedSubSchedules } = require("../util/handleSubScheduleBooking");
const getBookingsByDate = async (req, res) => {
  console.log("getBookingsByDate: start");
  let { selectedDate } = req.query;

  try {
    // Ensure the selectedDate is in the correct format (YYYY-MM-DD)
    selectedDate = moment(selectedDate).format("YYYY-MM-DD");

    console.log("getBookingsByDate: filtering bookings by date");
    const bookings = await Booking.findAll({
      where: {
        booking_date: {
          [Op.eq]: selectedDate,
        },
      },
      include: [
        {
          association: "passengers", // Include passengers associated with the bookings
          attributes: ["id", "name", "nationality", "passenger_type"],
        },
        {
          association: "schedule", // Include schedule details if needed
          attributes: ["id", "departure_time", "arrival_time"],
        },
        {
          association: "subSchedule", // Include subschedule details if needed
          attributes: ["id", "validity_start", "validity_end"],
        },
      ],
    });

    if (!bookings || bookings.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found for the selected date" });
    }

    console.log("getBookingsByDate: sending response");
    res.status(200).json(bookings);
  } catch (error) {
    console.log("getBookingsByDate: catch error");
    res.status(400).json({ error: error.message });
  }
};

// const createBookingMultiple = async (req, res) => {
//   console.log('\n=== Starting Multiple Booking Creation Process ===');

//   const {
//     trips,
//     total_passengers,
//     passengers,
//     agent_id,
//     ticket_total,
//     payment_status,
//     transports,
//     contact_name,
//     contact_phone,
//     contact_passport_id,
//     contact_nationality,
//     contact_email,
//     payment_method,
//     booking_source,
//     adult_passengers,
//     child_passengers,
//     infant_passengers,
//     transit_details,
//     transaction_type,
//     currency,
//     gross_total_in_usd,
//     exchange_rate,
//   } = req.body;

//   try {
//     // Step 1: Validate seat availability
//     console.log('\n🔍 Checking seat availability for all trips...');
//     const seatAvailabilityResult = await validateSeatAvailability(trips, total_passengers);

//     if (seatAvailabilityResult.error) {
//       console.log('❌ Seat availability check failed:', seatAvailabilityResult.error);
//       return res.status(400).json({ error: seatAvailabilityResult.error });
//     }

//     const { totalSeatsAvailable, warning } = seatAvailabilityResult;

//     if (warning) {
//       console.warn('⚠️ Seat availability warning:', warning);
//     }

//     if (totalSeatsAvailable < total_passengers) {
//       const errorMessage = `Not enough seats available. Required: ${total_passengers}, Available: ${totalSeatsAvailable}`;
//       console.error('❌', errorMessage);
//       return res.status(400).json({
//         error: errorMessage,
//         availableSeats: totalSeatsAvailable,
//       });
//     }

//     const result = await sequelize.transaction(async (t) => {
//       // Step 2: Calculate totals
//       console.log('\n💰 Calculating total amounts...');
//       const transportTotal = Array.isArray(transports)
//         ? transports.reduce((total, transport) => {
//             const price = parseFloat(transport.transport_price);
//             const qty = parseInt(transport.quantity);
//             console.log(`Transport item: Price=${price}, Quantity=${qty}`);
//             return total + (price * qty);
//           }, 0)
//         : 0;

//       const totalAmount = parseFloat(ticket_total) + transportTotal;
//       console.log('📊 Final calculations:', {
//         ticket_total: parseFloat(ticket_total),
//         transportTotal,
//         totalAmount
//       });

//       // Step 3: Process each trip
//       console.log('\n🔄 Processing individual trips...');
//       const bookingPromises = trips.map(async (trip, index) => {
//         console.log(`\n📝 Processing trip ${index + 1}:`, {
//           ticket_id: trip.ticket_id,
//           schedule_id: trip.schedule_id
//         });

//         // Check for existing ticket
//         const existingBooking = await Booking.findOne({
//           where: { ticket_id: trip.ticket_id },
//           transaction: t
//         });

//         if (existingBooking) {
//           throw new Error(`Ticket ID ${trip.ticket_id} already exists`);
//         }

//         // Create booking
//         const booking = await Booking.create({
//           total_passengers,
//           agent_id,
//           gross_total: totalAmount,
//           gross_total_in_usd,
//           exchange_rate,
//           ticket_total: parseFloat(ticket_total),
//           payment_status,
//           contact_name,
//           contact_phone,
//           contact_passport_id,
//           schedule_id: trip.schedule_id,
//           subschedule_id: trip.subschedule_id,
//           contact_nationality,
//           contact_email,
//           payment_method,
//           booking_source,
//           adult_passengers,
//           child_passengers,
//           infant_passengers: infant_passengers || 0,
//           booking_date: trip.booking_date,
//           ticket_id: trip.ticket_id,
//           expiration_time: new Date(Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000),
//           currency: currency || 'IDR'
//         }, { transaction: t });

//         console.log('✅ Booking created:', booking.id);

//         // Create transaction
//         const transactionEntry = await createTransaction({
//           transaction_id: `TRANS-${Date.now()}-${index}`,
//           payment_method,
//           payment_gateway: null,
//           amount: totalAmount,
//           currency: currency || 'IDR',
//           transaction_type: transaction_type || 'booking',
//           booking_id: booking.id,
//           status: 'pending'
//         }, t);

//         console.log('✅ Transaction created:', transactionEntry.transaction_id);

//         // Add to processing queue
//         const jobData = {
//           trips: [trip],
//           total_passengers,
//           passengers,
//           transports,
//           transit_details,
//           booking_id: booking.id,
//           agent_id,
//           gross_total: totalAmount,
//           payment_status
//         };
//         await bookingQueueMultiple.add(jobData);
//         console.log('✅ Added to processing queue');

//         return { booking, transactionEntry };
//       });

//       const results = await Promise.all(bookingPromises);
//       const bookings = results.map(result => result.booking);
//       const transactions = results.map(result => result.transactionEntry);

//       console.log('\n=== Multiple Booking Creation Completed ===');
//       console.log(`✅ Created ${bookings.length} bookings successfully`);

//       return res.status(201).json({
//         message: 'Multiple bookings created successfully',
//         data: {
//           bookings: bookings.map(booking => ({
//             id: booking.id,
//             ticket_id: booking.ticket_id,
//             total_amount: booking.gross_total,
//             currency: booking.currency
//           })),
//           transactions: transactions.map(trans => ({
//             id: trans.transaction_id,
//             status: trans.status
//           })),
//           transports: transports || [],
//           status: 'processing'
//         }
//       });
//     });

//   } catch (error) {
//     console.error('\n❌ Error in multiple booking creation:', {
//       message: error.message,
//       stack: error.stack
//     });

//     return res.status(400).json({
//       error: 'Failed to create bookings',
//       details: error.message
//     });
//   }
// };

const createBookingMultiple = async (req, res) => {
  const {
    trips,
    total_passengers,
    passengers,
    agent_id,
    gross_total,
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
    transit_details,
    transaction_type,
    currency,
    bank_fee,
    gross_total_in_usd,
    exchange_rate,
  } = req.body;

  try {
    // Step 1: Validate seat availability
    const seatAvailabilityResult = await validateSeatAvailability(
      trips,
      total_passengers
    );

    if (seatAvailabilityResult.error) {
      return res.status(400).json({ error: seatAvailabilityResult.error });
    }

    const { totalSeatsAvailable, warning } = seatAvailabilityResult;

    // Step 2: Check if available seats are less than total passengers
    if (totalSeatsAvailable < total_passengers) {
      console.error(
        "Not enough seats available for the number of passengers. Required:",
        total_passengers,
        "Available:",
        totalSeatsAvailable
      );
      return res.status(400).json({
        error:
          "Not enough seats available for the number of passengers. Please check again.",
        availableSeats: totalSeatsAvailable,
      });
    }

    // Log any warnings from the seat availability check
    if (warning) {
      console.warn(warning);
    }

    const result = await sequelize.transaction(async (t) => {
      console.log("Step 3: Calculate total transport if available");
      const transportTotal = Array.isArray(transports)
        ? transports.reduce(
            (total, transport) =>
              total +
              parseFloat(transport.transport_price) * transport.quantity,
            0
          )
        : 0;

      const totalAmount = ticket_total + transportTotal;
      console.log(
        `Total transport: ${transportTotal}, Total amount: ${totalAmount}`
      );

      // Step 4: Loop through each trip and create a booking for each
      const bookingPromises = trips.map(async (trip, index) => {
        console.log(
          `Processing trip ${index + 1} with ticket_id: ${trip.ticket_id}`
        );

        // Step 4.1: Validate if the ticket_id already exists
        const existingBooking = await Booking.findOne({
          where: { ticket_id: trip.ticket_id },
        });
        if (existingBooking) {
          throw new Error(
            `Ticket ID ${trip.ticket_id} already exists. Please provide a unique ticket ID.`
          );
        }

        // Step 4.2: Create the booking
        const booking = await Booking.create(
          {
            total_passengers,
            agent_id,
            gross_total: gross_total,
            gross_total_in_usd,
            exchange_rate,
            ticket_total: parseFloat(ticket_total),
            payment_status,
            contact_name,
            contact_phone,
            contact_passport_id,
            schedule_id: trip.schedule_id, // Use schedule_id from trip
            subschedule_id: trip.subschedule_id, // Use subschedule_id from trip
            contact_nationality,
            contact_email,
            payment_method,
            booking_source,
            adult_passengers,
            child_passengers,
            bank_fee,
            infant_passengers,
            booking_date: trip.booking_date, // Use booking_date from trip
            ticket_id: trip.ticket_id, // Ticket ID for this specific trip
            expiration_time: new Date(
              Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
            ), // Default 30 minutes
          },
          { transaction: t }
        );

        console.log(
          `Booking created with ID: ${booking.id} for ticket_id: ${trip.ticket_id}`
        );

        // Step 5: Create an initial transaction
        const transactionEntry = await createTransaction(
          {
            transaction_id: `TRANS-${Date.now()}`,
            payment_method,
            payment_gateway: null, // Optional, set to null for now
            amount: gross_total,
            currency,
            transaction_type,
            booking_id: booking.id,
            status: "pending",
          },
          t
        );

        console.log(
          `Transaction created with ID: ${transactionEntry.id} for booking ID: ${booking.id}`
        );

        // Step 6: Add job to queue for background processing (seat availability will be processed in the queue)
        const jobData = {
          trips: [trip], // Single trip data
          total_passengers,
          passengers,
          transports,
          transit_details,
          booking_id: booking.id,
          agent_id,
          gross_total: totalAmount,
          payment_status,
        };
        bookingQueueMultiple.add(jobData);
        console.log(
          `Job added to queue for background processing of booking ${booking.id}`,
          jobData
        );

        return { booking, transactionEntry }; // Return both booking and transaction
      });
      // Wait for all bookings and transactions to complete
      const results = await Promise.all(bookingPromises);
      const bookings = results.map((result) => result.booking);
      const transactions = results.map((result) => result.transactionEntry);

      console.log(
        `${bookings.length} bookings and transactions created successfully`
      );

      return res.status(201).json({
        bookings, // Array of all created bookings
        transactions, // Array of all created transactions
        transports,
        status: "processing",
      });
    });
  } catch (error) {
    console.error(
      "Error creating bookings with multiple trips:",
      error.message
    );
    return res.status(400).json({ error: error.message });
  }
};
bookingQueueMultiple.process(async (job, done) => {
  const {
    trips, // Array of { schedule_id, subschedule_id, booking_date }
    total_passengers,
    passengers,
    transports,
    transit_details,
    booking_id,
    agent_id,
    gross_total,
    payment_status,
  } = job.data;

  console.log("🚐 Transport details:", transports);
  console.log("🧳 Passenger details:", passengers);
  console.log("🗺️ Trips details:", trips);

  // Mulai transaksi
  const transaction = await sequelize.transaction();
  try {
    console.log(
      `⚙️ Processing booking with ID: ${booking_id} for multiple trips...`
    );

    // Step 1: Handle Seat Availability untuk multiple trips (seat availability only processed here)
    const seatAvailabilities = await handleMultipleSeatsBooking(
      trips,
      total_passengers,
      transaction
    );

    console.log("✅ Seat availability updated successfully.");

    // Step 2: Add passengers using the addPassengers utility
    if (passengers && passengers.length > 0) {
      await addPassengers(passengers, booking_id, transaction); // Use the correct transaction variable
      console.log(
        `✅ Passengers added successfully for booking ID: ${booking_id}`
      );
    }

    // Step 3: Add transport bookings using the addTransportBookings utility
    if (transports && transports.length > 0) {
      await addTransportBookings(
        transports,
        booking_id,
        total_passengers,
        transaction
      ); // Use the correct transaction variable
      console.log(
        `✅ Transport bookings added successfully for booking ID: ${booking_id}`
      );
    }

    // Step 4: Tambahkan seat availability ke table BookingSeatAvailability
    const bookingSeatAvailabilityData = seatAvailabilities.map(
      (seatAvailability) => ({
        booking_id: booking_id,
        seat_availability_id: seatAvailability.id,
      })
    );

    if (bookingSeatAvailabilityData.length > 0) {
      const result = await BookingSeatAvailability.bulkCreate(
        bookingSeatAvailabilityData,
        { transaction }
      );
      console.log(
        `✅ BookingSeatAvailability records added successfully. Total records created: ${result.length}`
      );

      // Log the seat_availability_id for each created BookingSeatAvailability record
      const seatAvailabilityIds = result.map(
        (record) => record.seat_availability_id
      );
      console.log(
        "🪑 Created BookingSeatAvailability entries with seat_availability_id values:",
        seatAvailabilityIds
      );
    } else {
      console.log("⚠️ No seat availability data found to add.");
    }

    // Commit the transaction jika semua langkah berhasil
    await transaction.commit();
    console.log(
      `🎉 Booking queue processed successfully for booking ${booking_id}`
    );
    done(); // Menandakan job selesai
  } catch (error) {
    // Rollback jika terjadi kesalahan
    await transaction.rollback();
    console.error(
      `❌ Error processing booking queue for booking ${booking_id}:`,
      error.message
    );
    done(error); // Menandakan job gagal
  }
});

// const createRoundBookingWithTransitQueue = async (req, res) => {
//   console.log("\n[Step 1] 🎯 Starting round trip booking process...");

//   const { departure, return: returnData } = req.body;

//   try {
//     console.log("\n[Step 2] 🔄 Starting database transaction...");
//     const result = await sequelize.transaction(async (t) => {
//       const handleBooking = async (data, type) => {
//         console.log(`\n[Step 3.${type === "departure" ? 1 : 2}] 📋 Processing ${type} booking...`);
//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.1] ${type} schedule_id:`, data.schedule_id);

//         const {
//           schedule_id,
//           subschedule_id,
//           total_passengers,
//           booking_date,
//           passengers,
//           agent_id,
//           gross_total,
//           ticket_total,
//           payment_status,
//           transports,
//           contact_name,
//           contact_phone,
//           contact_passport_id,
//           contact_nationality,
//           contact_email,
//           payment_method,
//           booking_source,
//           adult_passengers,
//           child_passengers,
//           infant_passengers,
//           ticket_id,
//           bank_fee,
//           transaction_type,
//           currency,
//           gross_total_in_usd,
//           exchange_rate,
//         } = data;

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.2] 🔍 Checking for existing booking with ticket ID:`, ticket_id);
//         const existingBooking = await Booking.findOne({ where: { ticket_id } });
//         if (existingBooking) {
//           console.log(`[Step 3.${type === "departure" ? 1 : 2}.2.1] ⚠️ Duplicate ticket ID found`);
//           throw new Error(`Ticket ID '${ticket_id}' is already in use.`);
//         }

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.3] 💺 Validating seat availability...`);
//         const seatAvailability = await validateSeatAvailabilitySingleTrip(
//           schedule_id,
//           subschedule_id,
//           booking_date,
//           total_passengers
//         );

//         if (!seatAvailability.success) {
//           console.log(`[Step 3.${type === "departure" ? 1 : 2}.3.1] ⚠️ Seat validation failed:`, seatAvailability.message);
//           throw new Error(seatAvailability.message);
//         }

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.4] 💰 Calculating transport total...`);
//         const transportTotal = Array.isArray(transports)
//           ? transports.reduce(
//               (total, { transport_price, quantity }) =>
//                 total + parseFloat(transport_price) * quantity,
//               0
//             )
//           : 0;

//         const totalAmount = ticket_total + transportTotal;
//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.5] 📊 Total amount calculated:`, totalAmount);

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.6] 💾 Creating booking record...`);
//         const formattedDate = moment(booking_date, "MMM DD, YYYY").format("YYYY-MM-DD");
//         const booking = await Booking.create(
//           {
//             schedule_id,
//             subschedule_id,
//             total_passengers,
//             booking_date: formattedDate,
//             agent_id,
//             gross_total,
//             ticket_total,
//             payment_status,
//             contact_name,
//             contact_phone,
//             contact_passport_id,
//             contact_nationality,
//             contact_email,
//             payment_method,
//             booking_source,
//             adult_passengers,
//             child_passengers,
//             infant_passengers,
//             ticket_id,
//             bank_fee,
//             transaction_type,
//             currency,
//             gross_total_in_usd,
//             exchange_rate,
//             expiration_time: new Date(
//               Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
//             ), // Default 30 minutes
//           },
//           { transaction: t }
//         );

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.7] 💳 Creating transaction entry...`);
//         const transactionEntry = await createTransaction(
//           {
//             transaction_id: `TRANS-${Date.now()}`,
//             payment_method,
//             amount: gross_total,
//             currency,
//             transaction_type,
//             booking_id: booking.id,
//             status: "pending",
//           },
//           t
//         );

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.8] 📤 Adding to booking queue...`);

//         bookingRoundQueue.add({
//           schedule_id,
//           subschedule_id,
//           booking_date,
//           total_passengers,
//           passengers,
//           transports,
//           booking_id: booking.id,
//           agent_id,
//           gross_total: totalAmount,
//           payment_status,
//         });

//         console.log(`[Step 3.${type === "departure" ? 1 : 2}.9] ✅ ${type} booking process completed`);
//         return { booking, transaction: transactionEntry };
//       };

//       console.log("\n[Step 3.1] 🛫 Processing departure booking...");
//       const departureResult = await handleBooking(departure, "departure");

//       console.log("\n[Step 3.2] 🛬 Processing return booking...");
//       const returnResult = await handleBooking(returnData, "return");

//       console.log("\n[Step 4] 📝 Compiling final results...");
//       return { departure: departureResult, return: returnResult };
//     });

//     const totalGross = departure.gross_total + returnData.gross_total;
//     console.log("\n[Step 5] 🎉 Round trip booking completed successfully!");
//     console.log("Total gross amount:", totalGross);
//     const bookings = [result.departure.booking, result.return.booking];
//     const transactions = [result.departure.transaction, result.return.transaction];
//     const transports = [
//       ...(departure.transports || []),
//       ...(returnData.transports || []),
//     ];

//     res.status(201).json({
//       message: "Round trip booking created successfully",
//       bookings,
//       transactions,
//       transports,
//       // departure: result.departure,
//       // return: result.return,
//       total_gross: totalGross,
//     });

//   } catch (error) {
//     console.log("\n[Error] ❌ Error creating round trip booking:", error.message);
//     res.status(400).json({ error: error.message });
//   }
// };

const createRoundBookingWithTransitQueue = async (req, res) => {
  console.log("\n[Step 1] 🎯 Starting round trip booking process...");

  const { departure, return: returnData } = req.body;

  try {
    console.log("\n[Step 2] 🔄 Starting database transaction...");
    const result = await sequelize.transaction(async (t) => {
      const handleBooking = async (data, type) => {
        console.log(
          `\n[Step 3.${
            type === "departure" ? 1 : 2
          }] 📋 Processing ${type} booking...`
        );
        console.log(
          `[Step 3.${type === "departure" ? 1 : 2}.1] ${type} schedule_id:`,
          data.schedule_id
        );

        const {
          schedule_id,
          subschedule_id,
          total_passengers,
          booking_date,
          passengers,
          agent_id,
          gross_total,
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
          bank_fee,
          transaction_type,
          currency,
          gross_total_in_usd,
          exchange_rate,
          note,
        } = data;

        console.log("note from frontend type", type, note);

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.2] 🔍 Checking for existing booking with ticket ID:`,
          ticket_id
        );
        const existingBooking = await Booking.findOne({ where: { ticket_id } });
        if (existingBooking) {
          console.log(
            `[Step 3.${
              type === "departure" ? 1 : 2
            }.2.1] ⚠️ Duplicate ticket ID found`
          );
          throw new Error(`Ticket ID '${ticket_id}' is already in use.`);
        }

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.3] 💺 Validating seat availability...`
        );
        const seatAvailability = await validateSeatAvailabilitySingleTrip(
          schedule_id,
          subschedule_id,
          booking_date,
          total_passengers
        );

        if (!seatAvailability.success) {
          console.log(
            `[Step 3.${
              type === "departure" ? 1 : 2
            }.3.1] ⚠️ Seat validation failed:`,
            seatAvailability.message
          );
          throw new Error(seatAvailability.message);
        }

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.4] 💰 Calculating transport total...`
        );
        const transportTotal = Array.isArray(transports)
          ? transports.reduce(
              (total, { transport_price, quantity }) =>
                total + parseFloat(transport_price) * quantity,
              0
            )
          : 0;

        const totalAmount = ticket_total + transportTotal;
        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.5] 📊 Total amount calculated:`,
          totalAmount
        );

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.6] 💾 Creating booking record...`
        );

        const booking = await Booking.create(
          {
            schedule_id,
            subschedule_id,
            total_passengers,
            booking_date,
            agent_id,
            gross_total,
            ticket_total,
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
            bank_fee,
            transaction_type,
            currency,
            gross_total_in_usd,
            exchange_rate,
            note,
            expiration_time: new Date(
              Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
            ), // Default 30 minutes
          },
          { transaction: t }
        );

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.7] 💳 Creating transaction entry...`
        );
        const transactionEntry = await createTransaction(
          {
            transaction_id: `TRANS-${Date.now()}`,
            payment_method,
            amount: gross_total,
            currency,
            transaction_type,
            booking_id: booking.id,
            status: "pending",
          },
          t
        );

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.8] 📤 Adding to booking queue...`
        );

        bookingRoundQueue.add({
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
          type,
        });

        console.log(
          `[Step 3.${
            type === "departure" ? 1 : 2
          }.9] ✅ ${type} booking process completed`
        );
        return { booking, transaction: transactionEntry };
      };

      console.log("\n[Step 3.1] 🛫 Processing departure booking...");
      const departureResult = await handleBooking(departure, "departure");

      console.log("\n[Step 3.2] 🛬 Processing return booking...");
      const returnResult = await handleBooking(returnData, "return");

      console.log("\n[Step 4] 📝 Compiling final results...");
      return { departure: departureResult, return: returnResult };
    });

    const totalGross = departure.gross_total + returnData.gross_total;
    console.log("\n[Step 5] 🎉 Round trip booking completed successfully!");
    console.log("Total gross amount:", totalGross);
    const bookings = [result.departure.booking, result.return.booking];
    const transactions = [
      result.departure.transaction,
      result.return.transaction,
    ];
    const transports = [
      ...(departure.transports || []),
      ...(returnData.transports || []),
    ];

    res.status(201).json({
      message: "Round trip booking created successfully",
      bookings,
      transactions,
      transports,
      total_gross: totalGross,
    });
  } catch (error) {
    console.log(
      "\n[Error] ❌ Error creating round trip booking:",
      error.message
    );
    res.status(400).json({ error: error.message });
  }
};

bookingRoundQueue.process(async (job, done) => {
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
    type, // Add 'type' to differentiate between departure and return
  } = job.data;

  console.log("---START OF JOB---");
  console.log(`[INFO] Processing ${type.toUpperCase()} booking queue`);

  const transaction = await sequelize.transaction();
  try {
    // Step 2: Handle Seat Availability
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
      `Remaining Seat Availabilities for ${type} booking:`,
      remainingSeatAvailabilities
    );

    // Step 5: Add Remaining Seat Availabilities
    if (remainingSeatAvailabilities && remainingSeatAvailabilities.length > 0) {
      const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(
        (sa) => ({
          booking_id,
          seat_availability_id: sa.id,
        })
      );

      console.log(
        "Data to Insert into BookingSeatAvailability:",
        bookingSeatAvailabilityData
      );

      const result = await BookingSeatAvailability.bulkCreate(
        bookingSeatAvailabilityData,
        { transaction }
      );

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

    console.log("Remaining Seat Availabilities:", remainingSeatAvailabilities);

    // Step 3: Add Passengers
    console.log(`Adding passengers for ${type}  booking_id ${booking_id}
      `);

    console.log("✅ DATA PASSENGER IS", passengers);
    await addPassengers(passengers, booking_id, transaction);

    // Step 4: Add Transport Bookings
    console.log(`Adding transport bookings for booking_id ${booking_id}`);
    await addTransportBookings(
      transports,
      booking_id,
      total_passengers,
      transaction
    );

    await transaction.commit(); // Commit the transaction if successful
    console.log(`Booking queue success for booking ${booking_id}`);
    done(); // Mark the job as done
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if any error occurs
    console.error("Error processing booking queue:", error.message);
    done(error); // Mark the job as failed
  }
});

const createBookingWithTransitQueue = async (req, res) => {
  const {
    schedule_id,
    subschedule_id,
    total_passengers,
    booking_date,
    passengers,
    agent_id,
    gross_total,
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
    bank_fee,
    transit_details,
    transaction_type,
    currency,
    gross_total_in_usd,
    exchange_rate,
    note,
  } = req.body;

  console.log("Received request body:", req.body);

  try {
    const result = await sequelize.transaction(async (t) => {
      const existingBooking = await Booking.findOne({ where: { ticket_id } });
      if (existingBooking) {
        return res.status(400).json({
          error: "Ticket ID already exists",
          message: `The ticket ID '${ticket_id}' is already in use. Please provide a unique ticket ID.`,
        });
      }

      // Step 1: Validate seat availability for the single trip
      const seatAvailabilityResult = await validateSeatAvailabilitySingleTrip(
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers
      );

      if (!seatAvailabilityResult.success) {
        // Return error if seats are not available
        return res.status(400).json({ error: seatAvailabilityResult.message });
      }

      console.log("Step 1: Calculate transport_total if transports exist");
      const transportTotal = Array.isArray(transports)
        ? transports.reduce(
            (total, transport) =>
              total +
              parseFloat(transport.transport_price) * transport.quantity,
            0
          )
        : 0;

      const totalAmount = ticket_total + transportTotal;
      console.log(`Gross total: ${totalAmount}`);

      const booking = await Booking.create(
        {
          schedule_id,
          subschedule_id,
          total_passengers,
          booking_date,
          agent_id,
          bank_fee,
          gross_total: gross_total,
          gross_total_in_usd,
          exchange_rate,
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
          expiration_time: new Date(
            Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000
          ),
        },
        { transaction: t }
      );

      console.log(`Booking created with ID: ${booking.id}`);

      const transactionEntry = await createTransaction(
        {
          transaction_id: `TRANS-${Date.now()}`,
          payment_method,
          payment_gateway: null,
          amount: gross_total,
          currency,
          transaction_type,
          booking_id: booking.id,
          status: "pending",
        },
        t
      );

      console.log(`Initial transaction created for booking ID: ${booking.id}`);

      bookingQueue.add({
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers,
        passengers,
        transports,
        transit_details,
        booking_id: booking.id,
        agent_id,
        gross_total: totalAmount,
        payment_status,
      });

      return res.status(201).json({
        booking,
        status: "processing",
        transaction: transactionEntry,
        transports,
        remainingSeatAvailabilities: null,
      });
    });
  } catch (error) {
    console.log("Error:", error.message);

    if (
      error.name === "SequelizeValidationError" ||
      error.name === "SequelizeUniqueConstraintError"
    ) {
      return res
        .status(400)
        .json({ error: "Invalid input data", details: error.message });
    }

    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};


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
  } = job.data;

  console.log("---START OF JOB---");

  const transaction = await sequelize.transaction();
  try {
    // Step 2: Handle Seat Availability
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
      "THIS ISRemaining Seat Availabilities:",
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

    // Step 4: Add Transport Bookings
    console.log(`Adding transport bookings for booking_id ${booking_id}`);
    await addTransportBookings(
      transports,
      booking_id,
      total_passengers,
      transaction
    );

    // Step 5: Update Agent Metrics (if needed)
    // if (agent_id && payment_status === 'paid') {
    //   console.log(`Updating agent metrics for agent_id ${agent_id}`);
    //   await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, transaction);
    // }

    console.log("Remaining Seat Availabilities:", remainingSeatAvailabilities);
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

const getBookingContact = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      attributes: [
        [fn("MAX", col("id")), "id"],
        [fn("MAX", col("contact_name")), "contact_name"],
        [fn("MAX", col("contact_phone")), "contact_phone"],
        [fn("MAX", col("contact_passport_id")), "contact_passport_id"],
        [fn("MAX", col("contact_nationality")), "contact_nationality"],
        [fn("MAX", col("contact_email")), "contact_email"],
      ],
      group: ["contact_email"],
    });

    res.status(200).json(bookings.map((b) => ({ id: b.id, ...b.dataValues })));
  } catch (error) {
    console.log("Error getting contact list:", error.message);
    res.status(400).json({ error: error.message });
  }
};

const findRelatedSubSchedulesGet = async (req, res) => {
  try {
    const { schedule_id, subschedule_id } = req.body;
    const transaction = null;

    // Fetch the subSchedule using schedule_id and subschedule_id
    const subSchedule = await SubSchedule.findOne({
      where: {
        id: subschedule_id,
        schedule_id: schedule_id,
        availability: true,
      },
      include: [
        {
          model: Transit,
          as: "TransitFrom",
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id"],
            },
          ],
        },

        {
          model: Transit,
          as: "TransitTo",
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id"],
            },
          ],
        },
        {
          model: Transit,

          as: "Transit1",
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id"],
            },
          ],
        },
        {
          model: Transit,

          as: "Transit2",
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id"],
            },
          ],
        },
        {
          model: Transit,
        
          as: "Transit3",
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id"],
            },
          ],
        },
        {
          model: Transit,
      
          as: "Transit4",
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id"],
            },
          ],
        },
      ],
      transaction,
    });
    

  
    if (!subSchedule) {
      return res.status(404).json({
        success: false,
        message: "SubSchedule not found or unavailable",
      });
    }

    // Call the function using the fetched subSchedule object
    const result = (await findRelatedSubSchedules(
      schedule_id,
      subSchedule,
      transaction
    )).map(({ id, schedule_id }) => ({ id, schedule_id }));

    res.json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi error saat memproses permintaan",
      error: error.message,
    });
  }
};



const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        {
          model: Schedule,
          as: "schedule",
          include: [
            {
              model: Transit,
              as: "Transits",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Destination,
              as: "FromDestination",
            },
            {
              model: Destination,
              as: "ToDestination",
            },
          ],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
          // include: [
          //     {
          //         model: BookingSeatAvailability,
          //         as: 'bookingSeatAvailability'
          //     }
          // ]
        },
        // {
        //     model: BookingSeatAvailability,
        //     as: 'bookingSeatAvailability'

        // },
        {
          model: Passenger,
          as: "passengers",
        },
        {
          model: TransportBooking,
          as: "transportBookings",
          include: [
            {
              model: Transport,
              as: "transport",
            },
          ],
        },
        {
          model: Agent,
          as: "Agent",
          // include: [
          //     {
          //         model: AgentMetrics,
          //         as: 'agentMetrics'
          //     }
          // ]
        },
      ],
    });
    if (booking) {
      console.log("Booking retrieved:", booking);
      res.status(200).json(booking);
    } else {
      console.log("Booking not found:", req.params.id);
      res.status(404).json({ error: "Booking not found" });
    }
  } catch (error) {
    console.log("Error retrieving booking:", error.message);
    res.status(400).json({ error: error.message });
  }
};
const createBookingWithTransit2 = async (req, res) => {
  const {
    schedule_id,
    total_passengers,
    booking_date,
    passengers,
    agent_id,
    gross_total,
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
    transit_details,
  } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // Membuat entri baru di tabel Booking
      const booking = await Booking.create(
        {
          schedule_id,
          total_passengers,
          booking_date,
          agent_id,
          gross_total,
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
        },
        { transaction: t }
      );

      // Memanggil fungsi untuk mengelola ketersediaan kursi
      await handleDynamicSeatAvailability(
        schedule_id,
        booking_date,
        total_passengers,
        payment_status,
        transit_details,
        t
      );

      // Menambahkan data penumpang ke tabel Passenger
      const passengerData = passengers.map((passenger) => ({
        booking_id: booking.id,
        ...passenger,
      }));
      await Passenger.bulkCreate(passengerData, { transaction: t });

      // Menambahkan data transportasi ke tabel TransportBooking
      const transportData = transports.map((transport) => ({
        booking_id: booking.id,
        transport_id: transport.transport_id,
        quantity: transport.quantity,
        transport_price: transport.transport_price,
        transport_type: transport.transport_type,
        note: transport.note,
      }));
      await TransportBooking.bulkCreate(transportData, { transaction: t });

      // Memperbarui metrik agen jika agent_id tersedia
      if (agent_id) {
        await updateAgentMetrics(
          agent_id,
          gross_total,
          total_passengers,
          payment_status,
          t
        );
      }

      // Membuat entri di tabel BookingSeatAvailability untuk menghubungkan pemesanan dengan ketersediaan kursi
      const bookingSeatAvailabilityData = transit_details.map((transit) => ({
        booking_id: booking.id,
        seat_availability_id: transit.seat_availability_id,
      }));
      await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, {
        transaction: t,
      });

      const transportBookings = await TransportBooking.findAll({
        where: { booking_id: booking.id },
        transaction: t,
      });
      res.status(201).json({ booking, transportBookings });
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      include: [
        {
          model: Schedule,
          as: "schedule",
          include: [
            {
              model: Transit,
              as: "Transits",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Destination,
              as: "FromDestination",
            },
            {
              model: Destination,
              as: "ToDestination",
            },
          ],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
          through: {
            model: BookingSeatAvailability,
            attributes: [], // Exclude the join table attributes if not needed
          },
        },
        // {
        //     model: BookingSeatAvailability,
        //     as: 'bookingSeatAvailability'

        // },
        {
          model: Passenger,
          as: "passengers",
        },
        {
          model: TransportBooking,
          as: "transportBookings",
          include: [
            {
              model: Transport,
              as: "transport",
            },
          ],
        },
        {
          model: Agent,
          as: "Agent",
          // include: [
          //     {
          //         model: AgentMetrics,
          //         as: 'agentMetrics'
          //     }
          // ]
        },
      ],
    });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const getFilteredBookings = async (req, res) => {
  try {
    // Ambil query parameter
    const { monthly, booking_month, ticket_id, id } = req.query;

    console.log("Console log all query:", { booking_month, monthly });

    // Filter data
    let dateFilter = {};

    // Prioritaskan filter berdasarkan `id` jika tersedia
    if (id) {
      dateFilter = { id }; // Filter berdasarkan `id`
    } else if (ticket_id) {
      // Jika `ticket_id` ada, abaikan filter lainnya
      dateFilter = { ticket_id };
    } else if (booking_month) {
      // Jika `booking_month` ada, filter berdasarkan bulan dari `booking_date`
      console.log("Filtering by booking_month:", booking_month);
      const [year, month] = booking_month.split("-");
      if (!year || !month || isNaN(year) || isNaN(month)) {
        return res
          .status(400)
          .json({ error: "Invalid booking_month filter format. Use YYYY-MM." });
      }

      dateFilter = {
        booking_date: {
          [Op.between]: [
            new Date(year, month - 1, 1), // Awal bulan
            new Date(year, month, 0, 23, 59, 59), // Akhir bulan
          ],
        },
      };
    } else if (monthly) {
      // Jika `monthly` ada, filter berdasarkan `created_at`
      console.log("Filtering by monthly:", monthly);
      const [year, month] = monthly.split("-");
      if (!year || !month || isNaN(year) || isNaN(month)) {
        return res
          .status(400)
          .json({ error: "Invalid monthly filter format. Use YYYY-MM." });
      }

      dateFilter = {
        created_at: {
          [Op.between]: [
            new Date(year, month - 1, 1), // Awal bulan
            new Date(year, month, 0, 23, 59, 59), // Akhir bulan
          ],
        },
      };
    }

    // Query semua data booking sesuai filter
    const bookings = await Booking.findAll({
      where: dateFilter,
      include: [
        {
          model: Schedule,
          as: "schedule",
          attributes: [
            "id",
            "boat_id",
            "availability",
            "arrival_time",
            "journey_time",
            "route_image",
            "departure_time",
            "check_in_time",
            "schedule_type",
            "days_of_week",
            "trip_type",
          ],
          include: [
            {
              model: Transit,
              as: "Transits",
              attributes: ["id"],
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            { model: Destination, as: "FromDestination" },
            { model: Destination, as: "ToDestination" },
          ],
        },
        { model: AgentCommission, as: "agentCommissions" },
        {
          model: SubSchedule,
          as: "subSchedule",
          attributes: [
            "id",
            "destination_from_schedule_id",
            "destination_to_schedule_id",
            "transit_from_id",
            "transit_to_id",
            "transit_1",
            "transit_2",
            "transit_3",
            "transit_4",
          ],
          include: [
            { model: Destination, as: "DestinationFrom", attributes: ["name"] },
            { model: Destination, as: "DestinationTo", attributes: ["name"] },
            {
              model: Transit,
              as: "TransitFrom",
              attributes: ["id", "departure_time", "arrival_time"],
              include: [
                { model: Destination, as: "Destination", attributes: ["name"] },
              ],
            },
            {
              model: Transit,
              as: "TransitTo",
              attributes: ["id", "departure_time", "arrival_time"],
              include: [
                { model: Destination, as: "Destination", attributes: ["name"] },
              ],
            },
            {
              model: Transit,
              as: "Transit1",
              attributes: ["id", "departure_time", "arrival_time"],
              include: [
                { model: Destination, as: "Destination", attributes: ["name"] },
              ],
            },
            {
              model: Transit,
              as: "Transit2",
              attributes: ["id", "departure_time", "arrival_time"],
              include: [
                { model: Destination, as: "Destination", attributes: ["name"] },
              ],
            },
            {
              model: Transit,
              as: "Transit3",
              attributes: ["id", "departure_time", "arrival_time"],
              include: [
                { model: Destination, as: "Destination", attributes: ["name"] },
              ],
            },
            {
              model: Transit,
              as: "Transit4",
              attributes: ["id", "departure_time", "arrival_time"],
              include: [
                { model: Destination, as: "Destination", attributes: ["name"] },
              ],
            },
          ],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
          attributes: ["id"],
          through: {
            model: BookingSeatAvailability,
            attributes: ["id"],
          },
        },
        { model: Passenger, as: "passengers" },
        {
          model: TransportBooking,
          as: "transportBookings",
          include: [{ model: Transport, as: "transport" }],
        },
        { model: Agent, as: "Agent" },
      ],
    });

    // Tambahkan route ke masing-masing booking
    const enrichedBookings = bookings.map((booking) => {
      const schedule = booking.schedule || null;
      const subSchedule = booking.subSchedule || null;

      // Tentukan departure_time dan arrival_time menggunakan fungsi
      const times = calculateDepartureAndArrivalTimes(schedule, subSchedule);

      // Gunakan fungsi `buildRouteFromSchedule` untuk membangun route
      const route = schedule
        ? buildRouteFromSchedule(schedule, subSchedule)
        : null;

      // Tambahkan route ke hasil booking
      return {
        ...booking.dataValues,
        route,
        departure_time: times.departure_time,
        arrival_time: times.arrival_time,
      };
    });

    // Respons data
    res.status(200).json({
      bookings: enrichedBookings,
      totalItems: enrichedBookings.length,
      id, // Jika tersedia, kirim kembali ke frontend
      ticket_id, // Jika tersedia, kirim kembali ke frontend
    });
  } catch (error) {
    console.error("Error retrieving filtered bookings:", error);
    res
      .status(400)
      .json({ error: "An error occurred while fetching bookings." });
  }
};

const getBookingByTicketId = async (req, res) => {
  console.log("start to get booking by ticket id");
  try {
    const booking = await Booking.findOne({
      where: { ticket_id: req.params.ticket_id },
      include: [
        {
          model: Schedule,
          as: "schedule",
          include: [
            {
              model: Boat,
              as: "Boat",
            },
          ],
          include: [
            {
              model: Destination,
              as: "FromDestination",
            },
            {
              model: Destination,
              as: "ToDestination",
            },
            {
              model: Transit,
              as: "Transits",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
          ],
        },

        {
          model: SubSchedule,
          as: "subSchedule",

          include: [
            {
              model: Destination,
              as: "DestinationFrom",
            },
            {
              model: Schedule,
              as: "Schedule",
              attributes: [
                "id",
                "arrival_time",
                "departure_time",
                "journey_time",
              ],
            },
            {
              model: Destination,
              as: "DestinationTo",
            },
            {
              model: Transit,
              as: "TransitFrom",

              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Transit,
              as: "TransitTo",

              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Transit,
              as: "Transit1",

              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Transit,
              as: "Transit2",

              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Transit,
              as: "Transit3",

              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
            {
              model: Transit,
              as: "Transit4",

              include: [
                {
                  model: Destination,
                  as: "Destination",
                },
              ],
            },
          ],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
        },
        {
          model: Passenger,
          as: "passengers",
        },
        {
          model: TransportBooking,
          as: "transportBookings",
          include: [
            {
              model: Transport,
              as: "transport",
            },
          ],
        },
        {
          model: Agent,
          as: "Agent",
        },
      ],
    });
    if (booking) {
      res.status(200).json(booking);
    } else {
      console.log("Booking not found:", req.params.ticket_id);
      res.status(404).json({ error: "Booking not found" });
    }
  } catch (error) {
    console.log("Error retrieving booking:", error.message);
    res.status(400).json({ error: error.message });
  }
};

const getRelatedBookingsByTicketId = async (req, res) => {
  try {
    const { ticket_id } = req.params;

    console.log("Processing ticket ID:", ticket_id);

    // 1️⃣ Ambil prefix dari ticket_id (contoh: "GG-RT-8867")
    const prefix = ticket_id.slice(0, -2); // Menghapus dua digit terakhir
    const regexPattern = `${prefix}%`; // Pattern wildcard untuk SQL

    // 2️⃣ Cari dua booking dengan ticket_id yang mirip
    const bookings = await Booking.findAll({
      where: {
        ticket_id: { [Op.like]: regexPattern }, // Cari semua tiket dengan prefix yang sama
      },
      include: [
        {
          model: Schedule,
          as: "schedule",
          include: [
            { model: Boat, as: "Boat" },
            {
              model: Transit,
              as: "Transits",
              include: [{ model: Destination, as: "Destination" }],
            },
            { model: Destination, as: "FromDestination" },
            { model: Destination, as: "ToDestination" },
          ],
        },
        {
          model: SubSchedule,
          as: "subSchedule",
          include: [
            { model: Destination, as: "DestinationFrom" },
            {
              model: Schedule,
              as: "Schedule",
              attributes: [
                "id",
                "arrival_time",
                "departure_time",
                "journey_time",
              ],
            },
            { model: Destination, as: "DestinationTo" },
            {
              model: Transit,
              as: "TransitFrom",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "TransitTo",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit1",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit2",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit3",
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit4",
              include: [{ model: Destination, as: "Destination" }],
            },
          ],
        },
        { model: SeatAvailability, as: "SeatAvailabilities" },
        { model: Passenger, as: "passengers" },
        {
          model: TransportBooking,
          as: "transportBookings",
          include: [{ model: Transport, as: "transport" }],
        },
        { model: Agent, as: "Agent" },
      ],
      order: [["id", "ASC"]], // Urutkan dari ID terkecil ke terbesar
      limit: 2, // Ambil maksimum 2 data
    });

    console.log("Bookings found:", bookings.length);

    if (bookings.length === 0) {
      console.log("❌ No related bookings found.");
      return res.status(404).json({ error: "No related bookings found" });
    }

    if (bookings.length === 1) {
      console.log("⚠️ Only one booking found. Returning single ticket.");
      return res
        .status(200)
        .json({ message: "Only one booking found", bookings });
    }

    // 3️⃣ Validasi apakah kedua booking.id memiliki selisih 1 angka (misal: 1439-1438)
    const bookingIds = bookings.map((b) => b.id).sort((a, b) => b - a);
    if (Math.abs(bookingIds[0] - bookingIds[1]) !== 1) {
      console.log(
        "⚠️ Booking IDs are not sequential. Returning only the first booking."
      );
      return res
        .status(200)
        .json({
          message: "Booking IDs are not sequential",
          bookings: [bookings[0]],
        });
    }

    // 4️⃣ Cek apakah booking[0].ticket_id atau booking[1].ticket_id cocok dengan ticket_id yang diberikan
    const validMatch = bookings.some((b) => b.ticket_id === ticket_id);
    if (!validMatch) {
      console.log(
        "❌ Ticket IDs do not match the provided ticket_id. Returning error."
      );
      return res
        .status(400)
        .json({ error: "Ticket IDs do not match the provided ticket_id" });
    }

    console.log("✅ Successfully retrieved related bookings.");
    return res
      .status(200)
      .json({
        message: "Round-trip bookings found",
        bookings: [bookings[0], bookings[1]],
      });
  } catch (error) {
    console.error("❌ Error retrieving related bookings:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateBookingNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    await booking.update({ note });
    return res
      .status(200)
      .json({ message: "Booking notes updated successfully" });
  } catch (error) {
    console.error("Error updating booking notes:", error);
    return res.status(500).json({ error: "Failed to update booking notes" });
  }
};

const createBooking = async (req, res) => {
  try {
    const result = await sequelize.transaction(async (t) => {
      // Create booking
      const booking = await Booking.create(req.body, { transaction: t });

      console.log("Booking data from body:", req.body);

      // Fetch schedule
      const schedule = await Schedule.findByPk(req.body.schedule_id, {
        transaction: t,
      });
      if (!schedule) {
        throw new Error(`Schedule with ID ${req.body.schedule_id} not found.`);
      }

      if (schedule.available_seats < req.body.total_passengers) {
        throw new Error("Not enough seats available on the schedule.");
      }

      // Update schedule available seats
      await schedule.update(
        {
          available_seats: schedule.available_seats - req.body.total_passengers,
        },
        { transaction: t }
      );

      // Check and update each transit, and create booking-transit associations
      for (const transit_id of req.body.transits) {
        const transit = await Transit.findByPk(transit_id, { transaction: t });
        if (!transit) {
          throw new Error(`Transit with ID ${transit_id} not found.`);
        }

        if (transit.available_seats < req.body.total_passengers) {
          throw new Error(
            `Not enough seats available on transit with ID ${transit_id}.`
          );
        }

        // Update transit available seats
        await transit.update(
          {
            available_seats:
              transit.available_seats - req.body.total_passengers,
          },
          { transaction: t }
        );

        // Create booking-transit association
        await booking.addTransit(transit, { transaction: t });
      }

      console.log("Booking created:", booking);
      return booking;
    });

    res.status(201).json(result);
  } catch (error) {
    console.log("Error creating booking:", error.message);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Update a booking
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The updated booking object
 */
const updateBooking = async (req, res) => {
  // Get the booking ID from the request parameters
  const { id } = req.params;
  // Get the new schedule ID, transit ID, and total passengers from the request body
  const { schedule_id, transit_id, total_passengers } = req.body;

  try {
    // Start a database transaction
    await sequelize.transaction(async (t) => {
      // Find the booking with the given ID
      const booking = await Booking.findByPk(id, { transaction: t });
      // If the booking is not found, throw an error
      if (!booking) {
        throw new Error("Booking not found.");
      }

      // Get the old schedule ID, old total passengers, and old transit ID from the booking
      const {
        schedule_id: old_schedule_id,
        total_passengers: old_total_passengers,
        transit_id: old_transit_id,
      } = booking;

      // Find the old schedule and update its available seats
      const oldSchedule = await Schedule.findByPk(old_schedule_id, {
        transaction: t,
      });
      await oldSchedule.update(
        { available_seats: oldSchedule.available_seats + old_total_passengers },
        { transaction: t }
      );

      // Find the old transit and update its available seats
      const oldTransit = await Transit.findByPk(old_transit_id, {
        transaction: t,
      });
      await oldTransit.update(
        { available_seats: oldTransit.available_seats + old_total_passengers },
        { transaction: t }
      );

      // Find the new schedule and check its available seats
      const newSchedule = await Schedule.findByPk(schedule_id, {
        transaction: t,
      });
      if (newSchedule.available_seats < total_passengers) {
        throw new Error("Not enough seats available on the new schedule.");
      }
      // Update the new schedule's available seats
      await newSchedule.update(
        { available_seats: newSchedule.available_seats - total_passengers },
        { transaction: t }
      );

      // Find the new transit and check its available seats
      const newTransit = await Transit.findByPk(transit_id, { transaction: t });
      if (newTransit.available_seats < total_passengers) {
        throw new Error(
          `Not enough seats available on new transit with ID ${transit_id}.`
        );
      }
      // Update the new transit's available seats
      await newTransit.update(
        { available_seats: newTransit.available_seats - total_passengers },
        { transaction: t }
      );

      // Update the booking with the new schedule ID, transit ID, and total passengers
      await booking.update(req.body, { transaction: t });

      // Log the updated booking and return it in the response
      console.log("Booking updated:", booking);
      res.status(200).json(booking);
    });
  } catch (error) {
    // Log the error and return it in the response
    console.log("Error updating booking:", error.message);
    res.status(400).json({ error: error.message });
  }
};

const updateMultipleBookingPayment = async (req, res) => {
  try {
    console.log("\n🚐 Processing multiple booking payment updates...");
    const { booking_ids, payment_status, payment_method } = req.body;
    console.log("Received IDs:", booking_ids, "Status:", payment_status, "Method:", payment_method);

    const results = await Promise.allSettled(
      booking_ids.map(async (booking_id) => {
        try {
          const booking = await Booking.findByPk(booking_id);
          if (!booking) {
            console.log(`Booking ID ${booking_id} not found`);
            return { success: false, id: booking_id, error: "Booking not found" };
          }
          
          await booking.update({ payment_status, payment_method });
          console.log(`Successfully updated booking ID ${booking_id}`);
          return { success: true, id: booking_id, booking };
        } catch (err) {
          console.error(`Error updating booking ID ${booking_id}:`, err.message);
          return { success: false, id: booking_id, error: err.message };
        }
      })
    );

    const updatedBookings = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value.booking);
    
    const failedUpdates = results
      .filter(result => result.status === 'rejected' || !result.value.success)
      .map(result => result.status === 'rejected' ? result.reason : result.value);

    if (failedUpdates.length > 0) {
      console.log("Some bookings failed to update:", failedUpdates);
    }

    res.status(200).json({ 
      updated: updatedBookings,
      failed: failedUpdates,
      message: failedUpdates.length > 0 
        ? `Updated ${updatedBookings.length} bookings, ${failedUpdates.length} failed` 
        : `Successfully updated all ${updatedBookings.length} bookings`
    });
  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(400).json({ error: error.message });
  }
};
const updateBookingPayment = async (req, res) => {
  const { id } = req.params;
  const { payment_method, payment_status } = req.body;

  try {
    await sequelize.transaction(async (t) => {
      console.log("\n🔍 Finding booking details...");
      const booking = await Booking.findByPk(id, {
        include: [{ model: Transaction, as: "transactions" }],
        transaction: t,
      });

      if (!booking) {
        console.log("❌ Booking not found");
        throw new Error("Booking not found");
      }

      // Check if payment details need an update
      if (payment_method || payment_status) {
        console.log("\n🔄 Updating payment details...");
        const data = {};
        if (payment_method) data.payment_method = payment_method;
        if (payment_status) data.payment_status = payment_status;

        await booking.update(data, { transaction: t });
        console.log("✅ Payment details updated successfully");

        // Send email notification

        console.log(
          "\n📧 Sending email notification...",
          booking.contact_email
        );
        if (booking.contact_email) {
          sendPaymentEmail(
            booking.contact_email,
            booking,
            payment_method,
            payment_status
          );
        }

        return res.status(200).json({
          message: "Payment details updated successfully",
          data: booking,
        });
      }

      // Handle refund cases
      if (payment_status === "refund_50" || payment_status === "refund_100") {
        const refundPercentage = payment_status === "refund_50" ? 0.5 : 1;
        const refundAmount = booking.gross_total * refundPercentage;
        const refundAmountUSD = booking.gross_total_in_usd
          ? booking.gross_total_in_usd * refundPercentage
          : null;

        console.log("\n📊 Refund Calculations:");
        console.log(`- Refund Percentage: ${refundPercentage * 100}%`);
        console.log(`- Refund Amount: ${refundAmount} ${booking.currency}`);
        if (refundAmountUSD !== null) {
          console.log(`- Refund Amount USD: $${refundAmountUSD}`);
        }

        const newGrossTotal = booking.gross_total - refundAmount;
        const newGrossTotalUSD = booking.gross_total_in_usd
          ? booking.gross_total_in_usd - refundAmountUSD
          : null;

        console.log("\n🔄 Updating booking with refund details...");
        await booking.update(
          {
            payment_status,
            gross_total: newGrossTotal,
            gross_total_in_usd: newGrossTotalUSD,
          },
          { transaction: t }
        );
        console.log("✅ Refund processed successfully");

        console.log("\n🪑 Processing seat release...");
        const releasedSeatIds = await releaseSeats(booking, t);
        console.log(
          `✅ Released seats: ${
            releasedSeatIds.length > 0 ? releasedSeatIds.join(", ") : "None"
          }`
        );

        console.log(
          "\n✅ Refund process completed successfully",
          booking.customer_email
        );
        // Send refund email notification
        if (booking.contact_email) {
          console.log("\n📧 Sending  email...");
          sendPaymentEmail(
            booking.contact_email,
            booking,
            payment_method,
            payment_status,
            refundAmount,
            refundAmountUSD
          );
        }

        return res.status(200).json({
          message: `${
            payment_status === "refund_50" ? "50%" : "Full"
          } refund processed successfully`,
          data: {
            booking_id: booking.id,
            refund_amount: refundAmount,
            refund_amount_usd: refundAmountUSD,
            new_gross_total: newGrossTotal,
            new_gross_total_usd: newGrossTotalUSD,
            new_payment_status: payment_status,
            released_seats: releasedSeatIds,
          },
        });
      }

      // Handle other payment status updates
      console.log("\n🔄 Updating payment status...");
      await booking.update({ payment_status }, { transaction: t });
      console.log("✅ Payment status updated successfully");

      // Send email notification
      if (booking.contact_email) {
        sendPaymentEmail(
          booking.contact_email,
          booking,
          payment_method,
          payment_status
        );
      }

      return res.status(200).json({
        message: "Payment status updated successfully",
        data: booking,
      });
    });
  } catch (error) {
    console.error("\n❌ Error in updateBookingPayment:", error);
    return res.status(400).json({
      error: error.message,
      details: "Failed to process payment update",
    });
  }
};



const updateBookingDate = async (req, res) => {
  const { id } = req.params;
  const { booking_date } = req.body;
  const { booking } = req.bookingDetails; // Assuming booking contains necessary info, including user email

  console.log("booking", booking);

  try {
    await sequelize.transaction(async (t) => {
      console.log("\n=== Starting Booking Date Update Process ===");

      const originalBookingDate = booking.booking_date;

      // Cek apakah tanggal baru sama dengan yang lama
      if (originalBookingDate === booking_date) {
        return res.status(400).json({
          error: "New booking date is the same as current booking date",
        });
      }

      // 1. Lepaskan kursi dari tanggal sebelumnya
      console.log("\n🔄 Releasing seats from previous date...");
      try {
        const releasedSeatIds = await releaseSeats(booking, t);
        console.log("✅ Successfully released seats for IDs:", releasedSeatIds);
      } catch (error) {
        console.error("❌ Error releasing seats:", error);
        throw new Error(`Failed to release seats: ${error.message}`);
      }

      // 2. Hapus BookingSeatAvailability lama sebelum update booking_date
      console.log("\n🗑️ Removing old BookingSeatAvailabilities...");
      await BookingSeatAvailability.destroy({
        where: { booking_id: booking.id },
        transaction: t,
      });
      console.log("✅ Old BookingSeatAvailabilities removed");

      // 3. Update booking date
      console.log("\n📅 Updating booking date...");
      await booking.update({ booking_date }, { transaction: t });
      console.log("✅ Booking date updated successfully");

      // 4. Buat atau perbarui seat availability untuk tanggal baru
      console.log("\n🔄 Creating new seat availabilities...");
      let remainingSeatAvailabilities;

      if (booking.subschedule_id) {
        remainingSeatAvailabilities = await handleSubScheduleBooking(
          booking.schedule_id,
          booking.subschedule_id,
          booking_date,
          booking.total_passengers,
          null,
          t
        );
      } else {
        remainingSeatAvailabilities = await handleMainScheduleBooking(
          booking.schedule_id,
          booking_date,
          booking.total_passengers,
          t
        );
      }

      console.log(
        "✅ New seat availabilities created successfully:",
        remainingSeatAvailabilities.map((sa) => ({
          id: sa.id,
          schedule_id: sa.schedule_id,
          subschedule_id: sa.subschedule_id,
          available_seats: sa.available_seats,
        }))
      );

      // 5. Buat ulang BookingSeatAvailability dengan seat_availability yang baru
      console.log("\n🔄 Creating new BookingSeatAvailabilities...");
      for (const seatAvailability of remainingSeatAvailabilities) {
        await BookingSeatAvailability.create(
          {
            booking_id: booking.id,
            seat_availability_id: seatAvailability.id,
          },
          { transaction: t }
        );
      }
      console.log("✅ New BookingSeatAvailabilities created successfully");

      console.log("\n=== Booking Date Update Process Completed ===");

      // 6. Kirim email notifikasi setelah transaksi sukses
      console.log("\n📧 Sending email notification...", booking.contact_email);
      if (booking.contact_email) {
        sendEmailNotification(
          booking.contact_email,
          booking.ticket_id,
          originalBookingDate,
          booking_date
        );
      }

      // 7. Response ke client
      res.status(200).json({
        message: "Booking date updated successfully",
        booking: {
          id: booking.id,
          new_date: booking_date,
          previous_date: originalBookingDate,
          affected_seat_availabilities: remainingSeatAvailabilities.map(
            (sa) => sa.id
          ),
        },
      });
    });
  } catch (error) {
    console.error("\n❌ Error in updateBookingDate:", error);
    res.status(400).json({
      error: "Failed to update booking date",
      details: error.message,
    });
  }
};

const updateBookingDateAgent = async (req, res) => {
  const { booking_id } = req.params; // Booking ID from URL params
  const { booking_date } = req.body; // New booking date from body

  const id = booking_id;

  try {
    await sequelize.transaction(async (t) => {
      console.log("\n=== Starting Booking Date Update Process ===");

      // 1. Find booking by ID
      // const booking = await Booking.findByPk(id, {
      //   include: [
      //     {
      //       model: Agent,
      //       as: 'Agent'
      //     },
      //     {
      //       model: BookingSeatAvailability, // Pastikan booking mencakup seat availability yang terkait
      //       as: 'BookingSeatAvailabilities'
      //     }
      //   ],
      //   transaction: t
      // });

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Agent,
            as: "Agent",
          },
        ],
        transaction: t,
      });

      if (!booking) {
        return res.status(404).json({
          error: "Booking not found",
        });
      }

      // Separately fetch the BookingSeatAvailabilities
      const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
        where: { booking_id: booking.id },
        include: [
          {
            model: SeatAvailability,
            as: "SeatAvailability",
          },
        ],
        transaction: t,
      });

      booking.BookingSeatAvailabilities = bookingSeatAvailabilities;

      if (!booking) {
        return res.status(404).json({
          error: "Booking not found",
        });
      }

      const originalBookingDate = booking.booking_date;
      console.log("Original booking date:", originalBookingDate);
      console.log("New booking date:", booking_date);

      // 2. Check if new date is the same as the old date
      if (
        originalBookingDate &&
        booking_date &&
        new Date(originalBookingDate).getTime() ===
          new Date(booking_date).getTime()
      ) {
        return res.status(400).json({
          error: "New booking date is the same as current booking date",
        });
      }

      // 3. Release seats from previous date
      console.log("\n🔄 Releasing seats from previous date...");
      try {
        const releasedSeatIds = await releaseSeats(booking, t);
        console.log("✅ Successfully released seats for IDs:", releasedSeatIds);
      } catch (error) {
        console.error("❌ Error releasing seats:", error);
        throw new Error(`Failed to release seats: ${error.message}`);
      }

      // 4. Hapus BookingSeatAvailabilities lama
      console.log("\n🗑️ Removing old BookingSeatAvailabilities...");
      await BookingSeatAvailability.destroy({
        where: { booking_id: booking.id },
        transaction: t,
      });
      console.log("✅ Old BookingSeatAvailabilities removed");

      // 5. Update booking date
      console.log("\n📅 Updating booking date...");
      await booking.update({ booking_date }, { transaction: t });
      console.log("✅ Booking date updated successfully");

      // 6. Create/update seat availabilities for the new date
      console.log("\n🔄 Creating new seat availabilities...");
      let remainingSeatAvailabilities;

      if (booking.subschedule_id) {
        console.log(
          `Processing sub-schedule booking for subschedule_id ${booking.subschedule_id}`
        );
        remainingSeatAvailabilities = await handleSubScheduleBooking(
          booking.schedule_id,
          booking.subschedule_id,
          booking_date,
          booking.total_passengers,
          null,
          t
        );
      } else {
        console.log(
          `Processing main schedule booking for schedule_id ${booking.schedule_id}`
        );
        remainingSeatAvailabilities = await handleMainScheduleBooking(
          booking.schedule_id,
          booking_date,
          booking.total_passengers,
          t
        );
      }

      console.log(
        "✅ New seat availabilities created successfully:",
        remainingSeatAvailabilities.map((sa) => ({
          id: sa.id,
          schedule_id: sa.schedule_id,
          subschedule_id: sa.subschedule_id,
          available_seats: sa.available_seats,
        }))
      );

      // 7. Buat ulang BookingSeatAvailabilities dengan seat_availability yang baru
      console.log("\n🔄 Creating new BookingSeatAvailabilities...");
      for (const seatAvailability of remainingSeatAvailabilities) {
        await BookingSeatAvailability.create(
          {
            booking_id: booking.id,
            seat_availability_id: seatAvailability.id,
          },
          { transaction: t }
        );
      }
      console.log("✅ New BookingSeatAvailabilities created successfully");

      console.log("\n=== Booking Date Update Process Completed ===");

      // 8. Send email notification to agent/customer
      if (booking.contact_email) {
        sendEmailNotification(
          booking.contact_email,
          booking.ticket_id,
          originalBookingDate,
          booking_date,
          booking.Agent.email
        );
      }

      // 9. Return success response
      return res.status(200).json({
        message: "Booking date updated successfully",
        booking: {
          id: booking.id,
          new_date: booking_date,
          previous_date: originalBookingDate,
          affected_seat_availabilities: remainingSeatAvailabilities.map(
            (sa) => sa.id
          ),
        },
      });
    }); // End of transaction
  } catch (error) {
    console.error("\n❌ Error in updateBookingDateAgent:", error);
    return res.status(400).json({
      error: "Failed to update booking date",
      details: error.message,
    });
  }
};

const deleteBooking = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const bookingId = req.params.id;

    // Step 1: Fetch the booking details based on the provided ID
    const booking = await Booking.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      // If the booking is not found, return a 404 error
      return res.status(404).json({
        success: false,
        message: `Booking with ID ${bookingId} not found.`,
      });
    }

    // Retrieve booking details
    const { booking_date, transport_id } = booking;

    // Step 2: Check and delete related records in Transactions
    console.log("\n🔍 Checking and deleting related Transactions...");
    const transactions = await Transaction.findAll({
      where: { booking_id: bookingId },
    });

    if (transactions.length > 0) {
      const transactionIds = transactions.map((transaction) => transaction.id);
      console.log("🔄 Deleting related Transactions records:", transactionIds);

      await Transaction.destroy({
        where: { booking_id: bookingId },
        transaction,
      });

      console.log("✅ Successfully deleted related Transactions records.");
    } else {
      console.log("✅ No related Transactions found.");
    }

    // Step 3: Check and delete related records in Passengers
    console.log("\n🔍 Checking and deleting related Passengers...");
    const passengers = await Passenger.findAll({
      where: { booking_id: bookingId },
    });

    if (passengers.length > 0) {
      const passengerIds = passengers.map((passenger) => passenger.id);
      console.log("🔄 Deleting related Passengers records:", passengerIds);

      await Passenger.destroy({
        where: { booking_id: bookingId },
        transaction,
      });

      console.log("✅ Successfully deleted related Passengers records.");
    } else {
      console.log("✅ No related Passengers found.");
    }

    // Step 4: Check and delete related records in BookingSeatAvailability
    console.log(
      "\n🔍 Checking and deleting related BookingSeatAvailability..."
    );
    const relatedRecords = await BookingSeatAvailability.findAll({
      where: { booking_id: bookingId },
    });

    if (relatedRecords.length > 0) {
      const relatedIds = relatedRecords.map((record) => record.id);
      console.log(
        "🔄 Deleting related BookingSeatAvailability records:",
        relatedIds
      );

      await BookingSeatAvailability.destroy({
        where: { booking_id: bookingId },
        transaction,
      });

      console.log(
        "✅ Successfully deleted related BookingSeatAvailability records."
      );
    } else {
      console.log("✅ No related records found in BookingSeatAvailability.");
    }

    // Step 5: Release seats associated with the booking
    console.log("\n🔄 Releasing seats from current booking date...");
    try {
      const releasedSeatIds = await releaseSeats(booking, transaction);
      console.log("✅ Successfully released seats for IDs:", releasedSeatIds);
    } catch (error) {
      console.error("❌ Error releasing seats:", error);
      throw new Error(`Failed to release seats: ${error.message}`);
    }

    // Step 6: Delete the booking
    console.log(`\n🔄 Deleting booking with ID: ${bookingId}`);
    const deletedBooking = await Booking.destroy({
      where: { id: bookingId },
      transaction,
    });

    if (deletedBooking) {
      // Commit transaction if deletion is successful
      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: `Booking with ID ${bookingId} and associated records have been deleted successfully.`,
      });
    } else {
      // Rollback transaction if deletion failed
      await transaction.rollback();

      return res.status(500).json({
        success: false,
        message: `Failed to delete booking with ID ${bookingId}.`,
      });
    }
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.error(
      `Error deleting booking with ID ${req.params.id}:`,
      error.message
    );

    return res.status(500).json({
      success: false,
      message: `An error occurred while deleting booking with ID ${req.params.id}: ${error.message}`,
    });
  }
};

const createBookingWithoutTransit = async (req, res) => {
  const {
    schedule_id,
    total_passengers,
    booking_date,
    passengers,
    agent_id,
    gross_total,
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
  } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      console.log("Creating booking...");
      // Create booking
      const booking = await Booking.create(
        {
          schedule_id,
          total_passengers,
          booking_date,
          agent_id,
          gross_total,
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
        },
        { transaction: t }
      );
      console.log("Booking created:", booking);

      // Find seat availability for the schedule and date
      let seatAvailability = await SeatAvailability.findOne({
        where: {
          schedule_id,
          date: booking_date,
        },
        transaction: t,
      });

      if (!seatAvailability) {
        console.log("Seat availability not found, creating new entry...");
        // Fetch schedule to get initial available seats
        const schedule = await Schedule.findByPk(schedule_id, {
          include: {
            model: Boat,
            as: "Boat",
            attributes: ["capacity"],
          },
          transaction: t,
        });

        if (!schedule) {
          throw new Error(`Schedule with ID ${schedule_id} not found.`);
        }

        // Create initial seat availability entry using boat capacity
        seatAvailability = await SeatAvailability.create(
          {
            schedule_id,
            available_seats: schedule.Boat.capacity,
            date: booking_date,
            availability: true, // Ensure availability is set to true by default
          },
          { transaction: t }
        );
        console.log("Seat availability created:", seatAvailability);
      }

      if (payment_status === "paid") {
        console.log("Checking available seats...");
        if (seatAvailability.available_seats < total_passengers) {
          throw new Error("Not enough seats available on the schedule.");
        }

        console.log("Updating seat availability...");
        // Update seat availability
        await seatAvailability.update(
          {
            available_seats:
              seatAvailability.available_seats - total_passengers,
          },
          { transaction: t }
        );
        console.log("Seat availability updated:", seatAvailability);
      }

      console.log("Adding passengers in batch...");
      // Add passengers in batch
      const passengerData = passengers.map((passenger) => ({
        booking_id: booking.id,
        ...passenger,
      }));
      await Passenger.bulkCreate(passengerData, { transaction: t });
      console.log("Passengers added:", passengerData);

      console.log("Adding transports in batch...");
      // Add transports in batch
      const transportData = transports.map((transport) => ({
        booking_id: booking.id,
        transport_id: transport.transport_id,
        quantity: transport.quantity,
        transport_price: transport.transport_price, // Include transport price
        transport_type: transport.transport_type,
        note: transport.note,
      }));
      await TransportBooking.bulkCreate(transportData, { transaction: t });
      console.log("Transports added:", transportData);

      console.log("Updating agent metrics if agent_id is present...");
      // Update agent metrics if agent_id is present
      if (agent_id) {
        await updateAgentMetrics(
          agent_id,
          gross_total,
          total_passengers,
          payment_status,
          t
        );
        console.log("Agent metrics updated for agent_id:", agent_id);
      }

      console.log("Linking booking with seat availability...");

      // Link booking with seat availability
      const bookingSeatAvailability = await BookingSeatAvailability.create(
        {
          booking_id: booking.id,
          seat_availability_id: seatAvailability.id,
        },
        { transaction: t }
      );
      console.log(
        "Booking linked with seat availability:",
        bookingSeatAvailability
      );

      console.log(
        "Returning the created booking along with transport bookings and seat availability..."
      );
      // Return the created booking along with transport bookings and seat availability
      const transportBookings = await TransportBooking.findAll({
        where: { booking_id: booking.id },
        transaction: t,
      });
      return {
        booking,
        transportBookings,
        seatAvailability,
        bookingSeatAvailability,
      };
    });

    res.status(201).json(result);
  } catch (error) {
    console.log("Error creating booking:", error.message);
    res.status(400).json({ error: error.message });
  }
};
const createBookingWithTransit = async (req, res) => {
  const {
    schedule_id,
    subschedule_id,
    total_passengers,
    booking_date,
    passengers,
    agent_id,
    gross_total,
    payment_status,
    transports,
    contact_name,
    contact_phone,
    contact_passport_id,
    contact_nationality,
    contact_email,
    payment_method,
    payment_gateway,
    booking_source,
    adult_passengers,
    child_passengers,
    infant_passengers,
    ticket_id,
    transit_details,
    transaction_type,
    currency,
    gross_amount_in_usd,
    exchange_rate,
  } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // Calculate expiration time (n minutes after booking_date)
      const expirationTimeMinutes = process.env.EXPIRATION_TIME_MINUTES || 30;
      const bookingDateTime = new Date();
      const expirationTime = new Date(
        bookingDateTime.getTime() + expirationTimeMinutes * 60000
      );

      // Step 1: Create the Booking
      const booking = await Booking.create(
        {
          schedule_id,
          subschedule_id,
          total_passengers,
          booking_date,
          agent_id,
          gross_total,
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
          expiration_time: expirationTime,
        },
        { transaction: t }
      );

      console.log(`Booking created with ID: ${booking.id}`);

      // Step 2: Handle Seat Availability
      let remainingSeatAvailabilities;
      if (subschedule_id) {
        remainingSeatAvailabilities = await handleSubScheduleBooking(
          schedule_id,
          subschedule_id,
          booking_date,
          total_passengers,
          transit_details,
          t
        );
        console.log(
          `Seat availability handled for sub-schedule ID: ${subschedule_id}`
        );
      } else {
        remainingSeatAvailabilities = await handleMainScheduleBooking(
          schedule_id,
          booking_date,
          total_passengers,
          t
        );
        console.log(
          `Seat availability handled for main schedule ID: ${schedule_id}`
        );
      }

      // Step 3: Add Passengers
      await addPassengers(passengers, booking.id, t);
      console.log(`Passengers added for booking ID: ${booking.id}`);

      // Step 4: Add Transport Bookings
      await addTransportBookings(transports, booking.id, total_passengers, t);
      console.log(`Transport bookings added for booking ID: ${booking.id}`);

      // Step 5: Update Agent Metrics
      if (agent_id && payment_status === "paid") {
        await updateAgentMetrics(
          agent_id,
          gross_total,
          total_passengers,
          payment_status,
          t
        );
        console.log(`Agent metrics updated for agent ID: ${agent_id}`);
      }

      // Step 6: Create a Transaction Entry
      const transaction = await createTransaction(
        {
          transaction_id: `TRANS-${Date.now()}`, // Unique transaction ID
          payment_method,
          payment_gateway,
          amount: gross_total,
          currency,
          transaction_type,
          booking_id: booking.id,
        },
        t
      );
      console.log(`Transaction created for booking ID: ${booking.id}`);

      // Step 7: Link Seat Availability
      if (
        remainingSeatAvailabilities &&
        remainingSeatAvailabilities.length > 0
      ) {
        const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(
          (sa) => ({
            booking_id: booking.id,
            seat_availability_id: sa.id,
          })
        );
        await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, {
          transaction: t,
        });
        console.log(`Linked seat availability to booking ID: ${booking.id}`);
      }

      // Step 8: Fetch Transport Bookings
      const transportBookings = await TransportBooking.findAll({
        where: { booking_id: booking.id },
        transaction: t,
      });
      console.log(`Fetched transport bookings for booking ID: ${booking.id}`);

      // Step 9: Return the result
      res.status(201).json({
        booking,
        transaction, // Return the created transaction
        remainingSeatAvailabilities,
        transportBookings,
      });
    });
  } catch (error) {
    console.log("Error:", error.message);
    res.status(400).json({ error: error.message });
  }
};

const cancelBooking = async (req, res) => {
  const { booking_id } = req.params;

  const id = booking_id;

  console.log("\n=== Starting Booking Cancellation Process ===");
  console.log("📝 Request Details:");
  console.log(`- Booking ID: ${id}`);

  try {
    await sequelize.transaction(async (t) => {
      // 1. Cari booking
      console.log("\n🔍 Finding booking details...");
      const booking = await Booking.findByPk(id, { transaction: t });

      if (!booking) {
        console.log("❌ Booking not found");
        throw new Error("Booking not found");
      }

      // Cek apakah sudah cancelled sebelumnya (opsional)
      if (booking.payment_status === "cancelled") {
        console.log("⚠️ Booking already cancelled");
        return res.status(400).json({
          error: "Booking is already cancelled",
        });
      }

      // 2. Lepaskan seat yang sudah terlanjur di-reserve
      console.log("\n🪑 Releasing seats for the booking...");
      const releasedSeatIds = await releaseSeats(booking, t);
      console.log(
        `✅ Released seats: ${
          releasedSeatIds.length > 0 ? releasedSeatIds.join(", ") : "None"
        }`
      );

      // 3. Update payment_status menjadi 'cancelled'
      //    (Opsional: set gross_total = 0, dsb. jika ada kebijakan refund total)
      console.log("\n🔄 Updating booking to cancelled status...");
      await booking.update(
        {
          payment_status: "cancelled",
          // gross_total: 0,        // <-- jika perlu set total = 0
          // gross_total_in_usd: 0, // <-- jika perlu set total USD = 0
        },
        { transaction: t }
      );
      console.log("✅ Booking successfully cancelled");

      // 4. Return response sukses
      return res.status(200).json({
        message: "Booking cancelled successfully",
        data: {
          booking_id: booking.id,
          new_payment_status: booking.payment_status,
          released_seats: releasedSeatIds,
        },
      });
    }); // end of transaction
  } catch (error) {
    console.error("\n❌ Error in cancelBooking:", error);
    return res.status(400).json({
      error: error.message || "Failed to cancel booking",
      details: "Cancellation process encountered an error",
    });
  }
};

const updateMultipleBookingStatus
  = async (req, res) => {
    try {
      const { booking_ids, payment_status } = req.body;

      const updatedBookings = await Promise.all(
        booking_ids.map(async (booking_id) => {
          const booking = await Booking.findByPk(booking_id);
          if (booking) {
            await booking.update({ payment_status });
            return booking;
          }
          return null;
        })
      );

      res.status(200).json({ message: 'Bookings updated successfully', updatedBookings });
    } catch (error) {
      console.error('Error updating bookings:', error);
      res.status(500).json({ error: 'Failed to update bookings' });
    }
  };

module.exports = {
  createBooking,
  updateMultipleBookingPayment,

  updateBookingNotes,
  createBookingMultiple,
  getBookingContact,
  getFilteredBookings,
  getBookings,
  getBookingById,
  updateBooking,
  getRelatedBookingsByTicketId,
  deleteBooking,
  createBookingWithTransit2,
  createBookingWithTransit,
  createBookingWithTransitQueue,
  createBookingWithoutTransit,
  getBookingByTicketId,
  updateBookingPayment,
  updateBookingDate,
  getBookingsByDate,
  updateBookingDateAgent,
  cancelBooking,
  findRelatedSubSchedulesGet,
  createRoundBookingWithTransitQueue,
};

