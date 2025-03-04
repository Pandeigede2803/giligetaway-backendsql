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

const checkSeatAvailabilityForUpdate2 = async (req, res, next) => {
    const { booking_id } = req.params;
    const { booking_date } = req.body;

    const id = booking_id;

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




const checkMaximumCapacity = async (req, res, next) => {
  try {
    const { seat_availability_id, schedule_id, qty } = req.body;

    // If `seat_availability_id` is not provided, bypass this middleware
    if (!seat_availability_id) {
      console.log("🛑 Bypassing maximum capacity check as seat_availability_id is not provided.");
      return next();
    }

    console.log(`🔍 Checking maximum capacity for Seat Availability ID: ${seat_availability_id}`);

    // Validate the required parameters
    if (!qty) {
      return res.status(400).json({
        success: false,
        message: "qty is required.",
      });
    }

    // Fetch the seat availability by ID
    const seatAvailability = await SeatAvailability.findByPk(seat_availability_id);

    if (!seatAvailability) {
      return res.status(404).json({
        success: false,
        message: `Seat availability not found for ID: ${seat_availability_id}`,
      });
    }

    console.log(`✅ Seat availability found. ID: ${seatAvailability.id}, Current Seats: ${seatAvailability.available_seats}`);

    // Fetch the schedule and boat capacity
    const schedule = await Schedule.findOne({
      where: { id: seatAvailability.schedule_id },
      include: {
        model: Boat,
        as: "Boat",
        attributes: ["capacity"],
      },
    });

    if (!schedule || !schedule.Boat) {
      return res.status(404).json({
        success: false,
        message: `Schedule or boat not found for Seat Availability ID: ${seat_availability_id}`,
      });
    }

    const boatCapacity = schedule.Boat.capacity;
    console.log(`🚤 Boat capacity: ${boatCapacity}, Current Available Seats: ${seatAvailability.available_seats}`);

    // Check if adding qty exceeds boat capacity
    if (seatAvailability.available_seats >= boatCapacity) {
      return res.status(400).json({
        success: false,
        message: "The capacity is already at the maximum limit.",
      });
    }

    // Proceed to next middleware or controller
    next();
  } catch (error) {
    console.error("❌ Error checking maximum capacity:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while checking seat availability.",
      error: error.message,
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
        console.log('\n=== Starting Date Validation === for',id);
        
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

const validateBookingDate2 = async (req, res, next) => {
    const { booking_id } = req.params;
    const { booking_date } = req.body;

    const id = booking_id;

    try {
        console.log('\n=== Starting Date Validation === for',id);
        
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

// middlewares/checkBookingDateUpdate.js

/**
 * Middleware untuk memeriksa apakah update booking_date
 * melebihi 10 hari dari created_at di tabel Booking.
 * 
 * Asumsi:
 * - booking_id diambil dari req.params.booking_id
 * - newBookingDate diambil dari req.body.booking_date
 */
const checkBookingDateUpdate = async (req, res, next) => {
    try {
      const bookingId = req.params.booking_id; 
      const newBookingDate = req.body.booking_date; // masih kita cek keberadaannya

      console.log('\n=== Starting checkBookingDateUpdate middleware ===');
  
      // Validasi awal
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: "booking_id is required in URL params"
        });
      }
      if (!newBookingDate) {
        return res.status(400).json({
          success: false,
          message: "booking_date is required in request body"
        });
      }
  
      // Ambil data booking
      const booking = await Booking.findByPk(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: `Booking with id ${bookingId} not found`
        });
      }
  
      // Hitung selisih antara waktu sekarang dan created_at
      const createdAt = booking.created_at; 
      const now = new Date();
      const diffMs = now - createdAt;  // (ms)
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
      // Cek apakah lebih dari 10 hari
      if (diffDays > 10) {
        return res.status(400).json({
          success: false,
          message: `Cannot update booking_date. More than 10 days have passed since the booking was created. (~${diffDays.toFixed(1)} days)`
        });
      }
  
      // Jika masih <= 10 hari, silakan lanjut ke controller
      next();
  
    } catch (err) {
      console.error('Error in checkBookingDateUpdate middleware:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
      });
    }
  };

  const checkBookingDateUpdate2 = async (req, res, next) => {
    try {
      const bookingId = req.params.booking_id; 
  
      console.log('\n=== Starting checkBookingDateUpdate2 middleware ===');
  
      // Validasi booking_id
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: "booking_id is required in URL params"
        });
      }
  
      // Ambil data booking berdasarkan ID
      const booking = await Booking.findByPk(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: `Booking with id ${bookingId} not found`
        });
      }
  
      // Validasi status pembayaran sebelum membatalkan
      if (booking.payment_status === "paid") {
        return res.status(400).json({
          success: false,
          message: "Your booking is already paid. Please contact our staff to process a refund. email: 0IgUc@example.com"
        });
      } else if (booking.payment_status !== "invoiced") {
        return res.status(400).json({
          success: false,
          message: "Booking can only be canceled if the payment status is 'invoiced'."
        });
      }
  
      // Hitung selisih antara waktu sekarang dan booking_date
      const bookingDate = new Date(booking.booking_date); 
      const now = new Date();
      const diffMs = now - bookingDate;  // (ms)
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
      // Cek apakah lebih dari 10 hari sejak dibuat
      if (diffDays > 10) {
        return res.status(400).json({
          success: false,
          message: `Cannot proceed. More than 10 days have passed since the booking date was created. (~${diffDays.toFixed(1)} days)`
        });
      }
  
      // Jika semua validasi lolos, lanjutkan ke controller berikutnya
      next();
  
    } catch (err) {
      console.error('Error in checkBookingDateUpdate2 middleware:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
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
        // if (payment_method && payment_status) {
        //     console.log('❌ Both parameters provided');
        //     return res.status(400).json({
        //         error: "You must specify either payment method or payment status, not both"
        //     });
        // }

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

const validateSeatAvailabilityDate = async (req, res, next) => {
    console.log('🔍 Validating date for Seat Availability...');
    try {
      const { seat_availability_id, schedule_id, date } = req.body;
  
      // Skip validation if `seat_availability_id` is provided
      if (seat_availability_id) {
        console.log(
          `🛑 Skipping date validation as Seat Availability ID (${seat_availability_id}) is provided.`
        );
        return next();
      }
  
      // Validate required parameters
      if (!schedule_id || !date) {
        return res.status(400).json({
          success: false,
          message: "Schedule ID and Date are required.",
        });
      }
  
      console.log(`🔍 Validating date for Schedule ID: ${schedule_id}, Date: ${date}`);
  
      // Fetch the schedule
      const schedule = await Schedule.findOne({
        where: { id: schedule_id },
        attributes: ["days_of_week", "validity_start", "validity_end"],
      });
  
      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: `Schedule not found for ID: ${schedule_id}`,
        });
      }
  
      const { days_of_week,validity_start, validity_end } = schedule;
      console.log(
        `📅 Schedule Details - Days of Week: ${days_of_week}, Availability: ${validity_start} to ${validity_end}`
      );
  
      // Check if the date falls within the availability period
      const providedDate = moment(date, "YYYY-MM-DD", true);
      const startDate = moment(validity_start, "YYYY-MM-DD");
      const endDate = moment(validity_end, "YYYY-MM-DD");
  
      if (!providedDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Please use YYYY-MM-DD.",
        });
      }
  
      if (providedDate.isBefore(startDate) || providedDate.isAfter(endDate)) {
        return res.status(400).json({
          success: false,
          message: `The provided date is outside the schedule availability period (${validity_start} to ${validity_end}).`,
        });
      }
  
      // Check if the day matches the days_of_week
      const dayOfWeek = providedDate.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if ((days_of_week & (1 << dayOfWeek)) === 0) {
        return res.status(400).json({
          success: false,
          message: `The provided date (${date}) does not match the allowed days of the week for this schedule.`,
        });
      }
  
      console.log("✅ Date validation passed. Proceeding to the next middleware.");
      next();
    } catch (error) {
      console.error("❌ Error in validateSeatAvailabilityDate middleware:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while validating the date.",
        error: error.message,
      });
    }
  };
  
  
  const checkAgentPassword = async (req, res, next) => {
    try {
      const { agent_id, password } = req.body;
  
      // 1. Pastikan agent_id dan password disertakan
      if (!agent_id) {
        return res.status(400).json({
          success: false,
          message: "agent_id is required"
        });
      }
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "password is required"
        });
      }
  
      // 2. Cari agent di database
      const agent = await Agent.findByPk(agent_id);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: `Agent with id ${agent_id} not found`
        });
      }
  
      // 3. Validasi password
      //    Asumsikan agent.password di DB adalah hash bcrypt.
      const isMatch = await bcrypt.compare(password, agent.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid password"
        });
      }
  
      // 4. Simpan data agent ke req agar dapat diakses controller
      req.agent = agent;
  
      // 5. Lanjut ke controller
      next();
  
    } catch (err) {
      console.error('Error in checkAgentPassword middleware:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
      });
    }
  };
  


// Helper function to convert binary days of week to array of day names
module.exports = {
    checkSeatAvailabilityForUpdate,
    checkSeatAvailabilityForUpdate2,
    validateBookingDate,
    validateBookingDate2,
    validatePaymentUpdate,checkMaximumCapacity,validateSeatAvailabilityDate,
    checkBookingDateUpdate,
    checkBookingDateUpdate2,
    checkAgentPassword
};