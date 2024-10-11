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
  
    // Check if payment_method is 'paypal'
    if (payment_method !== 'paypal') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method for PayPal. It must be "paypal".',
      });
    }
  
    // Proceed to the next middleware or controller
    next();
  };
  
  module.exports = {
    validateMidtransPaymentMethod,
    validatePayPalPaymentMethod,
  };
  