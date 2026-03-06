const { Op } = require("sequelize");
const Discount = require("../models/discount");

const parseIntSafe = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeDate = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const resolveScheduleId = (payload = {}) =>
  parseIntSafe(payload.schedule_id?.value || payload.schedule_id);

const isWithinDateRange = (discount, bookingDate) => {
  const targetDate = normalizeDate(bookingDate);
  if (!targetDate) {
    return false;
  }

  const startDate = normalizeDate(discount.start_date);
  const endDate = new Date(discount.end_date);
  if (Number.isNaN(endDate.getTime())) {
    return false;
  }
  endDate.setHours(23, 59, 59, 999);

  return Boolean(startDate) && targetDate >= startDate && targetDate <= endDate;
};

const isAllowedByAgent = (discount, agentId) => {
  if (!Array.isArray(discount.agent_ids) || discount.agent_ids.length === 0) {
    return true;
  }
  const normalizedAgentIds = discount.agent_ids
    .map((id) => parseIntSafe(id))
    .filter((id) => id !== null);
  return normalizedAgentIds.includes(agentId);
};

const isAllowedBySchedule = (discount, scheduleId) => {
  if (!Array.isArray(discount.schedule_ids) || discount.schedule_ids.length === 0) {
    return true;
  }
  if (!scheduleId) {
    return false;
  }
  const normalizedScheduleIds = discount.schedule_ids
    .map((id) => parseIntSafe(id))
    .filter((id) => id !== null);
  return normalizedScheduleIds.includes(scheduleId);
};

const isAllowedByType = (discount, bookingType) =>
  !discount.applicable_types ||
  discount.applicable_types === "all" ||
  discount.applicable_types === bookingType;

const isAllowedByDirection = (discount, direction) =>
  !discount.applicable_direction ||
  discount.applicable_direction === "all" ||
  discount.applicable_direction === direction;

const isDiscountValid = ({
  discount,
  agentId,
  scheduleId,
  bookingDate,
  bookingType,
  direction,
}) =>
  isAllowedByAgent(discount, agentId) &&
  isAllowedBySchedule(discount, scheduleId) &&
  isAllowedByType(discount, bookingType) &&
  isAllowedByDirection(discount, direction) &&
  isWithinDateRange(discount, bookingDate);

const findAutoDiscountForAgent = async ({
  agentId,
  scheduleId,
  bookingDate,
  bookingType,
  direction,
}) => {
  if (!agentId) {
    return null;
  }

  const targetDate = normalizeDate(bookingDate);
  if (!targetDate) {
    return null;
  }

  const dateYmd = targetDate.toISOString().split("T")[0];
  const discounts = await Discount.findAll({
    where: {
      start_date: { [Op.lte]: dateYmd },
      end_date: { [Op.gte]: dateYmd },
      applicable_types: { [Op.in]: [bookingType, "all"] },
      applicable_direction: { [Op.in]: [direction, "all"] },
    },
    order: [["id", "DESC"]],
  });

  for (const discount of discounts) {
    if (!Array.isArray(discount.agent_ids) || discount.agent_ids.length === 0) {
      continue;
    }
    if (
      isDiscountValid({
        discount,
        agentId,
        scheduleId,
        bookingDate,
        bookingType,
        direction,
      })
    ) {
      return discount;
    }
  }

  return null;
};

const resolveDiscountForPayload = async ({
  payload,
  bookingType,
  direction,
  bookingDate,
}) => {
  const discountCode = payload?.discount_code;
  const agentId = parseIntSafe(payload?.agent_id);
  const scheduleId = resolveScheduleId(payload);

  console.log("resolveDiscountForPayload:start", {
    direction,
    bookingType,
    agentId,
    scheduleId,
    bookingDate,
    incomingDiscountCode: discountCode || null,
  });

  if (!agentId) {
    payload.discount_code = null;
    console.log("resolveDiscountForPayload:skip-no-agent", { direction });
    return null;
  }

  let discount = null;

  if (discountCode) {
    discount = await Discount.findOne({ where: { code: discountCode } });
    if (!discount) {
      payload.discount_code = null;
      console.log("resolveDiscountForPayload:manual-not-found", {
        direction,
        discountCode,
      });
      return null;
    }
    console.log("resolveDiscountForPayload:manual-found", {
      direction,
      discountCode,
      discountId: discount.id,
    });
  } else {
    discount = await findAutoDiscountForAgent({
      agentId,
      scheduleId,
      bookingDate,
      bookingType,
      direction,
    });

    if (!discount) {
      console.log("resolveDiscountForPayload:auto-not-found", {
        direction,
        agentId,
        scheduleId,
      });
      return null;
    }

    payload.discount_code = discount.code;
    console.log(
      `Auto discount assigned (${direction}) agent_id=${agentId} code=${discount.code}`
    );
  }

  if (
    !isDiscountValid({
      discount,
      agentId,
      scheduleId,
      bookingDate,
      bookingType,
      direction,
    })
  ) {
    payload.discount_code = null;
    console.log("resolveDiscountForPayload:invalid-after-check", {
      direction,
      agentId,
      scheduleId,
      discountCode: discount.code,
      discountId: discount.id,
    });
    return null;
  }

  console.log("resolveDiscountForPayload:success", {
    direction,
    discountCode: discount.code,
    discountId: discount.id,
  });
  return discount;
};

const validateAgentDiscount = async (req, res, next) => {
  try {
    const discount = await resolveDiscountForPayload({
      payload: req.body,
      bookingType: "one_way",
      direction: "departure",
      bookingDate: req.body?.departure_date || req.body?.booking_date,
    });

    if (discount) {
      req.discount = discount;
    }

    next();
  } catch (error) {
    console.error("Error validating discount:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while validating discount",
      error: error.message,
    });
  }
};

const validateAgentRoundTripDiscount = async (req, res, next) => {
  try {
    const { departure, return: returnData } = req.body;
    console.log("validateAgentRoundTripDiscount:start", {
      hasDeparture: Boolean(departure),
      hasReturn: Boolean(returnData),
    });

    if (departure) {
      console.log("validateAgentRoundTripDiscount:departure:resolving", {
        agentId: departure.agent_id || null,
        scheduleId: departure.schedule_id || null,
        discountCode: departure.discount_code || null,
      });
      const departureDiscount = await resolveDiscountForPayload({
        payload: departure,
        bookingType: "round_trip",
        direction: "departure",
        bookingDate: departure.booking_date,
      });
      if (departureDiscount) {
        req.departureDiscount = departureDiscount;
      }
      console.log("validateAgentRoundTripDiscount:departure:resolved", {
        appliedCode: departure.discount_code || null,
        discountId: departureDiscount?.id || null,
      });
    }

    if (returnData) {
      console.log("validateAgentRoundTripDiscount:return:resolving", {
        agentId: returnData.agent_id || null,
        scheduleId: returnData.schedule_id || null,
        discountCode: returnData.discount_code || null,
      });
      const returnDiscount = await resolveDiscountForPayload({
        payload: returnData,
        bookingType: "round_trip",
        direction: "return",
        bookingDate: returnData.booking_date,
      });
      if (returnDiscount) {
        req.returnDiscount = returnDiscount;
      }
      console.log("validateAgentRoundTripDiscount:return:resolved", {
        appliedCode: returnData.discount_code || null,
        discountId: returnDiscount?.id || null,
      });
    }

    console.log("validateAgentRoundTripDiscount:done", {
      hasDepartureDiscount: Boolean(req.departureDiscount),
      hasReturnDiscount: Boolean(req.returnDiscount),
    });
    next();
  } catch (error) {
    console.error("Error validating round-trip discounts:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while validating discounts",
      error: error.message,
    });
  }
};

module.exports = {
  validateAgentDiscount,
  validateAgentRoundTripDiscount,
};
