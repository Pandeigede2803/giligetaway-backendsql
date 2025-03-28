const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_GMAIL, // SMTP Server (e.g., smtp.gmail.com)
  port: process.env.EMAIL_PORT_GMAIL, // Use port 465 for SSL
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER_GMAIL, // Your email
    pass: process.env.EMAIL_PASS_GMAIL, // Your email password or app password
  },
});

const sendPaymentEmail = async (
  recipientEmail,
  booking,
  paymentMethod,
  paymentStatus,
  refundAmount = null,
  refundAmountUSD = null
) => {
  console.log("start to send the email", recipientEmail);
  const emailUrl = process.env.FRONTEND_URL; // Retrieve email URL from environment variables

  try {
    let subject = "Payment Update for Your Booking";
    let statusColor = "#4CAF50"; // Default green color for success
    let statusIcon = "✅"; // Default success icon
    let statusMessage = "Payment Successful";

    // Set appropriate color, icon and status message based on payment status
    if (paymentStatus === "pending") {
      statusColor = "#FF9800"; // Orange for pending
      statusIcon = "⏳";
      statusMessage = "Payment Pending";
    } else if (paymentStatus === "failed") {
      statusColor = "#F44336"; // Red for failed
      statusIcon = "❌";
      statusMessage = "Payment Failed";
    } else if (paymentStatus === "refund_50" || paymentStatus === "refund_100") {
      statusColor = "#2196F3"; // Blue for refund
      statusIcon = "💰";
      statusMessage = paymentStatus === "refund_50" ? "Partial Refund Processed" : "Full Refund Processed";
    }

    let message = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; border-bottom: 3px solid #ddd;">
            <h1 style="margin: 0; color: #333;">Booking Update</h1>
          </div>
          <div style="padding: 20px; background-color: #fff;">
            <p style="margin-top: 0;">Dear Customer,</p>
            
            <div style="display: inline-block; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; color: white; background-color: ${statusColor};">
              ${statusIcon} ${statusMessage}
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">`;

    // Payment-specific content
    if (paymentStatus === "paid") {
      message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${booking.ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Method:</span> ${paymentMethod}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Status:</span> ${paymentStatus}
              </div>
              <p style="margin-bottom: 0;">Thank you for your payment. Your booking has been confirmed.</p>`;
    } else if (paymentStatus === "pending") {
      message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${booking.ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Method:</span> ${paymentMethod}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Status:</span> ${paymentStatus}
              </div>
              <p style="margin-bottom: 0;">Your payment is currently being processed. Please complete your payment to confirm your booking.</p>`;
    } else if (paymentStatus === "failed") {
      message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${booking.ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Method:</span> ${paymentMethod}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Status:</span> ${paymentStatus}
              </div>
              <p style="margin-bottom: 0;">Unfortunately, we couldn't process your payment. Please try again or contact our support team for assistance.</p>`;
    } else if (paymentStatus === "refund_50" || paymentStatus === "refund_100") {
      const refundType = paymentStatus === "refund_50" ? "50%" : "Full";
      message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${booking.ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Refund Type:</span> ${refundType}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Refund Amount:</span> ${refundAmount} ${booking.currency}
              </div>`;
      if (refundAmountUSD !== null) {
        message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Refund in USD:</span> $${refundAmountUSD}
              </div>`;
      }
      message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">New Status:</span> ${paymentStatus}
              </div>
              <p style="margin-bottom: 0;">Your refund has been processed successfully. Please allow 3-5 business days for the amount to appear in your account.</p>`;
    } else {
      message += `
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${booking.ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">New Status:</span> ${paymentStatus}
              </div>
              <p style="margin-bottom: 0;">Your payment status has been updated.</p>`;
    }

    message += `
            </div>
            
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            
            <a href="${emailUrl}/check-invoice/${booking.ticket_id}" style="display: inline-block; padding: 10px 20px; margin: 15px 0; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Booking Details</a>
            
            <div style="margin-top: 20px; text-align: center; padding: 15px; font-size: 12px; color: #777; border-top: 1px solid #eee;">
              <p style="margin-bottom: 5px;">© ${new Date().getFullYear()} Your Company Name</p>
              <p style="margin-top: 0;">This is an automated message, please do not reply directly to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Payment email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("❌ Failed to send payment email:", error);
  }
};

const sendEmailTransportBookingUpdate = async (
  recipientEmail,
  bookingTicketId,
  transportType,
  transportPrice,
  paymentStatus,
  paymentMethod
) => {
  try {
    const emailUrl = process.env.FRONTEND_URL;
    
    // Determine status styling
    let statusColor = "#4CAF50"; // Default green
    if (paymentStatus === "pending") {
      statusColor = "#FF9800"; // Orange
    } else if (paymentStatus === "failed") {
      statusColor = "#F44336"; // Red
    }

    let subject = "Transport Booking Update";
    let message = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transport Booking Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; border-bottom: 3px solid #ddd;">
            <h1 style="margin: 0; color: #333;">Transport Booking Update</h1>
          </div>
          <div style="padding: 20px; background-color: #fff;">
            <p style="margin-top: 0;">Dear Customer,</p>
            
            <div style="display: inline-block; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; color: white; background-color: ${statusColor};">
              Transport Booking ${paymentStatus.toUpperCase()}
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${bookingTicketId}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Transport Type:</span> ${transportType}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Transport Price:</span> ${transportPrice} ${paymentMethod}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Status:</span> ${paymentStatus}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Method:</span> ${paymentMethod}
              </div>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            
            <div style="margin: 20px 0;">
              <a href="${emailUrl}/check-invoice/${bookingTicketId}" style="display: inline-block; padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Invoice</a>
              <a href="${emailUrl}/check-ticket-page/${bookingTicketId}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Ticket</a>
            </div>
            
            <div style="margin-top: 20px; text-align: center; padding: 15px; font-size: 12px; color: #777; border-top: 1px solid #eee;">
              <p style="margin-bottom: 5px;">© ${new Date().getFullYear()} Your Company Name</p>
              <p style="margin-top: 0;">This is an automated message, please do not reply directly to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Transport booking update email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("❌ Failed to send transport booking update email:", error);
  }
};

// sendEmailNotificationAgent
const sendEmailNotificationAgent = async (
  recipientEmail,
  agentEmail,
  payment_method,
  payment_status,
  ticket_id
) => {
  try {
    const emailUrl = process.env.FRONTEND_URL;
    
    // Determine status styling
    let statusColor = "#4CAF50"; // Default green
    if (payment_status === "pending") {
      statusColor = "#FF9800"; // Orange
    } else if (payment_status === "failed") {
      statusColor = "#F44336"; // Red
    } else if (payment_status.includes("refund")) {
      statusColor = "#2196F3"; // Blue
    }
    
    // Email to Agent
    let agentSubject = "Booking Update Notification";
    let agentMessage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; border-bottom: 3px solid #ddd;">
            <h1 style="margin: 0; color: #333;">Agent Booking Update</h1>
          </div>
          <div style="padding: 20px; background-color: #fff;">
            <p style="margin-top: 0;">Dear Agent,</p>
            
            <div style="display: inline-block; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; color: white; background-color: ${statusColor};">
              Booking Status: ${payment_status.toUpperCase()}
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Method:</span> ${payment_method}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Status:</span> ${payment_status}
              </div>
            </div>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <div style="margin: 20px 0;">
              <a href="${emailUrl}/check-invoice/${ticket_id}" style="display: inline-block; padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Invoice</a>
              <a href="${emailUrl}/check-ticket-page/${ticket_id}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Ticket</a>
            </div>
            
            <div style="margin-top: 20px; text-align: center; padding: 15px; font-size: 12px; color: #777; border-top: 1px solid #eee;">
              <p style="margin-bottom: 5px;">© ${new Date().getFullYear()} Your Company Name</p>
              <p style="margin-top: 0;">This is an automated message, please do not reply directly to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Email to Recipient
    let recipientSubject = "Booking Update Notification";
    let recipientMessage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; border-bottom: 3px solid #ddd;">
            <h1 style="margin: 0; color: #333;">Booking Update</h1>
          </div>
          <div style="padding: 20px; background-color: #fff;">
            <p style="margin-top: 0;">Dear Customer,</p>
            
            <div style="display: inline-block; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; color: white; background-color: ${statusColor};">
              Booking Status: ${payment_status.toUpperCase()}
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Ticket ID:</span> ${ticket_id}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Method:</span> ${payment_method}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Payment Status:</span> ${payment_status}
              </div>
            </div>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <div style="margin: 20px 0;">
              <a href="${emailUrl}/check-invoice/${ticket_id}" style="display: inline-block; padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Invoice</a>
              <a href="${emailUrl}/check-ticket-page/${ticket_id}" style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Ticket</a>
            </div>
            
            <div style="margin-top: 20px; text-align: center; padding: 15px; font-size: 12px; color: #777; border-top: 1px solid #eee;">
              <p style="margin-bottom: 5px;">© ${new Date().getFullYear()} Your Company Name</p>
              <p style="margin-top: 0;">This is an automated message, please do not reply directly to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const agentMailOptions = {
      from: process.env.EMAIL_USER,
      to: agentEmail,
      subject: agentSubject,
      html: agentMessage,
    };

    const recipientMailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: recipientSubject,
      html: recipientMessage,
    };

    // Send emails
    await transporter.sendMail(agentMailOptions);
    console.log(`📧 Booking update email sent to agent ${agentEmail}`);
    await transporter.sendMail(recipientMailOptions);
    console.log(`📧 Booking update email sent to recipient ${recipientEmail}`);
  } catch (error) {
    console.error("❌ Failed to send booking update emails:", error);
  }
};

// how to use it send notification agent
// sendEmailNotificationAgent(recipientEmail, agentEmail, payment_method, payment_status, ticket_id);
// sendEmailNotification(recipientEmail, bookingId, oldDate, newDate);



const sendEmailNotification = async (
  recipientEmail,
  bookingId,
  oldDate,
  newDate,
  agentEmail
) => {
  try {
    const emailUrl = process.env.FRONTEND_URL;
    console.log("emailUrl", emailUrl);

    const message = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Date Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; border-bottom: 3px solid #ddd;">
            <h1 style="margin: 0; color: #333;">Booking Date Update</h1>
          </div>
          <div style="padding: 20px; background-color: #fff;">
            <p style="margin-top: 0;">Dear Customer,</p>
            
            <div style="display: inline-block; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; color: white; background-color: #FF9800;">
              ⚠️ Booking Date Changed
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Booking ID:</span> ${bookingId}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">Previous Date:</span> ${oldDate}
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold; display: inline-block; width: 150px;">New Date:</span> <span style="color: #2196F3; font-weight: bold;">${newDate}</span>
              </div>
            </div>
            
            <p>Please review the updated booking details. If you have any questions or concerns about this change, please contact our support team immediately.</p>
            
            <a href="${emailUrl}/check-ticket-page/${bookingId}" style="display: inline-block; padding: 10px 20px; margin: 15px 0; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Updated Ticket</a>
            
            <div style="margin-top: 20px; text-align: center; padding: 15px; font-size: 12px; color: #777; border-top: 1px solid #eee;">
              <p style="margin-bottom: 5px;">© ${new Date().getFullYear()} Your Company Name</p>
              <p style="margin-top: 0;">This is an automated message, please do not reply directly to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // If agent email is provided, also send to them
    const recipients = agentEmail ? [recipientEmail, agentEmail] : recipientEmail;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipients,
      subject: "Booking Date Updated",
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Email notification sent successfully to", recipients);
  } catch (error) {
    console.error("❌ Failed to send email notification:", error);
  }
};

/**
 * Function to send payment reminder email to customer
 * @param {string} recipientEmail - Customer email
 * @param {object} booking - Booking data
 * @param {number} reminderLevel - Reminder level (1, 2, or 3)
 */
const sendUnpaidReminderEmail = async (
  recipientEmail,
  booking,
  reminderLevel = 1
) => {
  console.log(
    `Sending reminder #${reminderLevel} to customer ${recipientEmail}`
  );

  console.log("👦booking", booking);
  const emailUrl = process.env.FRONTEND_URL;

  try {
    // Create email subject based on reminder level
    let subject = "";
    if (reminderLevel === 1) {
      subject = "Payment Reminder for Your Booking";
    } else if (reminderLevel === 2) {
      subject = "Second Reminder - Your Booking Requires Payment";
    } else {
      subject = "IMPORTANT: Your Booking Will Be Canceled in 6 Hours";
    }

    // Set urgency level based on reminder level
    let urgencyNotice = "";
    if (reminderLevel === 1) {
      urgencyNotice =
        "We would like to remind you that we haven't received your payment yet.";
    } else if (reminderLevel === 2) {
      urgencyNotice =
        "We still haven't received your payment. Please complete your payment promptly to confirm your booking.";
    } else {
      urgencyNotice =
        "<strong>ATTENTION:</strong> Your booking will be automatically canceled in the next 6 hours if payment is not completed.";
    }

    // Create email message
    let message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">${subject}</h2>
        
        <p>Dear Customer,</p>
        
        <p>${urgencyNotice}</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #333;">Booking Details:</h3>
          <p><strong>Ticket ID:</strong> ${booking.ticket_id}</p>
         <p><strong>Departure Date:</strong> ${new Intl.DateTimeFormat(
           "en-GB",
           { day: "2-digit", month: "long", year: "numeric" }
         ).format(new Date(booking.booking_date))}</p>
           <p><strong>Booking Date:</strong> ${new Intl.DateTimeFormat(
             "en-GB",
             { day: "2-digit", month: "long", year: "numeric" }
           ).format(new Date(booking.created_at))}</p>

   <p><strong>Total Payment:</strong> Rp ${Number(
     booking.gross_total
   ).toLocaleString("id-ID", { minimumFractionDigits: 0 })} </p>
          <p><strong>Payment Status:</strong> Unpaid</p>
          ${
            reminderLevel === 3
              ? `<p><strong style="color: red;">Payment Deadline:</strong> ${new Date(
                  new Date(booking.created_at).getTime() + 24 * 60 * 60 * 1000
                ).toLocaleString()}</p>`
              : ""
          }
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${emailUrl}/follow-up-payment/${
      booking.ticket_id
    }" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Complete Payment Now
          </a>
        </div>
        
        <p>If you have already made the payment, please disregard this email.</p>
        
        <p>If you are experiencing difficulties with the payment process, please contact our support team.</p>
        
        <p>You can also view your invoice details <a href="${emailUrl}/check-invoice/${
      booking.ticket_id
    }">here</a> and your ticket details <a href="${emailUrl}/check-ticket-page/${
      booking.ticket_id
    }">here</a>.</p>
        
        <p>Thank you for your attention.</p>
        
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
          <p>This email is sent automatically, please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER_GMAIL,
      to: recipientEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Reminder email #${reminderLevel} successfully sent to ${recipientEmail}`
    );
    return true;
  } catch (error) {
    console.error("❌ Failed to send reminder email:", error);
    return false;
  }
};

/**
 * Function to send payment reminder email to agent
 * @param {string} agentEmail - Agent email
 * @param {string} customerEmail - Customer email (for agent reference)
 * @param {object} booking - Booking data
 * @param {number} reminderLevel - Reminder level (1, 2, or 3)
 */
const sendUnpaidReminderEmailToAgent = async (
  agentEmail,
  customerEmail,
  booking,
  reminderLevel = 1
) => {
  console.log(`Sending reminder #${reminderLevel} to agent ${agentEmail}`);
  const emailUrl = process.env.FRONTEND_URL;

  try {
    // Create email subject based on reminder level
    let subject = "";
    if (reminderLevel === 1) {
      subject = "Reminder: Your Client's Booking is Unpaid";
    } else if (reminderLevel === 2) {
      subject = "Second Reminder: Client Booking Still Unpaid";
    } else {
      subject = "URGENT: Client Booking Will Be Canceled in 6 Hours";
    }

    // Create custom message for agent
    let agentMessage = "";
    if (reminderLevel === 1) {
      agentMessage = `This is a reminder that your client's booking with email ${customerEmail} is still unpaid. Please help follow up to ensure payment is completed on time.`;
    } else if (reminderLevel === 2) {
      agentMessage = `We still haven't received payment for your client's booking (${customerEmail}). Please follow up with your client immediately to complete the payment.`;
    } else {
      agentMessage = `<strong>ATTENTION:</strong> Your client's booking (${customerEmail}) will be automatically canceled in the next 6 hours if payment is not completed. Please contact your client immediately.`;
    }

    // Create email message
    let message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">${subject}</h2>
        
        <p>Dear Agent,</p>
        
        <p>${agentMessage}</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #333;">Client Booking Details:</h3>
          <p><strong>Ticket ID:</strong> ${booking.ticket_id}</p>
          <p><strong>Client Email:</strong> ${customerEmail}</p>
         <p><strong>Departure Date:</strong> ${new Intl.DateTimeFormat(
           "en-GB",
           { day: "2-digit", month: "long", year: "numeric" }
         ).format(new Date(booking.booking_date))}</p>
           <p><strong>Booking Date:</strong> ${new Intl.DateTimeFormat(
             "en-GB",
             { day: "2-digit", month: "long", year: "numeric" }
           ).format(new Date(booking.created_at))}</p>


          <p><strong>Total Payment:</strong> Rp ${Number(
            booking.gross_total
          ).toLocaleString("id-ID", { minimumFractionDigits: 0 })} </p>


          <p><strong>Payment Status:</strong> Unpaid</p>
          ${
            reminderLevel === 3
              ? `<p><strong style="color: red;">Payment Deadline:</strong> ${new Date(
                  new Date(booking.created_at).getTime() + 24 * 60 * 60 * 1000
                ).toLocaleString()}</p>`
              : ""
          }
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${emailUrl}/check-invoice/${
      booking.ticket_id
    }" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Invoice
          </a>
        </div>
        
        <p>A reminder email has also been sent to your client.</p>
        
        <p>You can view the invoice details <a href="${emailUrl}/check-invoice/${
      booking.ticket_id
    }">here</a> and ticket details <a href="${emailUrl}/check-ticket-page/${
      booking.ticket_id
    }">here</a>.</p>
        
        <p>Thank you for your cooperation.</p>
        
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
          <p>This email is sent automatically, please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER_GMAIL,
      to: agentEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Agent reminder email #${reminderLevel} successfully sent to ${agentEmail}`
    );
    return true;
  } catch (error) {
    console.error("❌ Failed to send agent reminder email:", error);
    return false;
  }
};

/**
 * Function to send cancellation email to customer
 * @param {string} customerEmail - Customer email
 * @param {object} booking - Booking data
 */
const sendCancellationEmail = async (customerEmail, booking) => {
  console.log(`Sending cancellation email to customer ${customerEmail}`);
  const emailUrl = process.env.FRONTEND_URL;

  try {
    const subject = "Your Booking Has Been Canceled - Payment Not Received";

    // Create email message
    let message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">${subject}</h2>
        
        <p>Dear Customer,</p>
        
        <p>We regret to inform you that your booking with the following details has been <strong style="color: red;">automatically canceled</strong> because payment was not received within 24 hours:</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #333;">Booking Details:</h3>
          <p><strong>Ticket ID:</strong> ${booking.ticket_id}</p>
     <p><strong>Departure Date:</strong> ${new Intl.DateTimeFormat(
           "en-GB",
           { day: "2-digit", month: "long", year: "numeric" }
         ).format(new Date(booking.booking_date))}</p>
           <p><strong>Booking Date:</strong> ${new Intl.DateTimeFormat(
             "en-GB",
             { day: "2-digit", month: "long", year: "numeric" }
           ).format(new Date(booking.created_at))}</p>


          <p><strong>Total Payment:</strong> ${booking.gross_total} ${
      booking.currency
    }</p>
          <p><strong>Status:</strong> <span style="color: red;">Canceled</span></p>
        </div>
        
        <p>If you still wish to travel, please contact your travel agent to make a new booking.</p>
        
        <p>Thank you for your understanding.</p>
        
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
          <p>This email is sent automatically, please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER_GMAIL,
      to: customerEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Cancellation email successfully sent to customer ${customerEmail}`
    );
    return true;
  } catch (error) {
    console.error("❌ Failed to send cancellation email to customer:", error);
    return false;
  }
};

/**
 * Function to send cancellation email to agent with rebooking instructions
 * @param {string} agentEmail - Agent email
 * @param {string} customerEmail - Customer email
 * @param {object} booking - Booking data
 */
const sendCancellationEmailToAgent = async (
  agentEmail,
  customerEmail,
  booking
) => {
  console.log(`Sending cancellation email to agent ${agentEmail}`);
  const emailUrl = process.env.FRONTEND_URL;

  try {
    const subject =
      "IMPORTANT: Client Booking Canceled - Rebooking Instructions";

    // Create custom email message for agent
    let message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">${subject}</h2>
        
        <p>Dear Agent,</p>
        
        <p>Your client's booking with email ${customerEmail} has been <strong style="color: red;">automatically canceled</strong> because payment was not received within 24 hours.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #333;">Canceled Booking Details:</h3>
          <p><strong>Ticket ID:</strong> ${booking.ticket_id}</p>
          <p><strong>Client Email:</strong> ${customerEmail}</p>

          <p><strong>Departure Date:</strong> ${new Intl.DateTimeFormat(
           "en-GB",
           { day: "2-digit", month: "long", year: "numeric" }
         ).format(new Date(booking.booking_date))}</p>
           <p><strong>Booking Date:</strong> ${new Intl.DateTimeFormat(
             "en-GB",
             { day: "2-digit", month: "long", year: "numeric" }
           ).format(new Date(booking.created_at))}</p>


          <p><strong>Total Payment:</strong> ${booking.gross_total} ${
      booking.currency
    }</p>
        
        <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #0066cc;">
          <h3 style="margin-top: 0; color: #0066cc;">Rebooking Instructions:</h3>
          <p>If your client still wishes to travel, please make a new booking and ensure payment is completed within 24 hours to avoid another cancellation.</p>
          <p>The seats previously reserved have been released back to the system, so you will need to check seat availability again.</p>
          <p><strong>Important:</strong> Make sure to follow up with your client to ensure timely payment.</p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${emailUrl}/booking" style="background-color: #0066cc; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Create New Booking
          </a>
        </div>
        
        <p>Your client has also been notified of this cancellation.</p>
        
        <p>Thank you for your cooperation.</p>
        
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
          <p>This email is sent automatically, please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER_GMAIL,
      to: agentEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Cancellation email successfully sent to agent ${agentEmail}`
    );
    return true;
  } catch (error) {
    console.error("❌ Failed to send cancellation email to agent:", error);
    return false;
  }
};

module.exports = {
  sendPaymentEmail,
  sendUnpaidReminderEmail,
  sendUnpaidReminderEmailToAgent,
  sendCancellationEmail,
  sendCancellationEmailToAgent,
  sendEmailNotification,
  sendEmailTransportBookingUpdate,
  sendEmailNotificationAgent,
  sendUnpaidReminderEmail,
};
