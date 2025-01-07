  console.log(" seatUtils.js loaded ");
  

const isSeatNumberWithA = (seatNumber) =>
  seatNumber.toLowerCase().startsWith("a");


const isSeatNumberWithX = (seatNumber) =>
  seatNumber.toLowerCase().startsWith("x");


const addSeatPair = (resultSet, seatNumber) => {
  if (isSeatNumberWithA(seatNumber)) {
    const number = seatNumber.slice(1);
    resultSet.add(`R${number}`);
  } else if (seatNumber.startsWith("R")) {
    const number = seatNumber.slice(1);
    resultSet.add(`A${number}`);
  } else if (isSeatNumberWithX(seatNumber)) {
    const number = parseInt(seatNumber.slice(1), 10);
    const rNumber = `R${number + 2}`;
    resultSet.add(rNumber);
  } else if (seatNumber.startsWith("R")) {
    const number = parseInt(seatNumber.slice(1), 10);
    if (number > 2) {
      resultSet.add(`X${number - 2}`);
    }
  }
};


const processBookedSeats = (bookedSeatsSet, boost) => {
  console.log("🚀 Starting to process booked seats");
  console.log(`📋 Initial booked seats: ${Array.from(bookedSeatsSet).join(', ')}`);
  console.log(`🔧 Boost enabled: ${boost}`);

  // If boost is enabled, skip processing
  if (boost) {
    console.log("🛑 Boost is enabled. Returning original booked seats without processing.");
    return Array.from(bookedSeatsSet);
  }

  // If boost is not enabled, process the seats
  console.log("⚙️ Boost is not enabled. Processing booked seats...");
  const resultSet = new Set(bookedSeatsSet);

  for (const seat of bookedSeatsSet) {
    console.log(`🔍 Processing seat: ${seat}`);
    addSeatPair(resultSet, seat);
    console.log(`✅ Updated seat set after processing ${seat}: ${Array.from(resultSet).join(', ')}`);
  }

  console.log("🎉 Finished processing all seats. Final set of seats:");
  console.log(Array.from(resultSet).join(', '));

  return Array.from(resultSet);
};
  module.exports = {
    isSeatNumberWithA,
    isSeatNumberWithX,
    processBookedSeats,
  };
