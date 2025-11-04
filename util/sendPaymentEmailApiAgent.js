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
  // //console.log("final state", JSON.stringify(booking.final_state, null, 2));

  const subject = `API BOOKING A new Agent booking has been made from ${agentName} in the system using API. Please see the details below: - Gili Getaway ${booking.contact_name} - Ticket ID: ${booking.ticket_id}`;

  const invoiceDownloadUrl = `${emailUrl}/check-invoice/${booking.ticket_id}`;
  const ticketDownloadUrl = `${emailUrl}/check-ticket-page/${booking.ticket_id}`;
  const passengerData = booking.passengers || [];

  // Get route from schedule or subschedule
  let routeFrom = "N/A";
  let routeTo = "N/A";

  if (booking.subSchedule) {
    // For subschedule: departure from DestinationFrom, arrival at TransitTo or DestinationTo
    routeFrom = booking.subSchedule.DestinationFrom?.name || "N/A";
    routeTo = booking.subSchedule.TransitTo?.Destination?.name ||
              booking.subSchedule.DestinationTo?.name || "N/A";
  } else if (booking.schedule) {
    // For regular schedule: use FromDestination and ToDestination
    routeFrom = booking.schedule.FromDestination?.name || "N/A";
    routeTo = booking.schedule.ToDestination?.name || "N/A";
  }

  // Use commission and transport from queue data (already calculated in controller)
  const totalCommission = parseFloat(booking.totalCommission || 0);
  const transportTotal = parseFloat(booking.transportTotal || 0);
  const ticketTotal = parseFloat(booking.ticket_total || 0);
  const netAmount = parseFloat(booking.gross_total) - totalCommission;

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
    <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #333;">API AGENT BOOKING</h1>
      <p>Please see booking details below to check whether you have received system confirmation API BOOKING NOTIFICATION.</p>

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
          <div style="font-weight: 600; margin-bottom: 5px;">${routeFrom} → ${routeTo}</div>
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
                (tb, index) => `
          <tr>
            <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
              <div style="font-weight: 600; margin-bottom: 5px;">
                ${tb.transport_type ? tb.transport_type.charAt(0).toUpperCase() + tb.transport_type.slice(1) : 'Transport'}
                ${tb.transport?.description ? ` - ${tb.transport.description}` : ''}
              </div>
              ${tb.transport?.pickup_area || tb.pickup_area ? `
              <div style="font-size: 12px; color: #007bff; margin-top: 3px;">
                📍 ${tb.transport?.pickup_area || tb.pickup_area}
              </div>` : ''}
              ${tb.note ? `<div style="font-size: 13px; color: #666; margin-top: 3px;">${tb.note}</div>` : ''}
            </td>
            <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">N/A</td>
            <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">${tb.quantity}</td>
            <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
              ${formatIDR(tb.transport_price * tb.quantity)}
            </td>
          </tr>
        `
              )
              .join("")
          : ""
      }

      <!-- TOTALS -->
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Ticket Total</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">
          ${formatIDR(ticketTotal)}
        </td>
      </tr>
      ${transportTotal > 0 ? `
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Transport Total</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">
          ${formatIDR(transportTotal)}
        </td>
      </tr>
      ` : ''}
      <tr style="border-top: 2px solid #dee2e6;">
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Subtotal</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">
          ${formatIDR(booking.gross_total)}
        </td>
      </tr>
      ${totalCommission > 0 ? `
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Agent Commission</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600; color: #28a745;">
          -${formatIDR(totalCommission)}
        </td>
      </tr>
      ` : ''}
      <tr style="background: #e8f5e9;">
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 700; font-size: 16px; color: #333;">Net Amount (After Commission)</td>
        <td style="padding: 15px; text-align: right; font-weight: 700; font-size: 16px; color: #2e7d32;">
          ${formatIDR(netAmount)}
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
    to:"bajuboss21@gmail.com",
    // cc: process.env.EMAIL_BOOKING,
    subject,
    html: message,
  };
  const mailOptionsTitan = {
    from: process.env.EMAIL_USER_TITAN,
  to:process.env.EMAIL_AGENT,
    subject,
    html: message,
  };

  try {
    //console.log("Sending email with main transporter...");
    await transporter.sendMail(mailOptions);
    //console.log("Email sent successfully with main transporter.");
  } catch (error) {
    console.error(
      "Main transporter failed, falling back to Titan:",
      error.message
    );
    try {
      await transporterTitan.sendMail(mailOptionsTitan);
      //console.log("Fallback email sent successfully with Titan transporter.");
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
  agentEmail,
  passengersArray // Original passengers array with both seat numbers
) => {
  // //console.log("firstBooking", firstBooking, secondBooking);
  const emailUrl = process.env.FRONTEND_URL;
  const subject = `API BOOKING ROUND TRIP TICKET – ${agentName} Gili Getaway ${firstBooking.ticket_id}`;

  const invoiceUrl = `${emailUrl}/check-invoice/${firstBooking.ticket_id}`;
  const ticketUrl = `${emailUrl}/check-ticket-page/${firstBooking.ticket_id}`;

  // Get route from schedule for departure
  let routeFromDep = "N/A";
  let routeToDep = "N/A";
  if (firstBooking.subSchedule) {
    routeFromDep = firstBooking.subSchedule.DestinationFrom?.name || "N/A";
    routeToDep = firstBooking.subSchedule.TransitTo?.Destination?.name ||
                 firstBooking.subSchedule.DestinationTo?.name || "N/A";
  } else if (firstBooking.schedule) {
    routeFromDep = firstBooking.schedule.FromDestination?.name || "N/A";
    routeToDep = firstBooking.schedule.ToDestination?.name || "N/A";
  }

  // Get route from schedule for return
  let routeFromRet = "N/A";
  let routeToRet = "N/A";
  if (secondBooking.subSchedule) {
    routeFromRet = secondBooking.subSchedule.DestinationFrom?.name || "N/A";
    routeToRet = secondBooking.subSchedule.TransitTo?.Destination?.name ||
                 secondBooking.subSchedule.DestinationTo?.name || "N/A";
  } else if (secondBooking.schedule) {
    routeFromRet = secondBooking.schedule.FromDestination?.name || "N/A";
    routeToRet = secondBooking.schedule.ToDestination?.name || "N/A";
  }

  // Use commission from queue data (already calculated in controller)
  const totalCommissionDep = parseFloat(firstBooking.totalCommission || 0);
  const totalCommissionRet = parseFloat(secondBooking.totalCommission || 0);
  const totalCommission = totalCommissionDep + totalCommissionRet;

  // Calculate transport totals
  const transportTotalDep = firstBooking.transportBookings?.reduce((sum, t) =>
    sum + (parseFloat(t.transport_price || 0) * (t.quantity || 1)), 0) || 0;
  const transportTotalRet = secondBooking.transportBookings?.reduce((sum, t) =>
    sum + (parseFloat(t.transport_price || 0) * (t.quantity || 1)), 0) || 0;
  const totalTransport = transportTotalDep + transportTotalRet;

  const ticketTotalDep = parseFloat(firstBooking.ticket_total || 0);
  const ticketTotalRet = parseFloat(secondBooking.ticket_total || 0);
  const totalTickets = ticketTotalDep + ticketTotalRet;

  const grossTotal = parseFloat(firstBooking.gross_total) + parseFloat(secondBooking.gross_total);
  const netAmount = grossTotal - totalCommission;

  const formatIDR = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: firstBooking.currency || "IDR",
      minimumFractionDigits: 0,
    }).format(value || 0);

  // Use the original passengers array passed from controller (has both seat_number_departure and seat_number_return)
  const passengerData = passengersArray || [];

  const message = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333; padding: 30px; background: #ffffff; max-width: 700px; margin: auto; line-height: 1.6;">

  <!-- HEADER -->
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #333;">API AGENT BOOKING - ROUND TRIP</h1>
    <p style="margin: 10px 0 0; font-size: 16px; color: #666;">Departure Ticket ID: ${firstBooking.ticket_id}</p>
    <p style="margin: 5px 0 0; font-size: 16px; color: #666;">Return Ticket ID: ${secondBooking.ticket_id}</p>
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
        <div style="font-weight: 600; margin-bottom: 5px;">${firstBooking.Agent?.name || agentName || "-"}</div>
        <div style="margin-bottom: 5px;">
          ${firstBooking.Agent?.email || agentEmail ? `<a href="mailto:${firstBooking.Agent?.email || agentEmail}" style="color: #007bff; text-decoration: none;">${firstBooking.Agent?.email || agentEmail}</a>` : "-"}
        </div>
        <div style="color: #666;">${firstBooking.Agent?.phone || "-"}</div>
      </div>
    </div>
  </div>

  <!-- PAYMENT INFO GRID -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 40px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">

    <div style="background: #f8f9fa; padding: 15px; border-right: 1px solid #e9ecef;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Payment Method</div>
      <div style="font-weight: 500;">${firstBooking.payment_method || "N/A"}</div>
    </div>

    <div style="background: #f8f9fa; padding: 15px;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Payment Status</div>
      <div style="font-weight: 500; color: ${firstBooking.payment_status === "paid" ? "#28a745" : firstBooking.payment_method === "invoiced" ? "#ffc107" : "#6c757d"};">
        ${firstBooking.payment_method === "invoiced" ? "INVOICED" : (firstBooking.payment_status || "N/A").toUpperCase()}
      </div>
    </div>

    <div style="background: #f8f9fa; padding: 15px; border-right: 1px solid #e9ecef; border-top: 1px solid #e9ecef;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Invoice Date</div>
      <div style="font-weight: 500;">${moment(firstBooking.created_at).format("MMMM D, YYYY")}</div>
    </div>

    <div style="background: #f8f9fa; padding: 15px; border-top: 1px solid #e9ecef;">
      <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Total Passengers</div>
      <div style="font-weight: 500;">${firstBooking.total_passengers} travelers</div>
    </div>

  </div>

  <!-- CONTACT INFO -->
  <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 40px;">
    <h3 style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333;">Contact Information</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Name</div>
        <div style="font-weight: 500;">${firstBooking.contact_name || "N/A"}</div>
      </div>
      <div>
        <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Phone</div>
        <div style="font-weight: 500;">${firstBooking.contact_phone || "N/A"}</div>
      </div>
      <div>
        <div style="color: #666; font-size: 13px; margin-bottom: 5px;">Email</div>
        <div style="font-weight: 500;">${firstBooking.contact_email || "N/A"}</div>
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
          <th style="padding: 12px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 13px;">Seat (Dep)</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef; font-size: 13px;">Seat (Ret)</th>
        </tr>
      </thead>
      <tbody>
        ${passengerData
          .map(
            (passenger) => `
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
            <td style="padding: 12px; text-align: center; font-weight: 600; color: #856404;">
              ${passenger.seat_number_departure || "-"}
            </td>
            <td style="padding: 12px; text-align: center; font-weight: 600; color: #004085;">
              ${passenger.seat_number_return || "-"}
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
        <th style="padding: 15px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Travel Date</th>
        <th style="padding: 15px; text-align: center; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Quantity</th>
        <th style="padding: 15px; text-align: right; font-weight: 600; color: #333; border-bottom: 1px solid #e9ecef;">Price</th>
      </tr>
    </thead>
    <tbody>

      <!-- DEPARTURE TRIP -->
      <tr style="background: #fff9e6;">
        <td colspan="4" style="padding: 10px 15px; font-weight: 600; color: #856404; border-bottom: 1px solid #e9ecef;">
          ✈️ DEPARTURE JOURNEY
        </td>
      </tr>
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; margin-bottom: 5px;">${routeFromDep} → ${routeToDep}</div>
          <div style="font-size: 13px; color: #666;">Travelers: ${firstBooking.total_passengers}</div>
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">
          ${moment(firstBooking.booking_date).format("DD MMM YYYY")}
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">1</td>
        <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
          ${formatIDR(ticketTotalDep)}
        </td>
      </tr>

      ${firstBooking.transportBookings?.length ? firstBooking.transportBookings.map(tb => {
        const transportType = tb.transport_type ? tb.transport_type.charAt(0).toUpperCase() + tb.transport_type.slice(1) : 'Transport';
        const transportDesc = tb.transport?.description || '';
        const pickupArea = tb.transport?.pickup_area || tb.pickup_area || '';
        return `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; margin-bottom: 5px;">${transportType}${transportDesc ? ` - ${transportDesc}` : ''}</div>
          ${pickupArea ? `<div style="font-size: 12px; color: #007bff; margin-top: 3px;">📍 ${pickupArea}</div>` : ''}
          ${tb.note ? `<div style="font-size: 13px; color: #666; margin-top: 3px;">${tb.note}</div>` : ''}
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">N/A</td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">${tb.quantity}</td>
        <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
          ${formatIDR(tb.transport_price * tb.quantity)}
        </td>
      </tr>
        `;
      }).join('') : ''}

      <!-- RETURN TRIP -->
      <tr style="background: #e7f3ff;">
        <td colspan="4" style="padding: 10px 15px; font-weight: 600; color: #004085; border-bottom: 1px solid #e9ecef;">
          🔄 RETURN JOURNEY
        </td>
      </tr>
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; margin-bottom: 5px;">${routeFromRet} → ${routeToRet}</div>
          <div style="font-size: 13px; color: #666;">Travelers: ${secondBooking.total_passengers}</div>
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">
          ${moment(secondBooking.booking_date).format("DD MMM YYYY")}
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">1</td>
        <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
          ${formatIDR(ticketTotalRet)}
        </td>
      </tr>

      ${secondBooking.transportBookings?.length ? secondBooking.transportBookings.map(tb => {
        const transportType = tb.transport_type ? tb.transport_type.charAt(0).toUpperCase() + tb.transport_type.slice(1) : 'Transport';
        const transportDesc = tb.transport?.description || '';
        const pickupArea = tb.transport?.pickup_area || tb.pickup_area || '';
        return `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <div style="font-weight: 600; margin-bottom: 5px;">${transportType}${transportDesc ? ` - ${transportDesc}` : ''}</div>
          ${pickupArea ? `<div style="font-size: 12px; color: #007bff; margin-top: 3px;">📍 ${pickupArea}</div>` : ''}
          ${tb.note ? `<div style="font-size: 13px; color: #666; margin-top: 3px;">${tb.note}</div>` : ''}
        </td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">N/A</td>
        <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e9ecef;">${tb.quantity}</td>
        <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e9ecef; font-weight: 600;">
          ${formatIDR(tb.transport_price * tb.quantity)}
        </td>
      </tr>
        `;
      }).join('') : ''}

      <!-- TOTALS -->
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Total Tickets (Departure + Return)</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">
          ${formatIDR(totalTickets)}
        </td>
      </tr>
      ${totalTransport > 0 ? `
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Total Transport</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">
          ${formatIDR(totalTransport)}
        </td>
      </tr>
      ` : ''}
      <tr style="border-top: 2px solid #dee2e6;">
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Subtotal</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600;">
          ${formatIDR(grossTotal)}
        </td>
      </tr>
      ${totalCommission > 0 ? `
      <tr>
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; background: #f8f9fa;">Agent Commission</td>
        <td style="padding: 15px; text-align: right; background: #f8f9fa; font-weight: 600; color: #28a745;">
          -${formatIDR(totalCommission)}
        </td>
      </tr>
      ` : ''}
      <tr style="background: #e8f5e9;">
        <td colspan="3" style="padding: 15px; text-align: right; font-weight: 700; font-size: 16px; color: #333;">Net Amount (After Commission)</td>
        <td style="padding: 15px; text-align: right; font-weight: 700; font-size: 16px; color: #2e7d32;">
          ${formatIDR(netAmount)}
        </td>
      </tr>

    </tbody>
  </table>

  <!-- DOWNLOAD BUTTONS -->
  <div style="display: flex; gap: 15px; margin-bottom: 40px; flex-wrap: wrap;">
    <a href="${invoiceUrl}"
       style="flex: 1; min-width: 200px; padding: 15px 20px; background: #007bff; color: white; text-decoration: none; text-align: center; font-weight: 600; border-radius: 6px;">
      Download Invoice
    </a>
    <a href="${ticketUrl}"
       style="flex: 1; min-width: 200px; padding: 15px 20px; background: #28a745; color: white; text-decoration: none; text-align: center; font-weight: 600; border-radius: 6px;">
      Download Ticket
    </a>
  </div>

  <!-- FOOTER -->
  <div style="text-align: center; color: #666; font-size: 14px;">
    <p>If you have any questions, contact us at <a href="mailto:bookings@giligetaway.com" style="color: #007bff;">bookings@giligetaway.com</a></p>
    <p>Thank you for choosing Gili Getaway!</p>
  </div>

</div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER_TITAN,
    to: "bajuboss21@gmail.com",
    subject,
    html: message,
  };

  await transporterTitan.sendMail(mailOptions);
};


module.exports = {
  sendEmailApiAgentStaff,
  sendEmailApiRoundTripAgentStaff,
};
