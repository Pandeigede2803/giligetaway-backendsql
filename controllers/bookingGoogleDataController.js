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

const getGoogleBookingsSummary = async (req, res) => {
  try {
    const q       = (req.query.q || "").trim();
    const start   = (req.query.start || "").trim();
    const end     = (req.query.end || "").trim();
    const adsOnly = req.query.adsOnly === "0" ? false : true; // default: true

    // where dasar sama seperti list
    const where = { [Op.and]: [ { google_data: { [Op.ne]: null } } ] };

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

    // Ambil kolom dengan nationality dan created_at untuk analisis lebih lanjut
    const rows = await Booking.findAll({
      where,
      attributes: ["gross_total", "google_data", "contact_nationality", "created_at", "ticket_id"],
      raw: true,
    });

    // Normalisasi dengan data tambahan
    let pool = rows.map(r => {
      const gd  = r.google_data || {};
      const ids = extractIds(gd);
      const s   = classifyAttribution(ids); // ada flag is_ads_conversion
      return {
        gross_total: Number(r.gross_total || 0),
        is_ads_conversion: !!(s && s.is_ads_conversion),
        ads_type: s.ads_type || "none", // direct, prior, none
        contact_nationality: r.contact_nationality || "Unknown",
        created_at: r.created_at,
        ticket_id: r.ticket_id || "",
      };
    });

    if (adsOnly) {
      pool = pool.filter(x => x.is_ads_conversion);
    }

    const totalRevenue   = pool.reduce((sum, x) => sum + x.gross_total, 0);
    const totalBookings  = pool.length;
    const averageBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // 1. Ads Type Distribution
    const adsTypeDistribution = pool.reduce((acc, item) => {
      acc[item.ads_type] = (acc[item.ads_type] || 0) + 1;
      return acc;
    }, {});

    // 2. Top Countries by Booking Count
    const countriesMap = pool.reduce((acc, item) => {
      const country = item.contact_nationality;
      if (!acc[country]) {
        acc[country] = { bookings: 0, revenue: 0 };
      }
      acc[country].bookings += 1;
      acc[country].revenue += item.gross_total;
      return acc;
    }, {});

    const topCountries = Object.entries(countriesMap)
      .map(([country, data]) => ({
        country,
        bookings: data.bookings,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10);

    // 3. Daily Bookings (based on created_at)
    const dailyBookingsMap = pool.reduce((acc, item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = { bookings: 0, revenue: 0 };
      }
      acc[date].bookings += 1;
      acc[date].revenue += item.gross_total;
      return acc;
    }, {});

    const dailyBookings = Object.entries(dailyBookingsMap)
      .map(([date, data]) => ({
        date,
        bookings: data.bookings,
        revenue: data.revenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 4. Trip Type Distribution (Round Trip vs One Way)
    const roundTripCount = pool.filter(x => x.ticket_id.includes("RT")).length;
    const oneWayCount = pool.filter(x => x.ticket_id.includes("OW")).length;

    return res.status(200).json({
      success: true,
      filters: { q: q || undefined, start: start || undefined, end: end || undefined, adsOnly },
      summary: {
        totalRevenue,
        totalBookings,
        averageBooking,
        roundTripBookings: roundTripCount,
        oneWayBookings: oneWayCount,
        adsTypeDistribution,
        topCountries,
        dailyBookings,
      }
    });
  } catch (err) {
    console.error("❌ getGoogleBookingsSummary error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};

module.exports = {

  getBookingsWithGoogleData,
  getGoogleBookingsSummary,
 
};
