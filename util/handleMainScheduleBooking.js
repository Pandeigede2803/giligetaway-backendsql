const { sequelize, Booking, SeatAvailability, Destination, SubSchedule, Transport, Schedule, Passenger, Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op } = require('sequelize');

const handleMainScheduleBooking = async (schedule_id, booking_date, total_passengers, transaction) => {
    console.log("we enter the handleMainScheduleBooking function"); 

    // Step 1: Fetch the schedule and ensure Boat is available
    console.log(`Step 1: Fetching Schedule with ID: ${schedule_id}`);
    const schedule = await Schedule.findByPk(schedule_id, {
        include: [
            {
                model: Boat,
                as: 'Boat'
            },
            {
                model: SubSchedule,
                as: 'SubSchedules' // Ensure this matches the alias used in the relationship
            }
        ],
        transaction
    });

    if (!schedule) {
        throw new Error('Jadwal tidak tersedia');
    }
    console.log(`Step 1: Schedule found with ID: ${schedule.id}`);

    // Step 2: Ensure the Boat has capacity
    if (!schedule.Boat || !schedule.Boat.capacity) {
        throw new Error('Boat capacity tidak ditemukan');
    }
    const boatCapacity = schedule.Boat.capacity;
    console.log(`Step 2: Boat capacity found: ${boatCapacity}`);

    // Step 3: Use the date without time
    const formattedDate = booking_date.split('T')[0];  // Use only the date part
    console.log(`Step 3: Formatted date used for query: ${formattedDate}`);

    // Step 4: Check if SeatAvailability already exists for MainSchedule
    console.log(`Step 4: Checking for SeatAvailability for MainSchedule on date: ${formattedDate}`);
    let seatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id: schedule_id,
            transit_id: null,
            subschedule_id: null,
            date: formattedDate  // Use only the date
        },
        transaction
    });

    // Step 5: If SeatAvailability not found, create a new entry
    if (!seatAvailability) {
        console.log(`Step 5: SeatAvailability not found. Creating new entry for MainSchedule ID: ${schedule_id} on date: ${formattedDate}`);
        seatAvailability = await SeatAvailability.create({
            schedule_id: schedule_id,
            transit_id: null,
            subschedule_id: null,
            available_seats: boatCapacity,  // Initialize with boat capacity
            date: formattedDate,
            availability: true
        }, { transaction });
    } else {
        console.log(`Step 5: Found existing SeatAvailability with ID: ${seatAvailability.id}`);
        console.log(`Step 5: Existing available seats before subtraction: ${seatAvailability.available_seats}`);
    }

    // Step 6: If available seats are less than passengers, throw an error
    if (seatAvailability.available_seats < total_passengers) {
        throw new Error('Kursi tidak cukup tersedia');
    }

    // Step 7: Subtract seats but ensure it doesn't go below zero
    seatAvailability.available_seats -= total_passengers;
    if (seatAvailability.available_seats < 0) {
        throw new Error('Seat availability cannot go below zero for the main schedule');
    }
    console.log(`Step 7: Available seats after subtraction: ${seatAvailability.available_seats}`);

    // Step 8: Save updated seat availability
    await seatAvailability.save({ transaction });

    // Step 9: Update SeatAvailability for each SubSchedule
    for (const subSchedule of schedule.SubSchedules) {
        console.log(`Step 9: Updating SeatAvailability for SubSchedule ID: ${subSchedule.id}`);
        let subScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                transit_id: null,
                subschedule_id: subSchedule.id,
                date: formattedDate
            },
            transaction
        });

        if (!subScheduleSeatAvailability) {
            console.log(`Step 9: Creating new SeatAvailability for SubSchedule ID: ${subSchedule.id}`);
            subScheduleSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                transit_id: null,
                subschedule_id: subSchedule.id,
                available_seats: seatAvailability.available_seats, // Same as MainSchedule
                date: formattedDate,
                availability: true
            }, { transaction });
        } else {
            subScheduleSeatAvailability.available_seats = seatAvailability.available_seats;

            // Ensure that the sub-schedule seat availability doesn't go below zero
            if (subScheduleSeatAvailability.available_seats < 0) {
                throw new Error(`Seat availability cannot go below zero for SubSchedule ID: ${subSchedule.id}`);
            }

            await subScheduleSeatAvailability.save({ transaction });
            console.log(`Step 9: Updated SeatAvailability for SubSchedule ID: ${subSchedule.id}, Available seats: ${subScheduleSeatAvailability.available_seats}`);
        }
    }

    // Step 10: Return seat availability
    console.log('Step 10: Seat availability successfully updated for MainSchedule and related SubSchedules');
    return seatAvailability;
};

module.exports = handleMainScheduleBooking;
