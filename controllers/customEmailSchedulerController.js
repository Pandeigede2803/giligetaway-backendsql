// controllers/customEmailSchedulerController.js
const { Op } = require('sequelize');
const {
  CustomEmailSchedulers,
  EmailSendLog,
  Booking,
  Schedule,
  SubSchedule
} = require('../models');
// const { sendEmail } = require('../util/emailUtils');
const { sendEmail } = require("../util/emailSender");

/**
 * ✅ Get all schedulers
 */
exports.getAllSchedulers = async (req, res) => {
  try {
    const schedulers = await CustomEmailSchedulers.findAll({
      order: [['id', 'DESC']],
      include: [{ model: EmailSendLog, as: 'SendLogs' }]
    });

    res.json({
      success: true,
      count: schedulers.length,
      data: schedulers
    });
  } catch (error) {
    console.error('Error fetching schedulers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedulers',
      error
    });
  }
};

/**
 * ✅ Get scheduler by ID
 */
exports.getSchedulerById = async (req, res) => {
  try {
    const scheduler = await CustomEmailSchedulers.findByPk(req.params.id, {
      include: [{ model: EmailSendLog, as: 'SendLogs' }]
    });
    if (!scheduler)
      return res.status(404).json({ success: false, message: 'Scheduler not found' });

    res.json({ success: true, data: scheduler });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching scheduler', error });
  }
};

/**
 * ✅ Create new scheduler
 */
exports.createScheduler = async (req, res) => {
  try {
    const scheduler = await CustomEmailSchedulers.create(req.body);
    res.json({
      success: true,
      message: 'Custom email scheduler created',
      data: scheduler
    });
  } catch (error) {
    console.error('Error creating scheduler:', error);
    res.status(500).json({ success: false, message: 'Error creating scheduler', error });
  }
};

/**
 * ✅ Update scheduler
 */
exports.updateScheduler = async (req, res) => {
  try {
    const scheduler = await CustomEmailSchedulers.findByPk(req.params.id);
    if (!scheduler)
      return res.status(404).json({ success: false, message: 'Scheduler not found' });

    await scheduler.update(req.body);
    res.json({
      success: true,
      message: 'Scheduler updated successfully',
      data: scheduler
    });
  } catch (error) {
    console.error('Error updating scheduler:', error);
    res.status(500).json({ success: false, message: 'Error updating scheduler', error });
  }
};

/**
 * ✅ Delete scheduler
 */
exports.deleteScheduler = async (req, res) => {
  try {
    const scheduler = await CustomEmailSchedulers.findByPk(req.params.id);
    if (!scheduler)
      return res.status(404).json({ success: false, message: 'Scheduler not found' });

    await scheduler.destroy();
    res.json({ success: true, message: 'Scheduler deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduler:', error);
    res.status(500).json({ success: false, message: 'Error deleting scheduler', error });
  }
};

/**
 * 🔁 Cron Executor: jalankan semua scheduler aktif
 * Cek delay_minutes & status booking, lalu kirim email sesuai aturan
 */
exports.runCustomEmailJob = async (req, res) => {
  console.log("🚀 Starting Custom Email Job Execution");
  try {
    const schedulers = await CustomEmailSchedulers.findAll({
      where: { is_active: true },
    });

    if (schedulers.length === 0) {
      return res.json({ success: true, message: "Tidak ada scheduler aktif." });
    }

    let totalEmailsSent = 0;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 hari kebelakang
    const BATCH_SIZE = 20; // ✅ jumlah email per batch
    const BATCH_DELAY_MS = 3000; // ✅ jeda antar batch (3 detik)

    for (const scheduler of schedulers) {
      const delayCutoff =
        scheduler.delay_minutes > 0
          ? new Date(now.getTime() - scheduler.delay_minutes * 60 * 1000)
          : null;

      const hasScheduleIds = Array.isArray(scheduler.schedule_ids) && scheduler.schedule_ids.length;
      const hasSubscheduleIds = Array.isArray(scheduler.subschedule_ids) && scheduler.subschedule_ids.length;

      const whereClause = {
        // Handle "completed" status for both invoiced and paid
        ...(scheduler.booking_status === 'completed'
          ? { payment_status: { [Op.in]: ['paid', 'invoiced'] } }
          : { payment_status: scheduler.booking_status }),
        // Only filter by payment_method if specified and not "completed" status
        ...(scheduler.payment_method && scheduler.booking_status !== 'completed' && {
          payment_method: scheduler.payment_method,
        }),
        [Op.and]: [
          { created_at: { [Op.between]: [oneDayAgo, now] } },
          ...(delayCutoff ? [{ created_at: { [Op.lte]: delayCutoff } }] : []),
          // Filter schedule/subschedule dengan OR logic
          ...(hasScheduleIds || hasSubscheduleIds ? [{
            [Op.or]: [
              // Match subschedule_id jika ada
              ...(hasSubscheduleIds ? [{ subschedule_id: { [Op.in]: scheduler.subschedule_ids } }] : []),
              // Match schedule_id dengan subschedule_id NULL jika ada schedule_ids
              ...(hasScheduleIds ? [{
                schedule_id: { [Op.in]: scheduler.schedule_ids },
                subschedule_id: null
              }] : []),
            ]
          }] : []),
        ],
      };


      const eligibleBookings = await Booking.findAll({
        where: whereClause,
      });

      console.log(
        `📦 Scheduler "${scheduler.name}" found ${eligibleBookings.length} eligible bookings`
      );
      console.log(`   Where clause used:`, JSON.stringify(whereClause, null, 2));

      // ✅ BATCH PROCESSING LOOP
      for (let i = 0; i < eligibleBookings.length; i += BATCH_SIZE) {
        const batch = eligibleBookings.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (booking) => {
            console.log(`   🔍 Processing booking ID: ${booking.id}, ticket: ${booking.ticket_id}`);

            // ✅ Filter round trip: only send email for odd-numbered tickets
            if (booking.ticket_id && booking.ticket_id.startsWith('GG-RT-')) {
              const ticketNumber = parseInt(booking.ticket_id.split('-')[2]);
              if (ticketNumber % 2 === 0) {
                console.log(`   ⏭️  Skipped: Round trip even number ${booking.ticket_id}`);
                return;
              }
            }

            const alreadySent = await EmailSendLog.findOne({
              where: { scheduler_id: scheduler.id, booking_id: booking.id },
            });
            if (alreadySent) {
              console.log(`   ⏭️  Skipped: Email already sent for booking ${booking.id}`);
              return;
            }

            // Determine recipients based on target_type
            let recipients = [];
            if (scheduler.target_type === "agent") {
              if (booking.agent_email) recipients.push(booking.agent_email);
            } else if (scheduler.target_type === "customer") {
              if (booking.contact_email) recipients.push(booking.contact_email);
            } else if (scheduler.target_type === "all") {
              if (booking.agent_email) recipients.push(booking.agent_email);
              if (booking.contact_email) recipients.push(booking.contact_email);
            }

            console.log(`   📧 Target type: ${scheduler.target_type}, Recipients: ${recipients.join(", ") || "none"}`);

            if (recipients.length === 0) {
              console.log(`   ⚠️  Skipped: No recipient email for booking ${booking.id}`);
              return;
            }

            const html = scheduler.body
              .replace(/%booking_id%/g, booking.ticket_id || "")
              .replace(/%customer_name%/g, booking.contact_name || "")
              .replace(/%total_price%/g, booking.gross_total?.toString() || "")
              .replace(/%date%/g, booking.booking_date || "");

            // Send to all recipients
            for (const recipient of recipients) {
              try {
                console.log(`   📤 Sending email to ${recipient}...`);

                await sendEmail({
                  to: recipient,
                  subject: scheduler.subject,
                  html,
                });

                await EmailSendLog.create({
                  scheduler_id: scheduler.id,
                  booking_id: booking.id,
                  sent_to: recipient,
                });
                totalEmailsSent++;
                console.log(`   ✅ Email sent successfully to ${recipient}`);
              } catch (err) {
                console.error(`   ❌ Failed to send email to ${recipient}:`, err.message);
              }
            }
          })
        );

        // Wait before processing the next batch
        if (i + BATCH_SIZE < eligibleBookings.length) {
          console.log(
            `Waiting ${BATCH_DELAY_MS / 1000} seconds before processing the next batch...`
          );
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      await scheduler.update({ last_sent_at: new Date() });
    }

    res.json({
      success: true,
      message: `Job completed. Total emails sent: ${totalEmailsSent}`,
      totalEmailsSent,
    });
    
  } catch (error) {
    console.error("Error running custom email job:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while running custom email job",
      error: error.message,
    });
  }

};
/**
 * 🧪 Manual trigger for cron job (for testing)
 */
exports.triggerCustomEmailJob = async (req, res) => {
  console.log("🔧 Manual trigger: Running custom email job...");

  try {
    // Call the main cron function
    await exports.runCustomEmailJob(req, res);
  } catch (error) {
    console.error("❌ Error in manual trigger:", error);
    res.status(500).json({
      success: false,
      message: "Error running custom email job manually",
      error: error.message
    });
  }
};

/**
 * 🧪 Send test email
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const { scheduler_id, booking_id, recipient_email } = req.body;

    console.log('Test Email Request:', { scheduler_id, booking_id, recipient_email });

    // Get scheduler
    const scheduler = await CustomEmailSchedulers.findByPk(scheduler_id);
    if (!scheduler) {
      return res.status(404).json({ success: false, message: 'Scheduler not found' });
    }

    // Get booking (injected by middleware or fetch manually)
    const booking = req.booking || await Booking.findOne({
      where: { ticket_id: booking_id },
    });

    console.log('Using Booking for Test Email:', booking);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Get actual booking data (handles both plain objects and Sequelize instances)
    const bookingData = booking.dataValues || booking;

    console.log('Booking Data Values:', {
      ticket_id: bookingData.ticket_id,
      contact_name: bookingData.contact_name,
      gross_total: bookingData.gross_total,
      booking_date: bookingData.booking_date
    });

    // Replace placeholders
    const html = scheduler.body
      .replace(/%booking_id%/g, bookingData.ticket_id || '')
      .replace(/%customer_name%/g, bookingData.contact_name || '')
      .replace(/%total_price%/g, bookingData.gross_total?.toString() || '')
      .replace(/%date%/g, bookingData.booking_date || '');

    // Send test email
    await sendEmail({
      to: recipient_email,
      subject: scheduler.subject,
      html
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        to: recipient_email,
        subject: scheduler.subject,
        booking_data_used: {
          ticket_id: bookingData.ticket_id,
          contact_name: bookingData.contact_name,
          gross_total: bookingData.gross_total
        }
      }
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
};