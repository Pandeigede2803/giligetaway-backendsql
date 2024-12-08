
const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op } = require("sequelize");
const { findRelatedSubSchedules } = require('./handleSubScheduleBooking'); // Import dari kode yang sudah Anda berikan
const { calculatePublicCapacity } = require('../util/getCapacityReduction');
// const handleMultipleSeatsBooking = async (trips, total_passengers, transaction) => {
//     console.log('Start handling multiple seats booking');
//     console.log(`Received ${trips.length} trips to handle`);
//     console.log("Total Passengers:", total_passengers);
//     console.log("Transaction:", transaction);
//     console.log("trips:", trips);
  
//     let allSeatAvailabilities = [];
  
//     // Loop melalui setiap trip dalam array
//     for (const trip of trips) {
//       const { schedule_id, subschedule_id, booking_date } = trip;
//       console.log(`Handling trip: schedule_id=${schedule_id}, subschedule_id=${subschedule_id}, booking_date=${booking_date}`);
  
//       // Panggil utility handleSeatAvailability untuk setiap trip
//       const seatAvailabilities = await handleSeatAvailability(schedule_id, subschedule_id, booking_date, total_passengers, transaction);
  
//       // Gabungkan semua hasil seat availability dari setiap trip
//       allSeatAvailabilities = [...allSeatAvailabilities, ...seatAvailabilities];
//       console.log(`Updated seat availabilities: ${allSeatAvailabilities.length}`);
//     }
  
//     console.log('Finished handling multiple seats booking');
//     return allSeatAvailabilities; // Kembalikan semua hasil seat availability yang diperbarui
//   };
  
const handleMultipleSeatsBooking = async (trips, total_passengers, transaction) => {
    console.log('🚀 START HANDLING MULTIPLE SEATS BOOKING');
    console.log(`🛤️ RECEIVED ${trips.length} TRIPS TO HANDLE`);
    console.log("👥 TOTAL PASSENGERS:", total_passengers);
    console.log("💳 TRANSACTION:", transaction);
    console.log("🗺️ TRIPS:", trips);
  
    let allSeatAvailabilities = [];
  
    // Loop melalui setiap trip dalam array
    for (const trip of trips) {
      const { schedule_id, subschedule_id, booking_date } = trip;
      console.log(`✈️ HANDLING TRIP: SCHEDULE_ID=${schedule_id}, SUBSCHEDULE_ID=${subschedule_id}, BOOKING_DATE=${booking_date}`);
  
      // Panggil utility handleSeatAvailability untuk setiap trip
      const seatAvailabilities = await handleSeatAvailability(schedule_id, subschedule_id, booking_date, total_passengers, transaction);
  
      // Gabungkan semua hasil seat availability dari setiap trip
      allSeatAvailabilities = [...allSeatAvailabilities, ...seatAvailabilities];
      console.log(`🪑 UPDATED SEAT AVAILABILITIES: ${allSeatAvailabilities.length}`);
    }
  
    console.log('✅ FINISHED HANDLING MULTIPLE SEATS BOOKING');
    return allSeatAvailabilities; // Kembalikan semua hasil seat availability yang diperbarui
};


  const handleSeatAvailability = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
    // Fetch the main schedule and boat capacity
    const schedule = await Schedule.findByPk(schedule_id, {
        include: [{ model: sequelize.models.Boat, as: 'Boat' }],
        transaction
    });

    // Log untuk memastikan asosiasi Schedule dan Boat
    if (!schedule || !schedule.Boat) {
        console.log('Schedule atau Boat tidak ditemukan:', schedule);
        throw new Error('Boat information is missing or invalid');
    }

    const publicCapacity = calculatePublicCapacity(schedule.Boat);
    console.log(`Schedule ID: ${schedule_id} - Original Capacity: ${schedule.Boat.capacity}, Public Capacity: ${publicCapacity}`);

    // Fetch the selected sub-schedule
    const subSchedule = await SubSchedule.findByPk(subschedule_id, {
        include: [
            { model: Transit, as: 'TransitFrom' },
            { model: Transit, as: 'TransitTo' },
            { model: Transit, as: 'Transit1' },
            { model: Transit, as: 'Transit2' },
            { model: Transit, as: 'Transit3' },
            { model: Transit, as: 'Transit4' }
        ],
        transaction
    });

    if (!subSchedule) {
        throw new Error('SubSchedule not found');
    }

    const seatAvailabilities = [];

    // Handle main schedule seat availability
    if (subschedule_id !== schedule_id) {
        let mainScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: null, // Main schedule does not have a specific sub-schedule ID
                date: booking_date
            },
            transaction
        });

        if (!mainScheduleSeatAvailability) {
            mainScheduleSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                subschedule_id: null,
                transit_id: null,
                available_seats: publicCapacity,
                date: booking_date,
                availability: true
            }, { transaction });
        }

        // Validate if available seats are sufficient and avoid going below 0
        if (mainScheduleSeatAvailability.available_seats < total_passengers) {
            throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
        }

        mainScheduleSeatAvailability.available_seats -= total_passengers;

        if (mainScheduleSeatAvailability.available_seats < 0) {
            throw new Error('Seat availability cannot go below zero in the main schedule');
        }

        await mainScheduleSeatAvailability.save({ transaction });

        seatAvailabilities.push(mainScheduleSeatAvailability); // Collect the updated seat availability
    }

    // Find related sub-schedules
    const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

    // Handle seat availability for each related sub-schedule
    for (const relatedSubSchedule of relatedSubSchedules) {
        // Skip if it's the selected sub-schedule to avoid double decrement
        if (relatedSubSchedule.id === subschedule_id) continue;

        let relatedSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: relatedSubSchedule.id,
                date: booking_date
            },
            transaction
        });

        if (!relatedSeatAvailability) {
            relatedSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                subschedule_id: relatedSubSchedule.id,
                transit_id: null,
                available_seats: publicCapacity,
                date: booking_date,
                availability: true
            }, { transaction });;
        }

        // Validate if available seats are sufficient and avoid going below 0
        if (relatedSeatAvailability.available_seats < total_passengers) {
            throw new Error(`KURSI TIDAK CUKUP TERSEDIA DI SubSchedule ID: ${relatedSubSchedule.id}`);
        }

        relatedSeatAvailability.available_seats -= total_passengers;

        if (relatedSeatAvailability.available_seats < 0) {
            throw new Error(`Seat availability cannot go below zero in SubSchedule ID: ${relatedSubSchedule.id}`);
        }

        await relatedSeatAvailability.save({ transaction });

        seatAvailabilities.push(relatedSeatAvailability); // Collect the updated seat availability
    }

    // Handle seat availability for the selected sub-schedule
    let selectedSubScheduleSeatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id: schedule_id,
            subschedule_id: subschedule_id,
            transit_id: null,
            date: booking_date
        },
        transaction
    });

    if (!selectedSubScheduleSeatAvailability) {
        selectedSubScheduleSeatAvailability = await SeatAvailability.create({
            schedule_id: schedule_id,
            subschedule_id: subschedule_id,
            transit_id: null,
            available_seats: boatCapacity,
            date: booking_date,
            availability: true
        }, { transaction });
    }

    // Validate if available seats are sufficient and avoid going below 0
    if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
        throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
    }

    selectedSubScheduleSeatAvailability.available_seats -= total_passengers;

    if (selectedSubScheduleSeatAvailability.available_seats < 0) {
        throw new Error('Seat availability cannot go below zero in the selected sub-schedule');
    }

    await selectedSubScheduleSeatAvailability.save({ transaction });

    seatAvailabilities.push(selectedSubScheduleSeatAvailability); // Collect the updated seat availability

    return seatAvailabilities; // Return all updated SeatAvailability records
};
  module.exports = { handleMultipleSeatsBooking };
  
