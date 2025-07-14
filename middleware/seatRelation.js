const { Booking, BookingSeatAvailability } = require('../models'); // sesuaikan path jika perlu

const validateSeatRelation= async (req, res, next) => {
  const { ticket_id } = req.query;

  if (!ticket_id) {
    return res.status(400).json({
      status: 'fail',
      message: 'Missing ticket_id in query parameters',
    });
  }

  try {
    // Langsung cari relasi BookingSeatAvailability dengan Booking (pakai ticket_id)
    const result = await BookingSeatAvailability.findAll({
      include: [
        {
          model: Booking,
          as: 'Booking',
          where: { ticket_id },
          attributes: ['id'], // cukup minimal untuk validasi
        },
      ],
    });

    if (!result || result.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `No seat availability found for ticket ID ${ticket_id}`,
      });
    }

    next(); // valid, lanjut ke controller
  } catch (error) {
    console.error('❌ Middleware error in validateSeatRelationWithQuery:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error checking seat availability relation',
      error: error.message,
    });
  }
};

module.exports = validateSeatRelation;