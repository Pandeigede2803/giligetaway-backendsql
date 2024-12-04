const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const moment = require('moment');
const { findRelatedSubSchedules } = require('../util/handleSubScheduleBooking');

const checkSeatAvailabilityForUpdate = async (req, res, next) => {
    const { id } = req.params;
    const { booking_date } = req.body;

    console.log('\n=== Starting Seat Availability Check ===');
    console.log(`📋 Booking ID: ${id}`);
    console.log(`📅 Requested Date: ${booking_date}`);

    try {
        // Input validation
        if (!booking_date) {
            console.log('❌ Error: Booking date is missing');
            return res.status(400).json({
                error: 'Booking date is required'
            });
        }

        // Find booking with relations
        console.log('\n🔍 Finding booking details...');
        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    include: [{
                        model: Boat,
                        as: 'Boat',
                        attributes: ['capacity']
                    }]
                },
                {
                    model: SubSchedule,
                    as: 'subSchedule'
                }
            ]
        });

        if (!booking) {
            console.log('❌ Error: Booking not found');
            return res.status(404).json({
                error: 'Booking not found'
            });
        }

        console.log('\n📊 Booking Details:');
        console.log(`- Schedule ID: ${booking.schedule_id}`);
        console.log(`- SubSchedule ID: ${booking.subschedule_id || 'None'}`);
        console.log(`- Total Passengers: ${booking.total_passengers}`);
        console.log(`- Boat Capacity: ${booking.schedule.Boat.capacity}`);

        // Schedule availability check
        console.log('\n🔍 Checking schedule availability...');
        if (!booking.schedule.availability) {
            console.log('❌ Main schedule is unavailable');
            return res.status(400).json({
                error: 'The main schedule is currently unavailable'
            });
        }
        console.log('✅ Main schedule is available');

        const availabilityChecks = [];

        if (!booking.subschedule_id) {
            console.log('\n🔍 Checking main schedule seat availability...');
            const mainScheduleSeatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id: booking.schedule_id,
                    subschedule_id: null,
                    date: booking_date
                }
            });

            if (mainScheduleSeatAvailability) {
                console.log(`- Current available seats: ${mainScheduleSeatAvailability.available_seats}`);
                console.log(`- Required seats: ${booking.total_passengers}`);
                
                availabilityChecks.push({
                    type: 'Main Schedule',
                    id: booking.schedule_id,
                    available: mainScheduleSeatAvailability.availability,
                    availableSeats: mainScheduleSeatAvailability.available_seats,
                    needed: booking.total_passengers,
                    sufficient: mainScheduleSeatAvailability.available_seats >= booking.total_passengers
                });
            } else {
                console.log('- No existing seat availability record, will create new');
                availabilityChecks.push({
                    type: 'Main Schedule',
                    id: booking.schedule_id,
                    available: true,
                    availableSeats: booking.schedule.Boat.capacity,
                    needed: booking.total_passengers,
                    sufficient: true
                });
            }
        } else {
            console.log('\n🔍 Checking sub-schedule and related schedules...');
            if (!booking.subSchedule.availability) {
                console.log('❌ Selected sub-schedule is unavailable');
                return res.status(400).json({
                    error: 'The selected sub-schedule is currently unavailable'
                });
            }
            console.log('✅ Selected sub-schedule is available');

            // Find related sub-schedules
            console.log('\n🔄 Finding related sub-schedules...');
            const relatedSubSchedules = await findRelatedSubSchedules(
                booking.schedule_id,
                booking.subSchedule
            );
            console.log(`Found ${relatedSubSchedules.length} related sub-schedules`);

            // Check each related sub-schedule
            for (const subSchedule of relatedSubSchedules) {
                console.log(`\n📊 Checking sub-schedule ID: ${subSchedule.id}`);
                const seatAvailability = await SeatAvailability.findOne({
                    where: {
                        schedule_id: booking.schedule_id,
                        subschedule_id: subSchedule.id,
                        date: booking_date
                    }
                });

                if (seatAvailability) {
                    console.log(`- Current available seats: ${seatAvailability.available_seats}`);
                    console.log(`- Required seats: ${booking.total_passengers}`);
                    
                    availabilityChecks.push({
                        type: 'Sub Schedule',
                        id: subSchedule.id,
                        available: seatAvailability.availability,
                        availableSeats: seatAvailability.available_seats,
                        needed: booking.total_passengers,
                        sufficient: seatAvailability.available_seats >= booking.total_passengers
                    });
                } else {
                    console.log('- No existing seat availability record, will create new');
                    availabilityChecks.push({
                        type: 'Sub Schedule',
                        id: subSchedule.id,
                        available: true,
                        availableSeats: booking.schedule.Boat.capacity,
                        needed: booking.total_passengers,
                        sufficient: true
                    });
                }
            }
        }

        // Print final availability summary
        console.log('\n📊 Seat Availability Summary:');
        availabilityChecks.forEach(check => {
            console.log(`\n${check.type} (ID: ${check.id}):`);
            console.log(`- Available: ${check.available ? 'Yes' : 'No'}`);
            console.log(`- Available Seats: ${check.availableSeats}`);
            console.log(`- Needed Seats: ${check.needed}`);
            console.log(`- Sufficient: ${check.sufficient ? 'Yes' : 'No'}`);
        });

        // Check if any availability check failed
        const failed = availabilityChecks.find(check => !check.available || !check.sufficient);
        if (failed) {
            console.log('\n❌ Seat availability check failed:');
            console.log(`- Failed at: ${failed.type} (ID: ${failed.id})`);
            console.log(`- Available seats: ${failed.availableSeats}`);
            console.log(`- Needed seats: ${failed.needed}`);
            
            return res.status(400).json({
                error: `Not enough seats available in ${failed.type.toLowerCase()} ${failed.id}`,
                availableSeats: failed.availableSeats,
                neededSeats: failed.needed
            });
        }

        console.log('\n✅ All seat availability checks passed');
        
        // Store booking details
        req.bookingDetails = {
            booking,
            availabilityChecks,
            boatCapacity: booking.schedule.Boat.capacity,
            totalPassengers: booking.total_passengers,
            scheduleId: booking.schedule_id,
            subscheduleId: booking.subschedule_id
        };

        console.log('\n=== Seat Availability Check Completed ===\n');
        next();

    } catch (error) {
        console.error('\n❌ Error in seat availability middleware:', error);
        return res.status(500).json({
            error: 'Internal server error while checking seat availability',
            details: error.message
        });
    }
};


const getAvailableDays = (daysOfWeek) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        if ((daysOfWeek & (1 << i)) !== 0) {
            days.push(moment.weekdays(i));
        }
    }
    return days;
};

// Helper middleware to validate booking date format
const validateBookingDate = async (req, res, next) => {
    const { id } = req.params;
    const { booking_date } = req.body;

    try {
        console.log('\n=== Starting Date Validation ===');
        
        // Basic validation
        if (!booking_date) {
            console.log('❌ Booking date is missing');
            return res.status(400).json({
                error: 'Booking date is required'
            });
        }

        // Format validation
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(booking_date)) {
            console.log('❌ Invalid date format');
            return res.status(400).json({
                error: 'Invalid date format. Please use YYYY-MM-DD'
            });
        }

        // Get booking details with schedule information
        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                },
                {
                    model: SubSchedule,
                    as: 'subSchedule'
                }
            ]
        });

        if (!booking) {
            console.log('❌ Booking not found');
            return res.status(404).json({
                error: 'Booking not found'
            });
        }

        const newBookingDate = moment(booking_date);
        const dayOfWeek = newBookingDate.day(); // 0 = Sunday, 1 = Monday, etc.

        // Validate schedule validity period
        const scheduleValidityStart = moment(booking.schedule.validity_start);
        const scheduleValidityEnd = moment(booking.schedule.validity_end);

        console.log('\n📅 Checking schedule validity period...');
        console.log(`Validity Start: ${scheduleValidityStart.format('YYYY-MM-DD')}`);
        console.log(`Validity End: ${scheduleValidityEnd.format('YYYY-MM-DD')}`);
        console.log(`New Booking Date: ${newBookingDate.format('YYYY-MM-DD')}`);

        if (newBookingDate.isBefore(scheduleValidityStart) || newBookingDate.isAfter(scheduleValidityEnd)) {
            console.log('❌ Date outside schedule validity period');
            return res.status(400).json({
                error: 'Selected date is outside the schedule validity period',
                validityStart: scheduleValidityStart.format('YYYY-MM-DD'),
                validityEnd: scheduleValidityEnd.format('YYYY-MM-DD')
            });
        }

        // Check days of week for schedule
        const scheduleDaysOfWeek = booking.schedule.days_of_week;
        const isDayAllowed = (scheduleDaysOfWeek & (1 << dayOfWeek)) !== 0;

        console.log('\n📅 Checking schedule days of week...');
        console.log(`Day of Week: ${dayOfWeek}`);
        console.log(`Schedule Days: ${scheduleDaysOfWeek}`);
        console.log(`Day Allowed: ${isDayAllowed}`);

        if (!isDayAllowed) {
            return res.status(400).json({
                error: 'Selected day is not available for this schedule',
                selectedDay: moment.weekdays(dayOfWeek),
                availableDays: getAvailableDays(scheduleDaysOfWeek)
            });
        }

        // Additional validation for subschedule if exists
        if (booking.subschedule_id) {
            console.log('\n📅 Checking subschedule validity...');
            
            const subSchedule = booking.subSchedule;
            if (!subSchedule) {
                return res.status(404).json({
                    error: 'SubSchedule not found'
                });
            }

            // Check subschedule validity period if different from main schedule
            if (subSchedule.validity_start || subSchedule.validity_end) {
                const subScheduleValidityStart = subSchedule.validity_start ? 
                    moment(subSchedule.validity_start) : scheduleValidityStart;
                const subScheduleValidityEnd = subSchedule.validity_end ? 
                    moment(subSchedule.validity_end) : scheduleValidityEnd;

                if (newBookingDate.isBefore(subScheduleValidityStart) || 
                    newBookingDate.isAfter(subScheduleValidityEnd)) {
                    return res.status(400).json({
                        error: 'Selected date is outside the subschedule validity period',
                        validityStart: subScheduleValidityStart.format('YYYY-MM-DD'),
                        validityEnd: subScheduleValidityEnd.format('YYYY-MM-DD')
                    });
                }
            }

            // Check subschedule days of week if different from main schedule
            if (subSchedule.days_of_week !== null) {
                const subScheduleDaysOfWeek = subSchedule.days_of_week;
                const isSubScheduleDayAllowed = (subScheduleDaysOfWeek & (1 << dayOfWeek)) !== 0;

                if (!isSubScheduleDayAllowed) {
                    return res.status(400).json({
                        error: 'Selected day is not available for this subschedule',
                        selectedDay: moment.weekdays(dayOfWeek),
                        availableDays: getAvailableDays(subScheduleDaysOfWeek)
                    });
                }
            }
        }

        console.log('✅ Date validation passed');
        next();

    } catch (error) {
        console.error('❌ Error in date validation:', error);
        return res.status(500).json({
            error: 'Error validating booking date',
            details: error.message
        });
    }
};

const validatePaymentUpdate = async (req, res, next) => {
    const { payment_method, payment_status } = req.body;
    const { id } = req.params;

    console.log('\n=== Starting Payment Validation ===');
    console.log('📝 Validating request:', { payment_method, payment_status });

    try {
        // Check if at least one field is provided
        if (!payment_method && !payment_status) {
            console.log('❌ No update parameters provided');
            return res.status(400).json({
                error: "Either payment_method or payment_status must be provided"
            });
        }

        // Check if both fields are provided
        if (payment_method && payment_status) {
            console.log('❌ Both parameters provided');
            return res.status(400).json({
                error: "You must specify either payment method or payment status, not both"
            });
        }

        // Find the booking first
        const booking = await Booking.findByPk(id, {
            include: [{
                model: Transaction,
                as: 'transactions'
            }]
        });

        if (!booking) {
            console.log('❌ Booking not found');
            return res.status(404).json({
                error: "Booking not found"
            });
        }

        // Check if booking is already refunded or cancelled
        const finalStates = ['refund_50', 'refund_100', 'cancelled'];
        if (finalStates.includes(booking.payment_status)) {
            console.log('❌ Cannot modify booking in final state:', booking.payment_status);
            return res.status(400).json({
                error: `Cannot modify booking that is already ${booking.payment_status}`,
                currentStatus: booking.payment_status
            });
        }

        // Validate payment method if provided
        if (payment_method) {
            const validPaymentMethods = ['credit_card', 'bank_transfer', 'cash', 'paypal'];
            if (!validPaymentMethods.includes(payment_method)) {
                console.log('❌ Invalid payment method:', payment_method);
                return res.status(400).json({
                    error: "Invalid payment method",
                    validMethods: validPaymentMethods
                });
            }
        }

        // Validate payment status if provided
        if (payment_status) {
            const currentStatus = booking.payment_status;
            console.log('Current payment status:', currentStatus);
            console.log('Requested payment status:', payment_status);

            // Define valid status transitions
            const validTransitions = {
                'invoiced': ['paid'],
                'paid': ['refund_50', 'refund_100', 'cancelled'],
                'refund_50': [], // No further transitions allowed
                'refund_100': [], // No further transitions allowed
                'cancelled': []   // No further transitions allowed
            };

            // Check if current status exists in valid transitions
            if (!validTransitions[currentStatus]) {
                console.log('❌ Invalid current status:', currentStatus);
                return res.status(400).json({
                    error: "Invalid current payment status",
                    currentStatus
                });
            }

            // Check if requested transition is valid
            if (!validTransitions[currentStatus].includes(payment_status)) {
                console.log('❌ Invalid status transition');
                return res.status(400).json({
                    error: "Invalid payment status transition",
                    currentStatus,
                    attemptedStatus: payment_status,
                    allowedTransitions: validTransitions[currentStatus]
                });
            }

            // For refunds and cancellation, check if there are existing transactions
            if (['refund_50', 'refund_100', 'cancelled'].includes(payment_status)) {
                const hasTransactions = booking.transactions && booking.transactions.length > 0;
                if (!hasTransactions) {
                    console.log('❌ No transactions found for refund/cancellation');
                    return res.status(400).json({
                        error: "Cannot refund or cancel booking without existing transactions"
                    });
                }
            }
        }

        // Store validated booking in request for controller use
        req.validatedBooking = booking;
        console.log('✅ Validation passed');
        next();

    } catch (error) {
        console.error('❌ Error in payment validation:', error);
        return res.status(500).json({
            error: "Error validating payment update",
            details: error.message
        });
    }
};




// Helper function to convert binary days of week to array of day names
module.exports = {
    checkSeatAvailabilityForUpdate,
    validateBookingDate,
    validatePaymentUpdate
};