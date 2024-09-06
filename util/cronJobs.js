// /utils/cronJobs.js

const cron = require('node-cron');
const Booking = require('../models/booking');  // Pastikan path ini benar sesuai struktur proyek Anda
const { Op } = require('sequelize');
const SeatAvailability = require('../models/SeatAvailability');

/**
 * Fungsi untuk melepaskan kursi yang sudah dipesan ke available_seats
 * jika pemesanan telah melewati waktu kedaluwarsa
 * @param {Booking} booking Pemesanan yang akan dihapus
 */
const releaseSeats = async (booking) => {
    const { schedule_id, subschedule_id, total_passengers, booking_date } = booking;

    // Update seat availability untuk Main Schedule
    const mainScheduleSeatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id,
            subschedule_id: null,
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
                subschedule_id: subschedule_id,
                date: booking_date
            }
        });

        if (subScheduleSeatAvailability) {
            subScheduleSeatAvailability.available_seats += total_passengers;
            await subScheduleSeatAvailability.save();
        }
    }
};

/**
 * Fungsi untuk menghandle pemesanan yang telah melewati waktu kedaluwarsa
 * Mencari pemesanan yang telah melewati waktu kedaluwarsa dan melepaskan kursi yang sudah dipesan
 */
const handleExpiredBookings = async () => {
    console.log('Checking for expired bookings...');
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

// Ambil frekuensi cron dari variabel environment, dengan default setiap 15 menit
const cronFrequency = process.env.CRON_FREQUENCY || '*/15 * * * *';  // Default 15 menit

// Menjadwalkan cron job dengan frekuensi dari env
cron.schedule(cronFrequency, async () => {
    await handleExpiredBookings();
});

module.exports = {
    handleExpiredBookings};

