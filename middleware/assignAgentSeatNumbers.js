const { SeatAvailability } = require("../models");
const { getBookedSeatsOptimized } = require("../util/querySchedulesHelper");
const { normalizeSeat } = require("../util/autoAssignSeats");

const passengerNeedsSeat = (passenger = {}) =>
  (passenger.passenger_type || "").toLowerCase() !== "infant";

const detectSeatIssues = (passengers = [], seatField = "seat_number") => {
  const missing = [];
  const duplicates = [];
  const seen = new Map();

  passengers.forEach((passenger, index) => {
    if (!passengerNeedsSeat(passenger)) return;

    const rawSeat = passenger[seatField];
    const normalized = normalizeSeat(rawSeat);

    if (!normalized) {
      missing.push({ index, passenger: passenger.name || `#${index + 1}` });
      return;
    }

    if (seen.has(normalized)) {
      const firstIndex = seen.get(normalized);
      duplicates.push({ seat: normalized, passengers: [firstIndex, index] });
    } else {
      seen.set(normalized, index);
    }
  });

  return { missing, duplicates, normalizedMap: seen };
};

const detectExistingSeatConflicts = async ({
  scheduleId,
  subscheduleId,
  travelDate,
  normalizedSeats,
}) => {
  if (!scheduleId || !travelDate || !normalizedSeats?.size) return [];

  const seatAvailabilities = await SeatAvailability.findAll({
    where: {
      schedule_id: scheduleId,
      subschedule_id: subscheduleId ?? null,
      date: travelDate,
    },
    attributes: ["id"],
  });

  if (!seatAvailabilities.length) return [];

  const seatAvailabilityIds = seatAvailabilities.map((sa) => sa.id);
  const bookedMap = await getBookedSeatsOptimized(seatAvailabilityIds);

  const conflicts = [];
  for (const seatList of Object.values(bookedMap)) {
    for (const seat of seatList) {
      const normalized = normalizeSeat(seat);
      if (normalized && normalizedSeats.has(normalized)) {
        conflicts.push({ seat: normalized });
      }
    }
  }

  return conflicts;
};

const buildSeatContext = (passengers, seatField) =>
  passengers
    .filter(passengerNeedsSeat)
    .map((p) => p[seatField])
    .filter(Boolean)
    .map((seat) => normalizeSeat(seat))
    .filter(Boolean);

const shouldAutoAssign = (issues) =>
  issues.missing.length > 0 ||
  issues.duplicates.length > 0 ||
  issues.conflicts.length > 0;

const assignAgentSeatNumbers = async (req, res, next) => {
  try {
    const passengers = Array.isArray(req.body.passengers)
      ? req.body.passengers
      : [];
    const scheduleId = req.body.schedule_id;
    const subscheduleId =
      req.body.subschedule_id === undefined || req.body.subschedule_id === ""
        ? null
        : req.body.subschedule_id;
    const travelDate = req.body.departure_date || req.body.booking_date;

    const issues = detectSeatIssues(passengers, "seat_number");

    if (scheduleId && travelDate) {
      const normalized = new Set(issues.normalizedMap.keys());
      const conflicts = await detectExistingSeatConflicts({
        scheduleId,
        subscheduleId,
        travelDate,
        normalizedSeats: normalized,
      });
      issues.conflicts = conflicts;
    } else {
      issues.conflicts = [];
    }
    delete issues.normalizedMap;

    if (shouldAutoAssign(issues)) {
      console.log("🪑 Auto-seat (one-way) issues detected:", {
        totalPassengers: passengers.length,
        missingSeatCount: issues.missing.length,
        duplicateSeatCount: issues.duplicates.length,
        conflictSeatCount: issues.conflicts.length,
      });
    }

    req.autoAssignSeat = {
      required: shouldAutoAssign(issues),
      issues,
    };

    next();
  } catch (error) {
    console.error("❌ Error detecting auto-seat issues (one-way):", error);
    next(error);
  }
};

const assignAgentRoundTripSeatNumbers = async (req, res, next) => {
  try {
    const { departure, return: returnData } = req.body;

    if (departure?.passengers) {
      const departureSeatSnapshot = departure.passengers.map((passenger, index) => ({
        passenger: passenger.name || `#${index + 1}`,
        seat: passenger.seat_number_departure ?? null,
      }));
      console.log("🪑 Round-trip departure seats (raw request)", departureSeatSnapshot);
      const depIssues = detectSeatIssues(
        departure.passengers,
        "seat_number_departure"
      );
      const scheduleId = departure.schedule_id;
      const subscheduleId =
        departure.subschedule_id === undefined ||
        departure.subschedule_id === ""
          ? null
          : departure.subschedule_id;
      const travelDate = departure.booking_date;

      if (scheduleId && travelDate) {
        const normalized = new Set(depIssues.normalizedMap.keys());
        depIssues.conflicts = await detectExistingSeatConflicts({
          scheduleId,
          subscheduleId,
          travelDate,
          normalizedSeats: normalized,
        });
      } else {
        depIssues.conflicts = [];
      }
      delete depIssues.normalizedMap;

      if (shouldAutoAssign(depIssues)) {
        console.log("🪑 Auto-seat (round-trip departure) issues detected:", {
          totalPassengers: departure.passengers.length,
          missingSeatCount: depIssues.missing.length,
          duplicateSeatCount: depIssues.duplicates.length,
          conflictSeatCount: depIssues.conflicts.length,
        });
      }

      req.departureAutoAssignSeat = {
        required: shouldAutoAssign(depIssues),
        issues: depIssues,
      };
    }

    if (returnData?.passengers) {
      const returnSeatSnapshot = returnData.passengers.map((passenger, index) => ({
        passenger: passenger.name || `#${index + 1}`,
        seat: passenger.seat_number_return ?? null,
      }));
      console.log("🪑 Round-trip return seats (raw request)", returnSeatSnapshot);
      const retIssues = detectSeatIssues(returnData.passengers, "seat_number_return");
      const scheduleId = returnData.schedule_id;
      const subscheduleId =
        returnData.subschedule_id === undefined || returnData.subschedule_id === ""
          ? null
          : returnData.subschedule_id;
      const travelDate = returnData.booking_date;

      if (scheduleId && travelDate) {
        const normalized = new Set(retIssues.normalizedMap.keys());
        retIssues.conflicts = await detectExistingSeatConflicts({
          scheduleId,
          subscheduleId,
          travelDate,
          normalizedSeats: normalized,
        });
      } else {
        retIssues.conflicts = [];
      }
      delete retIssues.normalizedMap;

      if (shouldAutoAssign(retIssues)) {
        console.log("🪑 Auto-seat (round-trip return) issues detected:", {
          totalPassengers: returnData.passengers.length,
          missingSeatCount: retIssues.missing.length,
          duplicateSeatCount: retIssues.duplicates.length,
          conflictSeatCount: retIssues.conflicts.length,
        });
      }

      req.returnAutoAssignSeat = {
        required: shouldAutoAssign(retIssues),
        issues: retIssues,
      };
    }

    next();
  } catch (error) {
    console.error("❌ Error detecting auto-seat issues (round-trip):", error);
    next(error);
  }
};

module.exports = {
  assignAgentSeatNumbers,
  assignAgentRoundTripSeatNumbers,
};
