// utils/utils.js
const {  SeatAvailability, SubSchedule } = require('../models');



// Fungsi untuk menangani ketersediaan kursi yang dinamis
const handleDynamicSeatAvailability = async (schedule_id, booking_date, total_passengers, payment_status, transit_details, transaction) => {
    const schedule = await Schedule.findByPk(schedule_id, {
        include: [{ model: SubSchedule }],
        transaction
    });

    if (!schedule) {
        throw new Error(`Schedule with ID ${schedule_id} not found.`);
    }

    for (const transit of transit_details) {
        // Mencari atau membuat entri SeatAvailability untuk setiap transit
        let seatAvailability = await findOrCreateSeatAvailability(schedule_id, booking_date, transit, transaction);

        if (payment_status === 'paid') {
            // Mengecek apakah kursi yang tersedia cukup
            if (seatAvailability.available_seats < total_passengers) {
                throw new Error(`Not enough seats available on transit ${transit.transit_id}`);
            }
            // Memperbarui ketersediaan kursi
            await updateSeatAvailability(seatAvailability, total_passengers, transit.transit_id, transaction);

            // Memperbarui ketersediaan kursi pada schedule utama jika subschedule penuh
            await updateMainScheduleAvailability(schedule, transit, total_passengers, transaction);
        }

        // Menyimpan seat_availability_id dalam transit_details untuk digunakan nanti
        transit.seat_availability_id = seatAvailability.id;
        console.log(`Updated seat_availability_id for transit ${transit.transit_id}: ${seatAvailability.id}`);
    }
};

// Fungsi untuk mencari atau membuat entri SeatAvailability

const findOrCreateSeatAvailability = async (schedule_id, booking_date, transit, transaction) => {
    let seatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id,
            transit_id: transit.transit_id,
            subschedule_id: transit.subschedule_id,
            date: booking_date
        },
        transaction
    });

    if (!seatAvailability) {
        const subSchedule = await SubSchedule.findByPk(transit.subschedule_id, { transaction });

        if (!subSchedule) {
            throw new Error(`SubSchedule with ID ${transit.subschedule_id} not found.`);
        }

        seatAvailability = await SeatAvailability.create({
            schedule_id,
            transit_id: transit.transit_id,
            subschedule_id: transit.subschedule_id,
            available_seats: subSchedule.capacity,
            date: booking_date
        }, { transaction });
        console.log(`Created new SeatAvailability for schedule ${schedule_id}, transit ${transit.transit_id}, date ${booking_date}`);
    } else {
        console.log(`Found existing SeatAvailability for schedule ${schedule_id}, transit ${transit.transit_id}, date ${booking_date}`);
    }

    return seatAvailability;
};

// Fungsi untuk memperbarui ketersediaan kursi
const updateSeatAvailability = async (seatAvailability, total_passengers, transit_id, transaction) => {
    if (seatAvailability.available_seats < total_passengers) {
        throw new Error(`Not enough seats available on transit ${transit_id}`);
    }
    await seatAvailability.update({ available_seats: seatAvailability.available_seats - total_passengers }, { transaction });
    console.log(`Updated seat availability for transit ${transit_id}. New available seats: ${seatAvailability.available_seats}`);
};

// Fungsi untuk memperbarui ketersediaan kursi pada schedule utama
const updateMainScheduleAvailability = async (schedule, transit, total_passengers, transaction) => {
    const subSchedule = await SubSchedule.findOne({
        where: { id: transit.subschedule_id },
        transaction
    });

    if (subSchedule) {
        let seatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule.id,
                transit_id: subSchedule.transit_from_id,
                subschedule_id: subSchedule.id,
                date: transit.date
            },
            transaction
        });

        if (!seatAvailability) {
            seatAvailability = await SeatAvailability.create({
                schedule_id: schedule.id,
                transit_id: subSchedule.transit_from_id,
                subschedule_id: subSchedule.id,
                available_seats: subSchedule.capacity,
                date: transit.date
            }, { transaction });
            console.log(`Created new SeatAvailability for main schedule ${schedule.id}, subschedule ${subSchedule.id}, date ${transit.date}`);
        }

        if (seatAvailability.available_seats < total_passengers) {
            throw new Error(`Not enough seats available on subschedule ${subSchedule.id}`);
        }

        await seatAvailability.update({ available_seats: seatAvailability.available_seats - total_passengers }, { transaction });
        console.log(`Updated seat availability for subSchedule ${subSchedule.id}. New available seats: ${seatAvailability.available_seats}`);

        const mainSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule.id,
                date: transit.date
            },
            transaction
        });

        if (mainSeatAvailability) {
            await mainSeatAvailability.update({ available_seats: mainSeatAvailability.available_seats - total_passengers }, { transaction });
            console.log(`Updated main schedule seat availability for schedule ${schedule.id}. New available seats: ${mainSeatAvailability.available_seats}`);
        }
    }
};



module.exports = {

    handleDynamicSeatAvailability
};
