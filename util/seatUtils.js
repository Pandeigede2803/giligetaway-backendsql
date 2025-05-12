  console.log(" seatUtils.js loaded ");
  

// const isSeatNumberWithA = (seatNumber) =>
//   seatNumber.toLowerCase().startsWith("a");


// const isSeatNumberWithX = (seatNumber) =>
//   seatNumber.toLowerCase().startsWith("x");

// const if seat number with R

const isSeatNumberWithR = (seatNumber) =>
  seatNumber.toLowerCase().startsWith("r");

const isSeatNumberWithA = (seatNumber) => seatNumber.startsWith("A");
const isSeatNumberWithX = (seatNumber) => seatNumber.startsWith("X");





// // const addSeatPair = (resultSet, seatNumber) => {
// //   if (isSeatNumberWithA(seatNumber)) {
// //     const number = seatNumber.slice(1);
// //     resultSet.add(`R${number}`);
// //   } else if (seatNumber.startsWith("R")) {
// //     const number = seatNumber.slice(1);
// //     resultSet.add(`A${number}`);
// //   } else if (isSeatNumberWithX(seatNumber)) {
// //     const number = parseInt(seatNumber.slice(1), 10);
// //     const rNumber = `R${number + 2}`;
// //     resultSet.add(rNumber);
// //   } else if (seatNumber.startsWith("R")) {
// //     const number = parseInt(seatNumber.slice(1), 10);
// //     if (number > 2) {
// //       resultSet.add(`X${number - 2}`);
// //     }
// //   }
// // };

// // Function to add a paired seat based on a given seat number
// const addSeatPair = (resultSet, seatNumber) => {
//   // If the seat number starts with "A", convert it to "R" with the same number
//   if (isSeatNumberWithA(seatNumber)) {
//     const number = seatNumber.slice(1); // Extract number after "A"
//     resultSet.add(`R${number}`); // Add corresponding "R" seat
//   } 
//   // If the seat number starts with "R", convert it to "A" with the same number
//   else if (seatNumber.startsWith("R")) {
//     const number = seatNumber.slice(1); // Extract number after "R"
//     resultSet.add(`A${number}`); // Add corresponding "A" seat
//   } 
//   // If the seat number starts with "X", add an "R" seat with an incremented number
//   else if (isSeatNumberWithX(seatNumber)) {
//     const number = parseInt(seatNumber.slice(1), 10); // Extract and convert the number after "X"
//     const rNumber = `R${number + 2}`; // Create a new seat number with "R" prefix
//     resultSet.add(rNumber); // Add it to the result set
//   } 
//   // If the seat number starts with "R", check if it’s greater than 2 and create an "X" seat
//   else if (seatNumber.startsWith("R")) {
//     const number = parseInt(seatNumber.slice(1), 10); // Extract and convert the number after "R"
//     if (number > 2) {
//       resultSet.add(`X${number - 2}`); // Create an "X" seat with a decremented number
//     }
//   }
// };

// const addSeatPairBoat2 = (resultSet, seatNumber) => {
 
//   // If the seat number starts with "X", add an "R" seat with an incremented number
//   if (isSeatNumberWithX(seatNumber)) {
//     const number = parseInt(seatNumber.slice(1), 10); // Extract and convert the number after "X"
//     const rNumber = `R${number + 2}`; // Create a new seat number with "R" prefix
//     resultSet.add(rNumber); // Add it to the result set
//   } 
//   // If the seat number starts with "R", check if it’s greater than 2 and create an "X" seat
//   else if (seatNumber.startsWith("R")) {
//     const number = parseInt(seatNumber.slice(1), 10); // Extract and convert the number after "R"
//     if (number > 2) {
//       resultSet.add(`X${number - 2}`); // Create an "X" seat with a decremented number
//     }
//   }
// };


const addSeatPair = (resultSet, seatNumber) => {
  if (isSeatNumberWithA(seatNumber)) {
    const number = seatNumber.slice(1); // Ambil angka setelah "A"
    resultSet.add(`R${number}`); // Tambahkan kursi dengan awalan "R"
  } 
  // Jika kursi diawali dengan "R", ubah menjadi "X" dengan angka dikurangi 2 jika lebih dari 2
  else if (seatNumber.startsWith("R")) {
    const number = parseInt(seatNumber.slice(1), 10);
    if (number > 2) {
      resultSet.add(`X${number - 2}`); // R ke X (misalnya R3 → X1, R4 → X2)
    }
  } 
  // Jika kursi diawali dengan "X", ubah menjadi "R" dengan angka bertambah 2
  else if (isSeatNumberWithX(seatNumber)) {
    const number = parseInt(seatNumber.slice(1), 10);
    resultSet.add(`R${number + 2}`); // X ke R (misalnya X1 → R3, X2 → R4)
  }
};

const addSeatPairBoat2 = (resultSet, seatNumber) => {
  // Jika kursi diawali dengan "X", ubah menjadi "R" dengan angka bertambah 2
  if (isSeatNumberWithX(seatNumber)) {
    const number = parseInt(seatNumber.slice(1), 10);
    resultSet.add(`R${number + 2}`); // X ke R (misalnya X1 → R3)
  } 
  // Jika kursi diawali dengan "R", ubah menjadi "X" dengan angka dikurangi 2
  else if (seatNumber.startsWith("R")) {
    const number = parseInt(seatNumber.slice(1), 10);
    if (number > 2) {
      resultSet.add(`X${number - 2}`); // R ke X (misalnya R3 → X1)
    }
  }
};

// Fungsi utilitas untuk pengecekan awalan kursi















const processBookedSeats = (bookedSeatsSet, boost, boatData) => {
 
  // If boost mode is enabled and boatData.Boat.id is 2, use addSeatPairBoat2
  if (boost && boatData.id=== 2) {
    // console.log("🚤 Boost enabled for Boat ID 2. Using addSeatPairBoat2.");
    const resultSet = new Set(bookedSeatsSet);

    for (const seat of bookedSeatsSet) {
      // console.log(`🔍 Processing seat: ${seat} with addSeatPairBoat2`);
      addSeatPairBoat2(resultSet, seat);
      // console.log(`✅ Updated seat set after processing ${seat}: ${Array.from(resultSet).join(', ')}`);
    }

    return Array.from(resultSet);
  }

  // If boost mode is enabled but not for Boat ID 2, return the original booked seats without processing
  if (boost) {
    // console.log("🛑 Boost is enabled. Returning original booked seats without processing.");
    return Array.from(bookedSeatsSet);
  }

  // If boost mode is disabled, process the booked seats using addSeatPair
  // console.log("⚙️ Boost is not enabled. Processing booked seats...");
  const resultSet = new Set(bookedSeatsSet); 

  for (const seat of bookedSeatsSet) {
    // console.log(`🔍 Processing seat: ${seat}`);
    addSeatPair(resultSet, seat);
    // console.log(`✅ Updated seat set after processing ${seat}: ${Array.from(resultSet).join(', ')}`);
  }

  // console.log("🎉 Finished processing all seats. Final set of seats:");
  // console.log(Array.from(resultSet).join(', '));

  return Array.from(resultSet);
};



  module.exports = {
    isSeatNumberWithA,
    isSeatNumberWithX,
    processBookedSeats,
  };
