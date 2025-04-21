const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_BREVO, // SMTP Server (e.g., smtp.gmail.com)
  port: 587, // Use port 465 for SSL
  secure: false, // Use SSL
  auth: {
    user: process.env.EMAIL_LOGIN_BREVO, // Your email
    pass: process.env.EMAIL_PASS_BREVO, // Your email password or app password
  },
});;


const sendExpiredBookingEmail = async (recipientEmail, booking) => {
  console.log("Starting to send expired booking email to:", recipientEmail);
  const emailUrl = process.env.FRONTEND_URL;
  // const emailUrl = "https://localhost:3000";


  

  try {
    const subject = " Almost There! Let’s Get You to the Gili Islands ";

    const message = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Complete Your Booking</title>
      <meta name="description" content="Your fast boat seats are still waiting – complete your booking now." />
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; color: #333;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FFFFFFFF, #134782); padding: 30px 20px; text-align: center;">
          <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/Logo-02.jpg?updatedAt=1745113322565" alt="Gili Getaway" style="max-width: 180px; margin-bottom: 10px;" />
          <h1 style="color: white; margin: 10px 0 5px; font-size: 24px;">Your fast boat seats are still waiting – complete your booking now.</h1>
        </div>
    
        <!-- Body -->
        <div style="padding: 30px 20px;">
          <p style="font-size: 16px; line-height: 1.5;">Hi ${booking.contact_name},</p>
    
          <p style="font-size: 16px; line-height: 1.5;">
            We noticed you were about to book your fast boat trip with Gili Getaway, but didn’t make it quite to the finish line. No worries – your seats are still waiting for you for now. However, are not confirmed until you finalize your booking and may be booked very soon!
          </p>
    
          <p style="font-size: 16px; line-height: 1.5;">
            Whether you're headed to <strong>Gili Trawangan</strong>, <strong>Gili Air</strong>, or <strong>Gili Gede</strong>, we’d love to get you there safely and in comfort aboard our premium fast boats.
          </p>
    
          <!-- Call to Action Buttons -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${emailUrl}/follow-up-payment/${booking.ticket_id}" style="background-color: #165297; color: white; padding: 14px 26px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 15px; font-size: 16px;">Complete Your Booking Now</a>
            <br/>
            <a href="${emailUrl}/" style="display: inline-block; padding: 12px 20px; margin-top: 10px; background-color: #FFBF00; color: #134782; text-decoration: none; border-radius: 6px; font-weight: bold; min-width: 160px; text-align: center; font-size: 16px;">Make a New Booking</a>
          </div>
    
          <p style="font-size: 16px; line-height: 1.5;">
            If you had any issues during checkout or have questions about the trip, our team is here to help. Just reply to this email or reach out anytime at <a href="mailto:bookings@giligetaway.co">bookings@giligetaway.com</a>.
          </p>
    
          <p style="font-size: 16px; line-height: 1.5;">Don’t miss the boat – paradise is just a click away. 🌊</p>
    
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 5px;">Warm regards,</p>
          <p style="font-size: 16px; font-weight: bold; margin-top: 0;">The Gili Getaway Team</p>
          <p style="font-size: 15px; color: #165297; margin-top: 5px; font-style: italic;">Fast. Safe. Reliable. Island Hopping Made Easy.</p>
        </div>
    
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 25px 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; text-align: center;">
          <p style="margin: 6px 0;">📞 +62 812-3456-7890 | ✉️ bookings@giligetaway.com</p>
          <p style="margin: 6px 0;"><a href="${emailUrl}/follow-up-payment/${booking.ticket_id}" style="color: #2991D6; text-decoration: underline; font-weight: bold;">Complete Your Booking Now</a></p>
          <p style="margin: 6px 0;">© ${new Date().getFullYear()} Gili Getaway. All rights reserved.</p>
          <p style="margin: 6px 0; font-size: 12px;">This is an automated message. Please don't reply directly to this email.</p>
          
       
        </div>
      </div>
    </body>
    </html>
    `;
    

    const mailOptions = {
      from: process.env.EMAIL_BOOKING,
      to: recipientEmail,
      subject: subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Expired booking email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send expired booking email:", error);
    return false;
  }
};




const sendPaymentSuccessEmail = async (recipientEmail, booking,pairBooking) => {
  console.log("📤 Sending PAYMENT SUCCESS email to:", recipientEmail);
  const emailUrl = process.env.FRONTEND_URL;
  const year = new Date().getFullYear();

  const ticketDownloadUrl = `${emailUrl}/check-ticket-page/${booking.ticket_id}`;
  const invoiceDownloadUrl = `${emailUrl}/check-invoice/${booking.ticket_id}`;

  try {
    const subject = "🎉 Booking Confirmed! You're All Set for Gili ";
   
    const message = `
     <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation & Ticket</title>
      <meta name="x-apple-disable-message-reformatting">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <!-- Preview text -->
      <meta name="description" content="Your Gili Getaway booking confirmation for ${booking.ticket_id} - Thank you for booking with us!">
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #333;
          line-height: 1.5;
          margin: 0;
          padding: 0;
        }
        .download-button {
          display: inline-block;
          background-color: #165297;
          color: white !important;
          text-align: center;
          padding: 10px 15px;
          margin: 10px 10px 20px 0;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #165297;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 20px;
          background-color: #ffffff;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 15px;
          text-align: center;
          font-size: 14px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
        }
        .info-box {
          background-color: #f0f7ff;
          border-left: 4px solid #165297;
          padding: 15px;
          margin: 20px 0;
        }
        h1, h2, h3 {
          color: #165297;
        }
      </style>
    </head>
    <body>
      <!-- Pre-header for email clients -->
      <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        Your Gili Getaway booking confirmation for ${booking.ticket_id} - Thank you for booking with us!
      </div>
    
      <div class="container">
        <div class="header">
          <!-- Perbaikan pada tag gambar -->
          <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/giligetawayinverted.png" 
               alt="Gili Getaway Fast Boat Service" 
               style="max-width: 180px; display: inline-block;" 
               width="180" height="60">
          <h1 style="color: white; margin: 10px 0;">Booking Confirmation & Ticket</h1>
        </div>
            
        <div class="content">
          <p>Hi ${booking.contact_name},</p>
              
          <p>Your booking has been successfully arranged – we're looking forward to welcoming you aboard.</p>
              
          <p>Attached you'll find your travel confirmation with all the key details. Here's a quick summary for your convenience:</p>
              
          <div class="info-box">
            <h3 style="margin-top: 0;">Before You Go:</h3>
            <ul style="padding-left: 20px; margin: 10px 0;">
              <li>Please check in at least 30 minutes before departure.</li>
              <li>Show this email or the attached document at the counter.</li>
              <li>Each guest is allowed up to 25kg of luggage.</li>
            </ul>
          </div>
              
          <!-- Download Links -->
          <div style="margin: 25px 0; text-align: center;">
              <a href="${invoiceDownloadUrl}" class="download-button">View/Download Invoice</a>
               <p style="font-size: 12px; color: #666;">Or copy this link: ${invoiceDownloadUrl}</p>
          
            <a href="${ticketDownloadUrl}" class="download-button">View/Download Ticket</a>
            <p style="font-size: 12px; color: #666;">Or copy this link: ${ticketDownloadUrl}</p>
            
          </div>
              
          <hr style="margin: 20px 0;">
        
              
          <p>Need to make a change? Please email us at <a href="mailto:officebali1@gmail.com" style="color: #165297;">officebali1@gmail.com</a></p>
              
          <p>Thanks for choosing Gili Getaway – we'll see you by the water!</p>
              
          <p>Warmly,<br>
          The Gili Getaway Team<br>
          <span style="color: #165297; font-style: italic;">Making island travel simple and reliable.</span></p>
        </div>
            
        <div class="footer">
          <p>Gili Getaway | Jl. Pantai Serangan, Serangan, Denpasar Selatan, Bali 80229, Indonesia</p>
          <p>Contact: +6281337074147| officebali1@gmail.com</p>
          <p><a href="https://www.giligetaway.com" style="color: #2991D6;">www.giligetaway.com</a></p>
          <p>© ${year} Gili Getaway. All rights reserved.</p>
          <p>This is a transactional email regarding your booking with Gili Getaway.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER_GMAIL,
        pass: process.env.EMAIL_PASS_GMAIL,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER_GMAIL,
      to: recipientEmail,
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment success email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send payment success email:", error);
    return false;
  }
};

const sendTicketEmail = async (recipientEmail, booking) => {
  console.log("Starting to send ticket email to:", recipientEmail);

  try {
    // Parse data dari final_state
    const finalState = JSON.parse(booking.final_state);
    
    // Format fungsi helper
    const formatTime = (time) => time?.split(':').slice(0, 2).join(':');
    
    const formatDurationToHour = (duration) => {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      return `${formattedHours}:${formattedMinutes}`;
    };
    
    // Ekstrak data dari finalState
    const {
      bookingData,
      transportStatus,
      orderDetails,
      order_Id,
      order_return_Id,
      pickupTime,
      tripType,
      checkinTimedeparture,
      checkinTimereturn,
      passengersAdult = [],
      passengersChild = [],
      passengerunderthree = []
    } = finalState;
    
    // Kalkulasi durasi
    const { duration } = transportStatus.pickupDetails;
    const { duration: durationReturn } = transportStatus.dropOffDetails;
    const formattedDuration = formatDurationToHour(duration);
    const formattedDurationReturn = formatDurationToHour(durationReturn);
    
    // Gabungkan semua penumpang
    const allPassengers = [
      ...passengersAdult.map((p, i) => ({ ...p, type: 'Adult', index: i })),
      ...passengersChild.map((p, i) => ({
        ...p,
        type: 'Child',
        index: i + passengersAdult.length
      })),
      ...passengerunderthree.map((p, i) => ({
        ...p,
        type: 'Under 3',
        index: i + passengersAdult.length + passengersChild.length
      }))
    ].filter(p => p.name !== '');
    
    // Buat rows untuk tabel penumpang
    let passengerRows = '';
    allPassengers.forEach((passenger, index) => {
      passengerRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee">${passenger.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee">${passenger.nationality}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee">${passenger.type}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee">${passenger.seat_number_departure || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee">${passenger.seat_number_return || '-'}</td>
        </tr>
      `;
    });
    
    // Buat rows untuk journey steps departure
    let journeyStepsDepartureHtml = '';
    if (bookingData.journeyStepsDeparture && bookingData.journeyStepsDeparture.length > 0) {
      bookingData.journeyStepsDeparture.forEach((step, index) => {
        journeyStepsDepartureHtml += `
          <div style="margin-top: 15px; padding: 15px; background-color: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1)">
            <table style="width: 100%; border-collapse: collapse">
              <tr>
                <td style="width: 40%; text-align: center; padding: 10px">
                  <div style="font-weight: bold">${step.departure}</div>
                  <div style="color: #2563eb">${formatTime(step.departuretime)}</div>
                </td>
                <td style="width: 20%; text-align: center; color: #2563eb; font-size: 24px">→</td>
                <td style="width: 40%; text-align: center; padding: 10px">
                  <div style="font-weight: bold">${step.arrived}</div>
                  <div style="color: #2563eb">${formatTime(step.timearrived)}</div>
                </td>
              </tr>
            </table>
          </div>
        `;
      });
    }
    
    // Buat rows untuk journey steps return
    let journeyStepsReturnHtml = '';
    if (bookingData.journeyStepsReturn && bookingData.journeyStepsReturn.length > 0) {
      bookingData.journeyStepsReturn.forEach((step, index) => {
        journeyStepsReturnHtml += `
          <div style="margin-top: 15px; padding: 15px; background-color: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1)">
            <table style="width: 100%; border-collapse: collapse">
              <tr>
                <td style="width: 40%; text-align: center; padding: 10px">
                  <div style="font-weight: bold">${step.departure}</div>
                  <div style="color: #2563eb">${formatTime(step.departuretime)}</div>
                </td>
                <td style="width: 20%; text-align: center; color: #2563eb; font-size: 24px">→</td>
                <td style="width: 40%; text-align: center; padding: 10px">
                  <div style="font-weight: bold">${step.arrived}</div>
                  <div style="color: #2563eb">${formatTime(step.timearrived)}</div>
                </td>
              </tr>
            </table>
          </div>
        `;
      });
    }
    
    // Buat html untuk transport details
    let transportDetailsHtml = '';
    const showTransportDetails = !(
      transportStatus.pickupDetails.description === 'Own Transport' &&
      transportStatus.dropOffDetails.description === 'Own Transport'
    );
    
    if (showTransportDetails) {
      transportDetailsHtml = `
        <div style="padding: 0 20px 30px">
          <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
            Transport Details
          </div>
          
          ${transportStatus.pickupDetails.description && transportStatus.pickupDetails.description !== 'Own Transport' ? `
            <div style="color: #2563eb; font-weight: bold; margin-bottom: 15px">
              PICK UP TIME: ${formatTime(pickupTime)}
            </div>
          ` : ''}
          
          <table style="width: 100%; border-collapse: collapse">
            <thead>
              <tr>
                <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Type</th>
                <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Area</th>
                <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Journey Time</th>
                <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Note</th>
              </tr>
            </thead>
            <tbody>
              ${transportStatus && 
                transportStatus.pickupDetails && 
                transportStatus.pickupDetails.transport_type && 
                transportStatus.pickupDetails.description && 
                transportStatus.pickupDetails.description !== '' && 
                transportStatus.pickupDetails.description !== 'Own Transport' ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">Pickup: ${transportStatus.pickupDetails.transport_type}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">${transportStatus.pickupDetails.area}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">${formattedDuration} hours</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">${transportStatus.pickupDetails.note}</td>
                </tr>
              ` : ''}
              
              ${transportStatus && 
                transportStatus.dropOffDetails && 
                transportStatus.dropOffDetails.transport_type && 
                transportStatus.dropOffDetails.description && 
                transportStatus.dropOffDetails.description !== '' && 
                transportStatus.dropOffDetails.description !== 'Own Transport' ? `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">Drop-off: ${transportStatus.dropOffDetails.transport_type}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">${transportStatus.dropOffDetails.area}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">${formattedDurationReturn} hours</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee">${transportStatus.dropOffDetails.note}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      `;
    }
    
    // Buat location maps html
    let locationMapsHtml = '';
    if (bookingData.mapUrlDeparture || bookingData.mapUrlReturn) {
      let departureMapHtml = '';
      let returnMapHtml = '';
      
      if (bookingData.mapUrlDeparture) {
        const [mapLink, imageLink] = bookingData.mapUrlDeparture.split("###");
        departureMapHtml = `
          <div style="margin-bottom: 20px">
            <div style="font-weight: bold; margin-bottom: 10px">Departure Location: ${bookingData.from}</div>
            <a href="${mapLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; display: block; margin-bottom: 10px">Open Map</a>
            <img src="${imageLink}" alt="Departure Location Map" style="width: 100%; height: auto; border-radius: 4px">
          </div>
        `;
      }
      
      if (bookingData.mapUrlReturn) {
        const [mapLink, imageLink] = bookingData.mapUrlReturn.split("###");
        returnMapHtml = `
          <div style="margin-top: 20px">
            <div style="font-weight: bold; margin-bottom: 10px">Return Location: ${bookingData.to}</div>
            <a href="${mapLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; display: block; margin-bottom: 10px">Open Map</a>
            <img src="${imageLink}" alt="Return Location Map" style="width: 100%; height: auto; border-radius: 4px">
          </div>
        `;
      }
      
      locationMapsHtml = `
        <div style="padding: 0 20px 30px">
          <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
            Location Maps
          </div>
          ${departureMapHtml}
          ${returnMapHtml}
        </div>
      `;
    }
    
    // Generate HTML template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Gili Getaway E-Ticket</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5">
          <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden">
            <!-- Header -->
            <div style="background-color: #0f172a; padding: 20px">
              <table style="width: 100%; border-collapse: collapse">
                <tr>
                  <td style="width: 33%; vertical-align: top">
                    <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/Logo-02.jpg?updatedAt=1739515682609" width="100" alt="Gili Getaway Logo" style="display: block; margin-bottom: 10px">
                    <div style="color: white; font-size: 14px; line-height: 1.5">
                      <div>giligetaway@gmail.com</div>
                      <div>+62 812-3456-7890</div>
                    </div>
                  </td>
                  <td style="width: 33%; text-align: center">
                    <div style="padding: 15px; border-radius: 4px">
                      <div style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 5px">
                        #${order_Id}
                      </div>
                      ${order_return_Id ? `
                        <div style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 5px">
                          #${order_return_Id}
                        </div>
                      ` : ''}
                      <div style="color: white">${tripType}</div>
                    </div>
                  </td>
                  <td style="width: 33%; text-align: right">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(JSON.stringify({ order_Id }))}" width="100" height="100" alt="QR Code" style="display: block; margin-left: auto; background-color: white; padding: 4px; border-radius: 4px">
                    <div style="color: white; font-size: 12px; margin-top: 5px; text-align: right">
                      Scan for verification
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Order Details -->
            <div style="padding: 30px 20px">
              <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
                Order Details
              </div>
              <table style="width: 100%; border-collapse: collapse">
                <tr>
                  <th style="padding: 12px; background-color: #f8f9fa; text-align: left; width: 20%">Name</th>
                  <td style="padding: 12px">${orderDetails.name}</td>
                </tr>
                <tr>
                  <th style="padding: 12px; background-color: #f8f9fa; text-align: left">Email</th>
                  <td style="padding: 12px">${orderDetails.email}</td>
                </tr>
                <tr>
                  <th style="padding: 12px; background-color: #f8f9fa; text-align: left">Phone</th>
                  <td style="padding: 12px">${orderDetails.phone}</td>
                </tr>
                <tr>
                  <th style="padding: 12px; background-color: #f8f9fa; text-align: left">Passport ID</th>
                  <td style="padding: 12px">${orderDetails.passportId}</td>
                </tr>
                <tr>
                  <th style="padding: 12px; background-color: #f8f9fa; text-align: left">Nationality</th>
                  <td style="padding: 12px">${orderDetails.nationality}</td>
                </tr>
              </table>
            </div>

            <!-- Departure Details -->
            <div style="padding: 0 20px 30px">
              <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
                Departure
              </div>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px">
                <div style="font-size: 18px; margin-bottom: 15px">
                  ${bookingData.from} / ${bookingData.to}
                  ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(bookingData.departureDate))} (${bookingData.boatName})
                </div>
                <div style="color: #2563eb; font-weight: bold; margin-bottom: 15px">
                  CHECK IN TIME: ${formatTime(checkinTimedeparture)}
                </div>
                <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 4px">
                  Note: Please arrive at least 45 minutes before departure time.
                </div>
              </div>
              
              ${journeyStepsDepartureHtml}
            </div>

            <!-- Return Details -->
            <div style="padding: 0 20px 30px">
              <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
                Return
              </div>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px">
                <div style="font-size: 18px; margin-bottom: 15px">
                  ${bookingData.to} / ${bookingData.from}
                  ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(bookingData.returnDate))} (${bookingData.boatNameReturn})
                </div>
                <div style="color: #2563eb; font-weight: bold; margin-bottom: 15px">
                  CHECK IN TIME: ${formatTime(checkinTimereturn)}
                </div>
                <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 4px">
                  Note: Please arrive at least 45 minutes before departure time.
                </div>
              </div>
              
              ${journeyStepsReturnHtml}
            </div>

            <!-- Passenger Details -->
            <div style="padding: 0 20px 30px">
              <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
                Passenger Details
              </div>
              <table style="width: 100%; border-collapse: collapse">
                <thead>
                  <tr>
                    <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">No.</th>
                    <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Passenger(s)</th>
                    <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Nationality</th>
                    <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Type</th>
                    <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Seat Number Departure</th>
                    <th style="padding: 12px; background-color: #f8f9fa; text-align: left; border-bottom: 1px solid #eee">Seat Number Return</th>
                  </tr>
                </thead>
                <tbody>
                  ${passengerRows}
                </tbody>
              </table>
            </div>

            <!-- Transport Details -->
            ${transportDetailsHtml}

            <!-- Route Images -->
            <div style="padding: 0 20px 30px">
              <table style="width: 100%; border-collapse: collapse">
                <tr>
                  <td style="width: 50%; padding-right: 10px">
                    <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px">
                      Route Image Departure
                    </div>
                    <img src="${bookingData.imageUrl}" alt="Route Map Departure" style="width: 100%; height: auto; border-radius: 4px">
                  </td>
                  <td style="width: 50%; padding-left: 10px">
                    <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px">
                      Route Image Return
                    </div>
                    <img src="${bookingData.imageUrlReturn}" alt="Route Map Return" style="width: 100%; height: auto; border-radius: 4px">
                  </td>
                </tr>
              </table>
            </div>

            <!-- Location Maps -->
            ${locationMapsHtml}

            <!-- Terms and Conditions -->
            <div style="padding: 0 20px 30px">
              <div style="font-size: 20px; font-weight: bold; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px">
                Terms and Conditions
              </div>

              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Gili Getaway endeavor to transport all customers to their destinations at these times. All travel itineraries are subject to weather conditions. Gili Getaway reserves the right to change and/or cancel schedules in the interest of passenger's safety and well being.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Cancellations and delays The company reserves the right to vary the service in any way whatsoever without liability to the passenger. The company shall not be liable for any loss, damage or injury which may arise in the event of cancellation or delay in service.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                The company shall not be liable in any way for the cost of any accommodation or any alternative travel which may arise through cancellation or delays. Any additional expenses so arising shall be the sole liability and responsibility of the passenger.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Refunds by the company In the event of a trip cancellation by the company, the company shall refund any amounts paid by the passenger direct to the company, or any funds already paid by the agent to the company on the passenger's behalf.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Cancellation & No-Show or Late-Arrival Fee: The full ticket price will be charged for any cancellation less than 24 hours prior guest. From 2 to 7 days, a 50% refund. Longer than 7 Days, no charge.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Re-Scheduling Trip: Re-scheduling is based on seat availability and if made prior to 48 hours before guest departure for regular season, and 96 hours prior to guest departure for high season there is no charge, (1 Jul – 30 Sept). Otherwise a Rp100,000 fee per ticket will be charged.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Baggage Allowance: Each passenger is entitled to a maximum of 2 pieces of luggage carried free of charge, not exceeding a total weight of 25 kg.
              </div>
              <div style="margin-bottom: 15px; line-height: 1.6; color: #333">
                Road Transportation in Bali/Gilis & Lombok: Road transportation to/from Serangan harbor is provided free of charge to/from ONE SPECIFIC ADDRESS in designated areas of Bali.
              </div>

              <div style="font-style: italic; margin-top: 20px; line-height: 1.6; color: #666; background-color: #f8f9fa; padding: 15px; border-radius: 4px">
                Due to the increasingly serious worldwide problem of plastic pollution and other rubbish in our oceans,
                Gili Getaway is committed to reducing plastic usage and will no longer offer bottled water onboard.
                However, please feel free to bring your own bottles which can be refilled free of charge in our offices.
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    // Konfigurasi email
    const mailOptions = {
      from: process.env.EMAIL_BOOKING,
      to: recipientEmail,
      subject: `Your E-Ticket for Gili Getaway - Order #${order_Id}`,
      html: htmlTemplate,
    };
    
    // Kirim email
    await transporter.sendMail(mailOptions);
    console.log(`📧 E-ticket email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send e-ticket email:", error);
    console.error("Error details:", error.message);
    return false;
  }
};

const sendPaymentSuccessEmailRoundTrip = async (recipientEmail, booking,pairBooking) => {
  console.log("📤 Sending PAYMENT SUCCESS email to:", recipientEmail);
  const emailUrl = process.env.FRONTEND_URL;
  const year = new Date().getFullYear();

  const ticketDownloadUrl = `${emailUrl}/check-ticket-page/${booking.ticket_id}`;
  const invoiceDownloadUrl = `${emailUrl}/check-invoice/${booking.ticket_id}`;

  try {
    const subject = "🎉 Booking Confirmed! You're All Set for Gili ";
   
    const message = `
     <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation & Ticket</title>
      <meta name="x-apple-disable-message-reformatting">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <!-- Preview text -->
      <meta name="description" content="Your Gili Getaway booking confirmation for ${booking.ticket_id} and ${pairBooking.ticket_id} - Thank you for booking with us!">
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #333;
          line-height: 1.5;
          margin: 0;
          padding: 0;
        }
        .download-button {
          display: inline-block;
          background-color: #165297;
          color: white !important;
          text-align: center;
          padding: 10px 15px;
          margin: 10px 10px 20px 0;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #165297;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 20px;
          background-color: #ffffff;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 15px;
          text-align: center;
          font-size: 14px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
        }
        .info-box {
          background-color: #f0f7ff;
          border-left: 4px solid #165297;
          padding: 15px;
          margin: 20px 0;
        }
        h1, h2, h3 {
          color: #165297;
        }
      </style>
    </head>
    <body>
      <!-- Pre-header for email clients -->
      <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        Your Gili Getaway booking confirmation for ${booking.ticket_id}-${pairBooking.ticket_id} - Thank you for booking with us!
      </div>
    
      <div class="container">
        <div class="header">
          <!-- Perbaikan pada tag gambar -->
          <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/giligetawayinverted.png" 
               alt="Gili Getaway Fast Boat Service" 
               style="max-width: 180px; display: inline-block;" 
               width="180" height="60">
          <h1 style="color: white; margin: 10px 0;">Booking Confirmation & Ticket</h1>
        </div>
            
        <div class="content">
          <p>Hi ${booking.contact_name},</p>
              
          <p>Your booking has been successfully arranged – we're looking forward to welcoming you aboard.</p>
              
          <p>Attached you'll find your travel confirmation with all the key details. Here's a quick summary for your convenience:</p>
              
          <div class="info-box">
            <h3 style="margin-top: 0;">Before You Go:</h3>
            <ul style="padding-left: 20px; margin: 10px 0;">
              <li>Please check in at least 30 minutes before departure.</li>
              <li>Show this email or the attached document at the counter.</li>
              <li>Each guest is allowed up to 25kg of luggage.</li>
            </ul>
          </div>
              
          <!-- Download Links -->
          <div style="margin: 25px 0; text-align: center;">
              <a href="${invoiceDownloadUrl}" class="download-button">View/Download Invoice</a>
               <p style="font-size: 12px; color: #666;">Or copy this link: ${invoiceDownloadUrl}</p>
          
            <a href="${ticketDownloadUrl}" class="download-button">View/Download Ticket</a>
            <p style="font-size: 12px; color: #666;">Or copy this link: ${ticketDownloadUrl}</p>
            
          </div>
              
          <hr style="margin: 20px 0;">
        
              
          <p>Need to make a change? Please email us at <a href="mailto:officebali1@gmail.com" style="color: #165297;">officebali1@gmail.com</a></p>
              
          <p>Thanks for choosing Gili Getaway – we'll see you by the water!</p>
              
          <p>Warmly,<br>
          The Gili Getaway Team<br>
          <span style="color: #165297; font-style: italic;">Making island travel simple and reliable.</span></p>
        </div>
            
        <div class="footer">
          <p>Gili Getaway | Jl. Pantai Serangan, Serangan, Denpasar Selatan, Bali 80229, Indonesia</p>
          <p>Contact: +6281337074147| officebali1@gmail.com</p>
          <p><a href="https://www.giligetaway.com" style="color: #2991D6;">www.giligetaway.com</a></p>
          <p>© ${year} Gili Getaway. All rights reserved.</p>
          <p>This is a transactional email regarding your booking with Gili Getaway.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_HOST_BREVO,
      auth: {
        user: process.env.EMAIL_LOGIN_BREVO,
        pass: process.env.EMAIL_PASS_BREVO,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_BOOKING,
      to: recipientEmail,
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment success email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send payment success email:", error);
    return false;
  }
};



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
    } else if (
      paymentStatus === "refund_50" ||
      paymentStatus === "refund_100"
    ) {
      statusColor = "#2196F3"; // Blue for refund
      statusIcon = "💰";
      statusMessage =
        paymentStatus === "refund_50"
          ? "Partial Refund Processed"
          : "Full Refund Processed";
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
    } else if (
      paymentStatus === "refund_50" ||
      paymentStatus === "refund_100"
    ) {
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
            
            <a href="${emailUrl}/check-invoice/${
      booking.ticket_id
    }" style="display: inline-block; padding: 10px 20px; margin: 15px 0; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Booking Details</a>
            
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
    const recipients = agentEmail
      ? [recipientEmail, agentEmail]
      : recipientEmail;

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
      from: process.env.EMAIL_BOOKING,
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
      from: process.env.EMAIL_BOOKING,
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
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancellation Notice</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <!-- Pre-header -->
        <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
          Important: Your Gili Getaway booking #${booking.ticket_id} has been canceled due to non-payment.
        </div>

        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: #165297; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
            <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/giligetawayinverted.png" 
                 alt="Gili Getaway" 
                 style="max-width: 180px; display: inline-block;" 
                 width="180" height="60">
            <h1 style="color: white; margin: 10px 0;">Booking Cancellation Notice</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Dear Customer,</p>
            
            <p>We regret to inform you that your booking with the following details has been <strong style="color: #d32f2f;">automatically canceled</strong> because payment was not received within 24 hours:</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #165297;">Booking Details:</h3>
              <p><strong>Ticket ID:</strong> ${booking.ticket_id}</p>
              <p><strong>Departure Date:</strong> ${new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              }).format(new Date(booking.booking_date))}</p>
              <p><strong>Booking Date:</strong> ${new Intl.DateTimeFormat(
                "en-GB",
                { day: "2-digit", month: "long", year: "numeric" }
              ).format(new Date(booking.created_at))}</p>
              <p><strong>Total Payment:</strong> ${booking.gross_total} ${booking.currency}</p>
              <p><strong>Status:</strong> <span style="color: #d32f2f;">Canceled</span></p>
            </div>
            
            <p>If you still wish to travel, please make a new booking through our website or contact our customer service.</p>
            
            <p>Thank you for your understanding.</p>
            
            <p>Best regards,<br>
            The Gili Getaway Team</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 14px; color: #6c757d; border-top: 1px solid #e9ecef; border-radius: 0 0 5px 5px;">
            <p style="margin: 5px 0;">Gili Getaway | Jl. Pantai Serangan, Serangan, Denpasar Selatan, Bali 80229, Indonesia</p>
            <p style="margin: 5px 0;">Contact: +62 812 3456 7890 | officebali1@gmail.com</p>
            <p style="margin: 5px 0;"><a href="https://www.giligetaway.com" style="color: #165297;">www.giligetaway.com</a></p>
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Gili Getaway. All rights reserved.</p>
            <p style="margin: 5px 0;">This is an automated transactional email regarding your booking with Gili Getaway.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: `Gili Getaway <${process.env.EMAIL_BOOKING}>`,
      to: customerEmail,
      subject: subject,
      html: message,
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Cancellation email successfully sent to customer ${customerEmail}`);
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
      from: process.env.EMAIL_BOOKING,
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

const sendWaitingListConfirmationEmail = async (
  transporter,
  email,
  name,
  schedule,
  date,
  passengers
) => {
  console.log("email", email);
  try {
    const routeInfo = schedule
      ? `${schedule.DestinationFrom.name} to ${schedule.DestinationTo.name}`
      : "Selected route";

    const mailOptions = {
      from:  process.env.EMAIL_BOOKING,
      to: email,
      subject: "Your Waiting List Confirmation",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/Logo-01.jpg?updatedAt=1740878261713" alt="Gili Getaway" style="max-width: 200px;">
          </div>
          
          <h2 style="color: #0047AB;">Waiting List Confirmation</h2>
          
          <p>Hello ${name},</p>
          
          <p>Thank you for joining our waiting list. We've received your request and will notify you as soon as seats become available for your selected journey.</p>
          
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0047AB;">Journey Details</h3>
            <p><strong>Route:</strong> ${routeInfo}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Passengers:</strong> ${passengers}</p>
          </div>
          
          <p>We'll do our best to accommodate your request. If seats become available, we'll contact you immediately with instructions on how to complete your booking.</p>
          
          <p>If you have any questions or need to update your waiting list request, please contact our customer service team at <a href="mailto:bookings@giligetaway.com">bookings@giligetaway.com</a> or call +62 123 456 789.</p>
          
          <p>Thank you for choosing Gili Getaway for your journey.</p>
          
          <p>Best regards,<br>The Gili Getaway Team</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; text-align: center;">
            <p>This is an automated message, please do not reply directly to this email.</p>
            <p>&copy; 2025 Gili Getaway. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Customer confirmation email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending customer confirmation email:", error);
    // Don't throw error to avoid disrupting the main process
  }
};

// Function to send notification email to admin
const sendAdminNotificationEmail = async (
  transporter,
  waitingList,
  schedule,
  formattedDate
) => {
  try {
    const routeInfo = schedule
      ? `${schedule.DestinationFrom.name} to ${schedule.DestinationTo.name}`
      : "Selected route";

    const adminEmail = "bookings@giligetaway.com";

    const mailOptions = {
      from:  process.env.EMAIL_BOOKING,
      to: adminEmail,
      subject: "New Waiting List Entry",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #0047AB;">New Waiting List Notification</h2>
          
          <p>A new customer has joined the waiting list with the following details:</p>
          
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Name:</strong> ${waitingList.contact_name}</p>
            <p><strong>Email:</strong> ${waitingList.contact_email}</p>
            <p><strong>Phone:</strong> ${waitingList.contact_phone}</p>
            <p><strong>Route:</strong> ${routeInfo}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Total Passengers:</strong> ${
              waitingList.total_passengers
            }</p>
            <p><strong>Adults:</strong> ${waitingList.adult_passengers}</p>
            <p><strong>Children:</strong> ${waitingList.child_passengers}</p>
            <p><strong>Infants:</strong> ${waitingList.infant_passengers}</p>
            ${
              waitingList.follow_up_notes
                ? `<p><strong>Notes:</strong> ${waitingList.follow_up_notes}</p>`
                : ""
            }
          </div>
          
          <p>Please check the admin dashboard for full details and to manage this waiting list entry.</p>
          
          <p>This notification was sent automatically by the Gili Getaway booking system.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Admin notification email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending admin notification email:", error);
    // Don't throw error to avoid disrupting the main process
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
  sendAdminNotificationEmail,
  sendWaitingListConfirmationEmail,
  sendExpiredBookingEmail,
  sendPaymentSuccessEmail,
  sendPaymentSuccessEmailRoundTrip
};
