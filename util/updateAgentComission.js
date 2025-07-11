// utils/utils.js
const {
  AgentMetrics,
  AgentCommission,
  
  SeatAvailability,
} = require("../models");

const {  SubSchedule, Schedule } = require("../models");

const { Agent,   TransportBooking } = require("../models");

const updateAgentCommission = async (
  agent_id,
  gross_total,
  total_passengers,
  payment_status,
  schedule_id,
  subschedule_id,
  booking_id,
  transaction
) => {
  try {
    console.log("🟡 Step 1: Check existing commission");

    const existingCommission = await AgentCommission.findOne({
      where: { booking_id, agent_id },
      transaction,
    });

    if (existingCommission) {
      console.log(`⚠️ Commission for booking_id ${booking_id} & agent_id ${agent_id} already exists. Skipping.`);
      return {
        success: false,
        commission: existingCommission.amount,
      };
    }

    // Step 2: Get trip type
    let tripType;
    if (subschedule_id) {
      // console.log(`Fetching trip type from SubSchedule with subschedule_id: ${subschedule_id}`);
      const subschedule = await SubSchedule.findOne({ where: { id: subschedule_id } });
      tripType = subschedule ? subschedule.trip_type : null;
      // console.log(`Trip type from SubSchedule: ${tripType}`);
    } else if (schedule_id) {
      console.log(`Fetching trip type from Schedule with schedule_id: ${schedule_id}`);
      const schedule = await Schedule.findOne({ where: { id: schedule_id } });
      tripType = schedule ? schedule.trip_type : null;
      console.log(`Trip type from Schedule: ${tripType}`);
    }

    if (!tripType) throw new Error("❌ Trip type not found");

    // console.log(`✅ Trip type determined: ${tripType}`);

    // // Step 3: Fetch agent's commission data
    // console.log(`Fetching commission rates for agent_id: ${agent_id}`);
    const agent = await Agent.findOne({ where: { id: agent_id } });
    if (!agent) throw new Error(`Agent with id ${agent_id} not found`);

    const {
      commission_rate,
      commission_long,
      commission_short,
      commission_mid,
      commission_intermediate,
      commission_transport,
    } = agent;

    let commissionAmount = 0;

    if (parseFloat(commission_rate) > 0) {
      commissionAmount = gross_total * (commission_rate / 100);
      console.log(`✅ Percentage-based commission: ${commissionAmount}`);
    } else {
      switch (tripType) {
        case "long":
          commissionAmount = parseFloat(commission_long) * total_passengers;
          break;
        case "short":
          commissionAmount = parseFloat(commission_short) * total_passengers;
          break;
        case "mid":
          commissionAmount = parseFloat(commission_mid) * total_passengers;
          break;
        case "intermediate":
          commissionAmount = parseFloat(commission_intermediate) * total_passengers;
          break;
        default:
          throw new Error("Invalid trip type");
      }
      console.log(`✅ Fixed commission for trip type '${tripType}': ${commissionAmount}`);
    }

    // Step 4: Fetch transport directly from DB and check
    const transports = await TransportBooking.findAll({
      where: { booking_id },
      transaction,
    });

    console.log("transports:", transports);

    const hasTransport = Array.isArray(transports) && transports.some(
      t => ['pickup', 'dropoff'].includes(t?.transport_type)
    );

    console.log("hasTransport:", hasTransport);

    if (!hasTransport) {
      commissionAmount += parseFloat(commission_transport) * total_passengers;
      console.log(`🟡 No transport detected (pickup/dropoff missing), added commission: ${commissionAmount}`);
    } else {
      console.log(`✅ Transport exists, no extra transport commission.`);
    }

    // Step 5: Save commission
    console.log(`🟢 Inserting commission: booking_id=${booking_id}, agent_id=${agent_id}, amount=${commissionAmount}`);

    await AgentCommission.create(
      {
        booking_id,
        agent_id,
        amount: commissionAmount,
      },
      { transaction }
    );

    console.log(`✅ Successfully inserted commission for booking ${booking_id}, agent ${agent_id}`);

    return {
      success: true,
      commission: commissionAmount,
    };
  } catch (error) {
    console.error("❌ Error updating agent commission:", error.message);
    throw error;
  }
};





const updateAgentCommissionBulk = async (
  agent_id,
  gross_total,
  total_passengers,
  payment_status,
  schedule_id,
  subschedule_id,
  booking_id,
  transaction,
  transports
) => {
  try {
    console.log(`----- Commission DEBUG for booking_id: ${booking_id} -----`);
    console.log(`agent_id: ${agent_id}`);
    console.log(`booking_id: ${booking_id}`);
    console.log(`gross_total: ${gross_total}`);
    console.log(`total_passengers: ${total_passengers}`);
    
    // Validasi: Apakah komisi sudah ada?
    const existingCommission = await AgentCommission.findOne({
      where: { booking_id },
      transaction,
    });

    if (existingCommission) {
      console.log(`✅ Commission for booking_id ${booking_id} already exists. Skipping.`);
      console.log(`Existing commission amount: ${existingCommission.amount}`);
      console.log(`Existing commission ID: ${existingCommission.id}`);
      return {
        success: false,
        commission: existingCommission.amount,
      };
    }
    
    // Cek apakah booking_id valid
    if (!booking_id) {
      console.error(`❌ ERROR: Invalid booking_id: ${booking_id}`);
      throw new Error("Invalid booking_id");
    }
    
    // Cek apakah agent_id valid
    if (!agent_id) {
      console.error(`❌ ERROR: Invalid agent_id: ${agent_id}`);
      throw new Error("Invalid agent_id");
    }

    console.log("Step 1: Get the trip type based on schedule or subschedule");

    // Step 1: Get the trip type based on schedule or subschedule
    let tripType;
    if (subschedule_id) {
      console.log(`🔍 Fetching trip type from SubSchedule with subschedule_id: ${subschedule_id}`);
      const subschedule = await SubSchedule.findOne({
        where: { id: subschedule_id },
        transaction
      });
      tripType = subschedule ? subschedule.trip_type : null;
      console.log(`Trip type from SubSchedule: ${tripType}`);
    } else if (schedule_id) {
      console.log(`🔍 Fetching trip type from Schedule with schedule_id: ${schedule_id}`);
      const schedule = await Schedule.findOne({ 
        where: { id: schedule_id },
        transaction
      });
      tripType = schedule ? schedule.trip_type : null;
      console.log(`Trip type from Schedule: ${tripType}`);
    }

    if (!tripType) {
      console.error(`❌ Trip type not found for booking_id: ${booking_id}`);
      throw new Error("Trip type not found");
    }

    console.log(`✅ Trip type determined: ${tripType}`);

    // Step 2: Get the agent's commission rates
    console.log(`🔍 Fetching commission rates for agent_id: ${agent_id}`);
    const agent = await Agent.findOne({ 
      where: { id: agent_id },
      transaction
    });
    
    if (!agent) {
      console.error(`❌ Agent not found with ID: ${agent_id}`);
      throw new Error(`Agent not found with ID: ${agent_id}`);
    }
    
    const {
      commission_rate, // Percentage (e.g., 15%)
      commission_long, // Fixed amount (e.g., 150000)
      commission_short, // Fixed amount
      commission_mid, // Fixed amount
      commission_intermediate, // Fixed amount
      commission_transport, // Fixed amount for transport commission
    } = agent;

    console.log(`✅ Agent commission rates retrieved:`);
    console.log(`- commission_rate: ${commission_rate}`);
    console.log(`- commission_long: ${commission_long}`);
    console.log(`- commission_short: ${commission_short}`);
    console.log(`- commission_mid: ${commission_mid}`);
    console.log(`- commission_intermediate: ${commission_intermediate}`);
    console.log(`- commission_transport: ${commission_transport}`);

    // Step 3: Determine the applicable commission rate
    let commissionAmount = 0;

    // Parse gross_total as float to ensure proper calculation
    const parsedGrossTotal = parseFloat(gross_total);
    if (isNaN(parsedGrossTotal)) {
      console.warn(`⚠️ Warning: gross_total is not a valid number: ${gross_total}, using 0 instead`);
    }
    const safeGrossTotal = isNaN(parsedGrossTotal) ? 0 : parsedGrossTotal;

    // Use the percentage-based commission if `commission_rate` is greater than 0
    if (parseFloat(commission_rate) > 0) {
      commissionAmount = safeGrossTotal * (parseFloat(commission_rate) / 100); // Percentage-based commission
      console.log(`💰 Percentage-based commission calculated: ${commissionAmount} (${commission_rate}% of ${safeGrossTotal})`);
    } else {
      // Otherwise, use the fixed commission based on trip type and total passengers
      console.log("💰 No percentage commission, calculating based on trip type and total passengers.");
      switch (tripType) {
        case "long":
          commissionAmount = parseFloat(commission_long) * total_passengers;
          console.log(`💰 Commission for long trip type: ${commissionAmount} (${commission_long} × ${total_passengers})`);
          break;
        case "short":
          commissionAmount = parseFloat(commission_short) * total_passengers;
          console.log(`💰 Commission for short trip type: ${commissionAmount} (${commission_short} × ${total_passengers})`);
          break;
        case "mid":
          commissionAmount = parseFloat(commission_mid) * total_passengers;
          console.log(`💰 Commission for mid trip type: ${commissionAmount} (${commission_mid} × ${total_passengers})`);
          break;
        case "intermediate":
          commissionAmount = parseFloat(commission_intermediate) * total_passengers;
          console.log(`💰 Commission for intermediate trip type: ${commissionAmount} (${commission_intermediate} × ${total_passengers})`);
          break;
        default:
          console.error(`❌ Invalid trip type: ${tripType}`);
          throw new Error(`Invalid trip type: ${tripType}`);
      }
    }

    // Ensure commissionAmount is a valid number
    if (isNaN(commissionAmount)) {
      console.error(`❌ Calculated commission amount is not a valid number`);
      throw new Error("Invalid commission amount calculated");
    }

    // Komisi transportasi hanya akan mengurangi commissionAmount jika transportasi tidak ada
    if (transports && transports.length > 0) {
      console.log(`ℹ️ Transport data exists, transport commission will not reduce the commission for agent_id ${agent_id}`);
      console.log(`💰 Total commission remains the same: ${commissionAmount}`);
    } else {
      const transportDeduction = parseFloat(commission_transport) * total_passengers;
      console.log(`ℹ️ No transport data found, reducing commission with transport commission for agent_id ${agent_id}`);
      console.log(`Transport commission deduction: ${transportDeduction} (${commission_transport} × ${total_passengers})`);
      commissionAmount -= transportDeduction; // Calculate with total passengers
      console.log(`💰 Total commission after reducing transport commission: ${commissionAmount}`);
    }

    // Ensure final commission amount is at least 0
    commissionAmount = Math.max(0, commissionAmount);
    console.log(`💰 Final commission amount: ${commissionAmount}`);

    // Step 5: Insert the commission into the AgentCommission table
    console.log(`📝 Creating commission record of ${commissionAmount} for agent_id ${agent_id}, booking_id ${booking_id}`);
    
    try {
      const newCommission = await AgentCommission.create(
        {
          booking_id,
          agent_id,
          amount: commissionAmount,
          status: payment_status === 'paid' ? 'completed' : 'pending',
          schedule_id,
          subschedule_id: subschedule_id || null,
          created_at: new Date(),
          updated_at: new Date()
        },
        { transaction }
      );
      
      console.log(`✅ Commission record created successfully with ID: ${newCommission.id}`);
      
      // Double-check that commission was actually created
      const verifyCommission = await AgentCommission.findOne({
        where: { booking_id },
        transaction
      });
      
      if (verifyCommission) {
        console.log(`✅ Verified commission exists in database for booking_id ${booking_id}`);
      } else {
        console.warn(`⚠️ WARNING: Commission was created but could not be verified!`);
      }
    } catch (createError) {
      console.error(`❌ Error creating commission:`, createError);
      throw createError;
    }

    console.log(`✅ Commission of ${commissionAmount} for agent_id ${agent_id} successfully added to AgentCommission`);
    console.log(`----- End of commission processing for booking_id: ${booking_id} -----`);

    // Return the commission amount and success status
    return {
      success: true,
      commission: commissionAmount,
    };
  } catch (error) {
    console.error(`❌ Error updating agent commission for booking_id ${booking_id}:`, error.message);
    throw error;
  }
};


module.exports = {
  updateAgentCommission,
  updateAgentCommissionBulk,
};
