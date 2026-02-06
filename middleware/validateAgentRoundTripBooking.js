// middleware/validateAgentRoundTripBooking.js
const { Agent, Schedule, SubSchedule } = require("../models");

/**
 * Validates round trip booking data for agents
 * Expected structure:
 * {
 *   agent_id: number,
 *   departure: { schedule_id, passengers, transports, etc. },
 *   return: { schedule_id, passengers, transports, etc. }
 * }
 */
module.exports = async (req, res, next) => {
  try {
    const { agent_id, departure, return: returnData } = req.body;

    // console.log("🔍 Validating agent round trip booking data");
    // console.log(`🎁Request body: ${JSON.stringify(req.body)}`);

    // ============================================
    // 1. Validate top-level structure
    // ============================================
    if (!departure || typeof departure !== "object") {
      return res.status(400).json({
        error: "Missing departure data",
        message: "departure object is required",
      });
    }

    if (!returnData || typeof returnData !== "object") {
      return res.status(400).json({
        error: "Missing return data",
        message: "return object is required",
      });
    }

    // ============================================
    // 2. Validate agent_id (if provided)
    // ============================================
    if (agent_id) {
      const parsedAgentId = parseInt(agent_id);
      if (isNaN(parsedAgentId)) {
        return res.status(400).json({
          error: "Invalid agent_id",
          message: "agent_id must be a valid number",
        });
      }

      const agent = await Agent.findByPk(parsedAgentId);
      if (!agent) {
        return res.status(404).json({
          error: "Agent not found",
          message: `No agent found with ID ${parsedAgentId}`,
        });
      }
      // console.log(`✅ Agent validated: ${agent.name}`);

      // Attach validated agent_id to both legs
      req.body.departure.agent_id = parsedAgentId;
      req.body.return.agent_id = parsedAgentId;
    }

    // ============================================
    // 3. Validate each leg (departure & return)
    // ============================================
    const validateLeg = async (legData, legName) => {
      // console.log(`🔍 Validating ${legName} leg`);

      // 3.1 Validate schedule_id
      const scheduleId = parseInt(legData.schedule_id?.value || legData.schedule_id);
      if (!scheduleId || isNaN(scheduleId)) {
        return {
          error: `Invalid ${legName} schedule_id`,
          message: `${legName} schedule_id must be a valid number`,
        };
      }
      legData.schedule_id = scheduleId;

      const schedule = await Schedule.findByPk(scheduleId);
      if (!schedule) {
        return {
          error: `${legName} schedule not found`,
          message: `No schedule found with ID ${scheduleId}`,
        };
      }
      // console.log(`✅ ${legName} schedule found: ${schedule.id}`);

      // 3.2 Validate subschedule_id (if provided)
      // Clean up subschedule_id: handle "", "N/A", null, undefined → remove field
      const rawSubScheduleId = legData.subschedule_id?.value || legData.subschedule_id;
      if (!rawSubScheduleId || rawSubScheduleId === "" || rawSubScheduleId === "N/A") {
        delete legData.subschedule_id;
        // console.log(`✅ ${legName} subschedule_id is optional, field removed`);
      } else {
        const subScheduleId = parseInt(rawSubScheduleId);
        if (isNaN(subScheduleId)) {
          return {
            error: `Invalid ${legName} subschedule_id`,
            message: `${legName} subschedule_id must be a valid number`,
          };
        }
        legData.subschedule_id = subScheduleId;

        const subSchedule = await SubSchedule.findByPk(subScheduleId);
        if (!subSchedule) {
          return {
            error: `${legName} subschedule not found`,
            message: `No subschedule found with ID ${subScheduleId}`,
          };
        }

        // Ensure subschedule belongs to the schedule
        if (subSchedule.schedule_id !== scheduleId) {
          return {
            error: `${legName} subschedule mismatch`,
            message: `SubSchedule ID ${subScheduleId} does not belong to Schedule ID ${scheduleId}`,
          };
        }
        // console.log(`✅ ${legName} subschedule found: ${subSchedule.id}`);
      }

      // 3.3 Validate booking_date
      if (!legData.booking_date) {
        return {
          error: `Missing ${legName} booking_date`,
          message: `${legName} booking_date is required`,
        };
      }

      const bookingDate = new Date(legData.booking_date);
      if (isNaN(bookingDate.getTime())) {
        return {
          error: `Invalid ${legName} booking_date`,
          message: `${legName} booking_date must be a valid date`,
        };
      }

      // 3.4 Validate passenger counts
      const adultPassengers = parseInt(legData.adult_passengers) || 0;
      const childPassengers = parseInt(legData.child_passengers) || 0;
      const infantPassengers = parseInt(legData.infant_passengers) || 0;
      const totalPassengers = parseInt(legData.total_passengers);

      if (isNaN(totalPassengers) || totalPassengers <= 0) {
        return {
          error: `Invalid ${legName} total_passengers`,
          message: `${legName} total_passengers must be a positive number`,
        };
      }

      const calculatedTotal = adultPassengers + childPassengers + infantPassengers;
      if (calculatedTotal !== totalPassengers) {
        return {
          error: `${legName} passenger count mismatch`,
          message: `${legName} total_passengers mismatch: expected ${totalPassengers}, got ${calculatedTotal}`,
        };
      }

      legData.adult_passengers = adultPassengers;
      legData.child_passengers = childPassengers;
      legData.infant_passengers = infantPassengers;
      legData.total_passengers = totalPassengers;

      // console.log(
      //   `✅ ${legName} passengers validated: ${totalPassengers} total (${adultPassengers}A, ${childPassengers}C, ${infantPassengers}I)`
      // );

      // 3.5 Validate contact information
      const requiredContactFields = [
        "contact_name",
        "contact_phone",
        "contact_email",
      ];

      for (const field of requiredContactFields) {
        if (!legData[field] || String(legData[field]).trim() === "") {
          return {
            error: `Missing ${legName} ${field}`,
            message: `${legName} ${field} is required`,
          };
        }
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(legData.contact_email)) {
        return {
          error: `Invalid ${legName} email`,
          message: `${legName} contact_email must be a valid email address`,
        };
      }

      // 3.6 Validate passengers array
      if (!Array.isArray(legData.passengers) || legData.passengers.length === 0) {
        return {
          error: `Missing ${legName} passengers`,
          message: `${legName} passengers array is required and must not be empty`,
        };
      }

      if (legData.passengers.length !== totalPassengers) {
        return {
          error: `${legName} passenger array mismatch`,
          message: `${legName} passengers array length (${legData.passengers.length}) does not match total_passengers (${totalPassengers})`,
        };
      }

      // Validate each passenger and count by type
      let adultCount = 0, childCount = 0, infantCount = 0;
      const validPassengerTypes = ['adult', 'child', 'infant'];

      for (let i = 0; i < legData.passengers.length; i++) {
        const passenger = legData.passengers[i];

        // Validate name
        if (!passenger.name || String(passenger.name).trim() === "") {
          return {
            error: `Invalid ${legName} passenger name`,
            message: `${legName} passenger[${i}] must have a valid name`,
          };
        }

        // Validate nationality
        if (!passenger.nationality || String(passenger.nationality).trim() === "") {
          return {
            error: `Invalid ${legName} passenger nationality`,
            message: `${legName} passenger[${i}] must have a valid nationality`,
          };
        }

        // Validate passport_id
        if (!passenger.passport_id || String(passenger.passport_id).trim() === "") {
          return {
            error: `Invalid ${legName} passenger passport_id`,
            message: `${legName} passenger[${i}] must have a valid passport_id`,
          };
        }

        // Validate passenger_type
        if (!passenger.passenger_type || !validPassengerTypes.includes(passenger.passenger_type)) {
          return {
            error: `Invalid ${legName} passenger_type`,
            message: `${legName} passenger[${i}] must have passenger_type: adult, child, or infant`,
          };
        }

        // Count passengers by type
        if (passenger.passenger_type === 'adult') adultCount++;
        else if (passenger.passenger_type === 'child') childCount++;
        else if (passenger.passenger_type === 'infant') infantCount++;
      }

      // Validate passenger counts match the breakdown
      if (adultCount !== adultPassengers) {
        return {
          error: `${legName} adult passengers mismatch`,
          message: `Expected ${adultPassengers} adults, but got ${adultCount} in passengers array`,
        };
      }

      if (childCount !== childPassengers) {
        return {
          error: `${legName} child passengers mismatch`,
          message: `Expected ${childPassengers} children, but got ${childCount} in passengers array`,
        };
      }

      if (infantCount !== infantPassengers) {
        return {
          error: `${legName} infant passengers mismatch`,
          message: `Expected ${infantPassengers} infants, but got ${infantCount} in passengers array`,
        };
      }

      // console.log(`✅ ${legName} passengers array validated: ${legData.passengers.length} passengers`);

      // 3.7 Validate transports (if provided)
      if (Array.isArray(legData.transports)) {
        for (let i = 0; i < legData.transports.length; i++) {
          const transport = legData.transports[i];

          const transportId = parseInt(transport.transport_id);
          if (isNaN(transportId)) {
            return {
              error: `Invalid ${legName} transport`,
              message: `${legName} transport[${i}].transport_id must be a valid number`,
            };
          }
          transport.transport_id = transportId;

          const transportPrice = parseFloat(transport.transport_price);
          if (isNaN(transportPrice) || transportPrice < 0) {
            return {
              error: `Invalid ${legName} transport price`,
              message: `${legName} transport[${i}].transport_price must be a valid non-negative number`,
            };
          }
          transport.transport_price = transportPrice;

          const quantity = parseInt(transport.quantity) || 1;
          transport.quantity = quantity;
        }
        // console.log(`✅ ${legName} transports validated: ${legData.transports.length} items`);
      }

      // 3.8 Validate currency
      if (legData.currency && typeof legData.currency !== "string") {
        return {
          error: `Invalid ${legName} currency`,
          message: `${legName} currency must be a string (e.g., 'IDR', 'USD')`,
        };
      }

      // 3.9 Validate ticket_id (if provided - for updates)
      if (legData.ticket_id && typeof legData.ticket_id !== "string") {
        return {
          error: `Invalid ${legName} ticket_id`,
          message: `${legName} ticket_id must be a string`,
        };
      }

      // console.log(`✅ ${legName} leg validation completed`);
      return null; // No error
    };

    // Validate departure leg
    const departureError = await validateLeg(departure, "departure");
    if (departureError) {
      return res.status(400).json(departureError);
    }

    // Validate return leg
    const returnError = await validateLeg(returnData, "return");
    if (returnError) {
      return res.status(400).json(returnError);
    }

    // ============================================
    // 4. Cross-validation (optional business rules)
    // ============================================

    // 4.1 Validate return date is after departure date (optional)
    const departureDate = new Date(departure.booking_date);
    const returnDate = new Date(returnData.booking_date);

    if (returnDate < departureDate) {
      console.warn(
        `⚠️ Warning: Return date (${returnData.booking_date}) is before departure date (${departure.booking_date})`
      );
      // Uncomment to enforce:
      // return res.status(400).json({
      //   error: "Invalid booking dates",
      //   message: "Return date must be after departure date",
      // });
    }

    // 4.2 Validate same currency for both legs (optional)
    if (departure.currency && returnData.currency && departure.currency !== returnData.currency) {
      console.warn(
        `⚠️ Warning: Different currencies - departure: ${departure.currency}, return: ${returnData.currency}`
      );
    }

    // ============================================
    // 5. All validations passed
    // ============================================
    console.log("✅ Agent round trip booking validation passed");
    next();
  } catch (error) {
    console.error("❌ Agent round trip booking validation error:", error.message);
    return res.status(500).json({
      error: "Validation internal error",
      message: error.message,
    });
  }
};
