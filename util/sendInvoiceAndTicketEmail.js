// utils/emailService.js (di Express.js)
const axios = require("axios");
require("dotenv").config();
const {
  sendBackupEmail,
  sendBackupEmailRoundTrip,
} = require("../util/sendPaymentEmail");
/**
 * Fungsi untuk mengirim email invoice dan ticket melalui API Next.js
 * @param {Object} booking - Data booking dari database
 * @returns {Promise<Object>} - Status pengiriman email
 */
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

const sendInvoiceAndTicketEmail = async (
  recipientEmail,
  booking,
  transactionId,
  agentCommission,
  agent
) => {
  // ✅ Move finalState and notificationPayload above
  const finalState =
    typeof booking.final_state === "string"
      ? JSON.parse(booking.final_state)
      : booking.final_state;

  const notificationPayload = {
    transactionId: transactionId,
    finalState: finalState,
    discountValue: booking.discount_data?.discountValue || 0,
    paymentMethod: booking.payment_method,
    agentCommission: agentCommission,
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

    console.log("Email API Response:", emailResponse.data);

    return {
      success: true,
      message: "Email and notification sent successfully",
      data: emailResponse.data,
    };
  } catch (error) {
    console.error("Error sending email via API:", error);
    console.error("Error details:", error.response?.data || error.message);

    // Fallback to simple backup email
    try {
      await sendBackupEmail(recipientEmail, booking);
      console.log("✅ Fallback email sent successfully");
    } catch (fallbackErr) {
      console.error("❌ Failed to send fallback email:", fallbackErr);
    }

    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  } finally {
    try {
      console.log(`Sending to notification API for booking ${booking.id}`);
      const notificationResponse = await axios.post(
        `${process.env.FRONTEND_URL}/api/payment/send-notification`,
        notificationPayload,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );
      console.log("Notification API Response:", notificationResponse.data);
    } catch (notificationError) {
      console.error("Error sending notification:", notificationError.message);
    }
  }
};

const sendInvoiceAndTicketEmailRoundTrip = async (
  recipientEmail,
  firstBooking,
  secondBooking,
  transactionId
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

    console.log(`Sending round trip email to ${recipientEmail}`);

    const response = await axios.post(
      `${process.env.FRONTEND_URL}/api/payment/send-email-round-customer-express`,
      emailPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return {
      success: true,
      message: "Round trip email and notification sent successfully",
      data: response.data,
    };
  } catch (error) {
    console.error("Error sending round trip email:", error);
    console.error("Error details:", error.response?.data || error.message);

    // Fallback to simple backup email
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
    try {
      console.log(
        `Sending to notification API for round trip bookings ${firstBooking.id}`
      );

      const notificationResponse = await axios.post(
        `${process.env.FRONTEND_URL}/api/payment/send-notification-round`,
        notificationPayload,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      console.log(
        "Notification API Response for round trip:",
        notificationResponse.data
      );
    } catch (notificationError) {
      console.error(
        "Error sending round trip notification:",
        notificationError.message
      );
    }
  }
};

module.exports = {
  sendInvoiceAndTicketEmail,
  sendInvoiceAndTicketEmailRoundTrip,
};
