const nodemailer = require('nodemailer');

// Use existing transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_BREVO,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_LOGIN_BREVO,
    pass: process.env.EMAIL_PASS_BREVO,
  },
});

/**
 * Send waiting list notification email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.type - Email type ('customer', 'staff', or 'reminder')
 * @param {Object} params.waitingListData - Waiting list entry data
 * @param {number} params.availableSeats - Number of available seats
 */
const sendWaitingListEmail = async (params) => {
  try {
    const { to, type, waitingListData, availableSeats } = params;

    console.log(`📧 Preparing ${type} waiting list email to: ${to}`);

    // Generate email content based on type
    const emailContent = generateWaitingListEmailContent(type, waitingListData, availableSeats);

    const mailOptions = {
      from: process.env.EMAIL_BOOKING,
      to: to,
      // cc: type === 'staff' ? process.env.EMAIL_BOOKING : undefined,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    };

    // Send email
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ ${type} waiting list email sent successfully to: ${to}`);
    
    return {
      success: true,
      messageId: result.messageId,
      recipient: to,
      type: type
    };

  } catch (error) {
    console.error(`❌ Error sending ${params.type} waiting list email to ${params.to}:`, error);
    throw error;
  }
};

/**
 * Generate email content for waiting list notification
 * @param {string} type - Email type ('customer', 'staff', or 'reminder')
 * @param {Object} waitingListData - Waiting list entry data
 * @param {number} availableSeats - Number of available seats
 * @returns {Object} Email content with subject, html, and text
 */
const generateWaitingListEmailContent = (type, waitingListData, availableSeats) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (type === 'customer' || type === 'reminder') {
    // Simplified subject lines without emojis and promotional language
    const subject = type === 'customer' 
      ? `Seats Available - ${waitingListData.follow_up_notes || 'Your Journey'} - Gili Getaway`
      : `Booking Reminder - ${waitingListData.follow_up_notes || 'Your Journey'} - Gili Getaway`;
        
    return generateCustomerEmailContent(waitingListData, availableSeats, formatDate, formatTime, subject);
  } else if (type === 'staff') {
    return generateStaffEmailContent(waitingListData, availableSeats, formatDate, formatTime);
  }
};



/**
 * Send follow-up email to customers whose waiting list booking dates are outside schedule validity
 * @param {Array} invalidEntries - Array of invalid waiting list entries
 */
const sendInvalidWaitingListFollowUp = async (invalidEntries) => {
  try {
    if (!invalidEntries || invalidEntries.length === 0) {
      return { success: true, message: 'No invalid entries to follow up' };
    }

    console.log(`📧 Sending follow-up emails to ${invalidEntries.length} customers with invalid booking dates`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Send individual emails to each customer
    for (const entry of invalidEntries) {
      try {
        const emailContent = generateInvalidWaitingListFollowUpContent(entry);

        const mailOptions = {
          from: process.env.EMAIL_BOOKING,
          to: entry.contact_email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Follow-up email sent to: ${entry.contact_email}`);
        
        successCount++;
        results.push({
          success: true,
          customer: entry.contact_name,
          email: entry.contact_email,
          messageId: result.messageId
        });

      } catch (error) {
        console.error(`❌ Failed to send follow-up email to ${entry.contact_email}:`, error.message);
        failureCount++;
        results.push({
          success: false,
          customer: entry.contact_name,
          email: entry.contact_email,
          error: error.message
        });
      }
    }

    console.log(`📊 Follow-up email summary: ${successCount} sent, ${failureCount} failed`);
    
    return {
      success: true,
      total_customers: invalidEntries.length,
      sent_count: successCount,
      failed_count: failureCount,
      results: results
    };

  } catch (error) {
    console.error(`❌ Error in invalid waiting list follow-up:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate follow-up email content for customers with invalid booking dates
 * @param {Object} entry - Invalid waiting list entry
 * @returns {Object} Email content with subject, html, and text
 */
const generateInvalidWaitingListFollowUpContent = (entry) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helper function for days_of_week display
  const getDayOfWeekText = (daysOfWeek) => {
    if (!daysOfWeek || daysOfWeek === 0) return 'No days set';
    if (daysOfWeek === 127) return 'Every day'; // All days: 1+2+4+8+16+32+64=127
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const activeDays = [];
    
    for (let i = 0; i < 7; i++) {
      const dayBit = Math.pow(2, i);
      if (daysOfWeek & dayBit) {
        activeDays.push(dayNames[i]);
      }
    }
    
    return activeDays.length > 0 ? activeDays.join(', ') : 'No days set';
  };

  // Determine the specific issue with the booking
  const bookingDate = new Date(entry.booking_date);
  const validityStart = new Date(entry.WaitingListSchedule.validity_start);
  const validityEnd = new Date(entry.WaitingListSchedule.validity_end);
  const daysOfWeek = entry.WaitingListSchedule.days_of_week || 0;
  const bookingDayOfWeek = bookingDate.getDay();
  const dayBitValue = Math.pow(2, bookingDayOfWeek);
  
  // Check what type of issue this is
  const isOutsideValidityPeriod = bookingDate < validityStart || bookingDate > validityEnd;
  const isWrongDayOfWeek = (daysOfWeek & dayBitValue) === 0;
  const bookingDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bookingDayOfWeek];
  
  // Generate appropriate issue explanation
  let issueExplanation = '';
  let issueClass = 'background-color: #fff3cd; border-left: 4px solid #ffc107;'; // Default warning style
  
  if (isOutsideValidityPeriod && isWrongDayOfWeek) {
    // Both issues
    issueExplanation = `
      <strong>Unfortunately, the schedule you selected is not available on your requested date for two reasons:</strong><br><br>
      <strong>1. Date Range:</strong> The schedule operates from <strong>${formatDate(validityStart)}</strong> to <strong>${formatDate(validityEnd)}</strong>, 
      and your requested date falls outside this period.<br><br>
      <strong>2. Operating Days:</strong> This schedule only operates on <strong>${getDayOfWeekText(daysOfWeek)}</strong>, 
      but your requested date is on <strong>${bookingDayName}</strong>.
    `;
  } else if (isOutsideValidityPeriod) {
    // Only validity period issue
    issueExplanation = `
      <strong>Unfortunately, the schedule you selected is not available on your requested date.</strong><br><br>
      The schedule operates from <strong>${formatDate(validityStart)}</strong> to <strong>${formatDate(validityEnd)}</strong>, 
      and your requested date falls outside this period.
    `;
  } else if (isWrongDayOfWeek) {
    // Only days of week issue
    issueExplanation = `
      <strong>Unfortunately, the schedule you selected does not operate on your requested day.</strong><br><br>
      This schedule only operates on <strong>${getDayOfWeekText(daysOfWeek)}</strong>, 
      but your requested date (<strong>${formatDate(entry.booking_date)}</strong>) is on <strong>${bookingDayName}</strong>.
    `;
    issueClass = 'background-color: #e1ecf4; border-left: 4px solid #165297;'; // Blue style for day issue
  }

  const subject = `Alternative Booking Options Available - ${entry.follow_up_notes || 'Your Journey'} - Gili Getaway`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alternative Booking Options</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 20px; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: auto;">
        
        <!-- Header -->
        <div style="padding: 20px 0; border-bottom: 1px solid #e0e0e0;">
            <h2 style="color: #165297; margin: 0; font-size: 20px;">Gili Getaway</h2>
        </div>
      
        <!-- Body -->
        <div style="padding: 20px 0;">
            <p>Dear ${entry.contact_name || 'Valued Customer'},</p>
      
            <p>Thank you for your interest in booking with Gili Getaway. We wanted to follow up on your waiting list request.</p>

            <!-- Current Request Details -->
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #165297;">
                <h3 style="color: #165297; font-size: 16px; margin: 0 0 10px 0;">Your Original Request:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;">Route:</td>
                        <td style="padding: 5px 0;"><strong>${entry.follow_up_notes || 'N/A'}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Requested Date:</td>
                        <td style="padding: 5px 0;"><strong>${formatDate(entry.booking_date)}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Passengers:</td>
                        <td style="padding: 5px 0;"><strong>${entry.total_passengers} passenger${entry.total_passengers > 1 ? 's' : ''}</strong></td>
                    </tr>
                </table>
            </div>

            <!-- Schedule Information -->
            <div style="margin: 20px 0; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #4a90e2;">
                <h3 style="color: #4a90e2; font-size: 16px; margin: 0 0 10px 0;">Schedule Information:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;">Operating Period:</td>
                        <td style="padding: 5px 0;"><strong>${formatDate(validityStart)} - ${formatDate(validityEnd)}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Operating Days:</td>
                        <td style="padding: 5px 0;"><strong>${getDayOfWeekText(daysOfWeek)}</strong></td>
                    </tr>
                </table>
            </div>

            <!-- Issue Explanation -->
            <div style="margin: 20px 0; padding: 15px; ${issueClass}">
                <p style="margin: 0; color: #856404;">
                    ${issueExplanation}
                </p>
            </div>

            <p>However, we have good news! We have many other schedules and dates available that could work for your travel plans.</p>

            <!-- Call to Action -->
            <div style="margin: 30px 0; text-align: center;">
                <p style="font-size: 16px; margin-bottom: 20px;"><strong>Would you like to explore alternative options?</strong></p>
                
                <a href="${process.env.FRONTEND_URL || '#'}?ref=waitinglist&contact=${encodeURIComponent(entry.contact_email)}" 
                   style="display: inline-block; background-color: #165297; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 10px;">
                   🗓️ Browse Alternative Schedules
                </a>
                
                <br><br>
                
                <a href="https://wa.me/6281337074147?text=Hi, I need help finding alternative booking options for ${encodeURIComponent(entry.follow_up_notes || 'my journey')} originally requested for ${encodeURIComponent(formatDate(entry.booking_date))}" 
                   style="display: inline-block; background-color: #25D366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 10px;">
                   💬 Whatsapp Us for Assistance
                </a>
            </div>

            <p>Our customer service team knows all available schedules and can help you find the perfect alternative that fits your travel dates and preferences.</p>
            
            <p>Website: <a href="${process.env.FRONTEND_URL || '#'}" style="color: #165297;">www.giligetaway.com</a></p>

            <!-- Contact Info -->
            <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px;">
                <p style="margin: 0; font-size: 14px;">
                    <strong>Need assistance? Contact us:</strong><br>
                    📧 Email: <a href="mailto:bookings@giligetaway.com" style="color: #165297;">bookings@giligetaway.com</a><br>
                    📱 WhatsApp: <a href="https://wa.me/6281337074147" style="color: #25D366;">+62 813-3707-4147</a><br>
                </p>
            </div>
      
            <p>Thank you for choosing Gili Getaway. We look forward to making your island adventure happen!</p>
      
            <p>Best regards,<br>
            Customer Service Team<br>
            <strong>Gili Getaway</strong></p>
        </div>
      
        <!-- Footer -->
        <div style="border-top: 1px solid #e0e0e0; padding: 15px 0; font-size: 12px; color: #666;">
            <p style="margin: 5px 0;">Gili Getaway</p>
            <p style="margin: 5px 0;">Jl. Pantai Serangan, Serangan, Denpasar Selatan, Bali 80229</p>
            <p style="margin: 5px 0;">Phone: +62 813-3707-4147 | Email: bookings@giligetaway.com</p>
            <p style="margin: 5px 0;">This is a follow-up regarding your booking request.</p>
        </div>
        </div>
    </body>
    </html>
  `;
  
  // Generate text version with similar logic
  let textIssueExplanation = '';
  if (isOutsideValidityPeriod && isWrongDayOfWeek) {
    textIssueExplanation = `IMPORTANT UPDATE:
Unfortunately, the schedule you selected is not available on your requested date for two reasons:

1. DATE RANGE: The schedule operates from ${formatDate(validityStart)} to ${formatDate(validityEnd)}, and your requested date falls outside this period.

2. OPERATING DAYS: This schedule only operates on ${getDayOfWeekText(daysOfWeek)}, but your requested date is on ${bookingDayName}.`;
  } else if (isOutsideValidityPeriod) {
    textIssueExplanation = `IMPORTANT UPDATE:
Unfortunately, the schedule you selected is not available on your requested date. The schedule operates from ${formatDate(validityStart)} to ${formatDate(validityEnd)}, and your requested date falls outside this period.`;
  } else if (isWrongDayOfWeek) {
    textIssueExplanation = `IMPORTANT UPDATE:
Unfortunately, the schedule you selected does not operate on your requested day. This schedule only operates on ${getDayOfWeekText(daysOfWeek)}, but your requested date (${formatDate(entry.booking_date)}) is on ${bookingDayName}.`;
  }
  
  const text = `
ALTERNATIVE BOOKING OPTIONS - GILI GETAWAY

Dear ${entry.contact_name || 'Valued Customer'},

Thank you for your interest in booking with Gili Getaway. We wanted to follow up on your waiting list request.

YOUR ORIGINAL REQUEST:
Route: ${entry.follow_up_notes || 'N/A'}
Requested Date: ${formatDate(entry.booking_date)}
Passengers: ${entry.total_passengers} passenger${entry.total_passengers > 1 ? 's' : ''}

SCHEDULE INFORMATION:
Operating Period: ${formatDate(validityStart)} - ${formatDate(validityEnd)}
Operating Days: ${getDayOfWeekText(daysOfWeek)}

${textIssueExplanation}

However, we have good news! We have many other schedules and dates available that could work for your travel plans.

WOULD YOU LIKE TO EXPLORE ALTERNATIVE OPTIONS?

To find alternative schedules, please:
1. Visit our website: ${process.env.FRONTEND_URL || 'www.giligetaway.com'}
2. WhatsApp us: +62 813-3707-4147
3. Email us: bookings@giligetaway.com

CUSTOMER SERVICE:
📧 Email: bookings@giligetaway.com
📱 WhatsApp: +62 813-3707-4147
🕒 Hours: 8:00 AM - 8:00 PM (Bali Time)

Our customer service team knows all available schedules and can help you find the perfect alternative that fits your travel dates and preferences.

Thank you for choosing Gili Getaway. We look forward to making your island adventure happen!

Best regards,
Customer Service Team
Gili Getaway

---
This is a follow-up regarding your booking request.
  `;

  return { subject, html, text };
};

/**
 * Generate customer email content
 */
const generateCustomerEmailContent = (data, availableSeats, formatDate, formatTime, customSubject = null) => {
  // Simplified subject without emojis and promotional language
  const subject = customSubject || `Seats Available - ${data.follow_up_notes || 'Your Journey'} - Gili Getaway`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Seat Available Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 20px; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: auto;">
        
        <!-- Simple Header -->
        <div style="padding: 20px 0; border-bottom: 1px solid #e0e0e0;">
            <h2 style="color: #165297; margin: 0; font-size: 20px;">Gili Getaway</h2>
        </div>
      
        <!-- Body -->
        <div style="padding: 20px 0;">
            <p>Dear Customer,</p>
      
            <p>We are writing to inform you that seats are now available for your requested journey.</p>
      
            <!-- Journey Details -->
            <div style="margin: 20px 0;">
                <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">Booking Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;">Route:</td>
                        <td style="padding: 5px 0;">${data.follow_up_notes || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Departure Date:</td>
                        <td style="padding: 5px 0;">${formatDate(data.booking_date)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Passengers:</td>
                        <td style="padding: 5px 0;">${data.total_passengers} passengers</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Available Seats:</td>
                        <td style="padding: 5px 0;">${availableSeats} seats</td>
                    </tr>
                </table>
            </div>
      
            <p>These seats may be taken by other passengers very soon. Don't miss this opportunity!</p>
            
            <div style="margin: 20px 0; text-align: center;">
                <a href="${process.env.FRONTEND_URL || '#'}" style="display: inline-block; background-color: #165297; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 5px;">Book Your Journey Now</a>
            </div>
            
            <p>Website: <a href="${process.env.FRONTEND_URL || '#'}" style="color: #165297;">www.giligetaway.com</a></p>

            <!-- Contact Info -->
            <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border: 1px solid #e0e0e0;">
                <p style="margin: 0; font-size: 14px;">
                    <strong>Customer Service:</strong><br>
                    Email: <a href="mailto:bookings@giligetaway.com" style="color: #165297;">bookings@giligetaway.com</a><br>
                    Phone: +62 813-3707-4147
                </p>
            </div>
      
            <p>Thank you for choosing Gili Getaway.</p>
      
            <p>Best regards,<br>
            Customer Service Team<br>
            Gili Getaway</p>
        </div>
      
        <!-- Simple Footer -->
        <div style="border-top: 1px solid #e0e0e0; padding: 15px 0; font-size: 12px; color: #666;">
            <p style="margin: 5px 0;">Gili Getaway</p>
            <p style="margin: 5px 0;">Jl. Pantai Serangan, Serangan, Denpasar Selatan, Bali 80229</p>
            <p style="margin: 5px 0;">Phone:  +62 813-3707-4147| Email: bookings@giligetaway.com</p>
            <p style="margin: 5px 0;">This is an automated notification regarding your booking request.</p>
        </div>
        </div>
    </body>
    </html>
  `;
  
  const text = `
SEAT AVAILABILITY NOTIFICATION

Dear Customer,

We are writing to inform you that seats are now available for your requested journey.

BOOKING DETAILS:
Route: ${data.follow_up_notes || 'N/A'}
Departure Date: ${formatDate(data.booking_date)}
Departure Time: ${formatTime(data.WaitingListSchedule?.departure_time)}
Passengers: ${data.total_passengers} passengers
Available Seats: ${availableSeats} seats

To proceed with your booking, please visit our website or contact our customer service team.

Website: ${process.env.FRONTEND_URL || 'www.giligetaway.com'}

CUSTOMER SERVICE:
Email: bookings@giligetaway.com
Phone: +62 813-3707-4147 

Thank you for choosing Gili Getaway.

Best regards,
Customer Service Team
Gili Getaway

---
This is an automated notification regarding your booking request.
  `;

  return { subject, html, text };
};

/**
 * Generate staff email content
 */
const generateStaffEmailContent = (data, availableSeats, formatDate, formatTime) => {
  const subject = `🔔 Staff Alert: Waiting List Customer Notified - ID ${data.id}`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Staff Alert - Waiting List Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h2>🔔 Staff Notification Alert</h2>
                <p>Waiting List Customer Notified</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;">
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #856404;">📧 Customer Notification Sent</h3>
                    <p style="margin-bottom: 0; color: #856404;">A waiting list customer has been automatically notified about seat availability.</p>
                </div>
                
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #dee2e6;">
                    <h3 style="margin-top: 0; color: #2c3e50;">📋 Waiting List Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; width: 40%; color: #495057;">Waiting List ID:</td>
                            <td style="padding: 8px 0;">#${data.id}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Customer Email:</td>
                            <td style="padding: 8px 0;">${data.contact_email || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Customer Name:</td>
                            <td style="padding: 8px 0;">${data.contact_name || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Route Info:</td>
                            <td style="padding: 8px 0;">${data.follow_up_notes || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Schedule ID:</td>
                            <td style="padding: 8px 0;">${data.schedule_id}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">SubSchedule ID:</td>
                            <td style="padding: 8px 0;">${data.subschedule_id || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Departure Date:</td>
                            <td style="padding: 8px 0;">${formatDate(data.booking_date)}</td>
                        </tr>
                    
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Required Passengers:</td>
                            <td style="padding: 8px 0;">${data.total_passengers}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Available Seats:</td>
                            <td style="padding: 8px 0; color: #28a745; font-weight: bold;">${availableSeats}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Seat Availability ID:</td>
                            <td style="padding: 8px 0;">${data.seat_availability_id || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: bold; color: #495057;">Notification Time:</td>
                            <td style="padding: 8px 0;">${new Date().toLocaleString('id-ID')}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #0c5460;">⚠️ Action Required</h3>
                    <p style="margin-bottom: 0; color: #0c5460;">Please monitor if the customer proceeds with the booking. Follow up may be needed if no booking is made within a reasonable timeframe.</p>
                </div>

                <div style="text-align: center; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                        You can check the admin dashboard for real-time booking status and manage waiting list entries.
                    </p>
                </div>
                
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center;">
                    <p style="margin: 5px 0;">© ${new Date().getFullYear()} Gili Getaway. All rights reserved.</p>
                    <p style="margin: 5px 0;">This is an automated notification from the booking system.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
  
  const text = `
🔔 STAFF ALERT: Waiting List Customer Notified

A waiting list customer has been automatically notified about seat availability.

DETAILS:
- Waiting List ID: #${data.id}
- Customer: ${data.contact_name || 'N/A'} (${data.contact_email || 'N/A'})
- Route Info: ${data.follow_up_notes || 'N/A'}
- Date: ${formatDate(data.booking_date)}
- Time: ${formatTime(data.WaitingListSchedule?.departure_time)}
- Required: ${data.total_passengers} passengers
- Available: ${availableSeats} seats
- Notified: ${new Date().toLocaleString('id-ID')}

⚠️ Please monitor for customer booking response and follow up if needed.

This is an automated notification from the Gili Getaway booking system.
  `;

  return { subject, html, text };
};

module.exports = {
  sendWaitingListEmail,
  sendInvalidWaitingListFollowUp
};