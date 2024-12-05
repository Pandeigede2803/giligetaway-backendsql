// utils/boatCapacityUtils.js

const getBoatCapacityReduction = () => {
  // Load environment variables for boat capacity reductions
  return {
    1: parseInt(process.env.BOAT_1_CAPACITY_REDUCTION || 6),
    2: parseInt(process.env.BOAT_2_CAPACITY_REDUCTION || 4),
    3: parseInt(process.env.BOAT_3_CAPACITY_REDUCTION || 2)
  };
};

const calculatePublicCapacity = (boat) => {
  const BOAT_CAPACITY_REDUCTION = getBoatCapacityReduction();
  
  // Get boat details with proper null checking
  const boatId = boat?.id || 0;
  const actualCapacity = boat?.capacity || 0;
  
  console.log('\n=== CAPACITY CALCULATION PROCESS ===');
  console.log('Boat ID:', boatId);
  console.log('Original Boat Capacity:', actualCapacity);
  
  // Calculate public capacity with safe fallback
  const capacityReduction = BOAT_CAPACITY_REDUCTION[boatId] || 0;
  console.log('Capacity Reduction for Boat', boatId + ':', capacityReduction);
  
  const publicCapacity = Math.max(0, actualCapacity - capacityReduction);
  console.log('Calculation:', `${actualCapacity} - ${capacityReduction} = ${publicCapacity}`);
  console.log('Final Public Capacity:', publicCapacity);
  console.log('===================================\n');

  return publicCapacity;
};

module.exports = {
  getBoatCapacityReduction,
  calculatePublicCapacity
};