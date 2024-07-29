// utils/utils.js
const { AgentMetrics, Agent, SeatAvailability, SubSchedule } = require('../models');

// Fungsi untuk memperbarui metrik agen
const updateAgentMetrics = async (agent_id, gross_total, total_passengers, payment_status, transaction) => {
    console.log('Updating agent metrics:', { agent_id, gross_total, total_passengers, payment_status });
    const agentMetrics = await AgentMetrics.findOne({ where: { agent_id }, transaction });

    if (agentMetrics) {
        await updateExistingAgentMetrics(agentMetrics, gross_total, total_passengers, payment_status, agent_id, transaction);
    } else {
        await createNewAgentMetrics(agent_id, gross_total, total_passengers, payment_status, transaction);
    }
};

// Fungsi untuk memperbarui metrik agen yang sudah ada
const updateExistingAgentMetrics = async (agentMetrics, gross_total, total_passengers, payment_status, agent_id, transaction) => {
    console.log('Updating existing agent metrics:', { agent_id, gross_total, total_passengers, payment_status });
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
};

// Fungsi untuk membuat metrik agen baru
const createNewAgentMetrics = async (agent_id, gross_total, total_passengers, payment_status, transaction) => {
    console.log('Creating new agent metrics:', { agent_id, gross_total, total_passengers, payment_status });
    const agent = await Agent.findByPk(agent_id, { transaction });
    const commission = payment_status === 'paid' ? parseFloat(gross_total) * parseFloat(agent.commission_rate) / 100 : 0;
    const newAgentMetricsData = {
        agent_id,
        total_revenue: parseFloat(gross_total),
        total_bookings: 1,
        total_customers: total_passengers,
        pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
        gross_pending_payment: payment_status === 'pending' ? parseFloat(gross_total) : 0,
        outstanding: commission,
        net_profit: commission
    };
    await AgentMetrics.create(newAgentMetricsData, { transaction });
};


module.exports = {
    updateAgentMetrics,

};
