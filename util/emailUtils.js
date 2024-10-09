// HTML template for Invoice
const getInvoiceHtml = (transactionId, orderDetails, bookingData, gross_amount) => 
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .container { width: 100%; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; }
    .header { text-align: center; margin-bottom: 40px; }
    .header img { width: 100px; }
    .header h1 { margin: 10px 0; }
    .content { padding: 10px; }
    .content h2 { margin-bottom: 20px; }
    .content table { width: 100%; border-collapse: collapse; }
    .content th, .content td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .content th { background-color: #f4f4f4; }
    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Section -->
    <div class="header">
      <img src="https://ik.imagekit.io/m1akscp5q/GIL_GETAWAY_LOGO_7TfKcfMi4.png" alt="Gili Getaway Logo">
      <h1>Invoice</h1>
      <p>Booking ID: ${transactionId}</p>
    </div>
    
    <!-- Billing Details -->
    <div class="content">
      <h2>Billing Information</h2>
      <table>
        <tr><th>Name</th><td>${orderDetails.name}</td></tr>
        <tr><th>Email</th><td>${orderDetails.email}</td></tr>
        <tr><th>Phone</th><td>${orderDetails.phone}</td></tr>
        <tr><th>Passport ID</th><td>${orderDetails.passportId}</td></tr>
      </table>
      
      <!-- Booking Information -->
      <h2>Booking Information</h2>
      ${bookingDataArray.map((bookingData, index) => `
      <table>
        <tr><th colspan="2">Booking ${index + 1}</th></tr>
        <tr><th>Departure</th><td>${bookingData.from}</td></tr>
        <tr><th>Destination</th><td>${bookingData.to}</td></tr>
        <tr><th>Departure Date</th><td>${bookingData.departureDate}</td></tr>
        <tr><th>Boat Name</th><td>${bookingData.boatName}</td></tr>
        <tr><th>Price</th><td>${bookingData.price}</td></tr>
      </table>
      `).join('')}

      <!-- Total Amount -->
      <h2>Total Amount</h2>
      <table><tr><th>Gross Amount</th><td>${gross_amount}</td></tr></table>
    </div>

    <!-- Terms and Conditions -->
    <div class="content terms">
      <h2>Terms and Conditions</h2>
      <p>Gili Getaway endeavors to transport all customers to their destinations at these times. All travel itineraries are subject to weather conditions. Gili Getaway reserves the right to change and/or cancel schedules in the interest of passenger’s safety and well-being.</p>
      <p><strong>Cancellations and delays</strong>: The company reserves the right to vary the service in any way whatsoever without liability to the passenger. The company shall not be liable for any loss, damage, or injury which may arise in the event of cancellation or delay in service.</p>
      <p><strong>Refunds</strong>: In the event of a trip cancellation by the company, the company shall refund any amounts paid by the passenger directly to the company, or any funds already paid by the agent to the company on the passenger’s behalf.</p>
      <p><strong>Re-Scheduling Trip</strong>: Re-scheduling is based on seat availability and must be made prior to 48 hours before guest departure for the regular season, and 96 hours for the high season.</p>
      <p><strong>Baggage Allowance</strong>: Each passenger is entitled to a maximum of 2 pieces of luggage carried free of charge, not exceeding a total weight of 25 kg. Excess luggage may be subject to additional charges.</p>
      <p><strong>Plastic Free Commitment</strong>: Gili Getaway does not provide bottled water onboard to help reduce plastic waste. Passengers are encouraged to bring reusable water bottles.</p>
    </div>

    <!-- Footer Section -->
    <div class="footer">
      <p>Thank you for booking with Gili Getaway!</p>
    </div>
  </div>
</body>
</html>
`;

// html

const getEticketHtml = (order_Id, orderDetails, bookingDataArray, passengers, checkinTime, pickupTime, transportStatus) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Ticket</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .container { width: 100%; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; }
    .header { text-align: center; margin-bottom: 40px; }
    .header img { width: 100px; }
    .header h1 { margin: 10px 0; }
    .content { padding: 10px; }
    .content h2 { margin-bottom: 20px; }
    .content table { width: 100%; border-collapse: collapse; }
    .content th, .content td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .content th { background-color: #f4f4f4; }
    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
    iframe { width: 100%; height: 200px; border: 0; margin-top: 20px; }
    .terms { margin-top: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Section -->
    <div class="header">
      <img src="https://ik.imagekit.io/m1akscp5q/GIL_GETAWAY_LOGO_7TfKcfMi4.png" alt="Gili Getaway Logo">
      <h1>E-Ticket</h1>
      <p>Booking ID: ${order_Id}</p>
    </div>
    
    <!-- Passenger Details -->
    <div class="content">
      <h2>Passenger Information</h2>
      <table>
        <tr><th>No</th><th>Passenger</th><th>Passport ID</th><th>Ticket Number</th></tr>
        ${passengers.map((passenger, index) => `
          <tr><td>${index + 1}</td><td>${passenger.name}</td><td>${passenger.passportId}</td><td>${order_Id}</td></tr>
        `).join('')}
      </table>
      
      <!-- Booking Details -->
      <h2>Booking Information</h2>
      ${bookingDataArray.map((bookingData, index) => `
      <table>
        <tr><th>Booking ${index + 1}</th></tr>
        <tr><th>Departure</th><td>${bookingData.from}</td></tr>
        <tr><th>Destination</th><td>${bookingData.to}</td></tr>
        <tr><th>Departure Date</th><td>${bookingData.departureDate}</td></tr>
        <tr><th>Boat Name</th><td>${bookingData.boatName}</td></tr>
        <tr><th>Check-in Time</th><td>${checkinTime}</td></tr>
      </table>
      `).join('')}
      
<!-- Transport Details -->
${(transportStatus.pickupDetails.transportType || transportStatus.dropOffDetails.transportType) ? `
  <h2>Transport Details</h2>
  <p><strong>Note:</strong> Please arrive at the location at least 15 minutes before the departure time. If you are late, the transport may leave without you.</p>
  <table>
    ${transportStatus.pickupDetails.transportType ? `
    <tr>
      <td><strong>Pickup:</strong></td>
      <td>${transportStatus.pickupDetails.transportType} - ${transportStatus.pickupDetails.area}</td>
    </tr>
    <tr>
      <td>Journey Time:</td>
      <td>${transportStatus.pickupDetails.duration} minutes</td>
    </tr>
    <tr>
      <td>Quantity:</td>
      <td>${transportStatus.pickupDetails.quantity} Transport</td>
    </tr>
    <tr>
      <td>Note:</td>
      <td>${transportStatus.pickupDetails.note}</td>
    </tr>
    ` : ''}

    ${transportStatus.dropOffDetails.transportType ? `
    <tr>
      <td><strong>Drop-off:</strong></td>
      <td>${transportStatus.dropOffDetails.transportType} - ${transportStatus.dropOffDetails.area}</td>
    </tr>
    <tr>
      <td>Journey Time:</td>
      <td>${transportStatus.dropOffDetails.duration} minutes</td>
    </tr>
    <tr>
      <td>Quantity:</td>
      <td>${transportStatus.dropOffDetails.quantity} Transport</td>
    </tr>
    <tr>
      <td>Note:</td>
      <td>${transportStatus.dropOffDetails.note}</td>
    </tr>
    ` : ''}
  </table>
` : ''}


    <!-- Google Maps Location -->
    <h2>Location Map</h2>
    <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1967.406380565124!2d115.23762796195038!3d-8.721405527571887!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd24182fb6d481b%3A0x93a356efae14ef1e!2sSerangan%20Port!5e0!3m2!1sen!2sid!4v1728446491489!5m2!1sen!2sid" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>

    <!-- Terms and Conditions -->
    <div class="terms">
      <h2>Terms and Conditions</h2>
      <p>Gili Getaway endeavors to transport all customers to their destinations at the scheduled times.</p>
      <p>All travel itineraries are subject to weather conditions. Gili Getaway reserves the right to change and/or cancel schedules in the interest of passenger safety and well-being.</p>
      <p><strong>Cancellations and delays</strong>: The company reserves the right to vary the service in any way whatsoever without liability to the passenger. The company shall not be liable for any loss, damage, or injury which may arise in the event of cancellation or delay in service.</p>
      <p><strong>Refunds</strong>: In the event of a trip cancellation by the company, the company shall refund any amounts paid by the passenger directly to the company, or any funds already paid by the agent to the company on the passenger’s behalf.</p>
      <p><strong>Re-Scheduling Trip</strong>: Re-scheduling is based on seat availability and must be made prior to 48 hours before guest departure for regular season, and 96 hours prior to guest departure for high season. A Rp100,000 fee per ticket will be charged for re-scheduling.</p>
      <p><strong>Baggage Allowance</strong>: Each passenger is entitled to a maximum of 2 pieces of luggage carried free of charge, not exceeding a total weight of 25 kg. Excess luggage may be subject to additional charges.</p>
      <p><strong>Plastic Free Commitment</strong>: Gili Getaway does not provide bottled water onboard to help reduce plastic waste. Passengers are encouraged to bring reusable water bottles.</p>
    </div>

    <!-- Footer Section -->
    <div class="footer">
      <p>Thank you for traveling with Gili Getaway!</p>
    </div>
  </div>
</body>
</html>
`;

// Export for CommonJS
module.exports = {
  getInvoiceHtml, 
  getEticketHtml
};
