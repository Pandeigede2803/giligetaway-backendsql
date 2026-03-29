const {
  Booking,
  Discount,
  Schedule,
  SubSchedule,
  TransportBooking,
  Agent,
} = require("../models");
const { Transaction } = require("sequelize");
const { calculateAgentCommissionAmount } = require("./updateAgentComission");
const AgentCommission = require("../models/AgentComission");

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

const getSeasonPrice = (date, lowSeasonPrice, highSeasonPrice, peakSeasonPrice) => {
  const month = new Date(date).getMonth() + 1;
  const lowSeasonMonths = process.env.LOW_SEASON_MONTHS.split(",").map(Number);
  const highSeasonMonths = process.env.HIGH_SEASON_MONTHS.split(",").map(Number);
  const peakSeasonMonths = process.env.PEAK_SEASON_MONTHS.split(",").map(Number);

  if (lowSeasonMonths.includes(month)) {
    return lowSeasonPrice || "N/A";
  }

  if (highSeasonMonths.includes(month)) {
    return highSeasonPrice || "N/A";
  }

  if (peakSeasonMonths.includes(month)) {
    return peakSeasonPrice || "N/A";
  }

  return "N/A";
};

const calculateTicketTotalFromLoadedSchedule = ({
  scheduleData,
  bookingDate,
  adultPassengers,
  childPassengers,
  infantPassengers,
}) => {

  if (!scheduleData) {
    throw new Error("Schedule association is required for total sync");
  }

  const pricePerPassenger = getSeasonPrice(
    bookingDate,
    scheduleData.low_season_price,
    scheduleData.high_season_price,
    scheduleData.peak_season_price
  );

  if (pricePerPassenger === "N/A" || !pricePerPassenger) {
    throw new Error("No valid price available for the selected date");
  }

  const totalPassengers =
    toNumber(adultPassengers) +
    toNumber(childPassengers) +
    toNumber(infantPassengers);

  return {
    ticketTotal: parseFloat((Number(pricePerPassenger) * totalPassengers).toFixed(2)),
    totalPassengers,
    pricePerPassenger: Number(pricePerPassenger),
  };
};

const resolveScheduleData = async ({ booking, overrides, transaction }) => {
  const effectiveScheduleId = toNumber(
    overrides.schedule_id ?? booking.schedule_id
  );
  const effectiveSubscheduleId =
    overrides.subschedule_id !== undefined
      ? overrides.subschedule_id === null || overrides.subschedule_id === ""
        ? null
        : toNumber(overrides.subschedule_id)
      : booking.subschedule_id;

  if (effectiveSubscheduleId) {
    if (
      booking.subSchedule &&
      toNumber(booking.subSchedule.id) === effectiveSubscheduleId
    ) {
      return {
        scheduleData: booking.subSchedule,
        effectiveScheduleId,
        effectiveSubscheduleId,
      };
    }

    const subSchedule = await SubSchedule.findByPk(effectiveSubscheduleId, {
      transaction,
    });

    if (!subSchedule) {
      throw new Error(`SubSchedule with ID ${effectiveSubscheduleId} not found`);
    }

    return {
      scheduleData: subSchedule,
      effectiveScheduleId,
      effectiveSubscheduleId,
    };
  }

  if (booking.schedule && toNumber(booking.schedule.id) === effectiveScheduleId) {
    return {
      scheduleData: booking.schedule,
      effectiveScheduleId,
      effectiveSubscheduleId: null,
    };
  }

  const schedule = await Schedule.findByPk(effectiveScheduleId, {
    transaction,
  });

  if (!schedule) {
    throw new Error(`Schedule with ID ${effectiveScheduleId} not found`);
  }

  return {
    scheduleData: schedule,
    effectiveScheduleId,
    effectiveSubscheduleId: null,
  };
};

const resolveDiscountSource = async (discountData, transaction) => {
  if (!discountData || typeof discountData !== "object") {
    return null;
  }

  if (discountData.discount_type && discountData.discount_value != null) {
    return {
      discount_type: discountData.discount_type,
      discount_value: discountData.discount_value,
      max_discount: discountData.max_discount ?? 0,
      min_purchase: discountData.min_purchase ?? 0,
      source: "stored_payload",
    };
  }

  if (discountData.discountId) {
    const discount = await Discount.findByPk(Number(discountData.discountId), {
      transaction,
    });
    if (discount) {
      return {
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        max_discount: discount.max_discount ?? 0,
        min_purchase: discount.min_purchase ?? 0,
        source: "discount_id",
      };
    }
  }

  const discountCode =
    discountData.discountCode || discountData.code || discountData.discount_code;
  if (discountCode) {
    const discount = await Discount.findOne({
      where: { code: discountCode },
      transaction,
    });
    if (discount) {
      return {
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        max_discount: discount.max_discount ?? 0,
        min_purchase: discount.min_purchase ?? 0,
        source: "discount_code",
      };
    }
  }

  if (
    discountData.discountPercentage != null ||
    discountData.discountValue != null
  ) {
    const discountType =
      Number.parseFloat(discountData.discountPercentage) > 0
        ? "percentage"
        : "fixed";
    const discountValue =
      discountType === "percentage"
        ? discountData.discountPercentage
        : discountData.discountValue;

    return {
      discount_type: discountType,
      discount_value: discountValue,
      max_discount: discountData.max_discount ?? 0,
      min_purchase: discountData.min_purchase ?? 0,
      source: "stored_percentage",
    };
  }

  return null;
};

const calculateDiscountAmount = (discount, ticketTotal) => {
  if (!discount) return 0;

  const discountValue = toNumber(discount.discount_value);
  const minPurchase = toNumber(discount.min_purchase);
  const maxDiscount = toNumber(discount.max_discount);

  if (discountValue <= 0 || ticketTotal <= 0) return 0;
  if (minPurchase > 0 && ticketTotal < minPurchase) return 0;

  let discountAmount = 0;
  if (discount.discount_type === "percentage") {
    discountAmount = (ticketTotal * discountValue) / 100;
  } else if (discount.discount_type === "fixed") {
    discountAmount = discountValue;
  } else {
    return 0;
  }

  if (maxDiscount > 0 && discountAmount > maxDiscount) {
    discountAmount = maxDiscount;
  }

  if (discountAmount > ticketTotal) {
    discountAmount = ticketTotal;
  }

  return parseFloat(discountAmount.toFixed(2));
};

const resolveGrossTotalInUsd = ({ booking, grossTotal }) => {
  const currency = booking.currency || "IDR";
  if (currency === "USD") {
    return parseFloat(grossTotal.toFixed(2));
  }

  const exchangeRate = toNumber(booking.exchange_rate);
  if (exchangeRate > 0) {
    return parseFloat((grossTotal / exchangeRate).toFixed(2));
  }

  const oldGrossTotal = toNumber(booking.gross_total);
  const oldGrossTotalUsd = toNumber(booking.gross_total_in_usd);
  if (oldGrossTotal > 0 && oldGrossTotalUsd > 0) {
    const ratio = oldGrossTotalUsd / oldGrossTotal;
    return parseFloat((grossTotal * ratio).toFixed(2));
  }

  return booking.gross_total_in_usd ?? null;
};

const buildBookingTotalsSnapshot = async ({
  bookingId,
  transaction,
  persist = true,
  overrides = {},
}) => {
  console.log(
    `[syncBookingTotals] START bookingId=${bookingId} persist=${persist ? "true" : "false"}`
  );
  const booking = await Booking.findByPk(bookingId, {
    include: [
      { model: TransportBooking, as: "transportBookings" },
      { model: Agent, as: "Agent" },
      { model: Schedule, as: "schedule" },
      { model: SubSchedule, as: "subSchedule" },
    ],
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  console.log("[syncBookingTotals] booking loaded", {
    bookingId: booking.id,
    ticket_id: booking.ticket_id,
    schedule_id: booking.schedule_id,
    subschedule_id: booking.subschedule_id,
    booking_date: normalizeDateOnly(booking.booking_date),
    agent_id: booking.agent_id,
    transport_count: (booking.transportBookings || []).length,
    has_discount_data: !!booking.discount_data,
  });

  const previousTicketTotal = toNumber(booking.ticket_total);
  const previousGrossTotal = toNumber(booking.gross_total);
  const previousBankFee = Math.max(0, toNumber(booking.bank_fee));
  const previousGrossTotalUsd =
    booking.gross_total_in_usd != null
      ? toNumber(booking.gross_total_in_usd)
      : null;

  console.log("[syncBookingTotals] previous totals", {
    previousTicketTotal,
    previousGrossTotal,
    previousBankFee,
    previousGrossTotalUsd,
  });

  const effectiveBookingDate = normalizeDateOnly(
    overrides.booking_date ?? booking.booking_date
  );
  const effectiveAdultPassengers =
    overrides.adult_passengers ?? booking.adult_passengers;
  const effectiveChildPassengers =
    overrides.child_passengers ?? booking.child_passengers;
  const effectiveInfantPassengers =
    overrides.infant_passengers ?? booking.infant_passengers;

  console.log("[syncBookingTotals] effective inputs", {
    effectiveBookingDate,
    effectiveAdultPassengers,
    effectiveChildPassengers,
    effectiveInfantPassengers,
    overrideKeys: Object.keys(overrides || {}),
  });

  const { scheduleData, effectiveScheduleId, effectiveSubscheduleId } =
    await resolveScheduleData({
      booking,
      overrides,
      transaction,
    });

  console.log("[syncBookingTotals] schedule resolved", {
    effectiveScheduleId,
    effectiveSubscheduleId,
    trip_type: scheduleData.trip_type,
    schedule_source: scheduleData === booking.schedule ? "loaded_schedule" : scheduleData === booking.subSchedule ? "loaded_subschedule" : "resolved_query",
  });

  const ticketCalculation = calculateTicketTotalFromLoadedSchedule({
    scheduleData,
    bookingDate: effectiveBookingDate,
    adultPassengers: effectiveAdultPassengers,
    childPassengers: effectiveChildPassengers,
    infantPassengers: effectiveInfantPassengers,
  });
  const ticketTotal = toNumber(ticketCalculation.ticketTotal);

  const effectiveTransports =
    Array.isArray(overrides.transports) && overrides.transports.length > 0
      ? overrides.transports
      : booking.transportBookings || [];

  const transportTotal = effectiveTransports.reduce(
    (sum, transportBooking) => sum + toNumber(transportBooking.transport_price),
    0
  );

  console.log("[syncBookingTotals] ticket calculation", {
    pricePerPassenger: ticketCalculation.pricePerPassenger,
    totalPassengers: ticketCalculation.totalPassengers,
    ticketTotal,
    transportTotal,
  });

  const discountDataInput =
    overrides.discount_data !== undefined
      ? overrides.discount_data
      : overrides.discount_code
        ? { discountCode: overrides.discount_code }
        : booking.discount_data;

  const discountSource = await resolveDiscountSource(
    discountDataInput,
    transaction
  );
  const discountAmount = calculateDiscountAmount(discountSource, ticketTotal);

  console.log("[syncBookingTotals] discount resolution", {
    discountSource,
    discountAmount,
  });

  const grossTotal = parseFloat(
    (ticketTotal + transportTotal - discountAmount + previousBankFee).toFixed(2)
  );

  const grossTotalInUsd = resolveGrossTotalInUsd({
    booking,
    grossTotal,
  });

  console.log("[syncBookingTotals] gross total calculated", {
    grossTotal,
    grossTotalInUsd,
  });

  let commissionAmount = 0;
  let commissionAction = "skipped";

  if (booking.agent_id) {
    const agent =
      booking.Agent || (await Agent.findByPk(booking.agent_id, { transaction }));

    if (agent && scheduleData.trip_type) {
      commissionAmount = calculateAgentCommissionAmount({
        agent,
        tripType: scheduleData.trip_type,
        grossTotal,
        totalPassengers: ticketCalculation.totalPassengers,
        transportBookings: effectiveTransports,
      });

      console.log("[syncBookingTotals] commission calculated", {
        agent_id: booking.agent_id,
        tripType: scheduleData.trip_type,
        commissionAmount,
      });

      if (persist) {
        const existingCommission = await AgentCommission.findOne({
          where: { booking_id: booking.id, agent_id: booking.agent_id },
          transaction,
          lock: Transaction.LOCK.UPDATE,
        });

        if (existingCommission) {
          await existingCommission.update(
            { amount: commissionAmount },
            { transaction }
          );
          commissionAction = "updated";
        } else {
          await AgentCommission.create(
            {
              booking_id: booking.id,
              agent_id: booking.agent_id,
              amount: commissionAmount,
            },
            { transaction }
          );
          commissionAction = "created";
        }
      } else {
        commissionAction = "preview_only";
      }
    } else {
      commissionAction = "skipped_missing_trip_type";
      console.log("[syncBookingTotals] commission skipped", {
        bookingId: booking.id,
        agent_id: booking.agent_id,
        tripType: scheduleData.trip_type,
      });
    }
  }

  const updatedDiscountData = discountSource
    ? {
        ...(booking.discount_data || {}),
        discount_amount: discountAmount,
        discountAmount,
        discount_type: discountSource.discount_type,
        discount_value: toNumber(discountSource.discount_value),
        discount_source: discountSource.source,
      }
    : booking.discount_data;

  if (persist) {
    await booking.update(
      {
        ticket_total: ticketTotal,
        gross_total: grossTotal,
        gross_total_in_usd: grossTotalInUsd,
        bank_fee: previousBankFee,
        discount_data: updatedDiscountData,
      },
      { transaction }
    );

    console.log("[syncBookingTotals] booking updated", {
      bookingId: booking.id,
      ticket_total: ticketTotal,
      gross_total: grossTotal,
      gross_total_in_usd: grossTotalInUsd,
      bank_fee: previousBankFee,
      discount_amount: discountAmount,
      commission_amount: commissionAmount,
      commission_action: commissionAction,
    });
  } else {
    console.log("[syncBookingTotals] preview result computed, no DB write", {
      bookingId: booking.id,
      ticket_total: ticketTotal,
      gross_total: grossTotal,
      gross_total_in_usd: grossTotalInUsd,
      bank_fee: previousBankFee,
      discount_amount: discountAmount,
      commission_amount: commissionAmount,
      commission_action: commissionAction,
    });
  }

  const result = {
    booking_id: booking.id,
    ticket_id: booking.ticket_id,
    schedule_id: booking.schedule_id,
    subschedule_id: booking.subschedule_id,
    booking_date: normalizeDateOnly(booking.booking_date),
    previous: {
      ticket_total: previousTicketTotal,
      gross_total: previousGrossTotal,
      gross_total_in_usd: previousGrossTotalUsd,
      bank_fee: previousBankFee,
    },
    current: {
      ticket_total: ticketTotal,
      transport_total: transportTotal,
      discount_amount: discountAmount,
      gross_total: grossTotal,
      gross_total_in_usd: grossTotalInUsd,
      bank_fee: previousBankFee,
      net_total: parseFloat((grossTotal - commissionAmount).toFixed(2)),
    },
    commission: {
      amount: commissionAmount,
      action: commissionAction,
    },
    preview: !persist,
    effective: {
      schedule_id: effectiveScheduleId,
      subschedule_id: effectiveSubscheduleId,
      booking_date: effectiveBookingDate,
      adult_passengers: effectiveAdultPassengers,
      child_passengers: effectiveChildPassengers,
      infant_passengers: effectiveInfantPassengers,
      transport_count: effectiveTransports.length,
    },
  };

  console.log("[syncBookingTotals] DONE", result);

  return result;
};

const syncBookingTotalsForBooking = async (params) => {
  return buildBookingTotalsSnapshot({
    ...params,
    persist: true,
  });
};

const previewBookingTotalsForBooking = async (params) => {
  return buildBookingTotalsSnapshot({
    ...params,
    persist: false,
  });
};

module.exports = {
  syncBookingTotalsForBooking,
  previewBookingTotalsForBooking,
};
