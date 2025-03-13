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
  

const sendPaymentEmail = async (recipientEmail, booking, paymentMethod, paymentStatus, refundAmount = null, refundAmountUSD = null) => {

    console.log("start to send the email", recipientEmail);
    const emailUrl = process.env.FRONTEND_URL; // Retrieve email URL from environment variables

    try {
      let subject = "Payment Update for Your Booking";
      let message = `<p>Dear Customer,</p>`;
  
      if (paymentStatus === "paid") {
        message += `<p>Your payment for <strong>Ticket ID: ${booking.ticket_id}</strong> has been successfully processed.</p>
                    <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                    <p><strong>Payment Status:</strong> ${paymentStatus}</p>`;
      } else if (paymentStatus === "pending") {
        message += `<p>Your payment for <strong>Booking ID: ${booking.ticket_id}</strong> is currently pending.</p>
                    <p>Please complete your payment to confirm your booking.</p>`;
      } else if (paymentStatus === "failed") {
        message += `<p>Unfortunately, your payment for <strong>Booking ID: ${booking.ticket_id}</strong> has failed.</p>
                    <p>Please try again or contact support.</p>`;
      } else if (paymentStatus === "refund_50" || paymentStatus === "refund_100") {
        const refundType = paymentStatus === "refund_50" ? "50%" : "Full";
        message += `<p>A <strong>${refundType} refund</strong> has been processed for your booking.</p>
                    <p><strong>Refund Amount:</strong> ${refundAmount} ${booking.currency}</p>`;
        if (refundAmountUSD !== null) {
          message += `<p><strong>Refund Amount in USD:</strong> $${refundAmountUSD}</p>`;
        }
        message += `<p><strong>New Booking Status:</strong> ${paymentStatus}</p>`;
      } else {
        message += `<p>Your payment status has been updated.</p>
                    <p><strong>Booking ID:</strong> ${booking.ticket_id}</p>
                    <p><strong>New Payment Status:</strong> ${paymentStatus}</p>`;;
      }
  
      message += `<p>If you have any questions, please contact our support team.</p>
                  <p>You can view your booking details <a href="${emailUrl}/check-invoice/${booking.ticket_id}">here</a>.</p>`;
  
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

  const sendEmailTransportBookingUpdate = async (recipientEmail, 
    bookingTicketId,  transportType, transportPrice, paymentStatus, paymentMethod) => {
    try {
      const emailUrl = process.env.FRONTEND_URL; // Retrieve email URL from environment variables

      let subject = "Transport Booking Update for Your Booking";
      let message = `<p>Dear Customer,</p>`;

      message += `<p>Your transport booking for <strong>Booking Ticket ID: ${bookingTicketId}</strong> has been updated.</p>
                  <p><strong>Transport Type:</strong> ${transportType}</p>
                  <p><strong>Transport Price:</strong> ${transportPrice} ${paymentMethod}</p>
                  <p><strong>Payment Status:</strong> ${paymentStatus}</p>
                  <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                  <p>If you have any questions, please contact our support team.</p>
                  <p>You can view your invoice details <a href="${emailUrl}/check-invoice/${bookingTicketId}">here</a>.</p>
                  <p>You can view your ticket details <a href="${emailUrl}/check-ticket-page/${bookingTicketId}">here</a>.</p>`;

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
  const sendEmailNotificationAgent = async (recipientEmail, agentEmail, payment_method, payment_status, ticket_id) => {
    try {
      const emailUrl = process.env.FRONTEND_URL; // Retrieve email URL from environment variables

      // Email to Agent
      let agentSubject = "Update for Your Booking";
      let agentMessage = `<p>Dear Agent,</p>`;
      agentMessage += `<p>Your booking for <strong>Booking Ticket ID: ${ticket_id}</strong> has been updated.</p>
                       <p><strong>Payment Method:</strong> ${payment_method}</p>
                       <p><strong>Payment Status:</strong> ${payment_status}</p>
                       <p>If you have any questions, please contact our support team.</p>
                       <p>You can view your invoice details <a href="${emailUrl}/check-invoice/${ticket_id}">here</a>.</p>
                       <p>You can view your ticket details <a href="${emailUrl}/check-ticket-page/${ticket_id}">here</a>.</p>`;
      const agentMailOptions = {
        from: process.env.EMAIL_USER,
        to: agentEmail,
        subject: agentSubject,
        html: agentMessage,
      };

      // Email to Recipient
      let recipientSubject = "Booking Update Notification";
      let recipientMessage = `<p>Dear Customer,</p>`;
      recipientMessage += `<p>Your booking for <strong>Booking Ticket ID: ${ticket_id}</strong> has been updated.</p>
                           <p><strong>Payment Method:</strong> ${payment_method}</p>
                           <p><strong>Payment Status:</strong> ${payment_status}</p>
                           <p>If you have any questions, please contact our support team.</p>
                           <p>You can view your invoice details <a href="${emailUrl}/check-invoice/${ticket_id}">here</a>.</p>
                           <p>You can view your ticket details <a href="${emailUrl}/check-ticket-page/${ticket_id}">here</a>.</p>`;
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
      








      
  const sendEmailNotification = async (recipientEmail, bookingId, oldDate, newDate,agentEmail) => {
    try {

      const emailUrl = process.env.FRONTEND_URL; // Retrieve email URL from environment variables
      console.log("emailUrl",emailUrl)

      // MAKE THE RECEPIENT ARRAY EMAIL
      const recipientEmails = [recipientEmail, agentEmail ];

      console.log("start to send the email")

      const mailOptions = {
        from: process.env.EMAIL_USER, // Sender's email
        to: recipientEmail, // Recipient's email
        subject: 'Booking Date Updated',
        html: `
          <h3>Your booking has been updated</h3>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Previous Date:</strong> ${oldDate}</p>
          <p><strong>New Date:</strong> ${newDate}</p>
          <p>For update ticket details, visit: <a href="${emailUrl}/check-ticket-page/${bookingId}">Click this link url</a></p>
          <p>If you have any questions, please contact our support.</p>
        `,
      };

   
  
      await transporter.sendMail(mailOptions);
      console.log('📧 Email notification sent successfully to', recipientEmail);
    } catch (error) {
      console.error('❌ Failed to send email notification:', error);
    }
  };
  

  module.exports = { sendPaymentEmail, sendEmailNotification,sendEmailTransportBookingUpdate,sendEmailNotificationAgent };