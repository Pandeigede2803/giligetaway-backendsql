// utils/emailService.js (di Express.js)
const axios = require("axios");
require("dotenv").config();
const {
  sendBackupEmail,
  sendBackupEmailRoundTrip,
  sendEmailBackupAgentStaff,
  sendBackupEmailAlways,
    sendBackupEmailAlways2,
  sendBackupEmailAgentStaff,
  sendBackupEmailRoundTripAgentStaff,
  sendBackupEmailRoundTripAlways,
  sendStaffEmailForAgentBooking,
  sendStaffEmailRoundTripAgent,
} = require("../util/sendPaymentEmail");
/**
 * Fungsi untuk mengirim email invoice dan ticket melalui API Next.js
 * @param {Object} booking - Data booking dari database
 * @returns {Promise<Object>} - Status pengiriman email
 */
const sendTelegramError = async (message) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error("❌ Failed to notify Telegram:", err.message);
  }
};

const sendInvoiceAndTicketEmail = async (
  recipientEmail,
  booking,
  transactionId,
  agentCommission,
  agent
) => {
  const finalState =
    typeof booking.final_state === "string"
      ? JSON.parse(booking.final_state)
      : booking.final_state;

  const notificationPayload = {
    transactionId,
    finalState,
    discountValue: booking.discount_data?.discountValue || 0,
    paymentMethod: booking.payment_method,
    agentCommission,
  };

  try {
    const emailPayload = {
      booking,
      transactionId,
      email: recipientEmail,
      finalState,
      discountData: booking.discount_data,
      paymentMethod: booking.payment_method,
      agentCommission,
    };

    const emailResponse = await axios.post(
      `${process.env.FRONTEND_URL}/api/payment/send-email-customer-express`,
      emailPayload,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    console.log("✅ Email API Response:", emailResponse.data);

    return {
      success: true,
      message: "Email and notification sent successfully",
      data: emailResponse.data,
    };
  } catch (error) {
    console.error("❌ Error sending email via API:", error);
    console.error("🔍 Error details:", error.response?.data || error.message);

    await sendTelegramError(
      `❌ <b>EMAIL FAILED</b>
  <p><strong>Booking Details:</strong></p>
  <ul>
    <li><strong>Booking ID:</strong> ${booking?.id}</li>
    <li><strong>Ticket ID:</strong> ${booking?.ticket_id}</li>
    <li><strong>Contact:</strong> ${booking?.contact_name}</li>
    <li><strong>Phone:</strong> ${booking?.contact_phone}</li>
    <li><strong>Email:</strong> ${booking?.contact_email}</li>
    <li><strong>Route:</strong> ${booking?.from || "N/A"} – ${booking?.to || "N/A"}</li>
    <li><strong>Passengers:</strong> ${booking?.total_passengers} (Adults ${booking?.adult_passengers}, Children ${booking?.child_passengers}, Infants ${booking?.infant_passengers})</li>
    <li><strong>Amount:</strong> ${parseFloat(booking?.gross_total || 0).toLocaleString()} ${booking?.currency || "IDR"}</li>
    <li><strong>Booking Source:</strong> ${booking?.booking_source || "N/A"}</li>
    <li><strong>Travel Date:</strong> ${require("moment")(booking?.booking_date).format("MMM D, YYYY")}</li>
    <li><strong>Created:</strong> ${require("moment")(booking?.created_at).format("MMM D, YYYY h:mm A")}</li>
  </ul>
  <b>To:</b> ${recipientEmail}
  <b>Error:</b> ${error.message}`
    );

    // Fallback to simple backup email
    try {
      await sendBackupEmail(recipientEmail, booking);
      console.log("✅ Fallback email sent successfully");
    } catch (fallbackErr) {
      console.error(
        `❌ Failed to send fallback email for booking ${booking.id}:`,
        fallbackErr
      );
    }

    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  } finally {
    try {
      sendBackupEmailAlways(booking);
      console.log("✅ Backup email always sent successfully");
    } catch (backupErr) {
      console.error(
        "❌ Failed to run sendBackupEmailAlways:",
        backupErr.message
      );
    }

    // how to make thrrow different api email notication for staff if the booking.agent_id is exist or not null??
    if (booking.agent_id) {
      try {
        await sendStaffEmailForAgentBooking(booking, agent);
        console.log("✅ Agent staff email notification sent");
      } catch (staffErr) {
        console.error(
          "❌ Failed to send staff email notification:",
          staffErr.message
        );
        await sendTelegramError(
          `❌ <b>STAFF EMAIL FOR AGENT FAILED</b>\nBooking ID: ${booking?.id}-${booking?.ticket_id}\nAgent ID: ${booking.agent_id}\nError: ${staffErr.message}`
        );
      }
    }
    // use sendStaffEmailForAgentBooking(booking,agent)

    // Only send notification if booking is NOT from an agent
    if (!booking.agent_id) {
      try {
        console.log(`📨 Sending to notification API for booking ${booking.id}`);
        const notificationResponse = await axios.post(
          `${process.env.FRONTEND_URL}/api/payment/send-notification`,
          notificationPayload,
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          }
        );
        console.log("✅ Notification API Response:", notificationResponse.data);
      } catch (notificationError) {
        console.error(
          "❌ Error sending notification:",
          notificationError.message
        );

        // try to send email backup
        try {
          await sendBackupEmailAlways2(booking);
          console.log("✅ Backup email always sent successfully after notification failed");
        } catch (backupErr) {
          console.error(
            "❌ Failed to run sendBackupEmailAlways2 after notification failed:",
            backupErr.message
          );
        }

        await sendTelegramError(
          `❌ <b>EMAIL FAILED</b>
  <p><strong>Booking Details:</strong></p>
  <ul>
    <li><strong>Booking ID:</strong> ${booking?.id}</li>
    <li><strong>Ticket ID:</strong> ${booking?.ticket_id}</li>
    <li><strong>Contact:</strong> ${booking?.contact_name}</li>
    <li><strong>Phone:</strong> ${booking?.contact_phone}</li>
    <li><strong>Email:</strong> ${booking?.contact_email}</li>
    <li><strong>Route:</strong> ${booking?.from || "N/A"} – ${booking?.to || "N/A"}</li>
    <li><strong>Passengers:</strong> ${booking?.total_passengers} (Adults ${booking?.adult_passengers},
     Children ${booking?.child_passengers}, Infants ${booking?.infant_passengers})</li>
    <li><strong>Amount:</strong> ${parseFloat(booking?.gross_total || 0).toLocaleString()} ${booking?.currency || "IDR"}</li>
    <li><strong>Booking Source:</strong> ${booking?.booking_source || "N/A"}</li>
    <li><strong>Travel Date:</strong> ${require("moment")(booking?.booking_date).format("MMM D, YYYY")}</li>
    <li><strong>Created:</strong> ${require("moment")(booking?.created_at).format("MMM D, YYYY h:mm A")}</li>
  </ul>
  <b>To:</b> ${recipientEmail}
  <b>Error:</b> ${error.message}`
        );
      }
    }
  }
};




const sendInvoiceAndTicketEmailRoundTrip = async (
  recipientEmail,
  firstBooking,
  secondBooking,
  transactionId,
  agent,
  agentCommission
) => {
  const finalState =
    typeof firstBooking.final_state === "string"
      ? JSON.parse(firstBooking.final_state)
      : firstBooking.final_state;

  const notificationPayload = {
    transactionId: transactionId,
    finalState: finalState,
    discountValue: firstBooking.discount_data?.discountValue || 0,
  };

  try {
    const emailPayload = {
      booking: firstBooking,
      transactionId: transactionId,
      email: recipientEmail,
      finalState: finalState,
      discountData: firstBooking.discount_data,
      isRoundTrip: true,
    };

    console.log(`📧 Sending round trip email to ${recipientEmail}`);

    const response = await axios.post(
      `${process.env.FRONTEND_URL}/api/payment/send-email-round-customer-express`,
      emailPayload,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    console.log("✅ Email API Response:", response.data);

    return {
      success: true,
      message: "Round trip email and notification sent successfully",
      data: response.data,
    };
  } catch (error) {
    console.error("❌ Error sending round trip email:", error);
    console.error("🔍 Error details:", error.response?.data || error.message);

    // 🔔 Notify Telegram
    await sendTelegramError(
      `❌ <b>ROUNDTRIP EMAIL FAILED</b>\nBooking ID: ${firstBooking?.id}\nTo: ${recipientEmail}\nError: ${error.message}`
    );

    // 🔁 Fallback simple email
    try {
      await sendBackupEmailRoundTrip(
        recipientEmail,
        firstBooking,
        secondBooking
      );
      console.log("✅ Fallback round trip email sent successfully");
    } catch (fallbackErr) {
      console.error(
        "❌ Failed to send fallback round trip email:",
        fallbackErr
      );
    }

    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  } finally {
    // ✅ Always send backup email (safe, only once)
    try {
      sendBackupEmailRoundTripAlways(firstBooking, secondBooking);
      console.log("✅ Backup round trip email always sent successfully");
    } catch (err) {
      console.error(
        "❌ Failed to run sendBackupEmailRoundTripAlways:",
        err.message
      );
      // send telegram
      await sendTelegramError(
        `❌ <b>BACKUP ROUNDTRIP always EMAIL FAILED</b>
  <p><strong>Booking Details:</strong></p>
  <ul>
    <li><strong>Booking ID:</strong> ${firstBooking.id}</li>
    <li><strong>Ticket ID:</strong> ${firstBooking.ticket_id}</li>
    <li><strong>Route:</strong> ${firstBooking.from || "N/A"} - ${firstBooking.to || "N/A"}</li>
    <li><strong>Passengers:</strong> ${firstBooking.total_passengers} (Adults: ${firstBooking.adult_passengers}, Children: ${firstBooking.child_passengers}, Infants: ${firstBooking.infant_passengers})</li>
    <li><strong>Travel Date:</strong> ${firstBooking.booking_date}</li>
    <li><strong>Created At:</strong> ${firstBooking.created_at}</li>
  </ul>
  <h3 style="color:#165297;">Departure</h3>
  <ul>
    <li><strong>Booking ID:</strong> ${firstBooking.id}</li>
    <li><strong>Ticket ID:</strong> ${firstBooking.ticket_id}</li>
    <li><strong>Route:</strong> ${firstBooking.from || "N/A"} - ${firstBooking.to || "N/A"}</li>
    <li><strong>Passengers:</strong> ${firstBooking.total_passengers} (Adults: ${firstBooking.adult_passengers}, Children: ${firstBooking.child_passengers}, Infants: ${firstBooking.infant_passengers})</li>
    <li><strong>Travel Date:</strong> ${firstBooking.booking_date}</li>
    <li><strong>Created At:</strong> ${firstBooking.created_at}</li>
  </ul>
  <h3 style="color:#165297; margin-top: 30px;">Return</h3>
  <ul>
    <li><strong>Booking ID:</strong> ${secondBooking.id}</li>
    <li><strong>Ticket ID:</strong> ${secondBooking.ticket_id}</li>
    <li><strong>Route:</strong> ${secondBooking.from || "N/A"} - ${secondBooking.to || "N/A"}</li>
    <li><strong>Travel Date:</strong> ${secondBooking.booking_date}</li>
    <li><strong>Created At:</strong> ${secondBooking.created_at}</li>
  </ul>
  <b>Error:</b> ${err.message}`
      );
    }
    if (firstBooking.agent_id) {
      try {
        await sendStaffEmailRoundTripAgent(firstBooking, secondBooking, agent);
        console.log("✅ Round-trip agent staff email sent");
      } catch (staffErr) {
        console.error(
          "❌ Failed to send round-trip agent staff email:",
          staffErr.message
        );
        await sendTelegramError(
          `❌ <b>STAFF EMAIL ROUNDTRIP for collect from customer FAILED</b>\nBooking ID: ${firstBooking?.id}\nAgent ID: ${firstBooking.agent_id}\nError: ${staffErr.message}`
        );
      }
    }
    if (!firstBooking.agent_id) {
      try {
        console.log(
          `📨 Sending to notification API for round trip booking ID ${firstBooking.id}`
        );

        const notificationResponse = await axios.post(
          `${process.env.FRONTEND_URL}/api/payment/send-notification-round`,
          notificationPayload,
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          }
        );

        console.log(
          "✅ Notification API Response for round trip:",
          notificationResponse.data
        );
      } catch (notificationError) {
        console.error(
          "❌ Error sending round trip notification:",
          notificationError.message
        );
        console.error(
          "🔍 Notification error details:",
          notificationError.response?.data || notificationError.message
        );

        // Fallback: send backup email
        try {
          await sendBackupEmailAlways2(firstBooking);
          console.log("✅ Backup email sent after round trip notification failed");
        } catch (backupErr) {
          console.error(
            "❌ Failed to send backup email after notification failed:",
            backupErr.message
          );
        }

        // Send Telegram alert
        await sendTelegramError(
          `❌ <b>ROUNDTRIP NOTIFICATION FAILED</b>
<b>Booking ID:</b> ${firstBooking?.id}-${firstBooking?.ticket_id}
<b>Contact:</b> ${firstBooking?.contact_name}
<b>Phone:</b> ${firstBooking?.contact_phone}
<b>Email:</b> ${firstBooking?.contact_email}
<b>Route:</b> ${firstBooking?.from || "N/A"} – ${firstBooking?.to || "N/A"} (Round Trip)
<b>Passengers:</b> ${firstBooking?.total_passengers}
<b>Travel Date:</b> ${require("moment")(firstBooking?.booking_date).format("MMM D, YYYY")}
<b>Error:</b> ${notificationError.response?.data?.error || notificationError.message}`
        );
      }
    }
  }
};

module.exports = {
  sendInvoiceAndTicketEmail,
  sendInvoiceAndTicketEmailRoundTrip,
};

// const sendInvoiceAndTicketEmail = async (
//   recipientEmail,
//   booking,
//   transactionId,
//   agentCommission,
//   agent
// ) => {
//   try {
//     // console.log("Preparing to send invoice email for booking:", booking.id);
//     // console.log("booking data:", booking);

//     // console.log("agentCommission data:", agentCommission, agent);

//     // Parse finalState if it's a string
//     const finalState =
//       typeof booking.final_state === "string"
//         ? JSON.parse(booking.final_state)
//         : booking.final_state;

//     // Prepare payload for email API
//     const emailPayload = {
//       booking,
//       transactionId: transactionId,
//       email: recipientEmail,
//       finalState: finalState,
//       discountData: booking.discount_data,
//       paymentMethod: booking.payment_method,
//       agentCommission: agentCommission, // ✅ Add this
//     };

//     // console.log(
//     //   `Sending invoice email to ${recipientEmail} for booking ${booking.id}`
//     // );

//     // Send request to email API
//     const emailResponse = await axios.post(
//       `${process.env.FRONTEND_URL}/api/payment/send-email-customer-express`,
//       emailPayload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//         timeout: 30000, // 30 seconds timeout
//       }
//     );

//     console.log("Email API Response:", emailResponse.data);

//     // Prepare simplified payload for notification API
//     const notificationPayload = {
//       transactionId: transactionId,
//       finalState: finalState,
//       discountValue: booking.discount_data?.discountValue || 0,
//       paymentMethod: booking.payment_method,
//       agentCommission: agentCommission, // ✅ Add this
//     };

//     // Send to notification API with minimal data
//     try {
//       console.log(`Sending to notification API for booking ${booking.id}`);

//       const notificationResponse = await axios.post(
//         `${process.env.FRONTEND_URL}/api/payment/send-notification`,
//         notificationPayload,
//         {
//           headers: {
//             "Content-Type": "application/json",
//           },
//           timeout: 30000,
//         }
//       );

//       console.log("Notification API Response:", notificationResponse.data);
//     } catch (notificationError) {
//       // Log error but don't fail the primary email flow
//       console.error("Error sending notification:", notificationError.message);
//     }

//     return {
//       success: true,
//       message: "Email and notification sent successfully",
//       data: emailResponse.data,
//     };
//   } catch (error) {
//     console.error("Error sending email via API:", error);
//     console.error("Error details:", error.response?.data || error.message);

//     return {
//       success: false,
//       error: error.response?.data?.error || error.message,
//     };
//   }
// };
