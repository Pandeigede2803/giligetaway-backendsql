// utils/waitingListNotify.js
const { Op } = require('sequelize');
const { WaitingList, SeatAvailability, Schedule, SubSchedule } = require('../models');
const { sendWaitingListEmail } = require('./sendWaitingListEmail'); // ← Fixed import path

/**
 * Notify waiting list users when seats become available
 * @param {Object} params - Parameters for notification
 * @param {number} params.total_passengers - Number of passengers released
 * @param {number} params.schedule_id - Schedule ID
 * @param {number} params.subschedule_id - SubSchedule ID (optional)
 * @param {string} params.booking_date - Booking date (YYYY-MM-DD format)
 * @param {Array<number>} params.seat_availability_ids - Array of released seat availability IDs
 * @param {Object} transaction - Database transaction object
 */
// const waitingListNotify = async (params, transaction = null) => {
//   try {
//     const {
//       total_passengers,
//       schedule_id,
//       subschedule_id = null,
//       booking_date,
//       seat_availability_ids = []
//     } = params;

//     console.log('\n🔔 === Starting Waiting List Notification ===');
//     console.log(`📝 Parameters:`, {
//       total_passengers,
//       schedule_id,
//       subschedule_id,
//       booking_date,
//       seat_availability_ids
//     });

//     // Validasi input - seat_availability_ids harus ada dan tidak kosong
//     if (!seat_availability_ids || seat_availability_ids.length === 0) {
//       console.log('⚠️ No seat availability IDs provided, skipping notification');
//       return {
//         success: false,
//         message: 'No seat availability IDs provided',
//         notified_count: 0,
//         notified_entries: []
//       };
//     }

//     // Validasi booking_date - skip jika sudah lewat
//     const currentDate = new Date();
//     const bookingDateObj = new Date(booking_date);
    
//     if (bookingDateObj < currentDate.setHours(0, 0, 0, 0)) {
//       console.log('⚠️ Booking date has passed, skipping notification');
//       return {
//         success: false,
//         message: 'Booking date has passed',
//         notified_count: 0,
//         notified_entries: []
//       };
//     }

//     // PRIMARY FILTER: Cari waiting list berdasarkan seat_availability_id yang match
//     const whereCondition = {
//       seat_availability_id: {
//         [Op.in]: seat_availability_ids // Filter utama: seat availability IDs yang di-release
//       },
//       status: 'pending' // Hanya yang belum dinotifikasi
//     };

//     console.log('\n🔍 Searching waiting list with PRIMARY filter (seat_availability_ids):', whereCondition);

//     // Cari waiting list yang matching dengan seat availability IDs (PRIMARY FILTER)
//     const waitingListEntries = await WaitingList.findAll({
//       where: whereCondition,
//       include: [
//         {
//           model: Schedule,
//           as: 'WaitingListSchedule',
//           attributes: ['id',  'arrival_time'], // ← Fixed: removed comma
//           required: false // ← Fixed: changed to false for safety
//         },
//         {
//           model: SubSchedule,
//           as: 'WaitingListSubSchedule',
//           attributes: ['id',], // ← Removed 'name' column
//           required: false
//         },
//         {
//           model: SeatAvailability,
//           as: 'WaitingListSeatAvailability',
//           attributes: ['id', 'available_seats', 'date'],
//           required: true // Seat availability harus ada
//         }
//       ],
//       order: [['created_at', 'ASC']], // First come first serve
//       transaction
//     });

//     console.log(`🔍 Found ${waitingListEntries.length} waiting list entries with matching seat_availability_ids`);

//     if (waitingListEntries.length === 0) {
//       console.log('ℹ️ No matching waiting list entries found');
//       return {
//         success: true,
//         message: 'No matching waiting list entries',
//         notified_count: 0,
//         notified_entries: []
//       };
//     }

//     // Validasi dan filter entries yang valid
//     const validEntries = [];

//     for (const entry of waitingListEntries) {
//       console.log(`\n🔍 Validating entry ID: ${entry.id}`);
//       console.log(`- Required passengers: ${entry.total_passengers}`);
//       console.log(`- Seat availability ID: ${entry.seat_availability_id}`);
//       console.log(`- Booking date: ${entry.booking_date}`);
//       console.log(`- Route info: ${entry.follow_up_notes || 'N/A'}`); // ← Added follow_up_notes logging
      
//       const seatAvailability = entry.WaitingListSeatAvailability;
//       console.log(`- Available seats in system: ${seatAvailability?.available_seats || 0}`);

//       // Validasi 1: Apakah booking date masih valid (belum lewat)
//       const entryBookingDate = new Date(entry.booking_date);
//       if (entryBookingDate < currentDate.setHours(0, 0, 0, 0)) {
//         console.log(`❌ Booking date has passed for entry ${entry.id}, skipping`);
//         continue;
//       }

//       // Validasi 2: Apakah seat availability masih cukup untuk required passengers
//       if (!seatAvailability || seatAvailability.available_seats < entry.total_passengers) {
//         console.log(`❌ Not enough available seats in system for entry ${entry.id} (need ${entry.total_passengers}, available ${seatAvailability?.available_seats || 0})`);
//         continue;
//       }

//       // Entry valid, tambahkan ke validEntries
//       validEntries.push(entry);
//       console.log(`✅ Entry ${entry.id} is valid`);
//     }

//     console.log(`\n📊 Valid entries count: ${validEntries.length}`);

//     if (validEntries.length === 0) {
//       console.log('ℹ️ No valid waiting list entries after validation');
//       return {
//         success: true,
//         message: 'No valid waiting list entries after validation',
//         notified_count: 0,
//         notified_entries: []
//       };
//     }

//     // Send notifications untuk setiap valid entry
//     console.log('\n📧 === Sending Email Notifications ===');
    
//     const notificationPromises = [];
//     const staffEmail = process.env.EMAIL_BOOKING ;

//     for (const entry of validEntries) {
//       console.log(`📧 Preparing notifications for entry ID: ${entry.id}`);
      
//       // Send customer notification
//       if (entry.contact_email) {
//         console.log(`📧 Adding customer email to queue: ${entry.contact_email}`);
//         notificationPromises.push(
//           sendWaitingListEmail({
//             to: entry.contact_email,
//             type: 'customer',
//             waitingListData: entry,
//             availableSeats: entry.WaitingListSeatAvailability?.available_seats || 0
//           })
//         );
//       }

//       // Send staff notification
//       if (staffEmail) {
//         console.log(`📧 Adding staff email to queue: ${staffEmail}`);
//         notificationPromises.push(
//           sendWaitingListEmail({
//             to: staffEmail,
//             type: 'staff',
//             waitingListData: entry,
//             availableSeats: entry.WaitingListSeatAvailability?.available_seats || 0
//           })
//         );
//       }
//     }

//     // Send all emails
//     console.log(`📧 Sending ${notificationPromises.length} emails...`);
//     await Promise.allSettled(notificationPromises);

//     // Update status untuk semua valid entries
//     console.log('\n💾 === Updating Database Status ===');
    
//     const updatePromises = validEntries.map(entry => {
//       console.log(`💾 Updating status for entry ID: ${entry.id}`);
//       return entry.update({
//         status: 'contacted',
//         last_contact_date: new Date()
//       }, { transaction });
//     });

//     await Promise.all(updatePromises);

//     console.log('✅ All waiting list entries updated successfully');

//     // Prepare response
//     const result = {
//       success: true,
//       message: 'Waiting list notifications sent successfully',
//       notified_count: validEntries.length,
//       notified_entries: validEntries.map(entry => ({
//         id: entry.id,
//         contact_email: entry.contact_email,
//         contact_phone: entry.contact_phone, // ← Changed from contact_name to contact_phone
//         total_passengers: entry.total_passengers,
//         seat_availability_id: entry.seat_availability_id,
//         schedule_info: entry.follow_up_notes || 'N/A', // ← Added schedule_info from follow_up_notes
//         booking_date: entry.booking_date
//       }))
//     };

//     console.log('\n🎉 === Waiting List Notification Complete ===');
//     console.log(`📊 Total notified: ${result.notified_count}`);
    
//     return result;

//   } catch (error) {
//     console.error('❌ Error in waitingListNotify:', error);
    
//     return {
//       success: false,
//       message: `Failed to notify waiting list: ${error.message}`,
//       notified_count: 0,
//       notified_entries: [],
//       error: error.message
//     };
//   }
// };


const waitingListNotify = async (params, transaction = null) => {
  try {
    const {
      total_passengers,
      schedule_id,
      subschedule_id = null,
      booking_date,
      seat_availability_ids = []
    } = params;

    // console.log('\n🔔 === Starting Waiting List Notification ===');
    // console.log(`📝 Parameters:`, {
    //   total_passengers,
    //   schedule_id,
    //   subschedule_id,
    //   booking_date,
    //   seat_availability_ids
    // });

    // Validasi input - seat_availability_ids harus ada dan tidak kosong
    if (!seat_availability_ids || seat_availability_ids.length === 0) {
      console.log('⚠️ No seat availability IDs provided, skipping notification');
      return {
        success: false,
        message: 'No seat availability IDs provided',
        notified_count: 0,
        notified_entries: []
      };
    }

    // Validasi booking_date - skip jika sudah lewat
    const currentDate = new Date();
    const bookingDateObj = new Date(booking_date);
    
    if (bookingDateObj < currentDate.setHours(0, 0, 0, 0)) {
      console.log('⚠️ Booking date has passed, skipping notification');
      return {
        success: false,
        message: 'Booking date has passed',
        notified_count: 0,
        notified_entries: []
      };
    }

    // PRIMARY FILTER: Cari waiting list berdasarkan seat_availability_id yang match
    const whereCondition = {
      seat_availability_id: {
        [Op.in]: seat_availability_ids // Filter utama: seat availability IDs yang di-release
      },
      status: 'pending' // Hanya yang belum dinotifikasi
    };

    console.log('\n🔍 Searching waiting list with PRIMARY filter (seat_availability_ids):', whereCondition);

    // Cari waiting list yang matching dengan seat availability IDs (PRIMARY FILTER)
    const waitingListEntries = await WaitingList.findAll({
      where: whereCondition,
      include: [
        {
          model: Schedule,
          as: 'WaitingListSchedule',
                     where: {
    availability: true // 🔥 Tambahkan ini untuk filter hanya yang tersedia
  },
          attributes: ['id', 'arrival_time', 'validity_start', 'validity_end', 'days_of_week'], // ← Added days_of_week
          required: true // ← Changed to true since we need schedule data

        
        },
        {
          model: SubSchedule,
          as: 'WaitingListSubSchedule',
                     where: {
    availability: true // 🔥 Tambahkan ini untuk filter hanya yang tersedia
  },
          attributes: ['id'],
          required: false
        },
        {
          model: SeatAvailability,
          as: 'WaitingListSeatAvailability',
          attributes: ['id', 'available_seats', 'date'],
          required: true, // Seat availability harus ada
           where: {
    availability: true // 🔥 Tambahkan ini untuk filter hanya yang tersedia
  }
        }
      ],
      order: [['created_at', 'ASC']], // First come first serve
      transaction
    });

    console.log(`🔍 Found ${waitingListEntries.length} waiting list entries with matching seat_availability_ids`);

    if (waitingListEntries.length === 0) {
      console.log('ℹ️ No matching waiting list entries found');
      return {
        success: true,
        message: 'No matching waiting list entries',
        notified_count: 0,
        notified_entries: []
      };
    }

    // Validasi dan filter entries yang valid
    const validEntries = [];

    for (const entry of waitingListEntries) {
      // console.log(`\n🔍 Validating entry ID: ${entry.id}`);
      // console.log(`- Required passengers: ${entry.total_passengers}`);
      // console.log(`- Seat availability ID: ${entry.seat_availability_id}`);
      // console.log(`- Booking date: ${entry.booking_date}`);
      // console.log(`- Route info: ${entry.follow_up_notes || 'N/A'}`);
      
      const seatAvailability = entry.WaitingListSeatAvailability;
      const schedule = entry.WaitingListSchedule;
      
      // console.log(`- Available seats in system: ${seatAvailability?.available_seats || 0}`);
      // console.log(`- Schedule validity: ${schedule?.validity_start} to ${schedule?.validity_end}`);
      // console.log(`- Schedule days_of_week: ${schedule?.days_of_week} (${getDayOfWeekText(schedule?.days_of_week || 0)})`);

      // Validasi 1: Apakah booking date masih valid (belum lewat)
      const entryBookingDate = new Date(entry.booking_date);
      if (entryBookingDate < currentDate.setHours(0, 0, 0, 0)) {
        console.log(`❌ Booking date has passed for entry ${entry.id}, skipping`);
        continue;
      }

      // ← NEW: Validasi 2: Apakah booking date dalam periode validity schedule?
      if (!schedule) {
        console.log(`❌ No schedule data found for entry ${entry.id}, skipping`);
        continue;
      }

      const validityStart = new Date(schedule.validity_start);
      const validityEnd = new Date(schedule.validity_end);
      
      if (entryBookingDate < validityStart || entryBookingDate > validityEnd) {
        // console.log(`❌ Booking date ${entry.booking_date} is OUTSIDE schedule validity period for entry ${entry.id}`);
        // console.log(`   📅 Schedule valid from: ${validityStart.toISOString().split('T')[0]} to ${validityEnd.toISOString().split('T')[0]}`);
        // console.log(`   📅 Requested booking date: ${entryBookingDate.toISOString().split('T')[0]}`);
        // console.log(`   ⚠️ This entry should not be notified - schedule not available on this date`);
        continue;
      }
      console.log(`✅ Booking date is within schedule validity period`);

      // ← NEW: Validasi 3: Apakah booking date sesuai dengan days_of_week schedule?
      const bookingDayOfWeek = entryBookingDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const daysOfWeek = schedule.days_of_week || 0;
      const dayBitValue = Math.pow(2, bookingDayOfWeek); // Convert day to bit value
      
      // console.log(`🗓️ Checking days_of_week for entry ${entry.id}:`);
      // console.log(`   - Booking date: ${entry.booking_date} (${getDayName(bookingDayOfWeek)})`);
      // console.log(`   - Schedule days_of_week: ${daysOfWeek} (${getDayOfWeekText(daysOfWeek)})`);
      // console.log(`   - Day bit value: ${dayBitValue}`);
      // console.log(`   - Bit check: ${daysOfWeek} & ${dayBitValue} = ${daysOfWeek & dayBitValue}`);
      
      if ((daysOfWeek & dayBitValue) === 0) {
        // console.log(`❌ Schedule does NOT operate on ${getDayName(bookingDayOfWeek)} for entry ${entry.id}`);
        // console.log(`   📅 Schedule only operates on: ${getDayOfWeekText(daysOfWeek)}`);
        // console.log(`   ⚠️ This entry should not be notified - schedule not available on this day of week`);
        continue;
      }
      console.log(`✅ Schedule operates on ${getDayName(bookingDayOfWeek)}`);

      // Validasi 4: Apakah seat availability masih cukup untuk required passengers
      if (!seatAvailability || seatAvailability.available_seats < entry.total_passengers) {
        console.log(`❌ Not enough available seats in system for entry ${entry.id} (need ${entry.total_passengers}, available ${seatAvailability?.available_seats || 0})`);
        continue;
      }

      // Entry valid, tambahkan ke validEntries
      validEntries.push(entry);
      console.log(`✅ Entry ${entry.id} is valid for notification`);
    }

    console.log(`\n📊 Valid entries after all validations: ${validEntries.length}`);

    if (validEntries.length === 0) {
      console.log('ℹ️ No valid waiting list entries after validation (schedule validity + days_of_week check included)');
      return {
        success: true,
        message: 'No valid waiting list entries after complete validation',
        notified_count: 0,
        notified_entries: []
      };
    }

    // Send notifications untuk setiap valid entry
    console.log('\n📧 === Sending Email Notifications ===');
    
    const notificationPromises = [];
    const staffEmail = process.env.EMAIL_BOOKING;

    for (const entry of validEntries) {
      // console.log(`📧 Preparing notifications for entry ID: ${entry.id}`);
      // console.log(`   - Customer: ${entry.contact_name} (${entry.contact_email})`);
      // console.log(`   - Booking date: ${entry.booking_date} (within schedule validity)`);
      // console.log(`   - Route: ${entry.follow_up_notes || 'N/A'}`);
      
      // Send customer notification
      if (entry.contact_email) {
        console.log(`📧 Adding customer email to queue: ${entry.contact_email}`);
        notificationPromises.push(
          sendWaitingListEmail({
            to: entry.contact_email,
            type: 'customer',
            waitingListData: entry,
            availableSeats: entry.WaitingListSeatAvailability?.available_seats || 0
          })
        );
      }

      // Send staff notification
      if (staffEmail) {
        console.log(`📧 Adding staff email to queue: ${staffEmail}`);
        notificationPromises.push(
          sendWaitingListEmail({
            to: staffEmail,
            type: 'staff',
            waitingListData: entry,
            availableSeats: entry.WaitingListSeatAvailability?.available_seats || 0
          })
        );
      }
    }

    // Send all emails
    console.log(`📧 Sending ${notificationPromises.length} emails...`);
    const emailResults = await Promise.allSettled(notificationPromises);
    
    // Log email results
    emailResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Email ${index + 1} sent successfully`);
      } else {
        console.log(`❌ Email ${index + 1} failed: ${result.reason}`);
      }
    });

    // Update status untuk semua valid entries
    console.log('\n💾 === Updating Database Status ===');
    
    const updatePromises = validEntries.map(entry => {
      console.log(`💾 Updating status for entry ID: ${entry.id}`);
      return entry.update({
        status: 'contacted',
        last_contact_date: new Date()
      }, { transaction });
    });

    await Promise.all(updatePromises);

    console.log('✅ All waiting list entries updated successfully');

    // Prepare response
    const result = {
      success: true,
      message: 'Waiting list notifications sent successfully (after complete validation)',
      notified_count: validEntries.length,
      notified_entries: validEntries.map(entry => ({
        id: entry.id,
        contact_email: entry.contact_email,
        contact_name: entry.contact_name, // ← Fixed: changed back from contact_phone
        total_passengers: entry.total_passengers,
        seat_availability_id: entry.seat_availability_id,
        schedule_info: entry.follow_up_notes || 'N/A',
        booking_date: entry.booking_date
      }))
    };

    console.log('\n🎉 === Waiting List Notification Complete ===');
    console.log(`📊 Total notified: ${result.notified_count}`);
    
    return result;

  } catch (error) {
    console.error('❌ Error in waitingListNotify:', error);
    
    return {
      success: false,
      message: `Failed to notify waiting list: ${error.message}`,
      notified_count: 0,
      notified_entries: [],
      error: error.message
    };
  }
};

// ← NEW: Helper functions for days_of_week processing
/**
 * Get day name from day number
 * @param {number} dayNum - Day number (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns {string} Day name
 */
const getDayName = (dayNum) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum] || 'Unknown';
};

/**
 * Convert days_of_week bit value to readable text
 * @param {number} daysOfWeek - Bit value representing days (1=Sunday, 2=Monday, 4=Tuesday, etc.)
 * @returns {string} Human readable days text
 */
const getDayOfWeekText = (daysOfWeek) => {
  if (!daysOfWeek || daysOfWeek === 0) return 'No days set';
  if (daysOfWeek === 127) return 'Every day'; // All days: 1+2+4+8+16+32+64=127
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = [];
  
  for (let i = 0; i < 7; i++) {
    const dayBit = Math.pow(2, i);
    if (daysOfWeek & dayBit) {
      activeDays.push(dayNames[i]);
    }
  }
  
  return activeDays.length > 0 ? activeDays.join(', ') : 'No days set';
};

module.exports = {
  waitingListNotify,
};