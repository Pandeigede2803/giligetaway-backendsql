const { SeatAvailability } = require('../models'); // Adjust the path as needed

const checkAvailableSeats = async (req, res) => {
    const { schedule_id, booking_date } = req.query;

    try {
        // Fetch seat availability
        const seatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id,
                date: booking_date
            }
        });

        if (!seatAvailability) {
            return res.status(404).json({ error: `Seat availability not found for schedule ID ${schedule_id} on date ${booking_date}.` });
        }

        // Return available seats
        return res.status(200).json({ available_seats: seatAvailability.available_seats });
    } catch (error) {
        console.log('Error checking available seats:', error.message);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = {
    checkAvailableSeats
};
