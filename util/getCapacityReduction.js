// utils/boatCapacityUtils.js

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

//   const boatId = boat?.id ;
//   const actualCapacity = boat?.capacity ;
  

  
//   // Calculate public capacity with safe fallback
//   const capacityReduction = BOAT_CAPACITY_REDUCTION[boatId] || 0;

//   const publicCapacity = Math.max(0, actualCapacity - capacityReduction);
 

//   return publicCapacity;
// };

const calculatePublicCapacity = (boat) => {
  return boat?.published_capacity ?? 0;
};

module.exports = {
  getBoatCapacityReduction,
  calculatePublicCapacity,
};
