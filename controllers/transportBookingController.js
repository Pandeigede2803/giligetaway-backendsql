const { TransportBooking, Transport,Booking, Passenger } = require('../models');
const getExchangeRate = require('../util/getExchangeRate');
const {sendEmailTransportBookingUpdate} = require('../util/sendPaymentEmail');

// Get all transport bookings with transport details
exports.getAllTransportBookings = async (req, res) => {
  try {
    console.log('Fetching all transport bookings...');
    const transportBookings = await TransportBooking.findAll({
      include: [
        {
          model: Transport,
          as: 'Transport', // alias untuk asosiasi
          attributes: ['id', 'pickup_area', 'pickup_time', 'duration', 'check_in_time', 'pickup_time_2', 'check_in_time_2', 'cost', 'interval_time', 'description'], // pilih atribut yang ingin diambil dari model Transport
        },
        {
          model: Booking,
          attributes: ['id', 'booking_source', 'booking_date', 'created_at', 'updated_at','payment_status'],
          // where: {
          //   payment_status: {
          //     [Op.in]: ['paid', 'invoiced']
          //   }
          // },
          attributes: [
            'id', 'contact_name', 'contact_phone', 'contact_passport_id', 'contact_nationality', 'contact_email', 'schedule_id', 'agent_id', 'payment_method', 'gross_total', 'total_passengers', 'adult_passengers', 'child_passengers', 'infant_passengers', 'payment_status', 'booking_source', 'booking_date', 'ticket_id', 'created_at', 'updated_at'
          ],
          include: [
            {
            model: Passenger,
            as: 'passengers',
          }
          ]
        },
      ],
    });
    console.log('Fetched transport bookings:', transportBookings);
    res.status(200).json(transportBookings);
  } catch (error) {
    console.error('Failed to fetch transport bookings:', error);
    res.status(500).json({ message: 'Failed to fetch transport bookings', error });
  }
};

// Create new transport booking
exports.createTransportBooking = async (req, res) => {
  const { booking_id, transport_id, quantity, transport_price, transport_type, note } = req.body;
  console.log('Creating new transport booking with data:', req.body);
  try {
    const newTransportBooking = await TransportBooking.create({
      booking_id,
      transport_id,
      quantity,
      transport_price,
      transport_type,
      note,
    });
    console.log('Created transport booking:', newTransportBooking);
    res.status(201).json(newTransportBooking);
  } catch (error) {
    console.error('Failed to create transport booking:', error);
    res.status(500).json({ message: 'Failed to create transport booking', error });
  }
};

// Update transport booking
const { sequelize } = require('../models'); // Import sequelize instance if not already available


exports.updateTransportBooking = async (req, res) => {
  const { id } = req.params;
  const { booking_id, transport_id, quantity, transport_type, note,payment_method,payment_status } = req.body;

  console.log("payment method",payment_method)
  console.log("payment status",payment_status)

  console.log("transportBooking")

  console.log(`Updating transport booking ID ${id} with data:`, req.body);

  if (!id) {
    return res.status(400).json({ message: 'Transport booking ID is required' });
  }

  if (!booking_id || !transport_id || !quantity || !transport_type) {
    return res.status(400).json({ message: 'Missing required fields for updating transport booking' });
  }

  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'Invalid quantity' });
  }

  const transaction = await sequelize.transaction();
  try {
    // ✅ Fetch the transport cost from the Transport table
    const transport = await Transport.findByPk(transport_id);
    if (!transport) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Transport not found' });
    }

    // ✅ Calculate the correct transport price (cost * quantity)
    const transportPrice = parseFloat(transport.cost) * quantity;
    console.log(`Transport cost: ${transport.cost}, Quantity: ${quantity}, Calculated Transport Price: ${transportPrice}`);

    // ✅ Check if transport booking exists
    const transportBooking = await TransportBooking.findByPk(id, { transaction });
    if (!transportBooking) {
      console.log(`Transport booking with ID ${id} not found`);
      await transaction.rollback();
      return res.status(404).json({ message: 'Transport booking not found' });
    }

    // ✅ Fetch booking data before updating
    const booking = await Booking.findByPk(booking_id, { transaction });
    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Booking not found' });
    }

    console.log(`Booking ticket total (IDR): ${booking.ticket_total}`);

    // ✅ Fetch latest exchange rate for IDR to USD
    const exchangeRate = await getExchangeRate("IDR");
    console.log(`Exchange Rate (1 USD = ${exchangeRate} IDR)`);

    // ✅ Correctly calculate the new gross total (IDR)
    const newGrossTotal = parseFloat(booking.ticket_total) + transportPrice;
    console.log(`New Gross Total (IDR) = Ticket Total + New Transport Price = ${booking.ticket_total} + ${transportPrice} = ${newGrossTotal}`);

    // ✅ Convert `gross_total` to `gross_total_in_usd`
    const newGrossTotalInUSD = parseFloat((newGrossTotal / exchangeRate).toFixed(2));
    console.log(`New Gross Total in USD: ${newGrossTotalInUSD}`);

    // ✅ Update transport booking with the correct transport_price
    await TransportBooking.update(
      { booking_id, transport_id, quantity, transport_price: transportPrice, transport_type, note,payment_method,payment_status },
      { where: { id }, transaction }
    );

    console.log("transportBooking",transportBooking)

    // ✅ Update the `gross_total` and `gross_total_in_usd` in Booking
    await Booking.update(
      { gross_total: newGrossTotal, gross_total_in_usd: newGrossTotalInUSD },
      { where: { id: booking_id }, transaction }
    );

    // ✅ Fetch the updated booking AFTER update
    const updatedBooking = await Booking.findByPk(booking_id, { transaction });

    // Store these values to use after transaction commit
    const contactEmail = booking.contact_email;
    const ticketId = booking.ticket_id;
    const paymentStatus = booking.payment_status;
    const paymentMethod = booking.payment_method;

    // ✅ Commit transaction to persist data
    await transaction.commit();

    // ✅ Fetch the updated transport booking AFTER committing
    const updatedTransportBooking = await TransportBooking.findByPk(id);

    // Now send email after transaction is committed
    try {
      await sendEmailTransportBookingUpdate(
        contactEmail,
        ticketId,
        transport_type,
        transportPrice,
        paymentStatus,
        paymentMethod
      );
    } catch (emailError) {
      // Just log the email error, don't roll back the transaction
      console.error('Failed to send email:', emailError);
    }

    res.status(200).json({
      transportBooking: updatedTransportBooking,
      booking: updatedBooking,
    });

  } catch (error) {
    // Only roll back if transaction hasn't been committed
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error(`Failed to update transport booking ID ${id}:`, error);
    res.status(500).json({ message: 'Failed to update transport booking', error: error.message });
  }
};

exports.addTransportBooking = async (req, res) => {
  const { booking_id, transport_id, quantity, transport_type,payment_method,payment_status, note } = req.body;

  console.log("Adding new transport booking with data:", req.body);

  if (!booking_id || !transport_id || !quantity || !transport_type) {
    return res.status(400).json({ message: "Missing required fields for adding transport booking" });
  }

  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "Invalid quantity" });
  }

  const transaction = await sequelize.transaction();
  try {
    // Fetch the transport cost from the Transport table
    const transport = await Transport.findByPk(transport_id);
    if (!transport) {
      await transaction.rollback();
      return res.status(404).json({ message: "Transport not found" });
    }

    // Calculate the transport price (cost * quantity)
    const transportPrice = parseFloat(transport.cost) * quantity;
    console.log(`Transport cost: ${transport.cost}, Quantity: ${quantity}, Calculated Transport Price: ${transportPrice}`);

    // Fetch the booking data
    const booking = await Booking.findByPk(booking_id, { transaction });
    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    console.log(`Current Booking ticket total: ${booking.ticket_total}, Current Gross Total: ${booking.gross_total}`);

    // Calculate new gross total after adding transport
    const newGrossTotal = parseFloat(booking.gross_total) + transportPrice;

    const exchangeRate = await getExchangeRate("IDR"); // Fetch USD to IDR rate
    console.log(`Exchange Rate (1 USD = ${exchangeRate} IDR)`);
    
    // Convert IDR to USD correctly
    const transportPriceInUSD = parseFloat((transportPrice / exchangeRate).toFixed(2));
    const newGrossTotalInUSD = parseFloat((newGrossTotal / exchangeRate).toFixed(2));
    
    console.log(`Corrected Transport Price in USD: ${transportPriceInUSD}`);
    console.log(`Corrected Gross Total in USD: ${newGrossTotalInUSD}`);

    // Add new Transport Booking
    const newTransportBooking = await TransportBooking.create(
      {
        booking_id,
        transport_id,
        quantity,
        transport_price: transportPrice,
        transport_type,
        payment_method,
        payment_status,
        note,
      },
      { transaction }
    );

    console.log("New Transport Booking:", newTransportBooking
    );

    // Update the Booking `gross_total` and `gross_total_in_usd`
    await Booking.update(
      { gross_total: newGrossTotal, gross_total_in_usd: newGrossTotalInUSD },
      { where: { id: booking_id }, transaction }
    );

    // Fetch updated booking
    const updatedBooking = await Booking.findByPk(booking_id, { transaction });

    // Commit the transaction
    await transaction.commit();

    // Send email notification
    await sendEmailTransportBookingUpdate(
      booking.contact_email,
      booking.ticket_id,
      transport_type,
      transportPrice,
      booking.payment_status,
      booking.payment_method
    );

    res.status(201).json({
      transportBooking: newTransportBooking,
      booking: updatedBooking,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Failed to add transport booking:", error);
    res.status(500).json({ message: "Failed to add transport booking", error: error.message });
  }
};

// Delete transport booking
exports.deleteTransportBooking = async (req, res) => {
  const { id } = req.params;
  console.log(`Deleting transport booking with id ${id}`);
  try {
    const transportBooking = await TransportBooking.findByPk(id);
    if (!transportBooking) {
      console.log(`Transport booking with id ${id} not found`);
      return res.status(404).json({ message: 'Transport booking not found' });
    }
    await transportBooking.destroy();
    console.log(`Deleted transport booking with id ${id}`);
    res.status(204).json({ message: 'Transport booking deleted successfully' });
  } catch (error) {
    console.error(`Failed to delete transport booking with id ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete transport booking', error });
  }
};
;