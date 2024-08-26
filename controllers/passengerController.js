const { Passenger } = require('../models');

const createPassenger = async (req, res) => {
    try {
        const passenger = await Passenger.create(req.body);
        res.status(201).json(passenger);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getPassengers = async (req, res) => {
    try {
        const passengers = await Passenger.findAll();
        res.status(200).json(passengers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getPassengerById = async (req, res) => {
    try {
        const passenger = await Passenger.findByPk(req.params.id);
        if (passenger) {
            res.status(200).json(passenger);
        } else {
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updatePassenger = async (req, res) => {
    try {
        const passenger = await Passenger.findByPk(req.params.id);
        if (passenger) {
            await passenger.update(req.body);
            res.status(200).json(passenger);
        } else {
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deletePassenger = async (req, res) => {
    try {
        const passenger = await Passenger.findByPk(req.params.id);
        if (passenger) {
            await passenger.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



const getPassengersByScheduleAndSubSchedule = async (req, res) => {
    console.log('getPassengersByScheduleAndSubSchedule: start');
    const { selectedDate } = req.query;

    try {
        // Step 1: Filter bookings based on the selected date
        console.log('getPassengersByScheduleAndSubSchedule: filtering bookings by date');
        const bookings = await Booking.findAll({
            where: {
                booking_date: selectedDate
            },
            include: [
                {
                    association: 'passengers', // Include passengers associated with the bookings
                    attributes: ['id', 'name', 'nationality', 'passenger_type']
                }
            ]
        });

        // Step 2: Split bookings into two categories
        console.log('getPassengersByScheduleAndSubSchedule: splitting bookings by schedule and subschedule');
        const scheduleOnlyBookings = bookings.filter(booking => booking.schedule_id && !booking.subschedule_id);
        const subScheduleBookings = bookings.filter(booking => booking.schedule_id && booking.subschedule_id);

        // Step 3: Respond with the split data
        console.log('getPassengersByScheduleAndSubSchedule: sending response');
        res.status(200).json({
            scheduleOnlyBookings,
            subScheduleBookings
        });
    } catch (error) {
        console.log('getPassengersByScheduleAndSubSchedule: catch error');
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createPassenger,
    getPassengersByScheduleAndSubSchedule,
    getPassengers,
    getPassengerById,
    updatePassenger,
    deletePassenger
};
