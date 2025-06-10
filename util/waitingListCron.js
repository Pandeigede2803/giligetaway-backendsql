// utils/waitingListCron.js
const cron = require('node-cron');
const { Op } = require('sequelize');
const { WaitingList, Schedule } = require('../models');
const { waitingListNotify } = require('./waitingListNotify'); // Gunakan utils yang sudah ada

/**
 * Check waiting list dan trigger notification menggunakan utils yang sudah ada
 */
/**
 * Check waiting list dan trigger notification menggunakan utils yang sudah ada
 */
const checkAndNotifyWaitingList = async () => {
  try {
    console.log('\n🔔 === Starting Cron Waiting List Check ===');
    console.log(`📅 Check time: ${new Date().toLocaleString('id-ID')}`);

    // Get current date untuk filter booking_date
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`📅 Checking waiting list for booking dates from today: ${today}`);

    // Cari semua waiting list dengan status 'pending' dan booking_date >= today
    const pendingWaitingList = await WaitingList.findAll({
      where: {
        status: 'pending',
        booking_date: {
          [Op.gte]: today // Hanya booking yang belum lewat
        }
      },
      include: [
        {
          model: Schedule,
          as: 'WaitingListSchedule',
          attributes: ['id', 'validity_start', 'validity_end'],
          required: true // Schedule harus ada
        }
      ],
      attributes: [
        'id',
        'seat_availability_id', 
        'schedule_id', 
        'subschedule_id', 
        'booking_date',
        'total_passengers',
        'contact_name',
        'contact_email',
        'follow_up_notes' // Berisi data route dan type waiting list
      ]
    });

    console.log(`🔍 Found ${pendingWaitingList.length} pending waiting list entries to check`);

    if (pendingWaitingList.length === 0) {
      console.log('ℹ️ No pending waiting list entries found');
      return {
        success: true,
        message: 'No pending waiting list entries',
        checked_entries: 0,
        valid_entries: 0,
        invalid_entries: 0,
        total_notified: 0
      };
    }

    let totalNotified = 0;
    let validEntries = 0;
    let invalidEntries = 0;
    const processedGroups = [];
    const invalidWaitingListIds = []; // Untuk mark sebagai contacted

    // Group by seat_availability_id untuk efficient processing
    const groupedBySeatId = {};
    
    for (const entry of pendingWaitingList) {
      const bookingDate = new Date(entry.booking_date);
      const validityStart = new Date(entry.WaitingListSchedule.validity_start);
      const validityEnd = new Date(entry.WaitingListSchedule.validity_end);

      console.log(`\n🔍 Checking entry ID ${entry.id}:`, {
        booking_date: entry.booking_date,
        validity_start: entry.WaitingListSchedule.validity_start,
        validity_end: entry.WaitingListSchedule.validity_end,
        schedule_id: entry.schedule_id
      });

      // Validasi: Apakah booking_date dalam periode validity schedule?
      if (bookingDate >= validityStart && bookingDate <= validityEnd) {
        console.log(`✅ Entry ${entry.id} - Booking date is within schedule validity period`);
        
        // Group valid entries by seat_availability_id
        const seatId = entry.seat_availability_id;
        if (!groupedBySeatId[seatId]) {
          groupedBySeatId[seatId] = [];
        }
        groupedBySeatId[seatId].push(entry);
        validEntries++;
        
      } else {
        console.log(`❌ Entry ${entry.id} - Booking date is OUTSIDE schedule validity period`);
        console.log(`   📅 Schedule valid: ${validityStart.toISOString().split('T')[0]} to ${validityEnd.toISOString().split('T')[0]}`);
        console.log(`   📅 Booking date: ${bookingDate.toISOString().split('T')[0]}`);
        console.log(`   👤 Customer: ${entry.contact_name} (${entry.contact_email})`);
        console.log(`   🛤️ Route info: ${entry.follow_up_notes || 'N/A'}`);
        
        // Mark untuk update status ke 'contacted' (skip notification)
        invalidWaitingListIds.push(entry.id);
        invalidEntries++;
      }
    }

    console.log(`\n📊 Validation Summary:`);
    console.log(`   ✅ Valid entries (within schedule period): ${validEntries}`);
    console.log(`   ❌ Invalid entries (outside schedule period): ${invalidEntries}`);

    // Update status invalid entries ke 'contacted' tanpa kirim email
    if (invalidWaitingListIds.length > 0) {
      console.log(`\n💾 Marking ${invalidWaitingListIds.length} invalid entries as 'contacted' (skip notification)...`);
  

      try {
  const invalidEntries = pendingWaitingList.filter(entry =>
    invalidWaitingListIds.includes(entry.id)
  );

  const updatePromises = invalidEntries.map(entry => {
    const existingNote = entry.follow_up_notes || '';
    const newNote = `Auto-marked as contacted: booking date outside schedule validity period (${new Date().toLocaleString('id-ID')})`;
    const combinedNote = `${existingNote}\n${newNote}`.trim();

    return entry.update({
      status: 'contacted',
      last_contact_date: new Date(),
      follow_up_notes: combinedNote
    });
  });

  await Promise.all(updatePromises);

  console.log(`✅ Successfully marked ${invalidWaitingListIds.length} invalid entries as contacted`);

}
      catch (updateError) {
        console.error(`❌ Failed to update invalid entries:`, updateError);
      }
    }

    // Process valid entries by seat_availability_id groups
    if (Object.keys(groupedBySeatId).length === 0) {
      console.log('ℹ️ No valid waiting list entries to process for notification');
      return {
        success: true,
        message: 'No valid waiting list entries found within schedule validity periods',
        checked_entries: pendingWaitingList.length,
        valid_entries: validEntries,
        invalid_entries: invalidEntries,
        total_notified: 0
      };
    }

    console.log(`\n🔄 Processing ${Object.keys(groupedBySeatId).length} seat availability groups...`);

    for (const [seatAvailabilityId, entries] of Object.entries(groupedBySeatId)) {
      console.log(`\n🔍 Processing seat availability ID: ${seatAvailabilityId}`);
      console.log(`👥 Valid entries in this group: ${entries.length}`);

      // Ambil data dari entry pertama untuk parameter
      const firstEntry = entries[0];

      try {
        // Panggil utils waitingListNotify yang sudah ada
        const notifyResult = await waitingListNotify({
          total_passengers: firstEntry.total_passengers,
          schedule_id: firstEntry.schedule_id,
          subschedule_id: firstEntry.subschedule_id,
          booking_date: firstEntry.booking_date,
          seat_availability_ids: [parseInt(seatAvailabilityId)]
        });

        console.log(`📊 Notification result for seat ${seatAvailabilityId}:`, {
          success: notifyResult.success,
          notified_count: notifyResult.notified_count,
          message: notifyResult.message
        });

        if (notifyResult.success && notifyResult.notified_count > 0) {
          totalNotified += notifyResult.notified_count;
          processedGroups.push({
            seat_availability_id: seatAvailabilityId,
            notified_count: notifyResult.notified_count,
            notified_entries: notifyResult.notified_entries
          });

          // Log detail customer yang dinotify
          console.log(`✅ Successfully notified ${notifyResult.notified_count} customers:`);
          notifyResult.notified_entries?.forEach(entry => {
            console.log(`   - ${entry.contact_name} (${entry.contact_email}) - ${entry.total_passengers} passengers`);
          });
        } else {
          console.log(`ℹ️ No customers notified for seat ${seatAvailabilityId}: ${notifyResult.message}`);
        }

      } catch (notifyError) {
        console.error(`❌ Failed to process waiting list group for seat ${seatAvailabilityId}:`, notifyError);
      }
    }

    // console.log(`\n🎉 Cron waiting list check completed`);
    // console.log(`📊 Processed ${processedGroups.length} groups with notifications`);
    // console.log(`📧 Total customers notified: ${totalNotified}`);
    // console.log(`⚠️ Invalid entries marked as contacted: ${invalidEntries}`);

    return {
      success: true,
      message: 'Cron waiting list check completed successfully',
      checked_entries: pendingWaitingList.length,
      valid_entries: validEntries,
      invalid_entries: invalidEntries,
      processed_groups: processedGroups.length,
      total_notified: totalNotified,
      processed_results: processedGroups
    };

  } catch (error) {
    console.error('❌ Error in cron waiting list check:', error);
    return {
      success: false,
      message: `Cron waiting list check failed: ${error.message}`,
      checked_entries: 0,
      valid_entries: 0,
      invalid_entries: 0,
      total_notified: 0,
      error: error.message
    };
  }
};

/**
 * Schedule waiting list cron job
 */
const scheduleWaitingListCron = () => {
  // Check waiting list availability setiap 1 jam
  const cronFrequency = process.env.CRON_FREQUENCY_WAITING_LIST || '0 * * * *'; // Default: setiap jam
  console.log(`📆 Registering Waiting List Cron with frequency: ${cronFrequency}`);

  cron.schedule(cronFrequency, async () => {
    console.log("🚀 WaitingListCron: Starting waiting list check job...");
    
    try {
      const result = await checkAndNotifyWaitingList();
      
      console.log("📊 Cron job completed:", {
        success: result.success,
        checked_entries: result.checked_entries,
        valid_entries: result.valid_entries,
        invalid_entries: result.invalid_entries,
        total_notified: result.total_notified,
        message: result.message
      });

      // Log summary
      if (result.total_notified > 0) {
        console.log(`\n🎉 CRON SUCCESS: Notified ${result.total_notified} waiting list customers!`);
        result.processed_results?.forEach(group => {
          console.log(`   📍 Seat ID ${group.seat_availability_id}: ${group.notified_count} customers notified`);
        });
      } else {
        console.log(`\nℹ️ CRON COMPLETE: No customers needed notification at this time`);
      }

      if (result.invalid_entries > 0) {
        console.log(`\n⚠️ SCHEDULE VALIDATION: ${result.invalid_entries} entries marked as contacted (outside schedule validity)`);
      }
      
    } catch (cronError) {
      console.error("❌ Cron job failed:", cronError);
    }
  });

  console.log("✅ Waiting list cron job scheduled successfully");
};;

module.exports = {
  scheduleWaitingListCron,
  checkAndNotifyWaitingList // Export untuk manual testing
};