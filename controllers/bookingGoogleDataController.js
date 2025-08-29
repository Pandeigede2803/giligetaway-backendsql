const { Op } = require("sequelize");

const {
  sequelize,
  Booking,
  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  //   AgentCommission,
  Agent,
  BookingSeatAvailability,
  Boat,
  Discount,
} = require("../models");

const { extractIds, classifyAttributionFromIds, classifyAttribution } = require("../util/googleAttribution");
const { buildRouteFromSchedule } = require("../util/buildRoute");


const getBookingsWithGoogleData = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? "50", 10), 1), 200);
    const offset = (page - 1) * limit;

    const q         = (req.query.q || "").trim();       // search name/email (opsional)
    const start     = (req.query.start || "").trim();   // ISO/tanggal (opsional)
    const end       = (req.query.end || "").trim();     // ISO/tanggal (opsional)
    const adsOnly   = req.query.adsOnly === "0" ? false : true; // default true (hanya Ads)
    const sortKey   = ["created_at", "gross_total"].includes(req.query.sort) ? req.query.sort : "created_at";
    const sortOrder = (req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const where = {
      [Op.and]: [
        { google_data: { [Op.ne]: null } }, // wajib ada google_data
      ],
    };

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { contact_name:  { [Op.like]: `%${q}%` } },
          { contact_email: { [Op.like]: `%${q}%` } },
        ],
      });
    }

    if (start) where[Op.and].push({ created_at: { [Op.gte]: new Date(start) } });
    if (end)   where[Op.and].push({ created_at: { [Op.lte]: new Date(end) } });

    const { rows, count } = await Booking.findAndCountAll({
      where,
      attributes: [
        "id",
        "contact_name",
        "gross_total",
        "ticket_id",
        "contact_email",
        "contact_nationality",
        "booking_date",
        "google_data",    // JSON mentah
        "created_at",
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          attributes: ["id", "boat_id"],
          include: [
            {
              model: Transit,
              as: "Transits",
              attributes: ["id"],
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            { model: Destination, as: "FromDestination", attributes: ["name"] },
            { model: Destination, as: "ToDestination", attributes: ["name"] },
          ],
        },
   
        {
          model: SubSchedule,
          as: "subSchedule",
          attributes: ["id"],
          include: [
            { model: Destination, as: "DestinationFrom", attributes: ["name"] },
            { model: Destination, as: "DestinationTo", attributes: ["name"] },
            {
              model: Transit,
              as: "TransitFrom",
              attributes: ["id"],
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "TransitTo",
              attributes: ["id"],
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit1",
              attributes: ["id"],
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit2",
              attributes: ["id"],
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit3",
              attributes: ["id"],
              include: [{ model: Destination, as: "Destination" }],
            },
            {
              model: Transit,
              as: "Transit4",
              attributes: ["id"],
              include: [{ model: Destination, as: "Destination" }],
            },
          ],
        },
      ],
      order: [[sortKey, sortOrder]],
      limit,
      offset,
    });

      
    // Normalisasi + klasifikasi di Node
    const normalized = rows.map((r) => {
      const gd  = r.google_data || {};
      const ids = extractIds(gd);
      const cls = classifyAttributionFromIds(ids);

      return {
        id: r.id,
        contact_name: r.contact_name,
        ticket_id: r.ticket_id,
        departure_date: r.booking_date,
        contact_email: r.contact_email,
        contact_nationality: r.contact_nationality,
        gross_total: r.gross_total,
        created_at: r.created_at,
          route: buildRouteFromSchedule(r.schedule, r.subSchedule),

        // data mentah yang kamu simpan
        google_data_raw: gd,

        google_data_convert: {
          gclid: ids.gclid || null,
          _gcl_aw: ids._gcl_aw || null,
          _gcl_au: ids._gcl_au || null,
          _ga: ids._ga || null,
          _ga_any: ids._ga_any || {},
          timestamp: ids.timestamp || null,
          _gl_present: !!ids._gl,
        },
        _gl_parsed: ids._gl_parsed, // map hasil pecahan _gl (debug)

        attribution_label: cls.label,
        attribution_why: cls.why,
        _hasAdsId: !!(ids.gclid || ids._gcl_aw),
        // human-friendly summary for quick filtering/reading
        summary: classifyAttribution(ids),

      
      };
    });

    // Terapkan filter adsOnly SETELAH fetch (sederhana, tanpa SQL JSON)
    const final = adsOnly
      ? normalized.filter(item => item.summary && item.summary.is_ads_conversion)
      : normalized;

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      pagination: {
        total: count,              // total baris yang punya google_data (sebelum filter adsOnly)
        returned: final.length,    // jumlah baris pada halaman ini setelah filter adsOnly
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        filters: { q: q || undefined, start: start || undefined, end: end || undefined, adsOnly },
        sort: { key: sortKey, order: sortOrder.toLowerCase() },
      },
      data: final,
    });
  } catch (err) {
    console.error("❌ getBookingsWithGoogleData error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};

module.exports = {

  getBookingsWithGoogleData,
 
};
