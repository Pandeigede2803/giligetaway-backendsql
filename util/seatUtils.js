  console.log(" seatUtils.js loaded ");
  

const isSeatNumberWithA = (seatNumber) =>
  seatNumber.toLowerCase().startsWith("a");


const isSeatNumberWithX = (seatNumber) =>
  seatNumber.toLowerCase().startsWith("x");


// const addSeatPair = (resultSet, seatNumber) => {
//   if (isSeatNumberWithA(seatNumber)) {
//     const number = seatNumber.slice(1);
//     resultSet.add(`R${number}`);
//   } else if (seatNumber.startsWith("R")) {
//     const number = seatNumber.slice(1);
//     resultSet.add(`A${number}`);
//   } else if (isSeatNumberWithX(seatNumber)) {
//     const number = parseInt(seatNumber.slice(1), 10);
//     const rNumber = `R${number + 2}`;
//     resultSet.add(rNumber);
//   } else if (seatNumber.startsWith("R")) {
//     const number = parseInt(seatNumber.slice(1), 10);
//     if (number > 2) {
//       resultSet.add(`X${number - 2}`);
//     }
//   }
// };

// Function to add a paired seat based on a given seat number
const addSeatPair = (resultSet, seatNumber) => {
  // If the seat number starts with "A", convert it to "R" with the same number
  if (isSeatNumberWithA(seatNumber)) {
    const number = seatNumber.slice(1); // Extract number after "A"
    resultSet.add(`R${number}`); // Add corresponding "R" seat
  } 
  // If the seat number starts with "R", convert it to "A" with the same number
  else if (seatNumber.startsWith("R")) {
    const number = seatNumber.slice(1); // Extract number after "R"
    resultSet.add(`A${number}`); // Add corresponding "A" seat
  } 
  // If the seat number starts with "X", add an "R" seat with an incremented number
  else if (isSeatNumberWithX(seatNumber)) {
    const number = parseInt(seatNumber.slice(1), 10); // Extract and convert the number after "X"
    const rNumber = `R${number + 2}`; // Create a new seat number with "R" prefix
    resultSet.add(rNumber); // Add it to the result set
  } 
  // If the seat number starts with "R", check if it’s greater than 2 and create an "X" seat
  else if (seatNumber.startsWith("R")) {
    const number = parseInt(seatNumber.slice(1), 10); // Extract and convert the number after "R"
    if (number > 2) {
      resultSet.add(`X${number - 2}`); // Create an "X" seat with a decremented number
    }
  }
};



// const processBookedSeats = (bookedSeatsSet, boost) => {
//   console.log("🚀 Starting to process booked seats");
//   console.log(`📋 Initial booked seats: ${Array.from(bookedSeatsSet).join(', ')}`);
//   console.log(`🔧 Boost enabled: ${boost}`);

//   // If boost is enabled, skip processing
//   if (boost) {
//     console.log("🛑 Boost is enabled. Returning original booked seats without processing.");
//     return Array.from(bookedSeatsSet);
//   }

//   // If boost is not enabled, process the seats
//   console.log("⚙️ Boost is not enabled. Processing booked seats...");
//   const resultSet = new Set(bookedSeatsSet);

//   for (const seat of bookedSeatsSet) {
//     console.log(`🔍 Processing seat: ${seat}`);
//     addSeatPair(resultSet, seat);
//     console.log(`✅ Updated seat set after processing ${seat}: ${Array.from(resultSet).join(', ')}`);
//   }

//   console.log("🎉 Finished processing all seats. Final set of seats:");
//   console.log(Array.from(resultSet).join(', '));

//   return Array.from(resultSet);
// };

// Function to process booked seats
const processBookedSeats = (bookedSeatsSet, boost,boatData) => {
 
  // If boost mode is enabled, return the original booked seats without processing
  if (boost) {
    console.log("🛑 Boost is enabled. Returning original booked seats without processing.");
    return Array.from(bookedSeatsSet);
  }

  // If boost mode is disabled, process the booked seats
  console.log("⚙️ Boost is not enabled. Processing booked seats...");
  const resultSet = new Set(bookedSeatsSet); // Copy the original booked seats into a new Set

  // Loop through each booked seat and add seat pairs
  for (const seat of bookedSeatsSet) {
    console.log(`🔍 Processing seat: ${seat}`);
    addSeatPair(resultSet, seat); // Add seat pair based on logic in addSeatPair function
    console.log(`✅ Updated seat set after processing ${seat}: ${Array.from(resultSet).join(', ')}`);
  }

  console.log("🎉 Finished processing all seats. Final set of seats:");
  console.log(Array.from(resultSet).join(', ')); // Log final processed seats

  return Array.from(resultSet); // Convert Set to Array and return the result
};



  module.exports = {
    isSeatNumberWithA,
    isSeatNumberWithX,
    processBookedSeats,
  };
