// Middleware to validate if payment_method is 'midtrans'
const validateMidtransPaymentMethod = (req, res, next) => {
    const { payment_method } = req.body.booking;
  
    // Check if payment_method is 'midtrans'
    if (payment_method !== 'midtrans') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method for Midtrans. It must be "midtrans".',
      });
    }
  
    // Proceed to the next middleware or controller
    next();
  };
  
  // Middleware to validate if payment_method is 'paypal'
  const validatePayPalPaymentMethod = (req, res, next) => {
    const { payment_method } = req.body.booking;
  
    // Check if payment_method is 'paypal' or 'Paypal'
    if (payment_method !== 'paypal' && payment_method !== 'Paypal') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method for PayPal. It must be "paypal".',
      });
    }
  
    // Proceed to the next middleware or controller
    next();
  };

  const validatePayPalPaymentMethodMulti = (req, res, next) => {
    const { bookings } = req.body;
  
    // Check if 'bookings' is an array and not empty
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bookings must be a non-empty array.',
      });
    }
  
    // Loop through each booking and check if payment_method is 'paypal'
    for (const booking of bookings) {
      if (booking.payment_method !== 'paypal') {
        return res.status(400).json({
          success: false,
          message: `Invalid payment method for booking ID ${booking.id}. It must be "paypal".`,
        });
      }
    }
  
    // If all bookings have 'paypal' as payment method, proceed to the next middleware or controller
    next();
  };
  


  
  // Middleware to validate if payment_method is 'paypal'
  const validateMidtransPaymentMethodMulti = (req, res, next) => {
    let { bookings } = req.body;
  
    // If 'bookings' is not an array, but an object with numeric keys, convert it to an array
    if (!Array.isArray(bookings)) {
      bookings = Object.values(bookings).filter(item => typeof item === 'object'); // Convert object to array
    }
  
    // Check if 'bookings' is a valid array and not empty
    if (bookings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bookings must be a non-empty array.',
      });
    }
  
    // Loop through each booking and check if payment_method is 'midtrans' and status is not 'invoiced'
    for (const booking of bookings) {
      if (booking.payment_method !== 'midtrans' && booking.payment_method !== 'invoiced' && booking.payment_method !== 'invoice') {
        return res.status(400).json({
          success: false,
          message: `Invalid payment method or status for booking ID ${booking.id}. Payment method must be "midtrans" and status must not be "invoiced".`,
        });
      }
    }
  
    // If all bookings have 'midtrans' as payment method, proceed to the next middleware or controller
    next();
  };
  




  
  
  module.exports = {
    validateMidtransPaymentMethod,
    validatePayPalPaymentMethod,
    validateMidtransPaymentMethodMulti,
    validatePayPalPaymentMethodMulti,

  };
  