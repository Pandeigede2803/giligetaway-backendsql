const createBooking = async (data, transaction) => {
    return await Booking.create(data, { transaction });
};

const fetchSchedule = async (schedule_id, transaction) => {
    const schedule = await Schedule.findByPk(schedule_id, { transaction });
    if (!schedule) {
        throw new Error(`Schedule with ID ${schedule_id} not found.`);
    }
    return schedule;
};

const updateScheduleSeats = async (schedule, total_passengers, transaction) => {
    if (schedule.available_seats < total_passengers) {
        throw new Error('Not enough seats available on the schedule.');
    }
    await schedule.update({ available_seats: schedule.available_seats - total_passengers }, { transaction });
};

const addPassengers = async (passengers, booking_id, transaction) => {
    const passengerData = passengers.map((passenger) => ({
        booking_id,
        ...passenger
    }));
    await Passenger.bulkCreate(passengerData, { transaction });
};

const addTransportBookings = async (transports, booking_id, total_passengers, transaction) => {
    const transportData = transports.map((transport) => ({
        booking_id,
        transport_id: transport.transport_id,
        quantity: transport.quantity || total_passengers,
        transport_type: transport.transport_type,
        note: transport.note
    }));
    await TransportBooking.bulkCreate(transportData, { transaction });
};

const updateAgentMetrics = async (agent_id, gross_total, total_passengers, payment_status, transaction) => {
    const agentMetrics = await AgentMetrics.findOne({ where: { agent_id }, transaction });

    if (agentMetrics) {
        agentMetrics.total_revenue += parseFloat(gross_total);
        agentMetrics.total_bookings += 1;
        agentMetrics.total_customers += total_passengers;
        if (payment_status === 'pending') {
            agentMetrics.pending_payment += parseFloat(gross_total);
            agentMetrics.gross_pending_payment += parseFloat(gross_total);
        } else if (payment_status === 'paid') {
            const agent = await Agent.findByPk(agent_id, { transaction });
            const commission = parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100;
            agentMetrics.outstanding += commission;
            agentMetrics.net_profit += commission;
        }
        await agentMetrics.save({ transaction });
    } else {
        const agent = await Agent.findByPk(agent_id, { transaction });
        const newAgentMetricsData = {
            agent_id,
            total_revenue: parseFloat(gross_total),
            total_bookings: 1,
            total_customers: total_passengers,
            pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
            gross_pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
            outstanding: payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0,
            net_profit: payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0
        };
        await AgentMetrics.create(newAgentMetricsData, { transaction });
    }
};


module.exports = {
    createBooking,
    fetchSchedule,
    updateScheduleSeats,
    addPassengers,
    addTransportBookings,
    updateAgentMetrics
}