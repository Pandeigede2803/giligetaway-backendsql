const transactionUpdateValidation = (req, res, next) => {
    const { transaction_id } = req.params;
    const {
      status,
      booking_status,
      amount_in_usd,
      exchange_rate,
      amount,
    } = req.body;
  
    // Check if transaction_id exists
    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id parameter is required' });
    }
  
    // Validate transaction status
    const validTransactionStatuses = ['paid', 'pending', 'failed','invoiced'];
    if (status && !validTransactionStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed statuses are: ${validTransactionStatuses.join(', ')}`,
      });
    }
  
    // Validate booking status
    const validBookingStatuses = ['pending', 'invoiced'];
    if (booking_status && !validBookingStatuses.includes(booking_status)) {
      return res.status(400).json({
        error: `Invalid booking status. Allowed statuses are: ${validBookingStatuses.join(', ')}`,
      });
    }
  
    // Validate numerical fields
    if (amount_in_usd && typeof amount_in_usd !== 'number') {
      return res.status(400).json({ error: 'amount_in_usd must be a number' });
    }
    if (exchange_rate && typeof exchange_rate !== 'number') {
      return res.status(400).json({ error: 'exchange_rate must be a number' });
    }
    if (amount && typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount must be a number' });
    }
  
    next();  // Proceed to the next middleware or controller if validations pass
  };
  
  module.exports = transactionUpdateValidation;
  