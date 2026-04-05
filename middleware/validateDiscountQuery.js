const Discount = require("../models/discount");
const SubSchedule = require("../models/SubSchedule");

const STATIC_SUBSCHEDULE_EXCEPTION_IDS = new Set(
  String(process.env.DISCOUNT_STATIC_SUBSCHEDULE_EXCEPTION_IDS || "")
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id))
);

const getDiscountExceptionSet = (discount) => {
  if (Array.isArray(discount?.sub_id_exception)) {
    return new Set(
      discount.sub_id_exception
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id))
    );
  }
  return STATIC_SUBSCHEDULE_EXCEPTION_IDS;
};

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

  const {
    type,
    booking_date,
    schedule_id_departure,
    schedule_id_return,
    subschedule_id_departure,
    subschedule_id_return,
    sub_schedule_id_departure,
    sub_schedule_id_return,
  } = req.query;
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
    // Resolve subschedule IDs to parent schedule IDs so query can use either schedule_id_* or subschedule_id_*.
    const parseId = (value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const parsedDepartureScheduleId = parseId(schedule_id_departure);
    const parsedReturnScheduleId = parseId(schedule_id_return);
    const parsedDepartureSubScheduleId = parseId(
      sub_schedule_id_departure ?? subschedule_id_departure
    );
    const parsedReturnSubScheduleId = parseId(
      sub_schedule_id_return ?? subschedule_id_return
    );

    const departureSubSchedule = parsedDepartureSubScheduleId
      ? await SubSchedule.findByPk(parsedDepartureSubScheduleId)
      : null;
    const returnSubSchedule = parsedReturnSubScheduleId
      ? await SubSchedule.findByPk(parsedReturnSubScheduleId)
      : null;

    if (parsedDepartureSubScheduleId && !departureSubSchedule) {
      return res.status(400).json({
        success: false,
        message: `SubSchedule departure not found: ${parsedDepartureSubScheduleId}`,
      });
    }

    if (parsedReturnSubScheduleId && !returnSubSchedule) {
      return res.status(400).json({
        success: false,
        message: `SubSchedule return not found: ${parsedReturnSubScheduleId}`,
      });
    }

    const effectiveDepartureScheduleId =
      departureSubSchedule?.schedule_id || parsedDepartureScheduleId || null;
    const effectiveReturnScheduleId =
      returnSubSchedule?.schedule_id || parsedReturnScheduleId || null;
    const discountExceptionSet = getDiscountExceptionSet(discount);
    const isDepartureSubscheduleException =
      parsedDepartureSubScheduleId !== null &&
      discountExceptionSet.has(parsedDepartureSubScheduleId);
    const isReturnSubscheduleException =
      parsedReturnSubScheduleId !== null &&
      discountExceptionSet.has(parsedReturnSubScheduleId);

    // Layered rule: when subschedule is provided and is listed as exception, block immediately.
    if (isDepartureSubscheduleException || isReturnSubscheduleException) {
      return res.status(400).json({
        success: false,
        message:
          "Discount is blocked for selected subschedule (exception rule).",
        blocked_subschedule_departure: isDepartureSubscheduleException
          ? parsedDepartureSubScheduleId
          : null,
        blocked_subschedule_return: isReturnSubscheduleException
          ? parsedReturnSubScheduleId
          : null,
      });
    }

    // ⛔ Unified schedule_id validation
    const hasScheduleIds =
      Array.isArray(discount.schedule_ids) && discount.schedule_ids.length > 0;
    const depValid =
      !effectiveDepartureScheduleId ||
      discount.schedule_ids.includes(effectiveDepartureScheduleId);
    const retValid =
      !effectiveReturnScheduleId ||
      discount.schedule_ids.includes(effectiveReturnScheduleId);

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
