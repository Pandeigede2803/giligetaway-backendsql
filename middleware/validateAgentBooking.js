// middlewares/validateAgentBooking.js
const { Agent, Schedule, SubSchedule } = require("../models");

module.exports = async (req, res, next) => {
  try {
    const data = req.body;
    console.log("🔍 Validating agent round booking data:", data);
    console.log("start validation")

    // 🔹 1. Pastikan schedule_id dan subschedule_id valid numerik
    data.schedule_id = parseInt(data.schedule_id?.value || data.schedule_id);
    data.subschedule_id = parseInt(data.subschedule_id?.value || data.subschedule_id);

    if (!data.schedule_id || isNaN(data.schedule_id)) {
      return res.status(400).json({
        error: "Invalid schedule_id",
        message: "Schedule ID must be a valid number.",
      });
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

    if (data.subschedule_id) {
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

    // 🔹 5. Validasi data transports (kalau ada)
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

    // 🔹 6. Semua validasi lolos, lanjut ke controller
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