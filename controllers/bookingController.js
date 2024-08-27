
const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op } = require("sequelize");
const { updateAgentMetrics } = require('../util/updateAgentMetrics');
const {addTransportBookings,addPassengers} =require('../util/bookingUtil');
// const {handleDynamicSeatAvailability} = require ("../util/handleDynamicSeatAvailability");
const handleMainScheduleBooking = require('../util/handleMainScheduleBooking');
const handleSubScheduleBooking = require('../util/handleSubScheduleBooking');
const { handleExpiredBookings } = require('../util/cornJobs');;  // Mengimpor fungsi dari cronJobs.js


const moment = require('moment'); // Use moment.js for date formatting

const getBookingsByDate = async (req, res) => {
    console.log('getBookingsByDate: start');
    let { selectedDate } = req.query;

    try {
        // Ensure the selectedDate is in the correct format (YYYY-MM-DD)
        selectedDate = moment(selectedDate).format('YYYY-MM-DD');

        console.log('getBookingsByDate: filtering bookings by date');
        const bookings = await Booking.findAll({
            where: {
                booking_date: {
                    [Op.eq]: selectedDate
                }
            },
            include: [
                {
                    association: 'passengers', // Include passengers associated with the bookings
                    attributes: ['id', 'name', 'nationality', 'passenger_type']
                },
                {
                    association: 'schedule', // Include schedule details if needed
                    attributes: ['id', 'departure_time', 'arrival_time']
                },
                {
                    association: 'subSchedule', // Include subschedule details if needed
                    attributes: ['id', 'validity_start', 'validity_end']
                }
            ]
        });

        if (!bookings || bookings.length === 0) {
            return res.status(404).json({ message: 'No bookings found for the selected date' });
        }

        console.log('getBookingsByDate: sending response');
        res.status(200).json(bookings);
    } catch (error) {
        console.log('getBookingsByDate: catch error');
        res.status(400).json({ error: error.message });
    }
};

const createBookingWithTransit = async (req, res) => {
    const {
        schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
        gross_total, payment_status, transports, contact_name, contact_phone,
        contact_passport_id, contact_nationality, contact_email, payment_method,
        booking_source, adult_passengers, child_passengers, infant_passengers,
        ticket_id, transit_details
    } = req.body;

    try {
        const result = await sequelize.transaction(async (t) => {
            const booking = await Booking.create({
                schedule_id, subschedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
                contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
                payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
                ticket_id
            }, { transaction: t });

            let remainingSeatAvailabilities;
            if (subschedule_id) {
                remainingSeatAvailabilities = await handleSubScheduleBooking(schedule_id, subschedule_id, booking_date, total_passengers, transit_details, t);
            } else {
                remainingSeatAvailabilities = await handleMainScheduleBooking(schedule_id, booking_date, total_passengers, t);
            }

            // Menggunakan utilitas untuk menambahkan data penumpang ke tabel Passenger
            await addPassengers(passengers, booking.id, t);

            // Menggunakan utilitas untuk menambahkan data transportasi ke tabel TransportBooking
            await addTransportBookings(transports, booking.id, total_passengers, t);

            // Memperbarui metrik agen jika agent_id tersedia dan payment_status 'paid'
            if (agent_id && payment_status === 'paid') {
                await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, t);
            }

         // Corrected part: Link Booking with the correct SeatAvailability
         if (remainingSeatAvailabilities && remainingSeatAvailabilities.length > 0) {
            const bookingSeatAvailabilityData = remainingSeatAvailabilities.map(sa => ({
                booking_id: booking.id,
                seat_availability_id: sa.id
            }));
            await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, { transaction: t });
        }
            const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });

            // Kembalikan booking, remainingSeatAvailabilities, dan transportBookings
            res.status(201).json({ 
                booking, 
                remainingSeatAvailabilities, 
                transportBookings 
            });
        });
    } catch (error) {
        console.log('Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};
const createBookingWithoutTransit = async (req, res) => {
    const {
        schedule_id, total_passengers, booking_date, passengers, agent_id,
        gross_total, payment_status, transports, contact_name, contact_phone,
        contact_passport_id, contact_nationality, contact_email, payment_method,
        booking_source, adult_passengers, child_passengers, infant_passengers,
        ticket_id
    } = req.body;

    try {
        const result = await sequelize.transaction(async (t) => {
            console.log('Creating booking...');
            // Create booking
            const booking = await Booking.create({
                schedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
                contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
                payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
                ticket_id
            }, { transaction: t });
            console.log('Booking created:', booking);

            // Find seat availability for the schedule and date
            let seatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id,
                    date: booking_date
                },
                transaction: t
            });

            if (!seatAvailability) {
                console.log('Seat availability not found, creating new entry...');
                // Fetch schedule to get initial available seats
                const schedule = await Schedule.findByPk(schedule_id, {
                    include: {
                        model: Boat,
                        as: 'Boat',
                        attributes: ['capacity']
                    },
                    transaction: t
                });

                if (!schedule) {
                    throw new Error(`Schedule with ID ${schedule_id} not found.`);
                }

                // Create initial seat availability entry using boat capacity
                seatAvailability = await SeatAvailability.create({
                    schedule_id,
                    available_seats: schedule.Boat.capacity,
                    date: booking_date,
                    availability: true // Ensure availability is set to true by default
                }, { transaction: t });
                console.log('Seat availability created:', seatAvailability);
            }

            if (payment_status === 'paid') {
                console.log('Checking available seats...');
                if (seatAvailability.available_seats < total_passengers) {
                    throw new Error('Not enough seats available on the schedule.');
                }

                console.log('Updating seat availability...');
                // Update seat availability
                await seatAvailability.update({ available_seats: seatAvailability.available_seats - total_passengers }, { transaction: t });
                console.log('Seat availability updated:', seatAvailability);
            }

            console.log('Adding passengers in batch...');
            // Add passengers in batch
            const passengerData = passengers.map((passenger) => ({
                booking_id: booking.id,
                ...passenger
            }));
            await Passenger.bulkCreate(passengerData, { transaction: t });
            console.log('Passengers added:', passengerData);

            console.log('Adding transports in batch...');
            // Add transports in batch
            const transportData = transports.map((transport) => ({
                booking_id: booking.id,
                transport_id: transport.transport_id,
                quantity: transport.quantity,
                transport_price: transport.transport_price, // Include transport price
                transport_type: transport.transport_type,
                note: transport.note
            }));
            await TransportBooking.bulkCreate(transportData, { transaction: t });
            console.log('Transports added:', transportData);

            console.log('Updating agent metrics if agent_id is present...');
            // Update agent metrics if agent_id is present
            if (agent_id) {
                await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, t);
                console.log('Agent metrics updated for agent_id:', agent_id);
            }

            console.log('Linking booking with seat availability...');

            
            // Link booking with seat availability
            const bookingSeatAvailability = await BookingSeatAvailability.create({
                booking_id: booking.id,
                seat_availability_id: seatAvailability.id
            }, { transaction: t });
            console.log('Booking linked with seat availability:', bookingSeatAvailability);

            console.log('Returning the created booking along with transport bookings and seat availability...');
            // Return the created booking along with transport bookings and seat availability
            const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });
            return { booking, transportBookings, seatAvailability, bookingSeatAvailability };
        });

        res.status(201).json(result);
    } catch (error) {
        console.log('Error creating booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};


// const createBookingWithTransit = async (req, res) => {
//     const {
//         schedule_id, subschedule_id, total_passengers, booking_date, passengers, agent_id,
//         gross_total, payment_status, transports, contact_name, contact_phone,
//         contact_passport_id, contact_nationality, contact_email, payment_method,
//         booking_source, adult_passengers, child_passengers, infant_passengers,
//         ticket_id, transit_details
//     } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             // Membuat entri baru di tabel Booking
//             const booking = await Booking.create({
//                 schedule_id, subschedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
//                 contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
//                 payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
//                 ticket_id
//             }, { transaction: t });

//             let remainingSeatAvailabilities;
//             // Memanggil fungsi untuk mengelola ketersediaan kursi berdasarkan jadwal utama atau subjadwal
//             if (subschedule_id) {
//                 remainingSeatAvailabilities = await handleSubScheduleBooking(schedule_id, subschedule_id, booking_date, total_passengers, transit_details, t);
//             } else {
//                 remainingSeatAvailabilities = await handleMainScheduleBooking(schedule_id, booking_date, total_passengers, t);
//             }

//             // Menambahkan data penumpang ke tabel Passenger
//             const passengerData = passengers.map((passenger) => ({
//                 booking_id: booking.id,
//                 ...passenger
//             }));
//             await Passenger.bulkCreate(passengerData, { transaction: t });

//             // Menambahkan data transportasi ke tabel TransportBooking
//             const transportData = transports.map((transport) => ({
//                 booking_id: booking.id,
//                 transport_id: transport.transport_id,
//                 quantity: transport.quantity,
//                 transport_price: transport.transport_price,
//                 transport_type: transport.transport_type,
//                 note: transport.note
//             }));
//             await TransportBooking.bulkCreate(transportData, { transaction: t });

//             // Memperbarui metrik agen jika agent_id tersedia dan payment_status 'paid'
//             if (agent_id && payment_status === 'paid') {
//                 await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, t);
//             }

//             // Membuat entri di tabel BookingSeatAvailability untuk menghubungkan pemesanan dengan ketersediaan kursi
//             const bookingSeatAvailabilityData = transit_details.map(transit => ({
//                 booking_id: booking.id,
//                 seat_availability_id: transit.seat_availability_id
//             }));
//             await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, { transaction: t });

//             const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });

//             // Mengembalikan booking dan sisa seatAvailability
//             res.status(201).json({ booking, remainingSeatAvailabilities, transportBookings });
//         });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// };




const getBookingContact = async (req, res) => {
    try {
        const bookings = await Booking.findAll({
            attributes: [
                'id',
                'contact_name',
                'contact_phone',
                'contact_passport_id',
                'contact_nationality',
                'contact_email'
            ]
        });
        console.log("Contact list:", JSON.stringify(bookings, null, 2));
        res.status(200).json(bookings.map(b => ({ id: b.id, ...b.dataValues })));
    } catch (error) {
        console.log('Error getting contact list:', error.message);
        res.status(400).json({ error: error.message });
    }
};



const getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findByPk(
            req.params.id, {
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        {
                            model: Transit,
                            as: 'Transits',
                            include: [
                                {
                                    model: Destination,
                                    as: 'Destination'
                                }]
                        },
                        {
                            model: Destination,
                            as: 'FromDestination'
                        },
                        {
                            model: Destination,
                            as: 'ToDestination'
                        }
                    ]
                },
                {
                    model: SeatAvailability,
                    as: 'SeatAvailabilities',
                    // include: [
                    //     {
                    //         model: BookingSeatAvailability,
                    //         as: 'bookingSeatAvailability'
                    //     }
                    // ]
                },
                // {
                //     model: BookingSeatAvailability,
                //     as: 'bookingSeatAvailability'

                // },
                {
                    model: Passenger,
                    as: 'passengers'
                },
                {
                    model: TransportBooking,
                    as: 'transportBookings',
                    include: [
                        {
                            model: Transport,
                            as: 'transport'
                        }
                    ]
                },
                {
                    model: Agent,
                    as: 'Agent',
                    // include: [
                    //     {
                    //         model: AgentMetrics,
                    //         as: 'agentMetrics'
                    //     }
                    // ]
                }
            ]
        });
        if (booking) {
            console.log('Booking retrieved:', booking);
            res.status(200).json(booking);
        } else {
            console.log('Booking not found:', req.params.id);
            res.status(404).json({ error: 'Booking not found' });
        }
    } catch (error) {
        console.log('Error retrieving booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};
const createBookingWithTransit2 = async (req, res) => {
    const {
        schedule_id, total_passengers, booking_date, passengers, agent_id,
        gross_total, payment_status, transports, contact_name, contact_phone,
        contact_passport_id, contact_nationality, contact_email, payment_method,
        booking_source, adult_passengers, child_passengers, infant_passengers,
        ticket_id, transit_details
    } = req.body;

    try {
        const result = await sequelize.transaction(async (t) => {
            // Membuat entri baru di tabel Booking
            const booking = await Booking.create({
                schedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
                contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
                payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
                ticket_id
            }, { transaction: t });

            // Memanggil fungsi untuk mengelola ketersediaan kursi
            await handleDynamicSeatAvailability(schedule_id, booking_date, total_passengers, payment_status, transit_details, t);

            // Menambahkan data penumpang ke tabel Passenger
            const passengerData = passengers.map((passenger) => ({
                booking_id: booking.id,
                ...passenger
            }));
            await Passenger.bulkCreate(passengerData, { transaction: t });

            // Menambahkan data transportasi ke tabel TransportBooking
            const transportData = transports.map((transport) => ({
                booking_id: booking.id,
                transport_id: transport.transport_id,
                quantity: transport.quantity,
                transport_price: transport.transport_price,
                transport_type: transport.transport_type,
                note: transport.note
            }));
            await TransportBooking.bulkCreate(transportData, { transaction: t });

            // Memperbarui metrik agen jika agent_id tersedia
            if (agent_id) {
                await updateAgentMetrics(agent_id, gross_total, total_passengers, payment_status, t);
            }

            // Membuat entri di tabel BookingSeatAvailability untuk menghubungkan pemesanan dengan ketersediaan kursi
            const bookingSeatAvailabilityData = transit_details.map(transit => ({
                booking_id: booking.id,
                seat_availability_id: transit.seat_availability_id
            }));
            await BookingSeatAvailability.bulkCreate(bookingSeatAvailabilityData, { transaction: t });

            const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });
            res.status(201).json({ booking, transportBookings });
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};







const getBookings = async (req, res) => {
    try {
        const bookings = await Booking.findAll({
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        {
                            model: Transit,
                            as: 'Transits',
                            include: [
                                {
                                    model: Destination,
                                    as: 'Destination'
                                }]
                        },
                        {
                            model: Destination,
                            as: 'FromDestination'
                        },
                        {
                            model: Destination,
                            as: 'ToDestination'
                        }
                    ]
                },
                {
                    model: SeatAvailability,
                    as: 'SeatAvailabilities',
                    through: {
                        model: BookingSeatAvailability,
                        attributes: [] // Exclude the join table attributes if not needed
                      }
                },
                // {
                //     model: BookingSeatAvailability,
                //     as: 'bookingSeatAvailability'

                // },
                {
                    model: Passenger,
                    as: 'passengers'
                },
                {
                    model: TransportBooking,
                    as: 'transportBookings',
                    include: [
                        {
                            model: Transport,
                            as: 'transport'
                        }
                    ]
                },
                {
                    model: Agent,
                    as: 'Agent',
                    // include: [
                    //     {
                    //         model: AgentMetrics,
                    //         as: 'agentMetrics'
                    //     }
                    // ]
                }
            ]
        });
        console.log('All bookings retrieved:', bookings);
        res.status(200).json(bookings);
    } catch (error) {
        console.log('Error retrieving bookings:', error.message);
        res.status(400).json({ error: error.message });
    }
};



const getBookingByTicketId = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            where: { ticket_id: req.params.ticket_id },
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        {
                            model: Transit,
                            as: 'Transits',
                            include: [
                                {
                                    model: Destination,
                                    as: 'Destination'
                                }
                            ]
                        },
                        {
                            model: Destination,
                            as: 'FromDestination'
                        },
                        {
                            model: Destination,
                            as: 'ToDestination'
                        }
                    ]
                },
                {
                    model: SeatAvailability,
                    as: 'SeatAvailabilities',
                },
                {
                    model: Passenger,
                    as: 'passengers'
                },
                {
                    model: TransportBooking,
                    as: 'transportBookings',
                    include: [
                        {
                            model: Transport,
                            as: 'transport'
                        }
                    ]
                },
                {
                    model: Agent,
                    as: 'Agent',
                }
            ]
        });
        if (booking) {
            console.log('Booking retrieved:', booking);
            res.status(200).json(booking);
        } else {
            console.log('Booking not found:', req.params.ticket_id);
            res.status(404).json({ error: 'Booking not found' });
        }
    } catch (error) {
        console.log('Error retrieving booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};


const createBooking = async (req, res) => {
    try {
        const result = await sequelize.transaction(async (t) => {
            // Create booking
            const booking = await Booking.create(req.body, { transaction: t });

            console.log('Booking data from body:', req.body);

            // Fetch schedule
            const schedule = await Schedule.findByPk(req.body.schedule_id, { transaction: t });
            if (!schedule) {
                throw new Error(`Schedule with ID ${req.body.schedule_id} not found.`);
            }

            if (schedule.available_seats < req.body.total_passengers) {
                throw new Error('Not enough seats available on the schedule.');
            }

            // Update schedule available seats
            await schedule.update({ available_seats: schedule.available_seats - req.body.total_passengers }, { transaction: t });

            // Check and update each transit, and create booking-transit associations
            for (const transit_id of req.body.transits) {
                const transit = await Transit.findByPk(transit_id, { transaction: t });
                if (!transit) {
                    throw new Error(`Transit with ID ${transit_id} not found.`);
                }

                if (transit.available_seats < req.body.total_passengers) {
                    throw new Error(`Not enough seats available on transit with ID ${transit_id}.`);
                }

                // Update transit available seats
                await transit.update({ available_seats: transit.available_seats - req.body.total_passengers }, { transaction: t });

                // Create booking-transit association
                await booking.addTransit(transit, { transaction: t });
            }

            console.log('Booking created:', booking);
            return booking;
        });

        res.status(201).json(result);
    } catch (error) {
        console.log('Error creating booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};


/**
 * Update a booking
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The updated booking object
 */
const updateBooking = async (req, res) => {
    // Get the booking ID from the request parameters
    const { id } = req.params;
    // Get the new schedule ID, transit ID, and total passengers from the request body
    const { schedule_id, transit_id, total_passengers } = req.body;

    try {
        // Start a database transaction
        await sequelize.transaction(async (t) => {
            // Find the booking with the given ID
            const booking = await Booking.findByPk(id, { transaction: t });
            // If the booking is not found, throw an error
            if (!booking) {
                throw new Error('Booking not found.');
            }

            // Get the old schedule ID, old total passengers, and old transit ID from the booking
            const { schedule_id: old_schedule_id, total_passengers: old_total_passengers, transit_id: old_transit_id } = booking;

            // Find the old schedule and update its available seats
            const oldSchedule = await Schedule.findByPk(old_schedule_id, { transaction: t });
            await oldSchedule.update({ available_seats: oldSchedule.available_seats + old_total_passengers }, { transaction: t });

            // Find the old transit and update its available seats
            const oldTransit = await Transit.findByPk(old_transit_id, { transaction: t });
            await oldTransit.update({ available_seats: oldTransit.available_seats + old_total_passengers }, { transaction: t });

            // Find the new schedule and check its available seats
            const newSchedule = await Schedule.findByPk(schedule_id, { transaction: t });
            if (newSchedule.available_seats < total_passengers) {
                throw new Error('Not enough seats available on the new schedule.');
            }
            // Update the new schedule's available seats
            await newSchedule.update({ available_seats: newSchedule.available_seats - total_passengers }, { transaction: t });

            // Find the new transit and check its available seats
            const newTransit = await Transit.findByPk(transit_id, { transaction: t });
            if (newTransit.available_seats < total_passengers) {
                throw new Error(`Not enough seats available on new transit with ID ${transit_id}.`);
            }
            // Update the new transit's available seats
            await newTransit.update({ available_seats: newTransit.available_seats - total_passengers }, { transaction: t });

            // Update the booking with the new schedule ID, transit ID, and total passengers
            await booking.update(req.body, { transaction: t });

            // Log the updated booking and return it in the response
            console.log('Booking updated:', booking);
            res.status(200).json(booking);
        });
    } catch (error) {
        // Log the error and return it in the response
        console.log('Error updating booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const updateBookingPayment = async (req, res) => {
    const { id } = req.params;
    const { payment_method, payment_status } = req.body;

    try {
        await sequelize.transaction(async (t) => {
            const booking = await Booking.findByPk(id, { transaction: t });
            console.log('Booking found:', booking);
            if (!booking) {
                throw new Error('Booking not found.');
            }

            const currentStatus = booking.payment_status;

            if (payment_status === 'paid' && currentStatus !== 'paid') {
                const seatAvailabilities = await SeatAvailability.findAll({
                    where: { schedule_id: booking.schedule_id },
                    transaction: t
                });

                for (const seatAvailability of seatAvailabilities) {
                    // Check if seat availability is frozen
                    if (!seatAvailability.availability) {
                        throw new Error(`The seat availability for date: ${seatAvailability.date} is frozen and cannot be booked at the moment.`);
                    }

                    // Check if there are enough available seats
                    if (seatAvailability.available_seats < booking.total_passengers) {
                        throw new Error(`The seat availability for date: ${seatAvailability.date} is full.`);
                    }

                    await seatAvailability.update({
                        available_seats: seatAvailability.available_seats - booking.total_passengers
                    }, { transaction: t });
                }
            }

            await booking.update({ payment_method, payment_status }, { transaction: t });

            console.log('Booking updated:', booking);
            res.status(200).json(booking);
        });
    } catch (error) {
        console.log('Error updating booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};
const updateBookingDate = async (req, res) => {
    const { id } = req.params;
    const { booking_date } = req.body;

    try {
        await sequelize.transaction(async (t) => {
            console.log('Finding booking...');
            const booking = await Booking.findByPk(id, { transaction: t });
            if (!booking) {
                throw new Error('Booking not found.');
            }
            console.log('Current booking found:', booking);

            const currentSeatAvailability = await SeatAvailability.findOne({
                where: { date: booking.booking_date, schedule_id: booking.schedule_id },
                transaction: t
            });
            console.log('Current seat availability found:', currentSeatAvailability);

            let newSeatAvailability = await SeatAvailability.findOne({
                where: { date: booking_date, schedule_id: booking.schedule_id },
                transaction: t
            });

            if (!newSeatAvailability) {
                console.log('New seat availability not found, creating new entry...');

                const schedule = await Schedule.findByPk(booking.schedule_id, {
                    include: {
                        model: Boat,
                        as: 'Boat',
                        attributes: ['capacity']
                    },
                    transaction: t
                });

                if (!schedule) {
                    throw new Error(`Schedule with ID ${booking.schedule_id} not found.`);
                }

                newSeatAvailability = await SeatAvailability.create({
                    schedule_id: booking.schedule_id,
                    available_seats: schedule.Boat.capacity - booking.total_passengers,
                    total_seats: schedule.Boat.capacity,
                    date: booking_date,
                    availability: true
                }, { transaction: t });
                console.log('New seat availability created:', newSeatAvailability);
            }

            if (!newSeatAvailability.availability) {
                throw new Error(`The seat availability for date: ${booking_date} is frozen and cannot be booked at the moment.`);
            }

            if (newSeatAvailability.available_seats < booking.total_passengers) {
                throw new Error(`The seat availability for date: ${booking_date} is full.`);
            }

            console.log('Updating seat availability...');
            
            if (currentSeatAvailability) {
                await currentSeatAvailability.update({
                    available_seats: currentSeatAvailability.available_seats + booking.total_passengers
                }, { transaction: t });
                console.log('Updated current seat availability:', currentSeatAvailability);
            } else {
                console.log('No seat availability found for the current booking date, skipping update...');
            }

            await newSeatAvailability.update({
                available_seats: newSeatAvailability.available_seats - booking.total_passengers
            }, { transaction: t });
            console.log('Updated new seat availability:', newSeatAvailability);

            console.log('Updating booking date...');
            await booking.update({ booking_date }, { transaction: t });
            console.log('Booking date updated:', booking);

            res.status(200).json(booking);
        });
    } catch (error) {
        console.log('Error updating booking date:', error.message);
        res.status(400).json({ error: error.message });
    }
};



const deleteBooking = async (req, res) => {
    const { id } = req.params;

    try {
        await sequelize.transaction(async (t) => {
            const booking = await Booking.findByPk(id, { transaction: t });
            if (!booking) {
                throw new Error('Booking not found.');
            }

            const { schedule_id, transit_id, total_passengers } = booking;

            const schedule = await Schedule.findByPk(schedule_id, { transaction: t });
            await schedule.update({ available_seats: schedule.available_seats + total_passengers }, { transaction: t });

            const transit = await Transit.findByPk(transit_id, { transaction: t });
            await transit.update({ available_seats: transit.available_seats + total_passengers }, { transaction: t });

            await booking.destroy({ transaction: t });

            console.log('Booking deleted:', id);
        });

        res.status(204).json();
    } catch (error) {
        console.log('Error deleting booking:', error.message);
        res.status(400).json({ error: error.message });
    }
};


module.exports = {
    createBooking,
    getBookingContact,
    getBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
    createBookingWithTransit2,
    createBookingWithTransit,
    createBookingWithoutTransit,
    getBookingByTicketId,
    updateBookingPayment,
    updateBookingDate,
    getBookingsByDate

};



// const createBookingWithoutTransit = async (req, res) => {
//     const {
//         schedule_id, total_passengers, booking_date, passengers, agent_id,
//         gross_total, payment_status, transports, contact_name, contact_phone,
//         contact_passport_id, contact_nationality, contact_email, payment_method,
//         booking_source, adult_passengers, child_passengers, infant_passengers,
//         ticket_id
//     } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             console.log('Creating booking...');
//             // Create booking
//             const booking = await Booking.create({
//                 schedule_id, total_passengers, booking_date, agent_id, gross_total, payment_status,
//                 contact_name, contact_phone, contact_passport_id, contact_nationality, contact_email,
//                 payment_method, booking_source, adult_passengers, child_passengers, infant_passengers,
//                 ticket_id
//             }, { transaction: t });
//             console.log('Booking created:', booking);

//             if (payment_status === 'paid') {
//                 console.log('Fetching seat availability...');
//                 // Fetch seat availability
//                 const seatAvailability = await SeatAvailability.findOne({
//                     where: {
//                         schedule_id,
//                         date: booking_date
//                     },
//                     transaction: t
//                 });

//                 if (!seatAvailability) {
//                     throw new Error(`Seat availability not found for schedule ID ${schedule_id} on date ${booking_date}.`);
//                 }

//                 console.log('Checking available seats...');
//                 if (seatAvailability.available_seats < total_passengers) {
//                     throw new Error('Not enough seats available on the schedule.');
//                 }

//                 console.log('Updating seat availability...');
//                 // Update seat availability
//                 await seatAvailability.update({ available_seats: seatAvailability.available_seats - total_passengers }, { transaction: t });
//             }

//             console.log('Adding passengers in batch...');
//             // Add passengers in batch
//             const passengerData = passengers.map((passenger) => ({
//                 booking_id: booking.id,
//                 ...passenger
//             }));
//             await Passenger.bulkCreate(passengerData, { transaction: t });

//             console.log('Adding transports in batch...');
//             // Add transports in batch
//             const transportData = transports.map((transport) => ({
//                 booking_id: booking.id,
//                 transport_id: transport.transport_id,
//                 quantity: transport.quantity,
//                 transport_type: transport.transport_type,
//                 note: transport.note
//             }));
//             await TransportBooking.bulkCreate(transportData, { transaction: t });

//             console.log('Updating agent metrics if agent_id is present...');
//             // Update agent metrics if agent_id is present
//             if (agent_id) {
//                 const agentMetrics = await AgentMetrics.findOne({ where: { agent_id }, transaction: t });

//                 if (agentMetrics) {
//                     agentMetrics.total_revenue += parseFloat(gross_total);
//                     agentMetrics.total_bookings += 1;
//                     agentMetrics.total_customers += total_passengers;
//                     if (payment_status === 'pending') {
//                         agentMetrics.pending_payment += parseFloat(gross_total);
//                         agentMetrics.gross_pending_payment += parseFloat(gross_total);
//                     } else if (payment_status === 'paid') {
//                         const agent = await Agent.findByPk(agent_id, { transaction: t });
//                         const commission = parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100;
//                         agentMetrics.outstanding += commission;
//                         agentMetrics.net_profit += commission;
//                     }
//                     await agentMetrics.save({ transaction: t });
//                 } else {
//                     const agent = await Agent.findByPk(agent_id, { transaction: t });
//                     const newAgentMetricsData = {
//                         agent_id,
//                         total_revenue: parseFloat(gross_total),
//                         total_bookings: 1,
//                         total_customers: total_passengers,
//                         pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
//                         gross_pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
//                         outstanding: payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0,
//                         net_profit: payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0
//                     };
//                     await AgentMetrics.create(newAgentMetricsData, { transaction: t });
//                 }
//             }

//             console.log('Returning the created booking along with transport bookings...');
//             // Return the created booking along with transport bookings
//             const transportBookings = await TransportBooking.findAll({ where: { booking_id: booking.id }, transaction: t });
//             return { booking, transportBookings };
//         });

//         res.status(201).json(result);
//     } catch (error) {
//         console.log('Error creating booking:', error.message);
//         res.status(400).json({ error: error.message });
//     }
// };



// const createBookingWithTransit = async (req, res) => {
//     const { schedule_id, transits, total_passengers, booking_date, passengers } = req.body;

//     try {
//         const result = await sequelize.transaction(async (t) => {
//             // Create booking
//             const booking = await Booking.create({
//                 schedule_id,
//                 total_passengers,
//                 booking_date,
//                 ...req.body
//             }, { transaction: t });

//             // Fetch schedule
//             const schedule = await Schedule.findByPk(schedule_id, { transaction: t });
//             if (!schedule) {
//                 throw new Error(`Schedule with ID ${schedule_id} not found.`);
//             }

//             if (schedule.available_seats < total_passengers) {
//                 throw new Error('Not enough seats available on the schedule.');
//             }

//             // Update schedule available seats
//             await schedule.update({ available_seats: schedule.available_seats - total_passengers }, { transaction: t });

//             // Check and update each transit, and create booking-transit associations
//             for (const transit_id of transits) {
//                 const transit = await Transit.findByPk(transit_id, { transaction: t });
//                 if (!transit) {
//                     throw new Error(`Transit with ID ${transit_id} not found.`);
//                 }

//                 if (transit.available_seats < total_passengers) {
//                     throw new Error(`Not enough seats available on transit with ID ${transit_id}.`);
//                 }

//                 // Update transit available seats
//                 await transit.update({ available_seats: transit.available_seats - total_passengers }, { transaction: t });

//                 // Create booking-transit association
//                 await booking.addTransit(transit, { transaction: t });
//             }

//             // Add passengers
//             for (const passenger of passengers) {
//                 await Passenger.create({
//                     booking_id: booking.id,
//                     ...passenger
//                 }, { transaction: t });
//             }

//             console.log('Booking created:', booking);
//             return booking;
//         });

//         res.status(201).json(result);
//     } catch (error) {
//         console.log('Error creating booking:', error.message);
//         res.status(400).json({ error: error.message });


//     }
// };
