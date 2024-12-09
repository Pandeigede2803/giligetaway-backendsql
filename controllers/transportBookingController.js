const { TransportBooking, Transport,Booking } = require('../models');

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
exports.updateTransportBooking = async (req, res) => {
  const { id } = req.params;
  const { booking_id, transport_id, quantity, transport_price, transport_type, note } = req.body;
  console.log(`Updating transport booking with id ${id} with data:`, req.body);
  try {
    const transportBooking = await TransportBooking.findByPk(id);
    if (!transportBooking) {
      console.log(`Transport booking with id ${id} not found`);
      return res.status(404).json({ message: 'Transport booking not found' });
    }
    transportBooking.booking_id = booking_id;
    transportBooking.transport_id = transport_id;
    transportBooking.quantity = quantity;
    transportBooking.transport_price = transport_price;
    transportBooking.transport_type = transport_type;
    transportBooking.note = note;
    await transportBooking.save();
    console.log('Updated transport booking:', transportBooking);
    res.status(200).json(transportBooking);
  } catch (error) {
    console.error(`Failed to update transport booking with id ${id}:`, error);
    res.status(500).json({ message: 'Failed to update transport booking', error });
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