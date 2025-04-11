// queue/bookingQueue.js
const Bull = require('bull');
const { 
  Booking, 
  BookingSeatAvailability, 
  SeatAvailability, 
  Passenger, 
  TransportBooking, 
  sequelize 
} = require('../models');

const { addTransportBookings, addPassengers } = require("../util/bookingUtil");
const handleMainScheduleBooking = require("../util/handleMainScheduleBooking");
const releaseSeats = require("../util/releaseSeats"); // Adjust the path based on your project structure
const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");

const Queue = require("bull");
const bookingQueue = new Queue("bookingQueue"); // Inisialisasi Bull Queue
const { updateAgentCommission } = require('../util/updateAgentComission');


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
    } = job.data;
  
    console.log("---START OF JOB---");
    console.log(`Processing booking ${booking_id}`);
    console.log("DEBUG schedule_id:", schedule_id);
    console.log("DEBUG subschedule_id:", subschedule_id);
    console.log("DEBUG booking_date:", booking_date);
    console.log("DEBUG total_passengers:", total_passengers);
    console.log("DEBUG agent_id:", agent_id);
    console.log("DEBUG payment_status:", payment_status);
    console.log("DEBUG gross_total:", gross_total);
    console.log("agent_id exists:", 'agent_id' in job.data);
console.log("payment_status exists:", 'payment_status' in job.data);
  
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
      const createdTransports = await addTransportBookings(
        transports,
        booking_id,
        total_passengers,
        transaction
      );
      console.log(`Added ${createdTransports.length} transport bookings`);

      console.log(`
        ---DEBUGGING AGENT COMMISSION---
        agent_id: ${agent_id}
        payment_status: ${payment_status}
        condition result: ${agent_id && (payment_status === 'paid' || payment_status === 'invoiced')}
        `);
  
      // Step 5: Update Agent Commission if agent_id exists and payment status is paid
      if (!agent_id || !(payment_status === 'paid' || payment_status === 'invoiced')) {
        console.log(
          `Skipping commission calculation for booking ${booking_id} as agent_id is ${
            agent_id ? 'present' : 'absent'
          } or payment status is not "paid" or "invoiced" (currently ${payment_status}).`
        );
      } else {
        console.log(`Calculating commission for agent_id ${agent_id}`);
        const commissionResponse = await updateAgentCommission(
          agent_id,
          gross_total,
          total_passengers,
          payment_status,
          schedule_id,
          subschedule_id,
          booking_id,
          transaction,
          createdTransports
        );
        console.log("Agent commission result:", commissionResponse);
      }
  
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
module.exports = bookingQueue;