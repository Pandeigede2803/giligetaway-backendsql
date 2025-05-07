const getBoatCapacityReduction = () => {
  // Load environment variables for boat capacity reductions
  return {
    1: parseInt(process.env.BOAT_1_CAPACITY_REDUCTION ),
    2: parseInt(process.env.BOAT_2_CAPACITY_REDUCTION ),
    3: parseInt(process.env.BOAT_3_CAPACITY_REDUCTION)
  };
};

// const calculatePublicCapacity = (boat) => {
//   const BOAT_CAPACITY_REDUCTION = getBoatCapacityReduction();
  
//   console.log('\n=== BOAT CAPACITY CALCULATION ===');
//   console.log('Raw Boat Input:', boat);
  
//   // Handle both direct boat object and sequelize model
//   const boatData = boat?.dataValues || boat;
  
//   if (!boatData) {
//     console.log('No boat data available');
//     return 0;
//   }
  
//   const boatId = boatData.id;
//   const actualCapacity = boatData.capacity;
  
//   console.log('Processed Boat Data:', {
//     id: boatId,
//     capacity: actualCapacity
//   });
  
//   const capacityReduction = BOAT_CAPACITY_REDUCTION[boatId] || 0;
//   const publicCapacity = Math.max(0, actualCapacity - capacityReduction);
  
//   console.log('Calculation Details:', {
//     originalCapacity: actualCapacity,
//     reduction: capacityReduction,
//     finalCapacity: publicCapacity
//   });
  
//   return publicCapacity;
// };

const calculatePublicCapacity = (boat) => {
  return boat?.published_capacity ?? 0;
};

module.exports = calculatePublicCapacity;