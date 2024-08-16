
const handleSubScheduleBooking = async (schedule_id, subschedule_id, booking_date, total_passengers, transit_details, transaction) => {
    const subSchedule = await SubSchedule.findByPk(subschedule_id, { transaction });

    if (!subSchedule) {
        throw new Error('SubJadwal tidak tersedia');
    }

    const remainingSeatAvailabilities = [];

    // Perbarui seat availability untuk SubSchedule
    for (const transit of transit_details) {
        let seatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                sub_schedule_id: subschedule_id,
                transit_id: transit.transit_id || null,
                date: booking_date
            },
            transaction
        });

        if (!seatAvailability) {
            const schedule = await Schedule.findByPk(schedule_id, { transaction });
            const boatCapacity = schedule.boat.capacity;

            seatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                sub_schedule_id: subschedule_id,
                transit_id: transit.transit_id || null,
                available_seats: boatCapacity,
                date: booking_date,
                availability: true
            }, { transaction });
        }

        if (seatAvailability.available_seats < total_passengers) {
            throw new Error('Kursi tidak cukup tersedia');
        }

        // Kurangi kursi yang tersedia di SubSchedule
        seatAvailability.available_seats -= total_passengers;
        await seatAvailability.save({ transaction });

        remainingSeatAvailabilities.push(seatAvailability);
    }

    // Perbarui seat availability untuk Main Schedule (tanpa transit dan subschedule_id)
    let mainScheduleSeatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id: schedule_id,
            transit_id: null,
            sub_schedule_id: null,
            date: booking_date
        },
        transaction
    });

    if (!mainScheduleSeatAvailability) {
        const schedule = await Schedule.findByPk(schedule_id, { transaction });
        const boatCapacity = schedule.boat.capacity;

        mainScheduleSeatAvailability = await SeatAvailability.create({
            schedule_id: schedule_id,
            transit_id: null,
            sub_schedule_id: null,
            available_seats: boatCapacity,
            date: booking_date,
            availability: true
        }, { transaction });
    }

    if (mainScheduleSeatAvailability.available_seats < total_passengers) {
        throw new Error('Kursi tidak cukup tersedia di jadwal utama');
    }

    // Kurangi kursi yang tersedia di Main Schedule
    mainScheduleSeatAvailability.available_seats -= total_passengers;
    await mainScheduleSeatAvailability.save({ transaction });

    remainingSeatAvailabilities.push(mainScheduleSeatAvailability);

    return remainingSeatAvailabilities;
};
