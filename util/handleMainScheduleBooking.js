
const { sequelize, Booking, SeatAvailability,Destination,SubSchedule,Transport, Schedule, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const handleMainScheduleBooking = async (schedule_id, booking_date, total_passengers, transaction) => {
    // Ambil jadwal dan pastikan Boat tersedia
    const schedule = await Schedule.findByPk(schedule_id, {
        include: [
            {
                model: Boat,
                as: 'Boat'
            },
            {
                model: SubSchedule,
                as: 'SubSchedules' // Pastikan ini sesuai dengan alias dalam definisi hubungan
            }
        ],
        transaction
    });

    if (!schedule) {
        throw new Error('Jadwal tidak tersedia');
    }

    // Gunakan tanggal tanpa waktu
    const formattedDate = booking_date.split('T')[0];  // Ambil hanya bagian tanggalnya
    console.log(`Formatted date used for query: ${formattedDate}`);

    // Cek jika seatAvailability sudah ada untuk MainSchedule
    let seatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id: schedule_id,
            transit_id: null,
            subschedule_id: null,
            date: formattedDate  // Gunakan hanya tanggal
        },
        transaction
    });

    // Jika SeatAvailability tidak ditemukan, buat entri baru
    if (!seatAvailability) {
        console.log(`SeatAvailability tidak ditemukan. Membuat entri baru untuk MainSchedule ID: ${schedule_id} pada tanggal: ${formattedDate}`);
        seatAvailability = await SeatAvailability.create({
            schedule_id: schedule_id,
            transit_id: null,
            subschedule_id: null,
            available_seats: schedule.Boat.capacity,  // Inisialisasi dengan kapasitas boat
            date: formattedDate,
            availability: true
        }, { transaction });
    } else {
        console.log(`Found existing SeatAvailability with ID: ${seatAvailability.id}`);
        console.log(`Existing available seats before subtraction: ${seatAvailability.available_seats}`);
    }

    // Jika jumlah kursi yang tersedia kurang dari penumpang, keluarkan error
    if (seatAvailability.available_seats < total_passengers) {
        throw new Error('Kursi tidak cukup tersedia');
    }

    seatAvailability.available_seats -= total_passengers;
    console.log(`Available seats after subtraction: ${seatAvailability.available_seats}`);

    await seatAvailability.save({ transaction });

    // Update juga SeatAvailability untuk setiap SubSchedule yang terkait
    for (const subSchedule of schedule.SubSchedules) {
        console.log(`Updating SeatAvailability for SubSchedule ID: ${subSchedule.id}`);
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
            console.log(`Creating new SeatAvailability for SubSchedule ID: ${subSchedule.id}`);
            subScheduleSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                transit_id: null,
                subschedule_id: subSchedule.id,
                available_seats: seatAvailability.available_seats, // Sama dengan MainSchedule
                date: formattedDate,
                availability: true
            }, { transaction });
        } else {
            subScheduleSeatAvailability.available_seats = seatAvailability.available_seats;
            await subScheduleSeatAvailability.save({ transaction });
        }
    }

    return seatAvailability;
};

module.exports = handleMainScheduleBooking;

module.exports = handleMainScheduleBooking;
