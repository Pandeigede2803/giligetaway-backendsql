const Discount = require('../models/discount');
const validateDiscountQuery = async (req, res, next) => {
  console.log("🚦 Start validating discount query...");

  const { type, booking_date } = req.query;
  const { code } = req.params;
  const errors = [];

  console.log("🔍 Query parameters:", req.query);

  // 🔍 Validate 'type'
  if (type && !['one_way', 'round_trip'].includes(type)) {
    console.log("❌ Invalid type:", type);
    errors.push("Type must be either 'one_way' or 'round_trip'");
  }

  // 🔍 Validate 'booking_date'
  if (booking_date && isNaN(Date.parse(booking_date))) {
    console.log("❌ Invalid booking_date:", booking_date);
    errors.push("Invalid booking_date format. Expected YYYY-MM-DD.");
  }

  // ❌ If there are format errors
  if (errors.length > 0) {
    console.log("🛑 Format validation failed:", errors);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  try {
    console.log("🔎 Searching discount with code:", code);
    const discount = await Discount.findOne({ where: { code } });

    if (!discount) {
      console.log("❌ Discount not found");
      return res.status(404).json({
        success: false,
        message: "Discount not found",
      });
    }

    req.discount = discount;

    // ⛔ Validate applicable_types compatibility
    if (
      discount.applicable_types &&
      type &&
      discount.applicable_types !== 'all' &&
      discount.applicable_types !== type
    ) {
      console.log(`❌ Discount applicable_types mismatch: expected '${discount.applicable_types}', got '${type}'`);
      return res.status(400).json({
        success: false,
        message: "Discount is not valid for selected trip type",
      });
    }

    console.log("✅ Discount validation passed.");
    next();
  } catch (error) {
    console.error("🔥 Server error during discount validation:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while validating discount",
    });
  }
};

module.exports = validateDiscountQuery;