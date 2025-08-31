// utils/seatCapacityAlert.js
const nodemailer = require("nodemailer");
const { Op } = require("sequelize");
const {
  SeatAvailability,
  Schedule,
  SubSchedule,
  Boat,
  Destination,
  Transit,
} = require("../models");
const { buildRouteFromScheduleFlatten } = require("../util/buildRoute");

// Helper: tentukan kapasitas efektif (boost → capacity, else published_capacity)
const getEffectiveCapacity = (sa, schedule) => {
  const boat = schedule?.Boat;
  if (!boat) return 0;
  return sa.boost
    ? Number(boat.capacity || 0)
    : Number(boat.published_capacity || 0);
};

// Helper: bikin string route (pakai util yang sudah ada)
const buildRouteName = (schedule, subSchedule) => {
  try {
    return buildRouteFromScheduleFlatten(schedule, subSchedule);
  } catch {
    const fromName =
      subSchedule?.DestinationFrom?.name ??
      schedule?.FromDestination?.name ??
      "From";
    const toName =
      subSchedule?.DestinationTo?.name ?? schedule?.ToDestination?.name ?? "To";
    return `${fromName} → ${toName}`;
  }
};

// Kirim email (SMTP Brevo sesuai environment project-mu)
const sendEmail = async ({ subject, html }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST_BREVO,
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_LOGIN_BREVO,
      pass: process.env.EMAIL_PASS_BREVO,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_BOOKING, // ✅ ganti di sini
    to: process.env.EMAIL_BOOKING, // ✅ ganti di sini
    cc: [
      "ooppssainy@gmail.com",
      "kadekgetaway@gmail.com",
      "booking@giligetaway.site",
    ],
    subject,
    html,
  });
};

// Format tanggal (YYYY-MM-DD → 18 August 2025)
const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// Build HTML table
const buildHtmlTable = (rows) => {
  const trs = rows
    .map(
      (r) => `
      <tr>
       <td style="padding:6px 8px;border:1px solid #e5e7eb;">${r.seat_id}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${r.schedule_id}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${r.subschedule_id ?? "-"}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${r.route}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${formatDate(r.date)}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${r.remaining_seats}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;">
    <p>Hello team,</p>
    <p>Below is the list of seats that are <b>approaching 90% full</b> (7 days ahead):</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead>
        <tr style="background:#f9fafb">
         <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Seat ID</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">S.ID</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Sub.S.ID</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Route</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Travel Date</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Remaining Seats</th>
        </tr>
      </thead>
      <tbody>${trs || `<tr><td colspan="6" style="padding:10px;border:1px solid #e5e7eb;">(No data)</td></tr>`}</tbody>
    </table>
    <p style="margin-top:12px;font-size:12px;color:#6b7280;">Auto-generated at ${new Date().toLocaleString("en-GB", { hour12: false })}</p>
  </div>`;
};;

/**
 * Cek seat aktif yang mendekati 90% terisi untuk rentang 7 hari ke depan.
 * - availability = true
 * - date: [today ... today+7]
 * - used/capacity >= 0.9  → remaining <= 10% capacity
 * Kirim email jika ada temuan.
 */
const performSeatCapacityCheckAndEmail = async ({
  daysAhead = 7,
  thresholdRatio = 0.9, // 90%
  //   recipients = (process.env.SEAT_ALERT_RECIPIENTS || "").split(",").filter(Boolean),
} = {}) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1); // ← mulai BESOK

  const until = new Date(start);
  until.setDate(until.getDate() + daysAhead);

  // Ambil SA aktif dalam rentang tanggal
  const seatAvailabilities = await SeatAvailability.findAll({
    where: {
      date: {
        [Op.between]: [start, until],
      },
    },
    attributes: [
      "id",
      "schedule_id",
      "subschedule_id",
      "available_seats",
      "boost",
      "date",
    ],
    include: [
      {
        model: Schedule,
        required: true,
        attributes: ["id", "departure_time"],
        include: [
          {
            model: Boat,
            as: "Boat",
            attributes: ["capacity", "published_capacity"],
          },
          { model: Destination, as: "FromDestination", attributes: ["name"] },
          { model: Destination, as: "ToDestination", attributes: ["name"] },
        ],
      },
      {
        model: SubSchedule,
        required: false,
        as: "SubSchedule",
        attributes: ["id"],
        include: [
          { model: Destination, as: "DestinationFrom", attributes: ["name"] },
          { model: Destination, as: "DestinationTo", attributes: ["name"] },
          {
            model: Transit,
            as: "TransitFrom",
            attributes: ["id"],
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Transit,
            as: "TransitTo",
            attributes: ["id"],
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
        ],
      },
    ],
    order: [
      ["date", "ASC"],
      ["created_at", "ASC"],
    ],
  });

  // Filter ≥ 90% terisi
  const rows = [];
  for (const sa of seatAvailabilities) {
    const capacity = getEffectiveCapacity(sa, sa.Schedule);
    if (!capacity) continue;

    const remaining = Number(sa.available_seats || 0);
    const used = capacity - remaining;
    const ratio = used / capacity;

    if (ratio >= thresholdRatio) {
      rows.push({
        schedule_id: sa.schedule_id,
        seat_id: sa.id,
        subschedule_id: sa.subschedule_id,
        route: buildRouteName(sa.Schedule, sa.SubSchedule),
        date: sa.date,
        remaining_seats: remaining,
      });
    }
  }

  // Kirim email jika ada data
  if (rows.length) {
    const subject = `⚠️ Seat Alert: ≥90% Full (7 days ahead) — ${rows.length} items`;
    const html = buildHtmlTable(rows);
    await sendEmail({ subject, html });
  }

  return { checked: seatAvailabilities.length, alerted: rows.length, rows };
};

module.exports = {
  performSeatCapacityCheckAndEmail,
};
