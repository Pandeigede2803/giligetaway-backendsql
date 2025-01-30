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
    async getCommissions(req, res) {
        try {
            // const { month, year, agent_id } = req.query;

            // console.log("Received query parameters:", { month, year, agent_id });;;;;;

            const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
            const year = req.query.year ? parseInt(req.query.year, 10) : null;
            const month = req.query.month ? parseInt(req.query.month, 10) : null;
            
            // Build dynamic query conditions
            const whereConditions = {};
            
            // Ensure `agent_id` is included as an integer
            if (agentId) whereConditions.agent_id = agentId;
            
            // Ensure `created_at` filter is correctly applied
            if (year) {
                whereConditions.created_at = {};
            
                if (month) {
                    // ✅ Fix: Use UTC to prevent timezone mismatches
                    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
                    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));
            
                    whereConditions.created_at[Op.gte] = startOfMonth;
                    whereConditions.created_at[Op.lte] = endOfMonth;
            
                    console.log("✅ Added month range to conditions:", startOfMonth.toISOString(), "-", endOfMonth.toISOString());
                } else {
                    // ✅ Fix: Ensure entire year is covered correctly
                    const startOfYear = new Date(Date.UTC(year, 0, 1));
                    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
            
                    whereConditions.created_at[Op.gte] = startOfYear;
                    whereConditions.created_at[Op.lte] = endOfYear;
            
                    console.log("✅ Added year range to conditions:", startOfYear.toISOString(), "-", endOfYear.toISOString());
                }
            }
            
            // ✅ Log the final query conditions for debugging
            console.log("📝 Final query conditions:", JSON.stringify(whereConditions, null, 2));
            
            console.log("Final query conditions:", whereConditions);

            // Query with detailed associations
            const commissions = await AgentCommission.findAll({
                where: whereConditions,
                include: {
                    model: Booking,
                    as: 'Booking',
                    attributes: [
                        'id', 'contact_name', 'contact_phone', 'contact_email',
                        'schedule_id', 'subschedule_id', 'gross_total', 'currency', 'payment_status','payment_method',
                        'booking_date', 'total_passengers', 'adult_passengers', 
                        'child_passengers', 'infant_passengers','ticket_id','booking_source'
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

            // Process commissions to add route names
            const processedCommissions = commissions.map((commission) => {
                const booking = commission.Booking;

                // Extract route names based on SubSchedule or Schedule
                let route = '';
                if (booking.subSchedule) {
                    // SubSchedule route
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
                } else if (booking.schedule) {
                    // Schedule route if SubSchedule is not available
                    route = [
                        booking.schedule.FromDestination?.name,
                        booking.schedule.ToDestination?.name
                    ].filter(Boolean).join(' - ');
                }

                // Add the computed route to the commission data
                return {
                    ...commission.toJSON(),
                    route
                };
            });

            console.log("Processed commissions with routes:", JSON.stringify(processedCommissions, null, 2));

            // Return processed data with status 200 for success
            res.status(200).json(processedCommissions);
        } catch (error) {
            // Log error and return with status 500 for failure
            console.error('Error fetching commissions:', error);
            res.status(500).json({ error: 'Failed to retrieve commissions' });
        }
    },

    async getCommissionsInvoiced(req, res) {
        try {
            const { month, year, agent_id } = req.query;

            console.log("===Received query parameters:====", { month, year, agent_id });;;;;;

            // Build dynamic query conditions
            const whereConditions = {};
            if (agent_id) whereConditions.agent_id = agent_id;
            
            if (year) {
                whereConditions.created_at = {};
                if (month) {
                    const startOfMonth = new Date(year, month - 1, 1);
                    const endOfMonth = new Date(year, month, 0);
                    whereConditions.created_at[Op.gte] = startOfMonth;
                    whereConditions.created_at[Op.lte] = endOfMonth;
                    console.log("Added month range to conditions:", startOfMonth, "-", endOfMonth);
                } else {
                    const startOfYear = new Date(year, 0, 1);
                    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
                    whereConditions.created_at[Op.gte] = startOfYear;
                    whereConditions.created_at[Op.lte] = endOfYear;
                    console.log("Added year range to conditions:", startOfYear, "-", endOfYear);
                }
            }

            console.log("Final query conditions:", whereConditions);

            // Query with detailed associations
            const commissions = await AgentCommission.findAll({
                where: whereConditions,
                include: {
                    model: Booking,
                    as: 'Booking',
                    where: { payment_status: 'invoiced' },
                    attributes: [
                        'id', 'contact_name', 'contact_phone', 'contact_email',
                        'schedule_id', 'subschedule_id', 'gross_total', 'currency', 'payment_status','payment_method',
                        'booking_date', 'total_passengers', 'adult_passengers', 
                        'child_passengers', 'infant_passengers','ticket_id','booking_source'
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

            // Process commissions to add route names
            const processedCommissions = commissions.map((commission) => {
                const booking = commission.Booking;

                // Extract route names based on SubSchedule or Schedule
                let route = '';
                if (booking.subSchedule) {
                    // SubSchedule route
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
                } else if (booking.schedule) {
                    // Schedule route if SubSchedule is not available
                    route = [
                        booking.schedule.FromDestination?.name,
                        booking.schedule.ToDestination?.name
                    ].filter(Boolean).join(' - ');
                }

                // Add the computed route to the commission data
                return {
                    ...commission.toJSON(),
                    route
                };
            });

            console.log("Processed commissions with routes:", JSON.stringify(processedCommissions, null, 2));

            // Return processed data with status 200 for success
            res.status(200).json(processedCommissions);
        } catch (error) {
            // Log error and return with status 500 for failure
            console.error('Error fetching commissions:', error);
            res.status(500).json({ error: 'Failed to retrieve commissions' });
        }
    }
};



module.exports = AgentCommissionController;
