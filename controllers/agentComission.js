const { Op } = require("sequelize");
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
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const AgentCommissionController = {
  // Fetch commissions with optional filters: month, year, agent_id
  // Fetch commissions with optional filters: month, year, agent_id, or from_date, to_date
  async getCommissions(req, res) {
    try {
      console.log("Received query parameters:", req.query);

      const agentId = req.query.agent_id
        ? parseInt(req.query.agent_id, 10)
        : null;

      // Filter created_at in AgentCommission
      const year = req.query.year ? parseInt(req.query.year, 10) : null;
      const month = req.query.month ? parseInt(req.query.month, 10) : null;
      const fromDate = req.query.from_date || null;
      const toDate = req.query.to_date || null;

      // Filter booking_date in Booking
      const fromBookingDate = req.query.from_booking_date || null;
      const toBookingDate = req.query.to_booking_date || null;

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
        console.log(
          "✅ Filter AgentCommission.created_at by custom range:",
          start,
          "-",
          end
        );
      } else if (year) {
        // Fallback ke year/month
        whereConditions.created_at = {};
        if (month) {
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfMonth;
          whereConditions.created_at[Op.lte] = endOfMonth;
          console.log(
            "✅ Filter AgentCommission.created_at by month:",
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
            "✅ Filter AgentCommission.created_at by year:",
            startOfYear,
            "-",
            endOfYear
          );
        }
      }

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
      }
      // Jika from_booking_date/to_booking_date tidak ada, booking_date tidak difilter

      console.log("📝 AgentCommission conditions:", whereConditions);
      console.log("📝 Booking conditions:", bookingWhereConditions);

      // Query AgentCommission + join ke Booking
      const commissions = await AgentCommission.findAll({
        where: whereConditions,
        include: {
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
              model:Passenger,
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
                'id','destination_from_schedule_id',
                'destination_to_schedule_id',
                'transit_from_id','transit_to_id',
                'transit_1','transit_2','transit_3','transit_4'],
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
                  attributes: ['id','departure_time','arrival_time'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "TransitTo",
                  attributes: ['id','departure_time','arrival_time'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit1",
                  attributes: ['id','departure_time','arrival_time'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit2",
                  attributes: ['id','departure_time','arrival_time'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit3",
                  attributes: ['id','departure_time','arrival_time'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    // attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: "Transit4",
                  attributes: ['id','departure_time','arrival_time'],
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

  // * GET /api/agent-sales-report?agent_id=xx&year=2024&month=5
  // *
  // * Mengembalikan struktur JSON:
  // * {
  // *   agent: [
  // *     {
  // *       agent_name,
  // *       agent_contact,
  // *       agent_id
  // *     }
  // *   ],
  // *   bookings: [
  // *     {
  // *       date,
  // *       departure,
  // *       customer,
  // *       tickets,
  // *       payment_status,
  // *       gross_total
  // *     },
  // *     ...
  // *   ]
  // * }
  // */

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
        payment_status: ["invoiced", "paid"],
      };

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
                include: [{ model: Transport, as: "Transport" }],
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
      const processedBookings = commissions
        .map((commission) => {
          const bk = commission.Booking;
          if (!bk) return null; // Skip if Booking data is missing

          const dateFormatted = formatDateDDMMYYYY(commission.created_at); // ✅ Use `created_at` from AgentCommission
          const departureFormatted = formatDateTimeDDMMYYYY_HHMM(
            bk.booking_date
          );
          // amount is gross total - commission amount
          const amount = bk.gross_total - commission.amount;
          // const amount invoiced is all the gross total with the payment status invoiced but - the commission amount
          const amountInvoiced =
            bk.payment_status === "invoiced"
              ? bk.gross_total - commission.amount
              : 0;

          // create amount paid for the payment status only,
          //  amount paid is same as gross total but ony in payment status paid
          const amountPaid = Number(
            bk.payment_status === "paid" ? bk.gross_total : 0
          );

          // date to paid is only in payment status paid updated_at
          const datePaid =
            bk.payment_status === "paid"
              ? formatDateDDMMYYYY(bk.updated_at)
              : null;

          // create current balance , in a condition if the payment status is paid it will be  minus(example -100000) and if payment status is invoiced it will be plus (example +100000)
          // i want you to calculate it for the index of the array (if index 0 is -100000 and index 1 is +100000 it will be 0)

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
            date: dateFormatted, // ✅ Use `created_at` from AgentCommission
            departure: departureFormatted,
            customer: bk.contact_name,
            passport_id: bk.contact_passport_id,
            nationality: bk.contact_nationality,
            tickets: bk.total_passengers,
            payment_status: bk.payment_status,
            payment_method: bk.payment_method,
            gross_total: bk.gross_total,
            gross_total_in_usd: bk.gross_total_in_usd, // ✅ Include USD total
            exchange_rate: bk.exchange_rate, // ✅ Include exchange rate
            bank_fee: bk.bank_fee, // ✅ Include bank fee
            commission: commission.amount, // ✅ Extract commission amount correctly
            amount: amount,
            amount_paid: amountPaid || 0, // ✅ Include amount paid with default 0
            amount_invoiced: amountInvoiced || 0, // ✅ Include amount invoiced with default 0

            date_paid: datePaid ? datePaid : "-", // ✅ Include date paid with default "-"
            route,
          };
        })
        .filter(Boolean); // Remove null entries
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

      console.log("Total Gross Amount:", totalGrossAmount);
      console.log("Total Commission Amount:", totalCommissionAmount);
      console.log(
        "Total Amount is gross total - agent comission:",
        totalAmount
      );
      console.log("Total Bank Fee:", totalBankFee);
      console.log(
        "Total Amount Paid for the booking with paymen status paid:",
        totalAmountPaid
      );
      console.log("Sub Total:", subTotal);

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

      console.log("===Received query parameters:====", {
        agent_id,
        year,
        month,
        from_date,
        to_date,
        from_booking_date,
        to_booking_date,
      });

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

      console.log("AgentCommission conditions (invoiced):", whereConditions);
      console.log("Booking conditions (invoiced):", bookingWhereConditions);

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

      console.log(
        "Processed commissions (invoiced) with routes:",
        JSON.stringify(processedCommissions, null, 2)
      );
      res.status(200).json(processedCommissions);
    } catch (error) {
      console.error("Error fetching commissions (invoiced):", error);
      res
        .status(500)
        .json({ error: "Failed to retrieve commissions (invoiced)" });
    }
  },
};

module.exports = AgentCommissionController;
