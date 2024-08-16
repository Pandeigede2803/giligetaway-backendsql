const handleMainScheduleBooking = async (schedule_id, booking_date, total_passengers, transaction) => {
    const schedule = await Schedule.findByPk(schedule_id, { transaction });

    if (!schedule) {
        throw new Error('Jadwal tidak tersedia');
    }

    // Cek atau buat seat availability untuk jadwal utama
    let seatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id: schedule_id,
            transit_id: null,
            sub_schedule_id: null,
            date: booking_date
        },
        transaction
    });

    if (!seatAvailability) {
        const boatCapacity = schedule.boat.capacity;

        seatAvailability = await SeatAvailability.create({
            schedule_id: schedule_id,
            transit_id: null,
            sub_schedule_id: null,
            available_seats: boatCapacity,
            date: booking_date,
            availability: true
        }, { transaction });
    }

    if (seatAvailability.available_seats < total_passengers) {
        throw new Error('Kursi tidak cukup tersedia');
    }

    // Kurangi kursi yang tersedia
    seatAvailability.available_seats -= total_passengers;
    await seatAvailability.save({ transaction });
};

module.exports = handleMainScheduleBooking;