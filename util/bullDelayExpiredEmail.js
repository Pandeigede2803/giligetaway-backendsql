const Queue = require("bull");
const { sendExpiredBookingEmail } = require("./sendPaymentEmail");

// Create a Bull queue with default Redis connection
const expiredEmailQueue = new Queue("expired-booking-emails", {
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times if email sending fails
    backoff: {
      type: "exponential",
      delay: 5000, // Start with a 5 second delay for retries
    },
    removeOnComplete: true, // Remove jobs from the queue once they're complete
  },
});

// Default delay time in milliseconds (3 hours)
const DEFAULT_EMAIL_DELAY = process.env.EXPIRED_EMAIL_DELAY 
  ? parseInt(process.env.EXPIRED_EMAIL_DELAY) * 60 * 60 * 1000 // Convert hours to milliseconds
  : 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Queue an expired booking email to be sent after the specified delay
 * @param {string} email - Recipient email address
 * @param {Object} booking - Booking object
 * @param {number} delay - Optional delay in milliseconds, defaults to DEFAULT_EMAIL_DELAY
 * @returns {Promise<boolean>} - Success status
 */
const queueExpiredBookingEmail = async (email, booking, delay = DEFAULT_EMAIL_DELAY) => {
  try {
    // Create a job with email data
    const jobData = {
      email,
      booking: {
        id: booking.id,
        ticket_id: booking.ticket_id,
        contact_name: booking.contact_name,
        // Include only necessary booking data to minimize storage
        payment_method: booking.payment_method,
        currency: booking.currency,
        amount: booking.amount
      },
      queuedAt: new Date().toISOString()
    };

    // Add job to Bull queue with the specified delay
    await expiredEmailQueue.add(jobData, {
      delay: delay,
      jobId: `expired-email-${booking.id}-${Date.now()}`
    });
    
    console.log(`📧 Expired booking email for ${email} queued to be sent in ${delay/1000/60} minutes`);
    return true;
  } catch (error) {
    console.error('❌ Failed to queue expired booking email:', error);
    return false;
  }
};

const bulkQueueExpiredBookingEmails = async (bookingList, delay = DEFAULT_EMAIL_DELAY) => {
  try {
    const jobs = bookingList.map((booking) => {
      const email = booking.contact_email;
      return {
        name: `expired-email-${booking.id}-${Date.now()}`, // optional: job name
        data: {
          email,
          booking: {
            id: booking.id,
            ticket_id: booking.ticket_id,
            contact_name: booking.contact_name,
            payment_method: booking.payment_method,
            currency: booking.currency,
            amount: booking.amount
          },
          queuedAt: new Date().toISOString()
        },
        opts: {
          delay: delay
        }
      };
    });

    if (jobs.length > 0) {
      await expiredEmailQueue.addBulk(jobs);
      console.log(`📦 Successfully queued ${jobs.length} expired booking emails in bulk`);
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to bulk queue expired booking emails:', error);
    return false;
  }
};



// Process jobs from the queue
expiredEmailQueue.process(async (job) => {
  const { email, booking } = job.data;
  
  try {
    console.log(`🔄 Processing expired booking email for ${email} (Booking ID: ${booking.id})`);
    
    // Send the email
    const emailSent = await sendExpiredBookingEmail(email, booking);
    
    if (emailSent) {
      console.log(`✅ Delayed expired booking email sent to ${email} for booking ID ${booking.id}`);
      return { success: true };
    } else {
      throw new Error(`Failed to send email to ${email}`);
    }
  } catch (error) {
    console.error(`❌ Error processing expired email for ${email}:`, error);
    throw error; // Rethrow to trigger Bull's retry mechanism
  }
});

// Error handling for the queue
expiredEmailQueue.on('error', (error) => {
  console.error('❌ Bull queue error:', error);
});

expiredEmailQueue.on('failed', (job, error) => {
  console.error(`❌ Job ${job.id} failed:`, error);
});

// Completed jobs
expiredEmailQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

// Start the queue processor
const startEmailQueueProcessor = () => {
  console.log('🚀 Starting Bull email queue processor...');
  // The processor is automatically started by registering the process function
  return expiredEmailQueue;
};

module.exports = {
  queueExpiredBookingEmail,
  startEmailQueueProcessor,
  bulkQueueExpiredBookingEmails,
  DEFAULT_EMAIL_DELAY
};