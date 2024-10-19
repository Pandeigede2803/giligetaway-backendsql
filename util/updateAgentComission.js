// utils/utils.js
const { AgentMetrics,AgentCommission,  SeatAvailability } = require('../models');

const {  Agent, SubSchedule, Schedule } = require('../models');

const updateAgentCommission = async (
    agent_id, 
    gross_total, 
    total_passengers, 
    payment_status, 
    schedule_id, 
    subschedule_id, 
    booking_id, 
    transaction, 
    transports // Data transport dari pemesanan
  ) => {
    try {
      console.log('Step 1: Get the trip type based on schedule or subschedule');
      console.log("gross_total CUK:", gross_total); 
      
      // Step 1: Get the trip type based on schedule or subschedule
      let tripType;
      if (subschedule_id) {
        console.log(`Fetching trip type from SubSchedule with subschedule_id: ${subschedule_id}`);
        const subschedule = await SubSchedule.findOne({ where: { id: subschedule_id } });
        tripType = subschedule ? subschedule.trip_type : null;
        console.log(`Trip type from SubSchedule: ${tripType}`);
      } else if (schedule_id) {
        console.log(`Fetching trip type from Schedule with schedule_id: ${schedule_id}`);
        const schedule = await Schedule.findOne({ where: { id: schedule_id } });
        tripType = schedule ? schedule.trip_type : null;
        console.log(`Trip type from Schedule: ${tripType}`);
      }
  
      if (!tripType) {
        throw new Error('Trip type not found');
      }
  
      console.log(`Trip type determined: ${tripType}`);
  
      // Step 2: Get the agent's commission rates
      console.log(`Fetching commission rates for agent_id: ${agent_id}`);
      const agent = await Agent.findOne({ where: { id: agent_id } });
      const {
        commission_rate,        // Percentage (e.g., 15%)
        commission_long,        // Fixed amount (e.g., 150000)
        commission_short,       // Fixed amount
        commission_mid,         // Fixed amount
        commission_intermediate, // Fixed amount
        commission_transport     // Fixed amount for transport commission
      } = agent;
  
      console.log(`Commission rates for agent_id ${agent_id}:`);
      console.log(`commission_rate: ${commission_rate}`);
      console.log(`commission_long: ${commission_long}`);
      console.log(`commission_short: ${commission_short}`);
      console.log(`commission_mid: ${commission_mid}`);
      console.log(`commission_intermediate: ${commission_intermediate}`);
      console.log(`commission_transport: ${commission_transport}`);
  
      // Step 3: Determine the applicable commission rate
      let commissionAmount = 0;
      
      // Use the percentage-based commission if `commission_rate` is greater than 0
      if (parseFloat(commission_rate) > 0) {
        commissionAmount = gross_total * (commission_rate / 100); // Percentage-based commission
        console.log(`Percentage-based commission calculated: ${commissionAmount}`);
      } else {
        // Otherwise, use the fixed commission based on trip type
        console.log('No percentage commission, calculating based on trip type.');
        switch (tripType) {
          case 'long':
            commissionAmount = parseFloat(commission_long);
            console.log(`Commission for long trip type: ${commissionAmount}`);
            break;
          case 'short':
            commissionAmount = parseFloat(commission_short);
            console.log(`Commission for short trip type: ${commissionAmount}`);
            break;
          case 'mid':
            commissionAmount = parseFloat(commission_mid);
            console.log(`Commission for mid trip type: ${commissionAmount}`);
            break;
          case 'intermediate':
            commissionAmount = parseFloat(commission_intermediate);
            console.log(`Commission for intermediate trip type: ${commissionAmount}`);
            break;
          default:
            throw new Error('Invalid trip type');
        }
      }
  
      // Step 4: Add transport commission if transports exist
      if (transports && transports.length > 0) {
        console.log(`Transport commission exists, adding transport commission for agent_id ${agent_id}`);
        commissionAmount += parseFloat(commission_transport); // Add the transport commission
        console.log(`Total commission after adding transport commission: ${commissionAmount}`);
      }
  
      // Step 5: Insert the commission into the AgentCommission table
      console.log(`Inserting commission of ${commissionAmount} for agent_id ${agent_id} into AgentCommission table`);
      await AgentCommission.create({
        booking_id,
        agent_id,
        amount: commissionAmount
      }, { transaction });
  
      console.log(`Commission of ${commissionAmount} for agent_id ${agent_id} successfully added to AgentCommission`);
  
      // Return the commission amount and success status
      return {
        success: true,
        commission: commissionAmount
      };
    } catch (error) {
      console.error('Error updating agent commission:', error.message);
      throw error;
    }
  };
  
  module.exports = {
    updateAgentCommission,

};
