const { Op } = require('sequelize');
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
  } = require("../models"); // Pastikan jalur impor benar
  const AgentCommissionController = {
    // Fetch commissions with optional filters: month, year, agent_id
   // Fetch commissions with optional filters: month, year, agent_id, or from_date, to_date
   async getCommissions(req, res) {
    try {
      console.log("Received query parameters:", req.query);
  
      const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
  
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
        console.log("✅ Filter AgentCommission.created_at by custom range:", start, "-", end);
      } 
      else if (year) {
        // Fallback ke year/month
        whereConditions.created_at = {};
        if (month) {
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfMonth;
          whereConditions.created_at[Op.lte] = endOfMonth;
          console.log("✅ Filter AgentCommission.created_at by month:", startOfMonth, "-", endOfMonth);
        } else {
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31, 23, 59, 59);
          whereConditions.created_at[Op.gte] = startOfYear;
          whereConditions.created_at[Op.lte] = endOfYear;
          console.log("✅ Filter AgentCommission.created_at by year:", startOfYear, "-", endOfYear);
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
        console.log("✅ Filter Booking.booking_date by range:", startBooking, "-", endBooking);
      }
      // Jika from_booking_date/to_booking_date tidak ada, booking_date tidak difilter
  
      console.log("📝 AgentCommission conditions:", whereConditions);
      console.log("📝 Booking conditions:", bookingWhereConditions);
  
      // Query AgentCommission + join ke Booking 
      const commissions = await AgentCommission.findAll({
        where: whereConditions,
        include: {
          model: Booking,
          as: 'Booking',
          where: { payment_status: ['invoiced', 'paid'],
            ...bookingWhereConditions // ✅ Ensure this is included!
           },  // Hanya ambil booking dengan status invoiced
          attributes: [
            'id','contact_name','contact_phone','contact_email',
            'schedule_id','subschedule_id','gross_total','currency','payment_status','payment_method',
            'booking_date','total_passengers','adult_passengers',
            'child_passengers','infant_passengers','ticket_id','booking_source'
          ],
          include: [
            {
              model: Schedule,
              as: 'schedule',
              attributes: ['id', 'departure_time', 'arrival_time', 'trip_type'],
              include: [
                {
                  model: Destination,
                  as: 'FromDestination',
                  attributes: ['id', 'name']
                },
                {
                  model: Destination,
                  as: 'ToDestination',
                  attributes: ['id', 'name']
                }
              ]
            },

            {
                model:TransportBooking,
                as:'transportBookings',
                include:[
                {
                  model: Transport,
                  as: 'Transport',
        
                }
            ]

            },
            {
              model: SubSchedule,
              as: 'subSchedule',
              attributes: ['id', 'validity_start', 'validity_end', 'trip_type'],
              include: [
                {
                  model: Destination,
                  as: 'DestinationFrom',
                  attributes: ['id', 'name']
                },
                {
                  model: Destination,
                  as: 'DestinationTo',
                  attributes: ['id', 'name']
                },
                {
                  model: Transit,
                  as: 'TransitFrom',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'TransitTo',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit1',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit2',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit3',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit4',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                }
              ]
            }
          ]
        }
      });
  
      // Process commissions to add route names
      const processedCommissions = commissions.map((commission) => {
        const booking = commission.Booking;
        let route = '';
        if (booking?.subSchedule) {
          route = [
            booking.subSchedule.DestinationFrom?.name,
            booking.subSchedule.TransitFrom?.Destination?.name,
            booking.subSchedule.Transit1?.Destination?.name,
            booking.subSchedule.Transit2?.Destination?.name,
            booking.subSchedule.Transit3?.Destination?.name,
            booking.subSchedule.Transit4?.Destination?.name,
            booking.subSchedule.TransitTo?.Destination?.name,
            booking.subSchedule.DestinationTo?.name
          ].filter(Boolean).join(' - ');
        } else if (booking?.schedule) {
          route = [
            booking.schedule.FromDestination?.name,
            booking.schedule.ToDestination?.name
          ].filter(Boolean).join(' - ');
        }
        return {
          ...commission.toJSON(),
          route,
        };
      });
  

      res.status(200).json(processedCommissions);
  
    } catch (error) {
      console.error('Error fetching commissions:', error);
      res.status(500).json({ error: 'Failed to retrieve commissions' });
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
      to_booking_date
    } = req.query;

    console.log("===Received query parameters:====", {
      agent_id, year, month, from_date, to_date, from_booking_date, to_booking_date
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
      console.log("✅ Filter AgentCommission.created_at by custom range (invoiced):", start, "-", end);
    }
    else if (year) {
      whereConditions.created_at = {};
      if (month) {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        whereConditions.created_at[Op.gte] = startOfMonth;
        whereConditions.created_at[Op.lte] = endOfMonth;
        console.log("✅ Filter AgentCommission.created_at by month (invoiced):", startOfMonth, "-", endOfMonth);
      } else {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);
        whereConditions.created_at[Op.gte] = startOfYear;
        whereConditions.created_at[Op.lte] = endOfYear;
        console.log("✅ Filter AgentCommission.created_at by year (invoiced):", startOfYear, "-", endOfYear);
      }
    }

    // 2. bookingWhereConditions untuk filter booking_date + payment_status
    const bookingWhereConditions = {
      payment_status: 'invoiced' // Hanya invoiced
    };

    if (from_booking_date && to_booking_date) {
      const startBooking = new Date(from_booking_date);
      const endBooking = new Date(to_booking_date);
      bookingWhereConditions.booking_date = {
        [Op.gte]: startBooking,
        [Op.lte]: endBooking,
      };
      console.log("✅ Filter Booking.booking_date range (invoiced):", startBooking, "-", endBooking);
    }
    // Jika from_booking_date/to_booking_date tidak ada, booking_date tidak difilter 
    // tapi masih payment_status = 'invoiced'

    console.log("AgentCommission conditions (invoiced):", whereConditions);
    console.log("Booking conditions (invoiced):", bookingWhereConditions);

    const commissions = await AgentCommission.findAll({
        where: whereConditions,
        include: {
          model: Booking,
          as: 'Booking',
          where: { payment_status: 'invoiced' },  // Hanya ambil booking dengan status invoiced
          attributes: [
            'id','contact_name','contact_phone','contact_email',
            'schedule_id','subschedule_id','gross_total','currency','payment_status','payment_method',
            'booking_date','total_passengers','adult_passengers',
            'child_passengers','infant_passengers','ticket_id','booking_source'
          ],
          include: [
            {
              model: Schedule,
              as: 'schedule',
              attributes: ['id', 'departure_time', 'arrival_time', 'trip_type'],
              include: [
                {
                  model: Destination,
                  as: 'FromDestination',
                  attributes: ['id', 'name']
                },
                {
                  model: Destination,
                  as: 'ToDestination',
                  attributes: ['id', 'name']
                }
              ]
            },
            {
              model: SubSchedule,
              as: 'subSchedule',
              attributes: ['id', 'validity_start', 'validity_end', 'trip_type'],
              include: [
                {
                  model: Destination,
                  as: 'DestinationFrom',
                  attributes: ['id', 'name']
                },
                {
                  model: Destination,
                  as: 'DestinationTo',
                  attributes: ['id', 'name']
                },
                {
                  model: Transit,
                  as: 'TransitFrom',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'TransitTo',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit1',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit2',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit3',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                },
                {
                  model: Transit,
                  as: 'Transit4',
                  attributes: ['id'],
                  include: {
                    model: Destination,
                    as: "Destination",
                    attributes: ["id", "name"],
                  },
                }
              ]
            }
          ]
        }
      });
    const processedCommissions = commissions.map((commission) => {
      const booking = commission.Booking;
      let route = '';
      if (booking?.subSchedule) {
        route = [
          booking.subSchedule.DestinationFrom?.name,
          booking.subSchedule.TransitFrom?.Destination?.name,
          booking.subSchedule.Transit1?.Destination?.name,
          booking.subSchedule.Transit2?.Destination?.name,
          booking.subSchedule.Transit3?.Destination?.name,
          booking.subSchedule.Transit4?.Destination?.name,
          booking.subSchedule.TransitTo?.Destination?.name,
          booking.subSchedule.DestinationTo?.name
        ].filter(Boolean).join(' - ');
      } else if (booking?.schedule) {
        route = [
          booking.schedule.FromDestination?.name,
          booking.schedule.ToDestination?.name
        ].filter(Boolean).join(' - ');
      }
      return {
        ...commission.toJSON(),
        route
      };
    });

    console.log("Processed commissions (invoiced) with routes:", JSON.stringify(processedCommissions, null, 2));
    res.status(200).json(processedCommissions);
  } catch (error) {
    console.error('Error fetching commissions (invoiced):', error);
    res.status(500).json({ error: 'Failed to retrieve commissions (invoiced)' });
  }
}
};



module.exports = AgentCommissionController;
