// utils/emailService.js (di Express.js)
const axios = require('axios');
require('dotenv').config();

/**
 * Fungsi untuk mengirim email invoice dan ticket melalui API Next.js
 * @param {Object} booking - Data booking dari database
 * @returns {Promise<Object>} - Status pengiriman email
 */
const sendInvoiceAndTicketEmail = async (recipientEmail, booking,midtransOrderId) => {
    try {
      console.log("booking file", booking);
  
      // Parse finalState jika dalam bentuk string
      const finalState = typeof booking.final_state === 'string' 
        ? JSON.parse(booking.final_state) 
        : booking.final_state;
  
      // Siapkan data untuk API Next.js
      const payload = {
        booking,
        transactionId: midtransOrderId,
        email: recipientEmail,
        finalState: finalState
      };;
      
  
    //   console.log("Sending data to Next.js API:", JSON.stringify(payload));
  
      // Kirim request ke API Next.js
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payment/send-email-customer-express`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 detik timeout
        }
      );
  
    //   console.log("API Response:", response.data);
      return { 
        success: true, 
        message: 'Email sent successfully',
        data: response.data 
      };
    } catch (error) {
      console.error("Error sending email via Next.js API:", error);
      console.error("Error details:", error.response?.data || error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.error || error.message 
      };
    }
  };

module.exports = { sendInvoiceAndTicketEmail };