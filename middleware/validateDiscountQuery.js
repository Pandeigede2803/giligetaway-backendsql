const Discount = require("../models/discount");

/**
 * Strip the time component so date–only comparisons work in local timezone.
 */
const stripTime = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Parse booking_date sent from the front‑end.
 * Accepts either ISO “YYYY-MM-DD”  **or**  “DD MMM, YYYY” / “DD MMM YYYY”
 * (e.g. “10 Jan, 2026”). Returns an invalid Date (NaN) if parsing fails.
 */
const parseBookingDate = (str) => {
  if (!str) return new Date(NaN);

  // Remove commas and trim extra spaces, then try native parser first
  const cleaned = str.replace(/,/g, "").trim();
  const direct = new Date(cleaned);
  if (!isNaN(direct)) return direct;

  // Manual fallback for “DD MMM YYYY” pattern
  const parts = cleaned.split(/\s+/);
  if (parts.length === 3) {
    const [dayStr, monthStr, yearStr] = parts;
    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);
    const months = [
      "jan","feb","mar","apr","may","jun",
      "jul","aug","sep","oct","nov","dec"
    ];
    const monthIdx = months.indexOf(monthStr.toLowerCase().slice(0,3));
    if (monthIdx !== -1) {
      return new Date(year, monthIdx, day);
    }
  }
  return new Date(NaN);
};
const validateDiscountQuery = async (req, res, next) => {
  console.log("🚦 Start validating discount query...");

  const { type, booking_date, schedule_id_departure, schedule_id_return } =
    req.query;
  const { code } = req.params;
  const errors = [];

  console.log("🔍 Query parameters:", req.query);

  // 🔍 Validate 'type'
  if (type && !["one_way", "round_trip"].includes(type)) {
    console.log("❌ Invalid type:", type);
    errors.push("Type must be either 'one_way' or 'round_trip'");
  }

  // 🔍 Validate 'booking_date'
  const parsedBookingDate = booking_date ? parseBookingDate(booking_date) : null;
  if (booking_date && isNaN(parsedBookingDate)) {
    console.log("❌ Invalid booking_date:", booking_date);
    errors.push("Invalid booking_date format. Expected YYYY-MM-DD or 'DD MMM, YYYY'.");
  }

  // ❌ If there are format errors
  if (errors.length > 0) {
    console.log("🛑 Format validation failed:", errors);
    return res.status(400).json({
      success: false,
      message: "Validation failed",
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

    // ⛔ Validate booking_date is within discount validity
    if (booking_date) {
      const checkDate = stripTime(parsedBookingDate);          // booking date from request
      const startDate = stripTime(discount.start_date);        // discount start
      const endDate   = stripTime(discount.end_date);          // discount end

      if (checkDate < startDate || checkDate > endDate) {
        console.log(
          `❌ Booking date ${booking_date} is outside discount validity range: ${discount.start_date} - ${discount.end_date}`
        );
        return res.status(400).json({
          success: false,
          message: `Discount is not valid for the selected booking date: ${booking_date}`,
        });
      }
    }

    // ⛔ Validate applicable_types compatibility
    if (
      discount.applicable_types &&
      type &&
      discount.applicable_types !== "all" &&
      discount.applicable_types !== type
    ) {
      console.log(
        `❌ Discount applicable_types mismatch: expected '${discount.applicable_types}', got '${type}'`
      );
      return res.status(400).json({
        success: false,
        message: "Discount is not valid for selected trip type",
      });
    }
    // ⛔ Unified schedule_id validation
    const hasScheduleIds =
      Array.isArray(discount.schedule_ids) && discount.schedule_ids.length > 0;
    const depValid =
      !schedule_id_departure ||
      discount.schedule_ids.includes(parseInt(schedule_id_departure));
    const retValid =
      schedule_id_return === null ||
      discount.schedule_ids.includes(parseInt(schedule_id_return));

    if (hasScheduleIds && !depValid && !retValid) {
      console.log(
        "❌ Discount not valid for either departure or return schedule."
      );
      return res.status(400).json({
        success: false,
        message:
          "Discount is not valid for either selected schedule (departure or return).",
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
