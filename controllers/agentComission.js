const { Op, literal, col } = require("sequelize");
const {
  Agent,
  Boat,
  AgentMetrics,
  Booking,
  sequelize,
  Destination,
  Schedule,
  SubSchedule,
  Transport,
  Passenger,
  Transit,
  TransportBooking,
  AgentCommission,
  Transaction,
} = require("../models"); // Pastikan jalur impor benar

function formatDateDDMMYYYY(dateObj) {
  if (!dateObj) return null;
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // misalnya "21/05/2024"
}

function formatDateTimeDDMMYYYY_HHMM(dateObj) {
  if (!dateObj) return null;
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();;

  return `${day}/${month}/${year} `;;
}

const AgentCommissionController = {
  // Fetch commissions with optional filters: month, year, agent_id
  // Fetch commissions with optional filters: month, year, agent_id, or from_date, to_date
  async getCommissions(req, res) {
    try {
      // console.log("Received query parameters:", req.query);;

      // console.log("START AGENT GET COMISSION DATA")

      const agentId = req.query.agent_id
        ? parseInt(req.query.agent_id, 10)
        : null;

      // Filter created_at in AgentCommission
      const year = req.query.year ? parseInt(req.query.year, 10) : null;
      const month = req.query.month ? parseInt(req.query.month, 10) : null;;

      const yearBooking = req.query.yearBooking ? parseInt(req.query.yearBooking, 10) : null;
      const monthBooking = req.query.monthBooking ? parseInt(req.query.monthBooking, 10) : null;

      const fromDate = req.query.from_date || null;
      const toDate = req.query.to_date || null;

      // Filter booking_date in Booking
      const fromBookingDate = req.query.from_booking_date || null;
      const toBookingDate = req.query.to_booking_date || null;

      const day = req.query.day ? parseInt(req.query.day, 10) : null;
      const dayBooking = req.query.dayBooking ? parseInt(req.query.dayBooking, 10) : null;

      // 1. whereConditions for AgentCommission
      const whereConditions = {};
      if (agentId) {
        whereConditions.agent_id = agentId;
      }

      // ➜ Filter created_at di AgentCommission
      if (fromDate && toDate) {
        // Jika ada from_date & to_date → filter range created_at
        const start = new Date(fromDate);
        const end = new Date(toDate);
        whereConditions.created_at = {
          [Op.gte]: start,
          [Op.lte]: end,
        };
     
        // );
      } else if (day) {
        // Jika ada day → filter created_at by day
        const startOfDay = new Date(year, month - 1, day);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59);
        whereConditions.created_at = {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        };
        // console.log(
        //   "✅ Filter AgentCommission.created_at by day:",
        //   startOfDay,
        //   "-",
        //   endOfDay
        // );
      }
      
      else if (year) {
        // Fallback ke year/month
        whereConditions.created_at = {};
        if (month) {
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfMonth;
          whereConditions.created_at[Op.lte] = endOfMonth;
          // console.log(
          //   "✅ Filter AgentCommission.created_at by month:",
          //   startOfMonth,
          //   "-",
          //   endOfMonth
          // );
        } else {
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfYear;
          whereConditions.created_at[Op.lte] = endOfYear;
          console.log(
            "✅ Filter AgentCommission.created_at by year:",
            startOfYear,
            "-",
            endOfYear
          );
        }
      }

      // 2. bookingWhereConditions for Booking.booking_date
   
      // 2. bookingWhereConditions for Booking.booking_date
      const bookingWhereConditions = {};
      if (fromBookingDate && toBookingDate) {
        const startBooking = new Date(fromBookingDate);
        const endBooking = new Date(toBookingDate);
        bookingWhereConditions.booking_date = {
          [Op.gte]: startBooking,
          [Op.lte]: endBooking,
        };
        console.log(
          "✅ Filter Booking.booking_date by range:",
          startBooking,
          "-",
          endBooking
        );
      } else if (dayBooking) {
        const startOfDay = new Date(yearBooking, monthBooking - 1, dayBooking);
        const endOfDay = new Date(yearBooking, monthBooking - 1, dayBooking, 23, 59, 59);
        bookingWhereConditions.booking_date = {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        };
        console.log(
          "✅ Filter Booking.booking_date by day:",
          startOfDay,
          "-",
          endOfDay
        );
      }
       else if (yearBooking) {
        // Add filter for booking_date using yearBooking/monthBooking
        bookingWhereConditions.booking_date = {};
        if (monthBooking) {
          const startOfMonth = new Date(yearBooking, monthBooking - 1, 1);
          const endOfMonth = new Date(yearBooking, monthBooking, 0, 23, 59, 59);
          bookingWhereConditions.booking_date[Op.gte] = startOfMonth;
          bookingWhereConditions.booking_date[Op.lte] = endOfMonth;
          // console.log(
          //   "✅ Filter Booking.booking_date by month:",
          //   startOfMonth,
          //   "-",
          //   endOfMonth
          // );
        } else {
          const startOfYear = new Date(yearBooking, 0, 1);
          const endOfYear = new Date(yearBooking, 11, 31, 23, 59, 59);
          bookingWhereConditions.booking_date[Op.gte] = startOfYear;
          bookingWhereConditions.booking_date[Op.lte] = endOfYear;
          // console.log(
          //   "✅ Filter Booking.booking_date by year:",
          //   startOfYear,
          //   "-",
          //   endOfYear
          // );
        }
      } 
      // Jika from_booking_date/to_booking_date tidak ada, booking_date tidak difilter

      // console.log("📝 AgentCommission conditions:", whereConditions);
      // console.log("📝 Booking conditions:", bookingWhereConditions);

      // Query AgentCommission + join ke Booking
      const commissions = await AgentCommission.findAll({
        where: whereConditions,
        include:
        
        
        {

          model: Booking,
          as: "Booking",
          where: {
            ...bookingWhereConditions, // ✅ Ensure this is included!
          }, // Hanya ambil booking dengan status invoiced

          include: [
            {
              model: Transaction,
              as: "transactions",
            },
            {
              model:Agent,
              as: "Agent",
            },
            {
              model: Passenger,
              as: "passengers",
            },
            {
              model: Schedule,
              as: "schedule",
              attributes: [
                "id",
                "boat_id",
                "availability",
                "arrival_time",
                "journey_time",
                "route_image",
                "departure_time",
                "check_in_time",
                "schedule_type",
                "days_of_week",
                "trip_type",
              ],
              include: [
                {
                  model: Destination,
                  as: "FromDestination",
                  // attributes: ["id", "name"],
                },
                {
                  model: Transit,

                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Boat,
                  as: "Boat",
                },
                {
                  model: Destination,
                  as: "ToDestination",
                  // attributes: ["id", "name"],
                },
              ],
            },

            {
              model: TransportBooking,
              as: "transportBookings",
              include: [
                {
                  model: Transport,
                  as: "Transport",
                },
              ],
            },
            {
              model: SubSchedule,
              as: "subSchedule",
              attributes: [
                "id",
                "destination_from_schedule_id",
                "destination_to_schedule_id",
                "transit_from_id",
                "transit_to_id",
                "transit_1",
                "transit_2",
                "transit_3",
                "transit_4",
              ],
              include: [
                {
                  model: Destination,
                  as: "DestinationFrom",
                  // attributes: ["id", "name"],
                },
                {
                  model: Destination,
                  as: "DestinationTo",
                  // attributes: ["id", "name"],
                },
                {
                  model: Transit,
                  as: "TransitFrom",
                  attributes: ["id", "departure_time", "arrival_time"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "TransitTo",
                  attributes: ["id", "departure_time", "arrival_time"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit1",
                  attributes: ["id", "departure_time", "arrival_time"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit2",
                  attributes: ["id", "departure_time", "arrival_time"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit3",
                  attributes: ["id", "departure_time", "arrival_time"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit4",
                  attributes: ["id", "departure_time", "arrival_time"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
              ],
            },
          ],
        },
      });

   

      // Process commissions to add route names
      const processedCommissions = commissions.map((commission) => {
        const booking = commission.Booking;
        let route = "";
        if (booking?.subSchedule) {
          route = [
            booking.subSchedule.DestinationFrom?.name,
            booking.subSchedule.TransitFrom?.Destination?.name,
            booking.subSchedule.Transit1?.Destination?.name,
            booking.subSchedule.Transit2?.Destination?.name,
            booking.subSchedule.Transit3?.Destination?.name,
            booking.subSchedule.Transit4?.Destination?.name,
            booking.subSchedule.TransitTo?.Destination?.name,
            booking.subSchedule.DestinationTo?.name,
          ]
            .filter(Boolean)
            .join(" - ");
        } else if (booking?.schedule) {
          route = [
            booking.schedule.FromDestination?.name,
            booking.schedule.ToDestination?.name,
          ]
            .filter(Boolean)
            .join(" - ");
        }
        return {
          ...commission.toJSON(),
          route,
        };
      });

      res.status(200).json(processedCommissions);
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ error: "Failed to retrieve commissions" });
    }
  },

  async getCommissionsPagination(req, res) {
    try {
      // console.log("Received query parameters:", req.query);
      // console.log("START AGENT GET COMMISSION DATA");
  
      const {
        agent_id,
        year,
        month,
        day,
        from_date,
        to_date,
        yearBooking,
        monthBooking,
        dayBooking,
        from_booking_date,
        to_booking_date,
        page = 1,
        limit = 100,
      } = req.query;
  
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;
  
      // AgentCommission filter
      const whereConditions = {};
      if (agent_id) whereConditions.agent_id = parseInt(agent_id, 10);
  
      if (from_date && to_date) {
        whereConditions.created_at = {
          [Op.gte]: new Date(from_date),
          [Op.lte]: new Date(to_date),
        };
      } else if (day) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const d = parseInt(day, 10);
        whereConditions.created_at = {
          [Op.gte]: new Date(y, m - 1, d),
          [Op.lte]: new Date(y, m - 1, d, 23, 59, 59),
        };
      } else if (year) {
        const y = parseInt(year, 10);
        const m = month ? parseInt(month, 10) : null;
        const start = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
        const end = m ? new Date(y, m, 0, 23, 59, 59) : new Date(y, 11, 31, 23, 59, 59);
        whereConditions.created_at = { [Op.gte]: start, [Op.lte]: end };
      }
  
      // Booking filter
      const bookingWhereConditions = {};
      if (from_booking_date && to_booking_date) {
        bookingWhereConditions.booking_date = {
          [Op.gte]: new Date(from_booking_date),
          [Op.lte]: new Date(to_booking_date),
        };
      } else if (dayBooking) {
        const yb = parseInt(yearBooking, 10);
        const mb = parseInt(monthBooking, 10);
        const db = parseInt(dayBooking, 10);
        bookingWhereConditions.booking_date = {
          [Op.gte]: new Date(yb, mb - 1, db),
          [Op.lte]: new Date(yb, mb - 1, db, 23, 59, 59),
        };
      } else if (yearBooking) {
        const yb = parseInt(yearBooking, 10);
        const mb = monthBooking ? parseInt(monthBooking, 10) : null;
        const start = mb ? new Date(yb, mb - 1, 1) : new Date(yb, 0, 1);
        const end = mb ? new Date(yb, mb, 0, 23, 59, 59) : new Date(yb, 11, 31, 23, 59, 59);
        bookingWhereConditions.booking_date = { [Op.gte]: start, [Op.lte]: end };
      }
  
      // console.log("📝 whereConditions:", whereConditions);
      // console.log("📝 bookingWhereConditions:", bookingWhereConditions);
  
      const { count, rows: commissions } = await AgentCommission.findAndCountAll({
        where: whereConditions,
        limit: limitNum,
        offset,
        order: [['created_at', 'DESC']], // Order by latest created_at
        distinct: true, // 🔧 fix overcounting
        include: {
          model: Booking,
          as: "Booking",
          where: bookingWhereConditions,
          include: [
            { model: Transaction, as: "transactions" },
            { model: Agent, as: "Agent" },
            { model: Passenger, as: "passengers" },
            {
              model: Schedule,
              as: "schedule",
              attributes: ["id", "boat_id", "availability", "arrival_time", "journey_time", "route_image", "departure_time", "check_in_time", "schedule_type", "days_of_week", "trip_type"],
              include: [
                { model: Destination, as: "FromDestination" },
                { model: Destination, as: "ToDestination" },
                { model: Boat, as: "Boat" },
                { model: Transit, include: { model: Destination, as: "Destination" } },
              ],
            },
            {
              model: SubSchedule,
              as: "subSchedule",
              attributes: ["id", "destination_from_schedule_id", "destination_to_schedule_id", "transit_from_id", "transit_to_id", "transit_1", "transit_2", "transit_3", "transit_4"],
              include: [
                { model: Destination, as: "DestinationFrom" },
                { model: Destination, as: "DestinationTo" },
                { model: Transit, as: "TransitFrom", attributes: ["id", "departure_time", "arrival_time"], include: { model: Destination, as: "Destination" } },
                { model: Transit, as: "TransitTo", attributes: ["id", "departure_time", "arrival_time"], include: { model: Destination, as: "Destination" } },
                { model: Transit, as: "Transit1", attributes: ["id", "departure_time", "arrival_time"], include: { model: Destination, as: "Destination" } },
                { model: Transit, as: "Transit2", attributes: ["id", "departure_time", "arrival_time"], include: { model: Destination, as: "Destination" } },
                { model: Transit, as: "Transit3", attributes: ["id", "departure_time", "arrival_time"], include: { model: Destination, as: "Destination" } },
                { model: Transit, as: "Transit4", attributes: ["id", "departure_time", "arrival_time"], include: { model: Destination, as: "Destination" } },
              ],
            },
            {
              model: TransportBooking,
              as: "transportBookings",
              include: [{ model: Transport, as: "Transport" }],
            },
          ],
        },
      });
  
      // Post-processing
      const processedCommissions = commissions.map((commission) => {
        const booking = commission.Booking;
        let route = "";
        if (booking?.subSchedule) {
          route = [
            booking.subSchedule.DestinationFrom?.name,
            booking.subSchedule.TransitFrom?.Destination?.name,
            booking.subSchedule.Transit1?.Destination?.name,
            booking.subSchedule.Transit2?.Destination?.name,
            booking.subSchedule.Transit3?.Destination?.name,
            booking.subSchedule.Transit4?.Destination?.name,
            booking.subSchedule.TransitTo?.Destination?.name,
            booking.subSchedule.DestinationTo?.name,
          ].filter(Boolean).join(" - ");
        } else if (booking?.schedule) {
          route = [
            booking.schedule.FromDestination?.name,
            booking.schedule.ToDestination?.name,
          ].filter(Boolean).join(" - ");
        }
        return {
          ...commission.toJSON(),
          route,
        };
      });
  
      res.status(200).json({
        totalData: count,
        currentPage: pageNum,
        perPage: limitNum,
        data: processedCommissions,
      });
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ error: "Failed to retrieve commissions" });
    }
  },  
  
// 3. monthly summary

async getMonthlyAgentSummary(req, res) {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month, 10) : null;

    const start = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const end = month
      ? new Date(year, month, 0, 23, 59, 59)
      : new Date(year, 11, 31, 23, 59, 59);

   const summaries = await AgentCommission.findAll({
      attributes: [
        "agent_id",
        [sequelize.fn("SUM", sequelize.literal(`
          CASE WHEN \`Booking\`.\`payment_method\` = 'invoiced'
          THEN (\`Booking\`.\`gross_total\` - COALESCE(\`Booking\`.\`bank_fee\`, 0))
          ELSE 0 END
        `)), "gross_total_invoiced"],
        [sequelize.fn("SUM", sequelize.literal(`
          CASE WHEN \`Booking\`.\`payment_status\` = 'paid'
          THEN (\`Booking\`.\`gross_total\` - COALESCE(\`Booking\`.\`bank_fee\`, 0))
          ELSE 0 END
        `)), "gross_total_paid"],
        [sequelize.fn("SUM", sequelize.literal(`
          CASE WHEN \`Booking\`.\`payment_method\` = 'invoiced'
          THEN \`AgentCommission\`.\`amount\`
          ELSE 0 END
        `)), "commission_amount_invoiced"],
        [sequelize.fn("SUM", sequelize.literal(`
          CASE WHEN \`Booking\`.\`payment_status\` = 'paid'
          THEN \`AgentCommission\`.\`amount\`
          ELSE 0 END
        `)), "commission_amount_paid"],
      ],
      include: [
        {
          model: Booking,
          as: "Booking",
          required: true,
          attributes: [],
          where: {
            booking_date: { [Op.between]: [start, end] }
          }
        },
        {
          model: Agent,
          as: "Agent",
          required: true,
          attributes: ["name"]
        }
      ],
      group: ["agent_id", "Agent.id", "Agent.name"],
      raw: true,
      nest: true
    });

    return res.status(200).json({
      month: month || "all",
      year,
      data: summaries.map((row) => ({
        agent_id: row.agent_id,
        agent_name: row.Agent?.name || "(Unknown Agent)",
        gross_total_invoiced: Number(row.gross_total_invoiced)-Number(row.commission_amount_invoiced),
        gross_total_paid: Number(row.gross_total_paid)-Number(row.commission_amount_paid),
        commission_amount_invoiced: Number(row.commission_amount_invoiced),
        commission_amount_paid: Number(row.commission_amount_paid),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to retrieve monthly summary" });
  }
},

  async getAgentSalesReport(req, res) {
    try {
      console.log("Received query parameters:", req.query);

      const agentId = req.query.agent_id
        ? parseInt(req.query.agent_id, 10)
        : null;
      const year = req.query.year ? parseInt(req.query.year, 10) : null;
      const month = req.query.month ? parseInt(req.query.month, 10) : null;
      const fromDate = req.query.from_date || null;
      const toDate = req.query.to_date || null;

      if (!agentId) {
        return res.status(400).json({ error: "agent_id is required" });
      }

      const bookingWhereConditions = {
        agent_id: agentId,
        payment_status: ["invoiced", "paid",],
      };

      // Changed from created_at to booking_date
      if (fromDate && toDate) {
        bookingWhereConditions.booking_date = {
          [Op.gte]: new Date(fromDate),
          [Op.lte]: new Date(toDate),
        };
      } else if (year) {
        let startOfPeriod, endOfPeriod;
        if (month) {
          startOfPeriod = new Date(year, month - 1, 1);
          endOfPeriod = new Date(year, month, 0, 23, 59, 59);
        } else {
          startOfPeriod = new Date(year, 0, 1);
          endOfPeriod = new Date(year, 11, 31, 23, 59, 59);
        }
        // Changed from created_at to booking_date
        bookingWhereConditions.booking_date = {
          [Op.gte]: startOfPeriod,
          [Op.lte]: endOfPeriod,
        };
      }

      // 3. Fetch `AgentCommissions` first and include `Booking`
      const commissions = await AgentCommission.findAll({
        where: { agent_id: agentId },
        attributes: ["id", "booking_id", "agent_id", "amount", "created_at"],
        include: [
          {
            model: Booking,
            as: "Booking",
            where: bookingWhereConditions,
            attributes: [
              "id",
              "contact_name",
              "contact_phone",
              "contact_email",
              "contact_passport_id",
              "contact_nationality",
              "schedule_id",
              "subschedule_id",
              "gross_total",
              "gross_total_in_usd",
              "exchange_rate",
              "currency",
              "payment_status",
              "payment_method",
              "booking_date",
              "total_passengers",
              "adult_passengers",
              "child_passengers",
              "infant_passengers",
              "ticket_id",
              "booking_source",
              "bank_fee",
              "created_at",
              "updated_at", // ✅ Include bank fee
            ],
            include: [
              {
                model: Schedule,
                as: "schedule",
                attributes: [
                  "id",
                  "departure_time",
                  "arrival_time",
                  "trip_type",
                ],
                include: [
                  {
                    model: Destination,
                    as: "FromDestination",
                    attributes: ["id", "name"],
                  },
                  {
                    model: Destination,
                    as: "ToDestination",
                    attributes: ["id", "name"],
                  },
                ],
              },
              {
                model: TransportBooking,
                as: "transportBookings",
                attributes: [
                  "id",
                  "transport_id",
                  "transport_type",
                  "quantity",
                  "transport_price",
                  "note",
                  "payment_status",
                  "created_at",
                  "updated_at",
                  "payment_method",
                ],
                include: [
                  {
                    model: Transport,

                    as: "Transport",
                    attributes: [
                      "id",

                      "pickup_area",
                      "pickup_time",
                      "duration",
                      "cost",
                      "interval_time",
                      "description",
                      

                      "availability",
                    ],
                  },
                ],
              },
              {
                model: SubSchedule,
                as: "subSchedule",
                attributes: [
                  "id",
                  "validity_start",
                  "validity_end",
                  "trip_type",
                ],
                include: [
                  {
                    model: Destination,
                    as: "DestinationFrom",
                    attributes: ["id", "name"],
                  },
                  {
                    model: Destination,
                    as: "DestinationTo",
                    attributes: ["id", "name"],
                  },
                  {
                    model: Transit,
                    as: "TransitFrom",
                    include: {
                      model: Destination,
                      as: "Destination",
                      attributes: ["id", "name"],
                    },
                  },
                  {
                    model: Transit,
                    as: "TransitTo",
                    include: {
                      model: Destination,
                      as: "Destination",
                      attributes: ["id", "name"],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      // 4. Fetch Agent Info
      const agent = await Agent.findByPk(agentId, {
        attributes: ["id", "name", "email", "phone"],
      });

      // 5. Process Bookings to use `created_at` from `AgentCommission`
      // ocess Bookings to use `created_at` from `AgentCommission`
      const processedBookings = commissions
        .map((commission) => {
          const bk = commission.Booking;
          if (!bk) return null;

          const dateFormatted = formatDateDDMMYYYY(commission.created_at);
          const departureFormatted = formatDateTimeDDMMYYYY_HHMM(
            bk.booking_date
          );

          let transportCost = 0;
          if (bk.transportBookings && bk.transportBookings.length > 0) {
            bk.transportBookings.forEach((transport) => {
              transportCost += parseFloat(transport.transport_price || 0);
            });
          }

          // console.log("👶transportCost", transportCost);

          // Use transportCost instead of bk.transportBookings if needed
          const amount = bk.gross_total - commission.amount-transportCost;
          const amountInvoiced =
            bk.payment_status === "invoiced"
              ? bk.gross_total - commission.amount
              : 0;
          const amountPaid = Number(
            bk.payment_status === "paid" ? bk.gross_total-transportCost : 0
          );
          const datePaid =
            bk.payment_status === "paid"
              ? formatDateDDMMYYYY(bk.updated_at)
              : null;

          const amountTransportInvoiced =
            bk.payment_status === "invoiced"
              ? transportCost
              : 0;
          const amountTransportPaid =
            bk.payment_status === "paid" ? transportCost : 0;
         

          // Rest of your code remains the same
          let route = "";
          if (bk?.subSchedule) {
            route = [
              bk.subSchedule.DestinationFrom?.name,
              bk.subSchedule.TransitFrom?.Destination?.name,
              bk.subSchedule.TransitTo?.Destination?.name,
              bk.subSchedule.DestinationTo?.name,
            ]
              .filter(Boolean)
              .join(" - ");
          } else if (bk?.schedule) {
            route = [
              bk.schedule.FromDestination?.name,
              bk.schedule.ToDestination?.name,
            ]
              .filter(Boolean)
              .join(" - ");
          }

          return {
            id: bk.ticket_id,
            date: dateFormatted,
            departure: departureFormatted,
            customer: bk.contact_name,
            passport_id: bk.contact_passport_id,
            nationality: bk.contact_nationality,
            tickets: bk.total_passengers,
            transport_booking: bk.transportBookings, // Include all transport bookings
            payment_status: bk.payment_status,
            payment_method: bk.payment_method,
            gross_total: bk.gross_total,
            gross_total_in_usd: bk.gross_total_in_usd,
            exchange_rate: bk.exchange_rate,
            bank_fee: bk.bank_fee,
            commission: commission.amount,
            amount: amount,
            amount_paid: amountPaid || 0,
            amount_invoiced: amountInvoiced || 0,
            amount_transport_invoiced: amountTransportInvoiced || 0,
            amount_transport_paid: amountTransportPaid || 0,
            date_paid: datePaid ? datePaid : "-",
            route,
          };
        })
        .filter(Boolean);

      // 5. Lakukan pass ke-2 untuk menghitung running balance
      // 5. Perform a second pass to compute running balance correctly
      let runningBalance = 0;
      for (let i = 0; i < processedBookings.length; i++) {
        const item = processedBookings[i];

        // Corrected logic: use amount - amount_paid instead of using amount_paid directly
        runningBalance += Number(item.amount) - Number(item.amount_paid);

        // Set current balance
        item.current_balance = runningBalance;
      }

      // sum all the processBookings gross total
      const totalGrossAmount = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.gross_total),
        0
      );
      // get the total amount paid for the booking with paymen status paid
      const totalAmountPaid = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.amount_paid),
        0
      );

      const totalAmountTransportPaid = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.amount_transport_paid),
        0
      );

      const totalAmountTransportInvoiced = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.amount_transport_invoiced),
        0
      );

      // get total amount (gross amount - commission)

      const totalCommissionAmount = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.commission),
        0
      );
      // get total amount invoiced with the payment status invoiced
      const totalAmountInvoiced = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.amount_invoiced),
        0
      );

      // tototal amount is gross total - agent comission
      const totalAmount = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.amount),
        0
      );
      const totalBankFee = processedBookings.reduce(
        (total, booking) => total + parseFloat(booking.bank_fee),
        0
      );
      // get sub total is total amount - total amount paid
      const subTotal = totalAmount - totalAmountPaid;

      // console.log("Total Gross Amount:", totalGrossAmount);
      // console.log("Total Commission Amount:", totalCommissionAmount);
      // console.log(
      //   "Total Amount is gross total - agent comission:",
      //   totalAmount
      // );
      // console.log("Total Bank Fee:", totalBankFee);
      // console.log(
      //   "Total Amount Paid for the booking with paymen status paid:",
      //   totalAmountPaid
      // );
      // console.log("Sub Total:", subTotal);

      // 6. Build Final Response JSON
      const response = {
        agent: [
          {
            agent_name: agent?.name || "Unknown Agent",
            agent_contact: agent?.email || agent?.phone || "",
            agent_id: agent?.id || agentId,
          },
        ],
        total_gross_amount: totalGrossAmount,
        total_commission_amount: totalCommissionAmount,
        total_amount: totalAmount,
        total_bank_fee: totalBankFee,
        total_amount_paid: totalAmountPaid,
        total_amount_invoiced: totalAmountInvoiced,
        total_amount_transport_invoiced: totalAmountTransportInvoiced,
        total_amount_transport_paid: totalAmountTransportPaid,
        sub_total: subTotal,


        bookings: processedBookings,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching Agent Sales Report:", error);
      res.status(500).json({ error: "Failed to retrieve agent sales report" });
    }
  },

  async getCommissionsInvoiced(req, res) {
    try {
      const {
        agent_id,
        year,
        month,
        from_date,
        to_date,
        from_booking_date,
        to_booking_date,
      } = req.query;

      // console.log("===Received query parameters:====", {
      //   agent_id,
      //   year,
      //   month,
      //   from_date,
      //   to_date,
      //   from_booking_date,
      //   to_booking_date,
      // });

      // 1. Filter di AgentCommission (created_at + agent_id)
      const whereConditions = {};
      if (agent_id) {
        whereConditions.agent_id = parseInt(agent_id, 10);
      }

      if (from_date && to_date) {
        const start = new Date(from_date);
        const end = new Date(to_date);
        whereConditions.created_at = {
          [Op.gte]: start,
          [Op.lte]: end,
        };
        console.log(
          "✅ Filter AgentCommission.created_at by custom range (invoiced):",
          start,
          "-",
          end
        );
      } else if (year) {
        whereConditions.created_at = {};
        if (month) {
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfMonth;
          whereConditions.created_at[Op.lte] = endOfMonth;
          console.log(
            "✅ Filter AgentCommission.created_at by month (invoiced):",
            startOfMonth,
            "-",
            endOfMonth
          );
        } else {
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfYear;
          whereConditions.created_at[Op.lte] = endOfYear;
          console.log(
            "✅ Filter AgentCommission.created_at by year (invoiced):",
            startOfYear,
            "-",
            endOfYear
          );
        }
      }

      // 2. bookingWhereConditions untuk filter booking_date + payment_status
      const bookingWhereConditions = {
        payment_status: "invoiced", // Hanya invoiced
      };

      if (from_booking_date && to_booking_date) {
        const startBooking = new Date(from_booking_date);
        const endBooking = new Date(to_booking_date);
        bookingWhereConditions.booking_date = {
          [Op.gte]: startBooking,
          [Op.lte]: endBooking,
        };
        console.log(
          "✅ Filter Booking.booking_date range (invoiced):",
          startBooking,
          "-",
          endBooking
        );
      }
      // Jika from_booking_date/to_booking_date tidak ada, booking_date tidak difilter
      // tapi masih payment_status = 'invoiced'

      // console.log("AgentCommission conditions (invoiced):", whereConditions);
      // console.log("Booking conditions (invoiced):", bookingWhereConditions);

      const commissions = await AgentCommission.findAll({
        where: whereConditions,
        include: {
          model: Booking,
          as: "Booking",
          where: { payment_status: "invoiced" }, // Hanya ambil booking dengan status invoiced
          attributes: [
            "id",
            "contact_name",
            "contact_phone",
            "contact_email",
            "schedule_id",
            "subschedule_id",
            "gross_total",
            "currency",
            "payment_status",
            "payment_method",
            "booking_date",
            "total_passengers",
            "adult_passengers",
            "child_passengers",
            "infant_passengers",
            "ticket_id",
            "booking_source",
          ],
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: ["id", "departure_time", "arrival_time", "trip_type"],
              include: [
                {
                  model: Destination,
                  as: "FromDestination",
                  attributes: ["id", "name"],
                },
                {
                  model: Destination,
                  as: "ToDestination",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: SubSchedule,
              as: "subSchedule",
              attributes: ["id", "validity_start", "validity_end", "trip_type"],
              include: [
                {
                  model: Destination,
                  as: "DestinationFrom",
                  attributes: ["id", "name"],
                },
                {
                  model: Destination,
                  as: "DestinationTo",
                  attributes: ["id", "name"],
                },
                {
                  model: Transit,
                  as: "TransitFrom",
                  attributes: ["id"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "TransitTo",
                  attributes: ["id"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit1",
                  attributes: ["id"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit2",
                  attributes: ["id"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit3",
                  attributes: ["id"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit4",
                  attributes: ["id"],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
              ],
            },
          ],
        },
      });
      const processedCommissions = commissions.map((commission) => {
        const booking = commission.Booking;
        let route = "";
        if (booking?.subSchedule) {
          route = [
            booking.subSchedule.DestinationFrom?.name,
            booking.subSchedule.TransitFrom?.Destination?.name,
            booking.subSchedule.Transit1?.Destination?.name,
            booking.subSchedule.Transit2?.Destination?.name,
            booking.subSchedule.Transit3?.Destination?.name,
            booking.subSchedule.Transit4?.Destination?.name,
            booking.subSchedule.TransitTo?.Destination?.name,
            booking.subSchedule.DestinationTo?.name,
          ]
            .filter(Boolean)
            .join(" - ");
        } else if (booking?.schedule) {
          route = [
            booking.schedule.FromDestination?.name,
            booking.schedule.ToDestination?.name,
          ]
            .filter(Boolean)
            .join(" - ");
        }
        return {
          ...commission.toJSON(),
          route,
        };
      });

      // console.log(
      //   "Processed commissions (invoiced) with routes:",
      //   JSON.stringify(processedCommissions, null, 2)
      // );
      res.status(200).json(processedCommissions);
    } catch (error) {
      console.error("Error fetching commissions (invoiced):", error);
      res
        .status(500)
        .json({ error: "Failed to retrieve commissions (invoiced)" });
    }
  },


  async updateCommission(req, res) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
  
      if (!id || isNaN(id)) {
        return res.status(400).json({ error: "Invalid or missing ID parameter" });
      }
  
      const commission = await AgentCommission.findByPk(id);
  
      if (!commission) {
        return res.status(404).json({ error: "AgentCommission not found" });
      }
  
      if (amount === undefined || isNaN(amount)) {
        return res.status(400).json({ error: "Invalid or missing amount in request body" });
      }
  
      // Update amount
      commission.amount = parseFloat(amount);
      await commission.save();
  
      return res.status(200).json({
        message: "AgentCommission updated successfully",
        data: commission,
      });
    } catch (error) {
      console.error("Error updating AgentCommission:", error);
      return res.status(500).json({ error: "Failed to update AgentCommission" });
    }
  },

 

  async createAgentComission(req, res) {
    // console.log("start to add agent comission")
    // console.log("BODY RECEIVED:", req.body);

    try {
      const { booking_id, agent_id, amount } = req.body;

      if (!booking_id || isNaN(booking_id)) {
        return res.status(400).json({ error: "Invalid or missing booking_id in request body" });
      }

      if (!agent_id || isNaN(agent_id)) {
        return res.status(400).json({ error: "Invalid or missing agent_id in request body" });
      }

      if (amount === undefined || isNaN(amount)) {
        return res.status(400).json({ error: "Invalid or missing amount in request body" });
      }

      const booking = await Booking.findByPk(booking_id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const agent = await Agent.findByPk(agent_id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const existingCommission = await AgentCommission.findOne({
        where: { booking_id, agent_id },
      });

      if (existingCommission) {
        return res.status(409).json({ error: "AgentCommission already exists" });
      }

      await booking.update({ agent_id });

      const commission = await AgentCommission.create({
        booking_id,
        agent_id,
        amount,
      });

      return res.status(201).json({ message: "AgentCommission created successfully", data: commission });
    } catch (error) {
      console.error("Error creating AgentCommission:", error);
      return res.status(500).json({ error: "Failed to create AgentCommission" });
    }
  },
async deleteAgentCommission(req, res) {
  try {
    const { id } = req.body;

    console.log("Deleting AgentCommission with ID:", id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid or missing AgentCommission ID in request body" });
    }

    const commission = await AgentCommission.findByPk(id);

    if (!commission) {
      console.log("AgentCommission not found");
      return res.status(404).json({ error: "AgentCommission not found" });
    }

    // Ambil booking dan hapus agent_id-nya jika ada
    const booking = await Booking.findByPk(commission.booking_id);
    if (booking) {
      console.log("Deleting agent_id from booking:", booking.id);
      await booking.update({ agent_id: null });
    }

    await commission.destroy();

    console.log("AgentCommission deleted successfully");
    return res.status(200).json({ message: "AgentCommission deleted successfully" });
  } catch (error) {
    console.error("Error deleting AgentCommission:", error);
    return res.status(500).json({ error: "Failed to delete AgentCommission" });
  }
},

};

// create update agent comission base on booking id that givin and the req body will be agent id and amount



module.exports = AgentCommissionController;
