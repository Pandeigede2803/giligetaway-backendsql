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

const { Op } = require("sequelize");
const { updateAgentMetrics } = require("../util/updateAgentMetrics");
const { addTransportBookings, addPassengers } = require("../util/bookingUtil");
const handleMainScheduleBooking = require("../util/handleMainScheduleBooking");
const releaseSeats = require('../util/releaseSeats'); // Adjust the path based on your project structure
const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");
const moment = require("moment"); // Use moment.js for date formatting
const cronJobs = require("../util/cronJobs");
const { createTransaction } = require("../util/transactionUtils");
const Queue = require("bull");
const bookingQueue = new Queue("bookingQueue"); // Inisialisasi Bull Queue
const bookingQueueMultiple = new Queue("bookingQueueMultiple");

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
            gross_total: totalAmount,
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
            amount: totalAmount,
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

// Proses bookingQueueMultiple

// bookingQueueMultiple.process(async (job, done) => {
//   const {
//     trips, // Array of { schedule_id, subschedule_id, booking_date }
//     total_passengers,
//     passengers,
//     transports,
//     transit_details,
//     booking_id,
//     agent_id,
//     gross_total,
//     payment_status,
//   } = job.data;

//   console.log("Transport details:", transports);
//   console.log("Passenger details:", passengers);
//   console.log("Trips details:", trips);

//   // Mulai transaksi
//   const transaction = await sequelize.transaction();
//   try {
//     console.log(
//       `Processing booking with ID: ${booking_id} for multiple trips...`
//     );

//     // Step 1: Handle Seat Availability untuk multiple trips (seat availability only processed here)
//     const seatAvailabilities = await handleMultipleSeatsBooking(
//       trips,
//       total_passengers,
//       transaction
//     );

//     console.log("Seat availability updated successfully.");

//     // Step 2: Add passengers using the addPassengers utility
//     if (passengers && passengers.length > 0) {
//       await addPassengers(passengers, booking_id, transaction); // Use the correct transaction variable
//       console.log(
//         `Passengers added successfully for booking ID: ${booking_id}`
//       );
//     }

//     // Step 3: Add transport bookings using the addTransportBookings utility
//     if (transports && transports.length > 0) {
//       await addTransportBookings(
//         transports,
//         booking_id,
//         total_passengers,
//         transaction
//       ); // Use the correct transaction variable
//       console.log(
//         `Transport bookings added successfully for booking ID: ${booking_id}`
//       );
//     }

//     // Step 4: Tambahkan seat availability ke table BookingSeatAvailability
//     const bookingSeatAvailabilityData = seatAvailabilities.map(
//       (seatAvailability) => ({
//         booking_id: booking_id,
//         seat_availability_id: seatAvailability.id,
//       })
//     );

//     if (bookingSeatAvailabilityData.length > 0) {
//       const result = await BookingSeatAvailability.bulkCreate(
//         bookingSeatAvailabilityData,
//         { transaction }
//       );
//       console.log(
//         ` BookingSeatAvailability records added successfully. Total records created: ${result.length}`
//       );

//       // Log the seat_availability_id for each created BookingSeatAvailability record
//       const seatAvailabilityIds = result.map(
//         (record) => record.seat_availability_id
//       );
//       console.log(
//         "Created BookingSeatAvailability entries with seat_availability_id values:",
//         seatAvailabilityIds
//       );
//     } else {
//       console.log("No seat availability data found to add.");
//     }

//     // Commit the transaction jika semua langkah berhasil
//     await transaction.commit();
//     console.log(
//       `Booking queue processed successfully for booking ${booking_id}`
//     );
//     done(); // Menandakan job selesai
//   } catch (error) {
//     // Rollback jika terjadi kesalahan
//     await transaction.rollback();
//     console.error(
//       `Error processing booking queue for booking ${booking_id}:`,
//       error.message
//     );
//     done(error); // Menandakan job gagal
//   }
// });

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
  const transaction = await sequelize.transaction();;
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
    transit_details,
    transaction_type,
    currency,
    gross_total_in_usd,
    exchange_rate,
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
          gross_total: totalAmount,
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
          amount: totalAmount,
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


// const createBookingWithTransitQueue = async (req, res) => {
//   console.log('\n=== Starting Booking Creation Process ===');
  
//   const {
//     schedule_id,
//     subschedule_id,
//     total_passengers,
//     booking_date,
//     passengers,
//     agent_id,
//     gross_total,
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
//     ticket_id,
//     transit_details,
//     transaction_type,
//     currency,
//     gross_total_in_usd,
//     exchange_rate,
//   } = req.body;

//   console.log('📝 Request Details:', {
//     ticket_id,
//     schedule_id,
//     booking_date,
//     total_passengers
//   });

//   try {
//     const result = await sequelize.transaction(async (t) => {
//       // Step 1: Validate seat availability
//       console.log('\n🔍 Validating seat availability...');
//       const seatAvailabilityResult = await validateSeatAvailabilitySingleTrip(
//         schedule_id,
//         subschedule_id,
//         booking_date,
//         total_passengers
//       );

//       if (!seatAvailabilityResult.success) {
//         console.log('❌ Seat availability check failed:', seatAvailabilityResult.message);
//         throw new Error(seatAvailabilityResult.message);
//       }
//       console.log('✅ Seat availability confirmed');

//       // Step 2: Calculate totals
//       console.log('\n💰 Calculating totals...');
//       let transportTotal = 0;
//       if (Array.isArray(transports) && transports.length > 0) {
//         transportTotal = transports.reduce(
//           (total, transport) => total + (parseFloat(transport.transport_price) * transport.quantity),
//           0
//         );
//         console.log(`Transport total calculated: ${transportTotal}`);
//       }

//       const totalAmount = parseFloat(ticket_total) + transportTotal;
//       console.log('📊 Final calculations:', {
//         ticket_total: parseFloat(ticket_total),
//         transportTotal,
//         totalAmount
//       });

//       // Step 3: Create booking record
//       console.log('\n📝 Creating booking record...');
//       const booking = await Booking.create({
//         schedule_id,
//         subschedule_id,
//         total_passengers,
//         booking_date,
//         agent_id,
//         gross_total: totalAmount,
//         gross_total_in_usd,
//         exchange_rate,
//         ticket_total: parseFloat(ticket_total),
//         payment_status,
//         contact_name,
//         contact_phone,
//         contact_passport_id,
//         contact_nationality,
//         contact_email,
//         payment_method,
//         booking_source,
//         adult_passengers,
//         child_passengers,
//         infant_passengers: infant_passengers || 0,
//         ticket_id,
//         expiration_time: new Date(Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000),
//         currency: currency || 'IDR'
//       }, { transaction: t });

//       console.log('✅ Booking created successfully:', booking.id);

//       // Step 4: Create initial transaction record
//       console.log('\n💳 Creating transaction record...');
//       const transactionEntry = await createTransaction({
//         transaction_id: `TRANS-${Date.now()}`,
//         payment_method,
//         payment_gateway: null,
//         amount: totalAmount,
//         currency: currency || 'IDR',
//         transaction_type: transaction_type || 'booking',
//         booking_id: booking.id,
//         status: 'pending'
//       }, t);

//       console.log('✅ Transaction record created:', transactionEntry.transaction_id);

//       // Step 5: Add to processing queue
//       console.log('\n🔄 Adding to processing queue...');
//       await bookingQueue.add({
//         schedule_id,
//         subschedule_id,
//         booking_date,
//         total_passengers,
//         passengers,
//         transports,
//         transit_details,
//         booking_id: booking.id,
//         agent_id,
//         gross_total: totalAmount,
//         payment_status
//       });

//       console.log('\n=== Booking Creation Process Completed ===');
      
//       // Return success response
//       return res.status(201).json({
//         message: 'Booking created successfully',
//         data: {
//           booking: {
//             id: booking.id,
//             ticket_id: booking.ticket_id,
//             total_amount: totalAmount,
//             currency: booking.currency,
//             expiration_time: booking.expiration_time
//           },
//           transaction: {
//             id: transactionEntry.transaction_id,
//             status: transactionEntry.status
//           },
//           status: 'processing'
//         }
//       });
//     });

//   } catch (error) {
//     console.error('\n❌ Error in booking creation:', error);

//     // Handle specific error types
//     if (error.name === 'SequelizeValidationError' || 
//         error.name === 'SequelizeUniqueConstraintError') {
//       return res.status(400).json({
//         error: 'Invalid input data',
//         details: error.message
//       });
//     }

//     if (error.message.includes('seat availability')) {
//       return res.status(400).json({
//         error: 'Seat availability error',
//         details: error.message
//       });
//     }

//     // Generic error response
//     return res.status(500).json({
//       error: 'Failed to create booking',
//       details: error.message
//     });
//   }
// };


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

    console.log("Remaining Seat Availabilities:", remainingSeatAvailabilities);

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

    // Step 5: Update Agent Metrics (only if payment is complete)
    // if (agent_id && payment_status === 'paid') {
    //   console.log(`Updating agent metrics for agent_id ${agent_id}`);
    //   await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, transaction);
    // }

    console.log("Remaining Seat Availabilities:", remainingSeatAvailabilities);
    console.log("Booking ID:", booking_id);

    // Step 6: Add remaining Seat Availabilities
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

      // Step 6: Add remaining Seat Availabilities to BookingSeatAvailability
      const result = await BookingSeatAvailability.bulkCreate(
        bookingSeatAvailabilityData,
        { transaction }
      );

      // Log the count of created BookingSeatAvailability records and their seat_availability_ids
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
        "id",
        "contact_name",
        "contact_phone",
        "contact_passport_id",
        "contact_nationality",
        "contact_email",
      ],
    });
    console.log("Contact list:", JSON.stringify(bookings, null, 2));
    res.status(200).json(bookings.map((b) => ({ id: b.id, ...b.dataValues })));
  } catch (error) {
    console.log("Error getting contact list:", error.message);
    res.status(400).json({ error: error.message });
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
    console.log("All bookings retrieved:", bookings);
    res.status(200).json(bookings);
  } catch (error) {
    console.log("Error retrieving bookings:", error.message);
    res.status(400).json({ error: error.message });
  }
};

const getFilteredBookings = async (req, res) => {
  try {
    // Ambil query parameter
    const { monthly, ticket_id, id } = req.query;

    // Filter data
    let dateFilter = {};

    // Prioritaskan filter berdasarkan `id` jika tersedia
    if (id) {
      dateFilter = { id }; // Filter berdasarkan `id`
    } else if (ticket_id) {
      // Jika `ticket_id` ada, abaikan filter lainnya
      dateFilter = { ticket_id };
    } else if (monthly) {
      // Jika `monthly` ada, filter berdasarkan bulan
      const [year, month] = monthly.split("-");
      if (!year || !month || isNaN(year) || isNaN(month)) {
        return res
          .status(400)
          .json({ error: "Invalid monthly filter format. Use YYYY-MM." });
      }

      dateFilter = {
        booking_date: {
          [Op.gte]: new Date(year, month - 1, 1), // Awal bulan
          [Op.lt]: new Date(year, month, 1), // Awal bulan berikutnya
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
            { model: Destination, as: "FromDestination" },
            { model: Destination, as: "ToDestination" },
          ],
        },
        {
            model:AgentCommission,
            as:'agentCommissions',

        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
          through: {
            model: BookingSeatAvailability,
            // attributes: ['id'] // Exclude attributes join table
          },
        },
        { model: Passenger, as: "passengers" },
        {
          model: TransportBooking,
          as: "transportBookings",
          include: [{ model: Transport, as: "transport" }],
        },
        {
          model: Agent,
          as: "Agent",
         
        },
      ],
    });

    // Respons data
    res.status(200).json({
      bookings,
      totalItems: bookings.length,
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
  try {
    const booking = await Booking.findOne({
      where: { ticket_id: req.params.ticket_id },
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
      console.log("Booking retrieved:", booking);
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

const updateBookingPayment = async (req, res) => {
  const { id } = req.params;
  const { payment_method, payment_status } = req.body;

  console.log('\n=== Starting Payment Update Process ===');
  console.log('📝 Request Details:');
  console.log(`- Booking ID: ${id}`);
  console.log(`- Payment Method: ${payment_method || 'Not provided'}`);
  console.log(`- Payment Status: ${payment_status || 'Not provided'}`);

  try {
    await sequelize.transaction(async (t) => {
      // Find booking with all necessary info
      console.log('\n🔍 Finding booking details...');
      const booking = await Booking.findByPk(id, {
        include: [{
          model: Transaction,
          as: 'transactions'
        }],
        transaction: t
      });

      if (!booking) {
        console.log('❌ Booking not found');
        throw new Error("Booking not found");
      }

      console.log('\n📊 Current Booking State:');
      console.log(`- Current Payment Status: ${booking.payment_status}`);
      console.log(`- Current Gross Total: ${booking.gross_total} ${booking.currency}`);
      console.log(`- Current Gross Total USD: ${booking.gross_total_in_usd || 'Not set'}`);
      console.log(`- Current Payment Method: ${booking.payment_method || 'Not set'}`);

      // Handle payment method update only
      if (payment_method && !payment_status) {
        console.log('\n🔄 Updating payment method only...');
        await booking.update({ payment_method }, { transaction: t });
        console.log('✅ Payment method updated successfully');
        return res.status(200).json({
          message: "Payment method updated successfully",
          data: booking
        });
      }

      // Handle refund cases
      if (payment_status === 'refund_50' || payment_status === 'refund_100') {
        console.log('\n💰 Processing Refund Request:');
        console.log(`- Refund Type: ${payment_status}`);
        
        // Calculate refund amounts
        const refundPercentage = payment_status === 'refund_50' ? 0.5 : 1;
        const refundAmount = booking.gross_total * refundPercentage;
        const refundAmountUSD = booking.gross_total_in_usd ? 
          booking.gross_total_in_usd * refundPercentage : null;

        console.log('\n📊 Refund Calculations:');
        console.log(`- Refund Percentage: ${refundPercentage * 100}%`);
        console.log(`- Original Amount: ${booking.gross_total} ${booking.currency}`);
        console.log(`- Refund Amount: ${refundAmount} ${booking.currency}`);
        if (booking.gross_total_in_usd) {
          console.log(`- Original Amount USD: $${booking.gross_total_in_usd}`);
          console.log(`- Refund Amount USD: $${refundAmountUSD}`);
        }

        // Calculate new totals
        const newGrossTotal = booking.gross_total - refundAmount;
        const newGrossTotalUSD = booking.gross_total_in_usd ? 
          booking.gross_total_in_usd - refundAmountUSD : null;

        console.log('\n📊 New Totals After Refund:');
        console.log(`- New Gross Total: ${newGrossTotal} ${booking.currency}`);
        if (newGrossTotalUSD !== null) {
          console.log(`- New Gross Total USD: $${newGrossTotalUSD}`);
        }

        // Update booking with refund
        console.log('\n🔄 Updating booking with refund details...');
        await booking.update({
          payment_status,
          gross_total: newGrossTotal,
          gross_total_in_usd: newGrossTotalUSD
        }, { transaction: t });
        console.log('✅ Booking updated successfully');

        // Release seats if needed
        console.log('\n🪑 Processing seat release...');
        const releasedSeatIds = await releaseSeats(booking, t);
        console.log(`✅ Released seats: ${releasedSeatIds.length > 0 ? releasedSeatIds.join(', ') : 'None'}`);

        console.log('\n✅ Refund process completed successfully');
        return res.status(200).json({
          message: `${payment_status === 'refund_50' ? '50%' : 'Full'} refund processed successfully`,
          data: {
            booking_id: booking.id,
            refund_amount: refundAmount,
            refund_amount_usd: refundAmountUSD,
            new_gross_total: newGrossTotal,
            new_gross_total_usd: newGrossTotalUSD,
            new_payment_status: payment_status,
            released_seats: releasedSeatIds
          }
        });
      }

      // Handle other payment status updates
      console.log('\n🔄 Updating payment status...');
      await booking.update({ payment_status }, { transaction: t });
      console.log('✅ Payment status updated successfully');
      
      return res.status(200).json({
        message: "Payment status updated successfully",
        data: booking
      });
    });

  } catch (error) {
    console.error('\n❌ Error in updateBookingPayment:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(400).json({
      error: error.message,
      details: 'Failed to process payment update'
    });
  }
};











const updateBookingDate = async (req, res) => {
  const { id } = req.params;
  const { booking_date } = req.body;
  const { booking } = req.bookingDetails;

  try {
    await sequelize.transaction(async (t) => {
      console.log('\n=== Starting Booking Date Update Process ===');
      
      // Store the original booking date before any updates
      const originalBookingDate = booking.booking_date;
      console.log('Original booking date:', originalBookingDate);
      console.log('New booking date:', booking_date);

      // Skip the update if dates are the same
      if (originalBookingDate === booking_date) {
        return res.status(400).json({
          error: 'New booking date is the same as current booking date'
        });
      }

      // 1. Release seats from current booking date
      console.log('\n🔄 Releasing seats from previous date...');
      try {
        const releasedSeatIds = await releaseSeats(booking, t);
        console.log('✅ Successfully released seats for IDs:', releasedSeatIds);
      } catch (error) {
        console.error('❌ Error releasing seats:', error);
        throw new Error(`Failed to release seats: ${error.message}`);
      }

      // 2. Update booking date
      console.log('\n📅 Updating booking date...');
      await booking.update({ booking_date }, { transaction: t });
      console.log('✅ Booking date updated successfully');

      // 3. Create new seat availabilities
      console.log('\n🔄 Creating new seat availabilities...');
      let remainingSeatAvailabilities;

      if (booking.subschedule_id) {
        console.log(`Processing sub-schedule booking for subschedule_id ${booking.subschedule_id}`);
        remainingSeatAvailabilities = await handleSubScheduleBooking(
          booking.schedule_id,
          booking.subschedule_id,
          booking_date,
          booking.total_passengers,
          null,
          t
        );
      } else {
        console.log(`Processing main schedule booking for schedule_id ${booking.schedule_id}`);
        remainingSeatAvailabilities = await handleMainScheduleBooking(
          booking.schedule_id,
          booking_date,
          booking.total_passengers,
          t
        );
      }

      console.log('✅ New seat availabilities created successfully:', 
        remainingSeatAvailabilities.map(sa => ({
          id: sa.id,
          schedule_id: sa.schedule_id,
          subschedule_id: sa.subschedule_id,
          available_seats: sa.available_seats
        }))
      );

      console.log('\n=== Booking Date Update Process Completed ===');

      res.status(200).json({
        message: 'Booking date updated successfully',
        booking: {
          id: booking.id,
          new_date: booking_date,
          previous_date: originalBookingDate,
          affected_seat_availabilities: remainingSeatAvailabilities.map(sa => sa.id)
        }
      });
    });

  } catch (error) {
    console.error('\n❌ Error in updateBookingDate:', error);
    res.status(400).json({ 
      error: 'Failed to update booking date',
      details: error.message
    });
  }
};

const deleteBooking = async (req, res) => {
  const { id } = req.params;

  try {
    await sequelize.transaction(async (t) => {
      const booking = await Booking.findByPk(id, { transaction: t });
      if (!booking) {
        throw new Error("Booking not found.");
      }

      const { schedule_id, transit_id, total_passengers } = booking;

      const schedule = await Schedule.findByPk(schedule_id, { transaction: t });
      await schedule.update(
        { available_seats: schedule.available_seats + total_passengers },
        { transaction: t }
      );

      const transit = await Transit.findByPk(transit_id, { transaction: t });
      await transit.update(
        { available_seats: transit.available_seats + total_passengers },
        { transaction: t }
      );

      await booking.destroy({ transaction: t });

      console.log("Booking deleted:", id);
    });

    res.status(204).json();
  } catch (error) {
    console.log("Error deleting booking:", error.message);
    res.status(400).json({ error: error.message });
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

module.exports = {
  createBooking,
  createBookingMultiple,
  getBookingContact,
  getFilteredBookings,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  createBookingWithTransit2,
  createBookingWithTransit,
  createBookingWithTransitQueue,
  createBookingWithoutTransit,
  getBookingByTicketId,
  updateBookingPayment,
  updateBookingDate,
  getBookingsByDate,
};











// const createBookingWithoutTransit = async (req, res) => {
//     const {
//         schedule_id, total_passengers, booking_date, passengers, agent_id,
//         gross_total, payment_status, transports, contact_name, contact_phone,
//         contact_passport_id, contact_nationality, contact_email, payment_method,
//         booking_source, adult_passengers, child_passengers, infant_passengers,
//         ticket_id
//     } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             console.log('Creating booking...');
//             // Create booking
//             const booking = await Booking.create({
//                 schedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
//                 contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
//                 payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
//                 ticket_id
//             }, { transaction: t });
//             console.log('Booking created:', booking);

//             if (payment_status === 'paid') {
//                 console.log('Fetching seat availability...');
//                 // Fetch seat availability
//                 const seatAvailability = await SeatAvailability.findOne({
//                     where: {
//                         schedule_id,
//                         date: booking_date
//                     },
//                     transaction: t
//                 });

//                 if (!seatAvailability) {
//                     throw new Error(`Seat availability not found for schedule ID ${schedule_id} on date ${booking_date}.`);
//                 }

//                 console.log('Checking available seats...');
//                 if (seatAvailability.available_seats < total_passengers) {
//                     throw new Error('Not enough seats available on the schedule.');
//                 }

//                 console.log('Updating seat availability...');
//                 // Update seat availability
//                 await seatAvailability.update({ available_seats: seatAvailability.available_seats - total_passengers }, { transaction: t });
//             }

//             console.log('Adding passengers in batch...');
//             // Add passengers in batch
//             const passengerData = passengers.map((passenger) => ({
//                 booking_id: booking.id,
//                 ...passenger
//             }));
//             await Passenger.bulkCreate(passengerData, { transaction: t });

//             console.log('Adding transports in batch...');
//             // Add transports in batch
//             const transportData = transports.map((transport) => ({
//                 booking_id: booking.id,
//                 transport_id: transport.transport_id,
//                 quantity: transport.quantity,
//                 transport_type: transport.transport_type,
//                 note: transport.note
//             }));
//             await TransportBooking.bulkCreate(transportData, { transaction: t });

//             console.log('Updating agent metrics if agent_id is present...');
//             // Update agent metrics if agent_id is present
//             if (agent_id) {
//                 const agentMetrics = await AgentMetrics.findOne({ where: { agent_id }, transaction: t });

//                 if (agentMetrics) {
//                     agentMetrics.total_revenue += parseFloat(gross_total);
//                     agentMetrics.total_bookings += 1;
//                     agentMetrics.total_customers += total_passengers;
//                     if (payment_status === 'pending') {
//                         agentMetrics.pending_payment += parseFloat(gross_total);
//                         agentMetrics.gross_pending_payment += parseFloat(gross_total);
//                     } else if (payment_status === 'paid') {
//                         const agent = await Agent.findByPk(agent_id, { transaction: t });
//                         const commission = parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100;
//                         agentMetrics.outstanding += commission;
//                         agentMetrics.net_profit += commission;
//                     }
//                     await agentMetrics.save({ transaction: t });
//                 } else {
//                     const agent = await Agent.findByPk(agent_id, { transaction: t });
//                     const newAgentMetricsData = {
//                         agent_id,
//                         total_revenue: parseFloat(gross_total),
//                         total_bookings: 1,
//                         total_customers: total_passengers,
//                         pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
//                         gross_pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
//                         outstanding: payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0,
//                         net_profit: payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0
//                     };
//                     await AgentMetrics.create(newAgentMetricsData, { transaction: t });
//                 }
//             }

//             console.log('Returning the created booking along with transport bookings...');
//             // Return the created booking along with transport bookings
//             const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });
//             return { booking, transportBookings };
//         });

//         res.status(201).json(result);
//     } catch (error) {
//         console.log('Error creating booking:', error.message);
//         res.status(400).json({ error: error.message });
//     }
// };

// const createBookingWithTransit = async (req, res) => {
//     const { schedule_id, transits, total_passengers, booking_date, passengers } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             // Create booking
//             const booking = await Booking.create({
//                 schedule_id,
//                 total_passengers,
//                 booking_date,
//                 ...req.body
//             }, { transaction: t });

//             // Fetch schedule
//             const schedule = await Schedule.findByPk(schedule_id, { transaction: t });
//             if (!schedule) {
//                 throw new Error(`Schedule with ID ${schedule_id} not found.`);
//             }

//             if (schedule.available_seats < total_passengers) {
//                 throw new Error('Not enough seats available on the schedule.');
//             }

//             // Update schedule available seats
//             await schedule.update({ available_seats: schedule.available_seats - total_passengers }, { transaction: t });

//             // Check and update each transit, and create booking-transit associations
//             for (const transit_id of transits) {
//                 const transit = await Transit.findByPk(transit_id, { transaction: t });
//                 if (!transit) {
//                     throw new Error(`Transit with ID ${transit_id} not found.`);
//                 }

//                 if (transit.available_seats < total_passengers) {
//                     throw new Error(`Not enough seats available on transit with ID ${transit_id}.`);
//                 }

//                 // Update transit available seats
//                 await transit.update({ available_seats: transit.available_seats - total_passengers }, { transaction: t });

//                 // Create booking-transit association
//                 await booking.addTransit(transit, { transaction: t });
//             }

//             // Add passengers
//             for (const passenger of passengers) {
//                 await Passenger.create({
//                     booking_id: booking.id,
//                     ...passenger
//                 }, { transaction: t });
//             }

//             console.log('Booking created:', booking);
//             return booking;
//         });

//         res.status(201).json(result);
//     } catch (error) {
//         console.log('Error creating booking:', error.message);
//         res.status(400).json({ error: error.message });

//     }
// };

//with transit trial #1

//with booking queue

// Function to create booking with queue and return early response
//   the booking is suscceded if the booking is created in the queue
//   const createBookingWithTransitQueue = async (req, res) => {
//     const {
//       schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
//       gross_total, payment_status, transports, contact_name, contact_phone,
//       contact_passport_id, contact_nationality, contact_email, payment_method,
//       booking_source, adult_passengers, child_passengers, infant_passengers,
//       ticket_id, transit_details, transaction_type, currency,ticket_total
//     } = req.body;

//     try {
//       const result = await sequelize.transaction(async (t) => {
//         // Set expiration time for booking
//         const expirationTimeMinutes = process.env.EXPIRATION_TIME_MINUTES || 30;
//         const bookingDateTime = new Date();
//         const expirationTime = new Date(bookingDateTime.getTime() + expirationTimeMinutes * 60000);

//         // Step 1: Create the Booking
//         const booking = await Booking.create({
//           schedule_id, subschedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
//           contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
//           payment_method,ticket_total, booking_source, adult_passengers, child_passengers, infant_passengers,
//           ticket_id,
//           expiration_time: expirationTime
//         }, { transaction: t });

//         console.log(`Booking created with ID: ${booking.id}`);

//         // Step 2: Create an initial transaction
//         const transactionEntry = await createTransaction({
//           transaction_id: `TRANS-${Date.now()}`, // Unique transaction ID
//           payment_method,
//           payment_gateway: null, // Set payment gateway if needed
//           amount: gross_total,
//           currency,
//           transaction_type,
//           booking_id: booking.id,
//           status: 'pending' // Set status to pending initially
//         }, t);

//         console.log(`Initial transaction created for booking ID: ${booking.id}`);

//         // Queue job for background processing (including seat availability, transport, etc.)
//         bookingQueue.add({
//           schedule_id,
//           subschedule_id,
//           booking_date,
//           total_passengers,
//           passengers,
//           transports,
//           transit_details,
//           booking_id: booking.id, // Pass booking ID to the queue
//           agent_id,
//           gross_total,
//           payment_status
//         });

//         // Return early response
//         res.status(201).json({
//           booking,
//           status: 'processing',
//           transaction: transactionEntry, // Include the created transaction in the response
//           transportBookings: [],
//           remainingSeatAvailabilities: null
//         });
//       });
//     } catch (error) {
//       console.log('Error:', error.message);
//       res.status(400).json({ error: error.message });
//     }
//   };
//   create booking with payment token
// const createBookingWithTransitQueue = async (req, res) => {
//     const {
//       schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
//       gross_total, ticket_total, payment_status, transports, contact_name, contact_phone,
//       contact_passport_id, contact_nationality, contact_email, payment_method,
//       booking_source, adult_passengers, child_passengers, infant_passengers,
//       ticket_id, transit_details, transaction_type, currency
//     } = req.body;

//     try {
//       const result = await sequelize.transaction(async (t) => {
//         // Step 1: Calculate transport_total if transports exist
//         const transportTotal = Array.isArray(transports)
//           ? transports.reduce((total, transport) => total + parseFloat(transport.transport_price) * transport.quantity, 0)
//           : 0;

//         const totalAmount = ticket_total + transportTotal;  // Gross total adalah gabungan tiket + transport

//         // Step 2: Create the Booking dengan ticket_total dan gross_total
//         const booking = await Booking.create({
//           schedule_id,
//           subschedule_id,
//           total_passengers,
//           booking_date,
//           agent_id,
//           gross_total: totalAmount,  // Gross total mencakup tiket + transport
//           ticket_total: parseFloat(ticket_total), // Ticket total dari frontend
//           payment_status,
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
//           expiration_time: new Date(Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000)
//         }, { transaction: t });

//         console.log(`Booking created with ID: ${booking.id}`);

//         // Step 3: Create an initial transaction
//         const transactionEntry = await createTransaction({
//           transaction_id: `TRANS-${Date.now()}`, // Unique transaction ID
//           payment_method,
//           payment_gateway: null, // Set payment gateway if needed
//           amount: totalAmount,  // Menggunakan gross_total untuk transaksi
//           currency,
//           transaction_type,
//           booking_id: booking.id,
//           status: 'pending' // Set status to pending initially
//         }, t);

//         console.log(`Initial transaction created for booking ID: ${booking.id}`);

//         // Step 4: Handle payment method
//         let paymentResponse = null;

//         if (payment_method === 'paypal') {
//           // Create PayPal Order
//           const orderDetails = {
//             amount: gross_total,  // Menggunakan totalAmount yang mencakup tiket + transport
//             currency: currency || 'USD', // Default to USD
//           };
//           try {
//             paymentResponse = await createPayPalOrder(orderDetails);
//             console.log('PayPal order created:', paymentResponse);
//           } catch (error) {
//             throw new Error('Failed to create PayPal order');
//           }

//         } else if (payment_method === 'midtrans') {
//           // Use the existing utility function for MidTrans
//           try {
//             const midtransDetails = {
//               ticket_id,
//               gross_total: totalAmount,  // Menggunakan totalAmount untuk MidTrans
//               total_passengers,
//               ticket_total: parseFloat(ticket_total),  // Menggunakan ticketTotal dari frontend
//               transports,
//               contact_name,
//               contact_email,
//               contact_phone,
//               booking_date,
//               passengers,
//             };

//             paymentResponse = await generateMidtransToken(midtransDetails);
//             console.log('MidTrans token created:', paymentResponse);
//           } catch (error) {
//             throw new Error('Failed to generate MidTrans token');
//           }
//         }

//         // Step 5: Queue job for background processing (including seat availability, transport, etc.)
//         bookingQueue.add({
//           schedule_id,
//           subschedule_id,
//           booking_date,
//           total_passengers,
//           passengers,
//           transports,
//           transit_details,
//           booking_id: booking.id, // Pass booking ID to the queue
//           agent_id,
//           gross_total: totalAmount,  // Gross total for the queue
//           payment_status
//         });

//         // Step 6: Return response
//         res.status(201).json({
//           booking,
//           status: 'processing',
//           transaction: transactionEntry, // Include the created transaction in the response
//           paymentResponse, // Include payment token or approval link in the response
//           transportBookings: [],
//           remainingSeatAvailabilities: null
//         });
//       });
//     } catch (error) {
//       console.log('Error:', error.message);
//       res.status(400).json({ error: error.message });
//     }
//   };
// CREATE BOOKING with transit origial without transaction code
// const createBookingWithTransit = async (req, res) => {
//     const {
//         schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
//         gross_total, payment_status, transports, contact_name, contact_phone,
//         contact_passport_id, contact_nationality, contact_email, payment_method,
//         booking_source, adult_passengers, child_passengers, infant_passengers,
//         ticket_id, transit_details
//     } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             const booking = await Booking.create({
//                 schedule_id, subschedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
//                 contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
//                 payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
//                 ticket_id
//             }, { transaction: t });

//             // Memanggil fungsi untuk mengelola ketersediaan kursi
//             let remainingSeatAvailabilities;
//             if (subschedule_id) {
//                 remainingSeatAvailabilities = await handleSubScheduleBooking(schedule_id, subschedule_id, booking_date, total_passengers, transit_details, t);
//             } else {
//                 remainingSeatAvailabilities = await handleMainScheduleBooking(schedule_id, booking_date, total_passengers, t);
//             }

//             // Menggunakan utilitas untuk menambahkan data penumpang ke tabel Passenger
//             await addPassengers(passengers, booking.id, t);

//             // Menggunakan utilitas untuk menambahkan data transportasi ke tabel TransportBooking
//             await addTransportBookings(transports, booking.id, total_passengers, t);

//             // Memperbarui metrik agen jika agent_id tersedia dan payment_status 'paid'
//             if (agent_id && payment_status === 'paid') {
//                 await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, t);
//             }

//          // Corrected part: Link Booking with the correct SeatAvailability
//          if (remainingSeatAvailabilities && remainingSeatAvailabilities.length > 0) {
//             const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(sa => ({
//                 booking_id: booking.id,
//                 seat_availability_id: sa.id
//             }));
//             await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, { transaction: t });
//         }
//             const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });

//             // Kembalikan booking, remainingSeatAvailabilities, dan transportBookings
//             res.status(201).json({
//                 booking,
//                 remainingSeatAvailabilities,
//                 transportBookings
//             });
//         });
//     } catch (error) {
//         console.log('Error:', error.message);
//         res.status(400).json({ error: error.message });
//     }
// };

// const getPaginatedBookings = async (req, res) => {
//     try {
//         // Ambil query params
//         const { page = 0, pageSize = 10, monthly } = req.query;

//         // Konversi ke integer untuk limit dan offset
//         const offset = parseInt(page, 10) * parseInt(pageSize, 10);
//         const limit = parseInt(pageSize, 10);

//         // Buat filter untuk booking_date berdasarkan bulan (jika ada)
//         let dateFilter = {};
//         if (monthly) {
//             const [year, month] = monthly.split('-');
//             dateFilter = {
//                 booking_date: {
//                     [Op.gte]: new Date(year, month - 1, 1), // Awal bulan
//                     [Op.lt]: new Date(year, month, 1) // Awal bulan berikutnya
//                 }
//             };
//         }

//         // Temukan semua bookings dengan pagination dan filter bulan
//         const { count, rows: bookings } = await Booking.findAndCountAll({
//             where: dateFilter, // Filter berdasarkan bulan
//             include: [
//                 {
//                     model: Schedule,
//                     as: 'schedule',
//                     include: [
//                         {
//                             model: Transit,
//                             as: 'Transits',
//                             include: [
//                                 {
//                                     model: Destination,
//                                     as: 'Destination'
//                                 }
//                             ]
//                         },
//                         {
//                             model: Destination,
//                             as: 'FromDestination'
//                         },
//                         {
//                             model: Destination,
//                             as: 'ToDestination'
//                         }
//                     ]
//                 },
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     through: {
//                         model: BookingSeatAvailability,
//                         attributes: [] // Exclude the join table attributes if not needed
//                     }
//                 },
//                 {
//                     model: Passenger,
//                     as: 'passengers'
//                 },
//                 {
//                     model: TransportBooking,
//                     as: 'transportBookings',
//                     include: [
//                         {
//                             model: Transport,
//                             as: 'transport'
//                         }
//                     ]
//                 },
//                 {
//                     model: Agent,
//                     as: 'Agent'
//                 }
//             ],
//             limit, // Batas jumlah data per halaman
//             offset // Offset untuk pagination
//         });

//         // Hitung total halaman
//         const totalPages = Math.ceil(count / limit);

//         // Respon dengan data yang sudah dipaginasi dan difilter
//         res.status(200).json({
//             bookings,
//             totalPages,
//             totalItems: count,
//             currentPage: parseInt(page, 10),
//             pageSize: limit,
//             monthly // Kembalikan nilai monthly agar bisa digunakan di frontend
//         });
//     } catch (error) {
//         console.error('Error retrieving paginated and filtered bookings:', error.message);
//         res.status(400).json({ error: error.message });
//     }
// };

// const createBookingWithTransit = async (req, res) => {
//     const {
//         schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
//         gross_total, payment_status, transports, contact_name, contact_phone,
//         contact_passport_id, contact_nationality, contact_email, payment_method,
//         booking_source, adult_passengers, child_passengers, infant_passengers,
//         ticket_id, transit_details
//     } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             // Membuat entri baru di tabel Booking
//             const booking = await Booking.create({
//                 schedule_id, subschedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
//                 contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
//                 payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
//                 ticket_id
//             }, { transaction: t });

//             let remainingSeatAvailabilities;
//             // Memanggil fungsi untuk mengelola ketersediaan kursi berdasarkan jadwal utama atau subjadwal
//             if (subschedule_id) {
//                 remainingSeatAvailabilities = await handleSubScheduleBooking(schedule_id, subschedule_id, booking_date, total_passengers, transit_details, t);
//             } else {
//                 remainingSeatAvailabilities = await handleMainScheduleBooking(schedule_id, booking_date, total_passengers, t);
//             }

//             // Menambahkan data penumpang ke tabel Passenger
//             const passengerData = passengers.map((passenger) => ({
//                 booking_id: booking.id,
//                 ...passenger
//             }));
//             await Passenger.bulkCreate(passengerData, { transaction: t });

//             // Menambahkan data transportasi ke tabel TransportBooking
//             const transportData = transports.map((transport) => ({
//                 booking_id: booking.id,
//                 transport_id: transport.transport_id,
//                 quantity: transport.quantity,
//                 transport_price: transport.transport_price,
//                 transport_type: transport.transport_type,
//                 note: transport.note
//             }));
//             await TransportBooking.bulkCreate(transportData, { transaction: t });

//             // Memperbarui metrik agen jika agent_id tersedia dan payment_status 'paid'
//             if (agent_id && payment_status === 'paid') {
//                 await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, t);
//             }

//             // Membuat entri di tabel BookingSeatAvailability untuk menghubungkan pemesanan dengan ketersediaan kursi
//             const bookingSeatAvailabilityData = transit_details.map(transit => ({
//                 booking_id: booking.id,
//                 seat_availability_id: transit.seat_availability_id
//             }));
//             await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, { transaction: t });

//             const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });

//             // Mengembalikan booking dan sisa seatAvailability
//             res.status(201).json({ booking, remainingSeatAvailabilities, transportBookings });
//         });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// };

// const createBookingWithTransitQueue = async (req, res) => {
//     const {
//       schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
//       gross_total, ticket_total, payment_status, transports, contact_name, contact_phone,
//       contact_passport_id, contact_nationality, contact_email, payment_method,
//       booking_source, adult_passengers, child_passengers, infant_passengers,
//       ticket_id, transit_details, transaction_type, currency,gross_total_in_usd,exchange_rate
//     } = req.body;

//     try {
//       const result = await sequelize.transaction(async (t) => {

//         const existingBooking = await Booking.findOne({
//             where: { ticket_id }
//           });

//           if (existingBooking) {
//             // If the ticket_id already exists, return an error response
//             return res.status(400).json({
//               error: 'Ticket ID already exists',
//               message: `The ticket ID '${ticket_id}' is already in use. Please provide a unique ticket ID.`
//             });
//           }

//         console.log('Step 1: Calculate transport_total if transports exist');
//         // Step 1: Calculate transport_total if transports exist
//         const transportTotal = Array.isArray(transports)
//           ? transports.reduce((total, transport) => total + parseFloat(transport.transport_price) * transport.quantity, 0)
//           : 0;

//         const totalAmount = ticket_total + transportTotal;  // Gross total adalah gabungan tiket + transport
//         console.log(`Gross total: ${totalAmount}`);

//         console.log('Step 2: Create the Booking dengan ticket_total dan gross_total');
//         // Step 2: Create the Booking dengan ticket_total dan gross_total
//         const booking = await Booking.create({
//           schedule_id,
//           subschedule_id,
//           total_passengers,
//           booking_date,
//           agent_id,
//           gross_total: totalAmount,
//           gross_total_in_usd: gross_total_in_usd,
//           exchange_rate: exchange_rate,
//           ticket_total: parseFloat(ticket_total),
//           payment_status,
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
//           expiration_time: new Date(Date.now() + (process.env.EXPIRATION_TIME_MINUTES || 30) * 60000)
//         }, { transaction: t });

//         console.log(`Booking created with ID: ${booking.id}`);

//         console.log('Step 3: Create an initial transaction');
//         // Step 3: Create an initial transaction
//         const transactionEntry = await createTransaction({
//           transaction_id: `TRANS-${Date.now()}`,
//           payment_method,
//           payment_gateway: null,
//           amount: totalAmount,
//           currency,
//           transaction_type,
//           booking_id: booking.id,
//           status: 'pending'
//         }, t);

//         console.log(`Initial transaction created for booking ID: ${booking.id}`);

//         console.log('Step 4: Queue job for background processing (including seat availability, transport, etc.)');
//         // Step 4: Queue job for background processing (including seat availability, transport, etc.)
//         bookingQueue.add({
//           schedule_id,
//           subschedule_id,
//           booking_date,
//           total_passengers,
//           passengers,
//           transports,
//           transit_details,
//           booking_id: booking.id,
//           agent_id,
//           gross_total: totalAmount,
//           payment_status
//         });

//         console.log('Step 5: Return response with status code 201 (Created)');
//         // Step 5: Return response with status code 201 (Created)
//         return res.status(201).json({
//           booking,
//           status: 'processing',
//           transaction: transactionEntry, // Include the created transaction in the response
//           transports:transports,
//           remainingSeatAvailabilities: null
//         });
//       });

//     } catch (error) {
//       console.log('Error:', error.message);

//       // Check if the error is related to the request (Bad Request)
//       if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
//         return res.status(400).json({ error: 'Invalid input data', details: error.message });
//       }

//       // For all other errors, return 500 (Internal Server Error)
//       return res.status(500).json({ error: 'Internal server error', details: error.message });
//     }
//   };

// Background job processing with Bull Queue
//   bookingQueue.process(async (job, done) => {
//     const {
//       schedule_id, subschedule_id, booking_date, total_passengers, passengers, transports,
//       transit_details, booking_id, agent_id, gross_total, payment_status
//     } = job.data;

//     const transaction = await sequelize.transaction();
//     try {
//       // Step 2: Handle Seat Availability
//       let remainingSeatAvailabilities;
//       if (subschedule_id) {
//         console.log(`Processing sub-schedule booking for subschedule_id ${subschedule_id}`);
//         remainingSeatAvailabilities = await handleSubScheduleBooking(schedule_id, subschedule_id, booking_date, total_passengers, transit_details, transaction);
//       } else {
//         console.log(`Processing main schedule booking for schedule_id ${schedule_id}`);
//         remainingSeatAvailabilities = await handleMainScheduleBooking(schedule_id, booking_date, total_passengers, transaction);
//       }

//       console.log('Remaining Seat Availabilities:', remainingSeatAvailabilities);

//       // Step 3: Add Passengers
//       console.log(`Adding passengers for booking_id ${booking_id}`);
//       await addPassengers(passengers, booking_id, transaction);

//       // Step 4: Add Transport Bookings
//       console.log(`Adding transport bookings for booking_id ${booking_id}`);
//       await addTransportBookings(transports, booking_id, total_passengers, transaction);

//       // Step 5: Update Agent Metrics (only if payment is complete)
//     //   if (agent_id && payment_status === 'paid') {
//     //     console.log(`Updating agent metrics for agent_id ${agent_id}`);
//     //     await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, transaction);
//     //   }

//       console.log('Remaining Seat Availabilities:', remainingSeatAvailabilities);
//       console.log('Booking ID:', booking_id);
//       // Step 6: Add remaining Seat Availabilities
//       if (remainingSeatAvailabilities && remainingSeatAvailabilities.length > 0) {
//         const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(sa => ({
//           booking_id,
//           seat_availability_id: sa.id
//         }));

//         console.log('Data to Insert into BookingSeatAvailability:', bookingSeatAvailabilityData);
//         // Step 6: Add remaining Seat Availabilities to BookingSeatAvailability
//         await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, { transaction });
//       } else {
//         console.log('No seat availabilities found.');
//       }

//       await transaction.commit(); // Commit the transaction if successful
//       console.log(`Booking queue success for booking ${booking_id}`);
//       done(); // Mark the job as done
//     } catch (error) {
//       await transaction.rollback(); // Rollback transaction if any error occurs
//       console.error('Error processing booking queue:', error.message);
//       done(error); // Mark the job as failed
//     }
//   });
