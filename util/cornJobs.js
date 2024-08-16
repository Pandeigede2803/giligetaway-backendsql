// /utils/cronJobs.js

const cron = require('node-cron');
const Booking = require('../models/booking');  // Pastikan path ini benar sesuai struktur proyek Anda
const { Op } = require('sequelize');

const handleExpiredBookings = async () => {
    try {
        const expiredBookings = await Booking.findAll({
            where: {
                payment_status: 'pending',
                expiration_time: {
                    [Op.lte]: new Date()  // Mencari pemesanan yang sudah melewati waktu kedaluwarsa
                }
            }
        });

        for (let booking of expiredBookings) {
            // Logika untuk melepaskan kursi yang sudah dipesan ke available_seats
            await releaseSeats(booking);

            // Update status pemesanan menjadi 'cancelled'
            booking.payment_status = 'cancelled';
            await booking.save();

            console.log(`Booking ID ${booking.id} telah dibatalkan karena melewati waktu kedaluwarsa.`);
        }
    } catch (error) {
        console.error("Error handling expired bookings:", error);
    }
};

const releaseSeats = async (booking) => {
    const { schedule_id, subschedule_id, total_passengers, booking_date } = booking;

    // Update seat availability untuk Main Schedule
    const mainScheduleSeatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id,
            sub_schedule_id: null,
            date: booking_date
        }
    });

    if (mainScheduleSeatAvailability) {
        mainScheduleSeatAvailability.available_seats += total_passengers;
        await mainScheduleSeatAvailability.save();
    }

    // Update seat availability untuk SubSchedule jika ada
    if (subschedule_id) {
        const subScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id,
                sub_schedule_id: subschedule_id,
                date: booking_date
            }
        });

        if (subScheduleSeatAvailability) {
            subScheduleSeatAvailability.available_seats += total_passengers;
            await subScheduleSeatAvailability.save();
        }
    }
};

// Menjadwalkan cron job untuk berjalan setiap 5 menit
cron.schedule('*/5 * * * *', async () => {
    console.log('Checking for expired bookings...');
    await handleExpiredBookings();
});

module.exports = {
    handleExpiredBookings};
