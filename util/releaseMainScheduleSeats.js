const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');


/**
 * Mengembalikan kursi yang sebelumnya telah dipesan untuk Main Schedule dan SubSchedules terkait.
 *
 * @param {number} schedule_id - ID dari Main Schedule.
 * @param {string} booking_date - Tanggal pemesanan dalam format YYYY-MM-DD.
 * @param {number} total_passengers - Jumlah total penumpang yang akan mengembalikan kursi.
 * @param {object} transaction - Transaksi aktif Sequelize untuk memastikan atomicity.
 *
 * @throws {Error} Jika SeatAvailability tidak ditemukan atau kursi melebihi kapasitas.
 */
const releaseMainScheduleSeats = async (schedule_id, booking_date, total_passengers, transaction) => {
    try {
        // Format tanggal menjadi 'YYYY-MM-DD'
        const formattedDate = booking_date.split('T')[0];

        // Ambil Schedule dan Boat untuk mendapatkan kapasitas perahu
        console.log(`Fetching Schedule with ID: ${schedule_id}`);
        const schedule = await Schedule.findByPk(schedule_id, {
            include: [{ model: sequelize.models.Boat, as: 'Boat' }],
            transaction
        });

        if (!schedule || !schedule.Boat) {
            throw new Error('Schedule atau Boat tidak ditemukan.');
        }

        const boatCapacity = schedule.Boat.capacity;
        console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

        // Cek ketersediaan kursi di Main Schedule
        console.log(`Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
        let seatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                transit_id: null,
                subschedule_id: null, // Main Schedule tidak memiliki subschedule_id
                date: formattedDate
            },
            transaction
        });

        if (!seatAvailability) {
            throw new Error('SeatAvailability untuk Main Schedule tidak ditemukan.');
        }

        // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat
        if (seatAvailability.available_seats + total_passengers > boatCapacity) {
            throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk Main Schedule ID: ${schedule_id}`);
        }

        // Kembalikan kursi yang dilepaskan di Main Schedule
        console.log(`Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
        seatAvailability.available_seats += total_passengers;
        await seatAvailability.save({ transaction });

        console.log(`Berhasil mengembalikan ${total_passengers} kursi untuk Main Schedule ID: ${schedule_id}.`);

        // Cari sub-schedule yang terkait dengan main schedule
        console.log(`Fetching related SubSchedules for Main Schedule ID: ${schedule_id}`);
        const relatedSubSchedules = await SubSchedule.findAll({
            where: {
                schedule_id: schedule_id
            },
            transaction
        });

        // Kembalikan kursi untuk setiap SubSchedule yang terkait
        for (const subSchedule of relatedSubSchedules) {
            console.log(`Fetching SeatAvailability for SubSchedule ID: ${subSchedule.id}`);
            let subScheduleSeatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id: schedule_id,
                    subschedule_id: subSchedule.id, // Mengembalikan kursi di sub-schedule terkait
                    date: formattedDate
                },
                transaction
            });

            if (!subScheduleSeatAvailability) {
                console.error(`Seat availability tidak ditemukan untuk SubSchedule ID: ${subSchedule.id}.`);
                continue;
            }

            // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat di sub-schedule
            if (subScheduleSeatAvailability.available_seats + total_passengers > boatCapacity) {
                throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk SubSchedule ID: ${subSchedule.id}`);
            }

            // Kembalikan kursi di sub-schedule terkait
            console.log(`Returning ${total_passengers} seats to SubSchedule ID: ${subSchedule.id}`);
            subScheduleSeatAvailability.available_seats += total_passengers;
            await subScheduleSeatAvailability.save({ transaction });

            console.log(`Berhasil mengembalikan ${total_passengers} kursi untuk SubSchedule ID: ${subSchedule.id}.`);
        }

    } catch (error) {
        console.error(`Gagal melepaskan kursi untuk Main Schedule ID: ${schedule_id}`, error);
        throw error;
    }
};

module.exports = releaseMainScheduleSeats;