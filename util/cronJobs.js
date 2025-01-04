// /utils/cronJobs.js

const cron = require('node-cron');
const Booking = require('../models/booking'); 
const Transaction = require('../models/Transaction'); // Pastikan path ini benar sesuai struktur proyek Anda
const { Op } = require('sequelize');
const SeatAvailability = require('../models/SeatAvailability');

const releaseMainScheduleSeats = require('../util/releaseMainScheduleSeats');
const releaseSubScheduleSeats = require('../util/releaseSubScheduleSeats');
/**
 * Fungsi untuk melepaskan kursi yang sudah dipesan ke available_seats
 * jika pemesanan telah melewati waktu kedaluwarsa
 * @param {Booking} booking Pemesanan yang akan dihapus
 */


const releaseSeats = async (booking, transaction) => {
    const { schedule_id, subschedule_id, total_passengers, booking_date } = booking;

    try {
        if (subschedule_id) {
            // Jika SubSchedule ada, kembalikan kursi untuk SubSchedule
            await releaseSubScheduleSeats(schedule_id, subschedule_id, booking_date, total_passengers, transaction);
        } else {
            // Jika Main Schedule, kembalikan kursi untuk Main Schedule
            await releaseMainScheduleSeats(schedule_id, booking_date, total_passengers, transaction);
        }

        console.log(`🎉Berhasil melepaskan ${total_passengers} kursi untuk Booking ID: ${booking.id}🎉`);
    } catch (error) {
        console.error(`Gagal melepaskan kursi untuk Booking ID: ${booking.id}`, error);
        throw error;
    }
};
/**
 * Fungsi untuk menghandle pemesanan yang telah melewati waktu kedaluwarsa
 * Mencari pemesanan yang telah melewati waktu kedaluwarsa dan melepaskan kursi yang sudah dipesan
 */
const handleExpiredBookings = async () => {
    console.log('	✅========Checking for expired bookings...====	✅');
    try {
        const expiredBookings = await Booking.findAll({
            where: {
                payment_status: 'pending',
                expiration_time: {
                    [Op.lte]: new Date()  // Mencari pemesanan yang sudah melewati waktu kedaluwarsa
                }
            },
            include: [{
                model: Transaction, // Include the related transaction
                as: 'transactions'  // Assuming the association is correctly named
            }]
        });

        for (let booking of expiredBookings) {
            console.log(`✅ Checking booking ID ${booking.id}...`);

            // Logika untuk melepaskan kursi yang sudah dipesan ke available_seats
            await releaseSeats(booking);

            // Update status pemesanan menjadi 'cancelled'
            booking.payment_status = 'cancelled';
            await booking.save();

            // Update related transaction status to 'cancelled'
            const transaction = await Transaction.findOne({
                where: { booking_id: booking.id, status: 'pending' }  // Only cancel pending transactions
            });

            if (transaction) {
                transaction.status = 'cancelled';
                await transaction.save();

                console.log(`Transaction ID ${transaction.transaction_id} telah dibatalkan karena pemesanan melewati waktu kedaluwarsa.`);
            }

            console.log(`Booking ID ${booking.id} dan ticket id ${booking.ticket_id} telah dibatalkan karena melewati waktu kedaluwarsa.`);
        }
    } catch (error) {
        console.error("Error handling expired bookings:", error);
    }
};
// Ambil frekuensi cron dari variabel environment, dengan default setiap 15 menit
const cronFrequency = process.env.CRON_FREQUENCY || '*/5 * * * *';  // Default 15 menit

// Menjadwalkan cron job dengan frekuensi dari env
cron.schedule(cronFrequency, async () => {
    await handleExpiredBookings();
});

module.exports = {
    handleExpiredBookings};

