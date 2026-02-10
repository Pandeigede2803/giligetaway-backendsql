// middlewares/validateAgentBooking.js
const { Agent, Schedule, SubSchedule } = require("../models");

module.exports = async (req, res, next) => {
  try {
    const data = req.body;
    console.log("🔍 Validating agent round booking data:", data);
    console.log("start validation")

    // 🔹 1. Pastikan schedule_id dan subschedule_id valid numerik
    const rawScheduleId = data.schedule_id?.value ?? data.schedule_id;
    data.schedule_id = parseInt(rawScheduleId, 10);

    if (!data.schedule_id || isNaN(data.schedule_id)) {
      return res.status(400).json({
        error: "Invalid schedule_id",
        message: "Schedule ID must be a valid number.",
      });
    }

    const rawSubScheduleId = data.subschedule_id?.value ?? data.subschedule_id;

    if (
      rawSubScheduleId === undefined ||
      rawSubScheduleId === null ||
      rawSubScheduleId === "" ||
      rawSubScheduleId === "N/A"
    ) {
      delete data.subschedule_id;
    } else {
      const parsedSubScheduleId = parseInt(rawSubScheduleId, 10);
      if (isNaN(parsedSubScheduleId)) {
        return res.status(400).json({
          error: "Invalid subschedule_id",
          message: "SubSchedule ID must be a valid number.",
        });
      }
      data.subschedule_id = parsedSubScheduleId;
    }

    // 🔹 2. Validasi schedule dan subschedule ada di database
    const schedule = await Schedule.findByPk(data.schedule_id);
    if (!schedule) {
      return res.status(404).json({
        error: "Schedule not found",
        message: `No schedule found with ID ${data.schedule_id}`,
      });
    }
    console.log("Schedule found:", schedule.id);

    if (data.subschedule_id !== undefined && data.subschedule_id !== null) {
      const subSchedule = await SubSchedule.findByPk(data.subschedule_id);
      if (!subSchedule) {
        return res.status(404).json({
          error: "SubSchedule not found",
          message: `No subschedule found with ID ${data.subschedule_id}`,
        });
      }
        console.log("SubSchedule found:", subSchedule.id);
      // ✅ Tambahan: pastikan subschedule milik schedule yang sama
      if (subSchedule.schedule_id !== data.schedule_id) {
        return res.status(400).json({
          error: "SubSchedule mismatch",
          message: `SubSchedule ID ${data.subschedule_id} does not belong to Schedule ID ${data.schedule_id}.`,
        });
      }
    }

    // 🔹 3. Validasi agent_id (foreign key constraint)
    if (data.agent_id) {
      const agent = await Agent.findByPk(data.agent_id);
      if (!agent) {
        return res.status(404).json({
          error: "Agent not found",
          message: `No agent found with ID ${data.agent_id}`,
        });
      }
    }

    // 🔹 4. Validasi jumlah penumpang
    const totalPassengers =
      (parseInt(data.adult_passengers) || 0) +
      (parseInt(data.child_passengers) || 0) +
      (parseInt(data.infant_passengers) || 0);

    if (totalPassengers !== parseInt(data.total_passengers)) {
      return res.status(400).json({
        error: "Passenger count mismatch",
        message: `Total passengers mismatch: expected ${data.total_passengers}, got ${totalPassengers}`,
      });
    }

    // 🔹 5. Validasi passengers array
    if (!Array.isArray(data.passengers) || data.passengers.length === 0) {
      return res.status(400).json({
        error: "Passengers required",
        message: "Passengers array must not be empty",
      });
    }

    // Validasi jumlah passengers array harus sama dengan total_passengers
    if (data.passengers.length !== parseInt(data.total_passengers)) {
      return res.status(400).json({
        error: "Passengers count mismatch",
        message: `Passengers array length (${data.passengers.length}) must match total_passengers (${data.total_passengers})`,
      });
    }

    // Validasi setiap passenger
    let adultCount = 0, childCount = 0, infantCount = 0;
    for (let i = 0; i < data.passengers.length; i++) {
      const p = data.passengers[i];

      // Field wajib
      if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
        return res.status(400).json({
          error: "Invalid passenger name",
          message: `Passenger at index ${i} must have a valid name`,
        });
      }

      if (!p.nationality || typeof p.nationality !== 'string' || p.nationality.trim() === '') {
        return res.status(400).json({
          error: "Invalid passenger nationality",
          message: `Passenger at index ${i} must have a valid nationality`,
        });
      }

      if (!p.passport_id || typeof p.passport_id !== 'string' || p.passport_id.trim() === '') {
        return res.status(400).json({
          error: "Invalid passenger passport_id",
          message: `Passenger at index ${i} must have a valid passport_id`,
        });
      }

      // Validasi passenger_type
      const validTypes = ['adult', 'child', 'infant'];
      if (!p.passenger_type || !validTypes.includes(p.passenger_type)) {
        return res.status(400).json({
          error: "Invalid passenger_type",
          message: `Passenger at index ${i} must have passenger_type: adult, child, or infant`,
        });
      }

      // Hitung jumlah per tipe
      if (p.passenger_type === 'adult') adultCount++;
      else if (p.passenger_type === 'child') childCount++;
      else if (p.passenger_type === 'infant') infantCount++;
    }

    // Validasi jumlah per tipe passenger harus sesuai
    if (adultCount !== parseInt(data.adult_passengers)) {
      return res.status(400).json({
        error: "Adult passengers mismatch",
        message: `Expected ${data.adult_passengers} adults, but got ${adultCount} in passengers array`,
      });
    }

    if (childCount !== parseInt(data.child_passengers)) {
      return res.status(400).json({
        error: "Child passengers mismatch",
        message: `Expected ${data.child_passengers} children, but got ${childCount} in passengers array`,
      });
    }

    if (infantCount !== parseInt(data.infant_passengers)) {
      return res.status(400).json({
        error: "Infant passengers mismatch",
        message: `Expected ${data.infant_passengers} infants, but got ${infantCount} in passengers array`,
      });
    }

    // 🔹 6. Validasi data transports (kalau ada)
    if (Array.isArray(data.transports)) {
      for (const t of data.transports) {
        if (!t.transport_id || isNaN(parseInt(t.transport_id))) {
          return res.status(400).json({
            error: "Invalid transport_id",
            message: `Invalid transport entry detected: ${JSON.stringify(t)}`,
          });
        }
        if (t.transport_price == null || isNaN(parseFloat(t.transport_price))) {
          return res.status(400).json({
            error: "Invalid transport_price",
            message: `Each transport must have a valid price.`,
          });
        }
      }
    }

    // 🔹 7. Semua validasi lolos, lanjut ke controller
    console.log("✅ Agent booking validation passed");
    next();
  } catch (error) {
    console.error("❌ Agent booking validation error:", error.message);
    return res.status(500).json({
      error: "Validation internal error",
      message: error.message,
    });
  }
};
