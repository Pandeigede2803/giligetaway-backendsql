# Email strucktur or component
<!-- REFRENCE one way-->

/util/sendpaymentEmailApiAgent

# send email after booking sucess one way or round trip

 const nodemailer = require("nodemailer");
const moment = require("moment");
const { sendTelegramMessage } = require("./telegram");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_BREVO, // SMTP Server (e.g., smtp.gmail.com)
  port: 587, // Use port 465 for SSL
  secure: false, // Use SSL
  auth: {
    user: process.env.EMAIL_LOGIN_BREVO, // Your email
    pass: process.env.EMAIL_PASS_BREVO, // Your email password or app password
  },
});

const transporterBackup = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_BREVO, // smtp-relay.brevo.com
  port: 587, // STARTTLS
  secure: false,
  auth: {
    user: process.env.EMAIL_LOGIN_BREVO,
    pass: process.env.EMAIL_PASS_BREVO,
  },

  // ⬇️ tambahan agar tak gampang timeout
  connectionTimeout: 60000, // 60 s tunggu TCP connect
  greetingTimeout: 30000, // 30 s tunggu banner “220”
  socketTimeout: 60000, // 60 s idle tiap command
  pool: true, // pakai koneksi ulang
  maxConnections: 3,
});

const transporterGmail = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER_GMAIL,
    pass: process.env.EMAIL_PASS_GMAIL,
  },
});

// EMAIL_USER=booking@giligetaway.site
// EMAIL_PASS="Fastboat2025))"
// EMAIL_HOST=smtp.titan.email

// create new transporter with titan host
const transporterTitan = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_TITAN, // smtp.titan.email
  port: 587, // Use port 465 for SSL
  secure: false, // Use SSL
  auth: {
    user: process.env.EMAIL_USER_TITAN, // Your email
    pass: process.env.EMAIL_PASS_TITAN, // Your email password or app password
  },
  // ⬇️ tambahan agar tak gampang timeout
  connectionTimeout: 60000, // 60 s tunggu TCP connect
  greetingTimeout: 30000, // 30 s tunggu banner “220”
  socketTimeout: 60000, // 60 s idle tiap command
  pool: true, // pakai koneksi ulang
  maxConnections: 3,
});

const sendEmailApiAgentStaff = async (
  recipientEmail,
  booking,
  agentName,
  agentEmail
) => {
  const emailUrl = process.env.FRONTEND_URL;


  // // console log final state
  // console.log("final state", JSON.stringify(booking.final_state, null, 2));

  const subject = `BACKUP A new Agent booking has been made from ${agentName} in the system. Please see the details below: - Gili Getaway ${booking.contact_name} - Ticket ID: ${booking.ticket_id}`;

  const invoiceDownloadUrl = `${emailUrl}/check-invoice/${booking.ticket_id}`;
  const ticketDownloadUrl = `${emailUrl}/check-ticket-page/${booking.ticket_id}`;
  const bookingData = booking.final_state?.bookingData || {};
  const passengerData = booking.passengers || [];

  const formatIDR = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: booking.currency || "IDR",
      minimumFractionDigits: 0,
    }).format(value || 0);

  const message = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333; padding: 30px; background: #ffffff; max-width: 700px; margin: auto; line-height: 1.6;">

  <!-- HEADER -->
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #333;">AGENT BOOKING</h1>
     <p>ATT STAFF</p>
      <p>Please see booking details below to check whether you have received system confirmation. If you have not received system confirmation and only received this BACKUP NOTIFICATION, please contact the guest with their booking confirmation</p>

    <p style="margin: 10px 0 0; font-size: 16px; color: #666;">Ticket ID: ${booking.ticket_id}</p>
  </div>

  <!-- FROM & BILLED TO SECTION -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
    
    <!-- FROM SECTION -->
    <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
      <h3 style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333;">From</h3>
      <div style="line-height: 1.7;">
        <div style="font-weight: 600; margin-bottom: 5px;">Gili Getaway Fast Boat</div>
        <div style="margin-bottom: 5px;">
          <a href="mailto:bookings@giligetaway.com" style="color: #007bff; text-decoration: none;">bookings@giligetaway.com</a>
        </div>
        <div style="color: #666;">Serangan, Bali</div>
      </div>
    </div>

    <!-- BILLED TO SECTION -->
    <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
      <h3 style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333;">Billed To (Agent)</h3>
      <div style="line-height: 1.7;">
        <div style="font-weight: 600; margin-bottom: 5px;">${booking.Agent?.name || agentName || "-"}</div>
        <div style="margin-bottom: 5px;">
          ${
            booking.Agent?.email || agentEmail
              ? `<a href="mailto:${booking.Agent?.email || agentEmail}" style="color: #007bff; text-decoration: none;">${booking.Agent?.email || agentEmail}</a>`
              : "-"
          }
        </div>
        <div style="color: #666;">${booking.Agent?.phone || "-"}</div>
      </div>
    </div>
  </div>

  <!-- PAYMENT INFO GRID -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 40px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
    
    <div style="background: #f8f9fa; padding: 15px; border-right: 1px solid #e9ecef;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Payment Method</div>
      <div style="font-weight: 500;">${booking.payment_method || "N/A"}</div>
    </div>

    <div style="background: #f8f9fa; padding: 15px;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Payment Status</div>
      <div style="font-weight: 500; color: ${
        booking.payment_status === "paid"
          ? "#28a745"
          : booking.payment_method === "invoiced"
            ? "#ffc107"
            : booking.payment_method === "collect from customer"
              ? "#dc3545"
              : "#6c757d"
      };">
        ${
          booking.payment_method === "invoiced"
            ? "INVOICED"
            : booking.payment_method === "collect from customer"
              ? "UNPAID"
              : (booking.payment_status || "N/A").toUpperCase()
        }
      </div>
    </div>

    <div style="background: #f8f9fa; padding: 15px; border-right: 1px solid #e9ecef; border-top: 1px solid #e9ecef;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Invoice Date</div>
      <div style="font-weight: 500;">${moment(booking.created_at).format("MMMM D, YYYY")}</div>
    </div>

    <div style="background: #f8f9fa; padding: 15px; border-top: 1px solid #e9ecef;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Travel Date</div>
      <div style="font-weight: 500;">${moment(booking.booking_date).format("MMMM D, YYYY")}</div>
    </div>

  </div>

  <!-- CONTACT INFO -->
  <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 40px;">
    <h3 style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333;">Passenger Information</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Name</div>
        <div style="font-weight: 500;">${booking.contact_name || "N/A"}</div>
      </div>
      <div>
        <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Phone</div>
        <div style="font-weight: 500;">${booking.contact_phone || "N/A"}</div>
      </div>
       <div>
        <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Email</div>
        <div style="font-weight: 500;">${booking.contact_email || "N/A"}</div>
      </div>
      
    </div>
  </div>

 
<!-- PASSENGER DETAILS -->
  <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 40px;">
    <h3 style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333;">Passenger Details</h3>
    
    <!-- Passenger Table -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden; background: white;">
      <thead>
        <tr style="background: #f1f3f4;">
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 14px;">Name</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 14px;">Nationality</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 14px;">Passport ID</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 14px;">Type</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 14px;">Seat</th>
        </tr>
      </thead>
      <tbody>
        ${passengerData
          .map(
            (passenger, index) => `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 12px; font-weight: 500; color: #333;">${passenger.name || "-"}</td>
            <td style="padding: 12px; color: #666;">${passenger.nationality || "-"}</td>
            <td style="padding: 12px; color: #666; font-family: monospace;">${passenger.passport_id || "-"}</td>
            <td style="padding: 12px; text-align: center;">
              <span style="padding: 4px 8px; background: ${
                passenger.passenger_type === "Adult" 
                  ? "#e3f2fd" 
                  : passenger.passenger_type === "Child" 
                    ? "#fff3e0" 
                    : "#f3e5f5"
              }; color: ${
                passenger.passenger_type === "Adult" 
                  ? "#1565c0" 
                  : passenger.passenger_type === "Child" 
                    ? "#f57c00" 
                    : "#7b1fa2"
              }; border-radius: 12px; font-size: 12px; font-weight: 500;">
                ${passenger.passenger_type || "-"}
              </span>
            </td>
            <td style="padding: 12px; text-align: center; font-weight: 600; color: #007bff;">
              ${passenger.seat_number || "-"}
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <!-- BOOKING ORDER -->
  <h3 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #333;">Booking Order</h3>

  <!-- ORDER TABLE -->
  <table style="width: 100%; border-collapse: collapse; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; margin-bottom: 40px;">
    <thead>
      <tr style="background: #f8f9fa;">
        <th style="padding: 15px; text-align: left; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Details</th>
        <th style="padding: 15px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Departure Date</th>
        <th style="padding: 15px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Quantity</th>
        <th style="padding: 15px; text-align: right; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Price</th>
      </tr>
    </thead>
    <tbody>
      
      <!-- MAIN TRIP -->
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; margin-bottom: 5px;">${bookingData.from || "N/A"} → ${bookingData.to || "N/A"}</div>
          <div style="font-size: 13px; color: #666;">Travelers: ${booking.total_passengers}</div>
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">
          ${moment(booking.booking_date).format("DD MMM YYYY")}
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">1</td>
        <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
          ${formatIDR(booking.ticket_total)}
        </td>
      </tr>

      ${
        booking.transportBookings?.length
          ? booking.transportBookings
              .map(
                (transport, index) => `
          <tr>
            <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
              <div style="font-weight: 600; margin-bottom: 5px;">${transport.transport_type}</div>
              <div style="font-size: 13px; color: #666;">
                ${transport.note ? transport.note.replace(/,/g, " • ") : "No description"}
              </div>
            </td>
            <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">N/A</td>
            <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">${transport.quantity}</td>
            <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
              ${formatIDR(transport.transport_price)}
            </td>
          </tr>
        `
              )
              .join("")
          : ""
      }

      <!-- TOTALS -->
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Bank Fee</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">Rp 0</td>
      </tr>
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Discount</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">-Rp 0</td>
      </tr>
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 700; font-size: 16px; background: #f8f9fa; color: #333;">Total</td>
        <td style="padding: 15px; text-align: right; font-weight: 700; font-size: 16px; background: #f8f9fa; color: #333;">
          ${formatIDR(booking.gross_total)}
        </td>
      </tr>

    </tbody>
  </table>

  <!-- DOWNLOAD BUTTONS -->
  <div style="display: flex; gap: 15px; margin-bottom: 40px; flex-wrap: wrap;">
    <a href="${invoiceDownloadUrl}" 
       style="flex: 1; min-width: 200px; padding: 15px 20px; background: #007bff; color: white; text-decoration: none; text-align: center; font-weight: 600; border-radius: 6px;">
      Download Invoice
    </a>
    <a href="${ticketDownloadUrl}" 
       style="flex: 1; min-width: 200px; padding: 15px 20px; background: #28a745; color: white; text-decoration: none; text-align: center; font-weight: 600; border-radius: 6px;">
      Download Ticket
    </a>
  </div>

  <!-- FOOTER -->
  <div style="text-align: center; color: #666; font-size: 14px;">
    Thank you for choosing our service!
  </div>

<!-- Mobile Responsive Styles (Add this to your existing style section) -->
  <style>
    @media (max-width: 768px) {
      .grid-2 {
        grid-template-columns: 1fr !important;
        gap: 20px !important;
      }
      
      .payment-grid {
        grid-template-columns: 1fr !important;
      }
      
      table, th, td {
        font-size: 13px !important;
      }
      
      th, td {
        padding: 10px !important;
      }
      
      .buttons {
        flex-direction: column !important;
      }
      
      /* Passenger table mobile responsiveness */
      .passenger-table th:nth-child(3),
      .passenger-table td:nth-child(3) {
        display: none;
      }
      
      .passenger-table th,
      .passenger-table td {
        padding: 8px !important;
        font-size: 12px !important;
      }
    }
    
    /* Additional mobile optimization for very small screens */
    @media (max-width: 480px) {
      .passenger-table {
        font-size: 11px !important;
      }
      
      .passenger-table th:nth-child(2),
      .passenger-table td:nth-child(2) {
        display: none;
      }
      
      .passenger-table th,
      .passenger-table td {
        padding: 6px !important;
      }
    }
  </style>
</div>
`;

  const mailOptions = {
    from: process.env.EMAIL_AGENT,
    to: process.env.EMAIL_AGENT,
    // cc: process.env.EMAIL_BOOKING,
    subject,
    html: message,
  };
  const mailOptionsTitan = {
    from: process.env.EMAIL_USER_TITAN,
    to: process.env.EMAIL_AGENT,
    subject,
    html: message,
  };

  try {
    console.log("Sending email with main transporter...");
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully with main transporter.");
  } catch (error) {
    console.error(
      "Main transporter failed, falling back to Titan:",
      error.message
    );
    try {
      await transporterTitan.sendMail(mailOptionsTitan);
      console.log("Fallback email sent successfully with Titan transporter.");
    } catch (titanError) {
      console.error(
        "Both main and fallback transporters failed:",
        titanError.message
      );
      // throw telegram error
      await sendTelegramMessage(titanError);
      throw titanError; // biar error bisa ditangani di level atas
    }
  }
};

const sendEmailApiRoundTripAgentStaff = async (
  recipientEmail,
  firstBooking,
  secondBooking,
  agentName,
  agentEmail
) => {
  console.log("firstBooking", firstBooking, secondBooking);
  const emailUrl = process.env.FRONTEND_URL;
  const subject = `BACKUP ROUND TRIP TICKET – ${agentName} Gili Getaway ${firstBooking.ticket_id}`;

  const invoiceUrl = `${emailUrl}/check-invoice/${firstBooking.ticket_id}`;
  const ticketUrl = `${emailUrl}/check-ticket-page/${firstBooking.ticket_id}`;

  const bookingDataDeparture = firstBooking.final_state?.bookingData || {};
  const bookingDataReturn = secondBooking.final_state?.bookingData || {};

  const message = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">

     <p>ATT STAFF</p>
      <p>Please see booking details below to check whether you have received system confirmation. If you have not received system confirmation and only received this BACKUP NOTIFICATION, please contact the guest with their booking confirmation</p>

      <p>This is a backup email for agent ${agentName}-customer:${firstBooking.contact_name} <strong>round-trip booking</strong> with Gili Getaway.</p>

      <h3 style="color:#165297;">Departure</h3>
      <ul>
        <li><strong>Booking ID:</strong> ${firstBooking.id}</li>
        <li><strong>Ticket ID:</strong> ${firstBooking.ticket_id}</li>
        <li><strong>Route:</strong> ${bookingDataDeparture.from || "N/A"} - ${bookingDataDeparture.to || "N/A"}</li>
        <li><strong>Passengers:</strong> ${firstBooking.total_passengers} (Adults: ${firstBooking.adult_passengers}, Children: ${firstBooking.child_passengers}, Infants: ${firstBooking.infant_passengers})</li>
        <li><strong>Travel Date:</strong> ${moment(firstBooking.booking_date).format("MMM D, YYYY")}</li>
        <li><strong>Created At:</strong> ${moment(firstBooking.created_at).format("MMM D, YYYY h:mm A")}</li>
      </ul>

      <h3 style="color:#165297; margin-top: 30px;">Return</h3>
      <ul>
        <li><strong>Booking ID:</strong> ${secondBooking.id}</li>
        <li><strong>Ticket ID:</strong> ${secondBooking.ticket_id}</li>
        <li><strong>Route:</strong> ${bookingDataReturn.from || "N/A"} - ${bookingDataReturn.to || "N/A"}</li>
        <li><strong>Travel Date:</strong> ${moment(secondBooking.booking_date).format("MMM D, YYYY")}</li>
        <li><strong>Created At:</strong> ${moment(secondBooking.created_at).format("MMM D, YYYY h:mm A")}</li>
      </ul>

      <p>You can download your documents below (departure and return included):</p>

      <div style="margin: 20px 0; text-align: center;">
        <a href="${invoiceUrl}" style="display:inline-block; padding:10px 20px; background:#165297; color:white; text-decoration:none; border-radius:6px;">View/Download Invoice</a>
        <p style="font-size: 12px; color: #666;">Or copy this link: ${invoiceUrl}</p>

        <a href="${ticketUrl}" style="display:inline-block; padding:10px 20px; background:#28a745; color:white; text-decoration:none; border-radius:6px; margin-top:10px;">View/Download Ticket</a>
        <p style="font-size: 12px; color: #666;">Or copy this link: ${ticketUrl}</p>
      </div>

      <p>If you have any questions, just reply to this email or contact us at <a href="mailto:bookings@giligetaway.com">bookings@giligetaway.com</a>.</p>

      <p>Thank you,<br><strong>The Gili Getaway Team</strong></p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER_TITAN,
    to: process.env.EMAIL_AGENT,
    subject,
    html: message,
  };

  await transporterTitan.sendMail(mailOptions);
};


module.exports = {
  sendEmailApiAgentStaff,
  sendEmailApiRoundTripAgentStaff,
};
