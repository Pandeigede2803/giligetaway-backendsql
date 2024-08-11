const formatSeatAvailability = (seatAvailability) => {
    if (!seatAvailability) return null;

    let schedule = null;
    let subschedules = [];

    if (seatAvailability.Schedule) {
        schedule = {
            id: seatAvailability.Schedule.id,
            boat: seatAvailability.Schedule.Boat ? seatAvailability.Schedule.Boat.boat_name : null,
            destination_from: seatAvailability.Schedule.DestinationFrom ? seatAvailability.Schedule.DestinationFrom.name : null,
            destination_to: seatAvailability.Schedule.DestinationTo ? seatAvailability.Schedule.DestinationTo.name : null,
            departure_time: seatAvailability.Schedule.departure_time,
            arrival_time: seatAvailability.Schedule.arrival_time
        };
    }

    if (seatAvailability.SubSchedules && seatAvailability.SubSchedules.length > 0) {
        subschedules = seatAvailability.SubSchedules.map(subSchedule => ({
            id: subSchedule.id,
            parent_schedule: {
                id: subSchedule.Schedule.id,
                boat: subSchedule.Schedule.Boat ? subSchedule.Schedule.Boat.boat_name : null,
                destination_from: subSchedule.Schedule.DestinationFrom ? subSchedule.Schedule.DestinationFrom.name : null,
                destination_to: subSchedule.Schedule.DestinationTo ? subSchedule.Schedule.DestinationTo.name : null
            },
            available_seats: seatAvailability.available_seats,
            availability_status: seatAvailability.availability
        }));
    }

    return {
        date: seatAvailability.date,
        available_seats: seatAvailability.available_seats,
        availability_status: seatAvailability.availability,
        schedule,
        subschedules
    };
};

module.exports = formatSeatAvailability;
