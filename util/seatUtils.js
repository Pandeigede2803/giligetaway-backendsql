  console.log(" seatUtils.js loaded ");
  
  /**
   * Check if a seat number starts with "A".
   * @param {string} seatNumber - The seat number to check.
   * @returns {boolean} - True if the seat number starts with "A", otherwise false.
   */
  const isSeatNumberWithA = (seatNumber) =>
    seatNumber.toLowerCase().startsWith("a");;
  
  /**
   * Check if a seat number starts with "X".
   * @param {string} seatNumber - The seat number to check.
   * @returns {boolean} - True if the seat number starts with "X", otherwise false.
   */
  const isSeatNumberWithX = (seatNumber) =>
    seatNumber.toLowerCase().startsWith("x");
  
  /**
   * Add equivalent seat numbers based on specific conditions.
   * @param {Set<string>} resultSet - The set to store unique seat numbers.
   * @param {string} seatNumber - The seat number to process.
   */
  const addSeatPair = (resultSet, seatNumber) => {
    if (isSeatNumberWithA(seatNumber)) {
      const number = seatNumber.slice(1);
      resultSet.add(`R${number}`);
    } else if (seatNumber.startsWith("R")) {
      const number = seatNumber.slice(1);
      resultSet.add(`A${number}`);
    } else if (isSeatNumberWithX(seatNumber)) {
      const number = parseInt(seatNumber.slice(1), 10);
      const rNumber = `R${number + 2}`; // Shift X numbering to R
      resultSet.add(rNumber);
    } else if (seatNumber.startsWith("R")) {
      const number = parseInt(seatNumber.slice(1), 10);
      if (number > 2) {
        resultSet.add(`X${number - 2}`); // Reverse map R back to X
      }
    }
  };
  
  /**
   * Process booked seats based on the boost flag and add seat pairs.
   * @param {Set<string>} bookedSeatsSet - A set of unique booked seat numbers.
   * @param {boolean} boost - Whether to apply the boost logic.
   * @returns {string[]} - An array of processed booked seats.
   */
  const processBookedSeats = (bookedSeatsSet, boost) => {
    if (!boost) {
      return Array.from(bookedSeatsSet);
    }
  
    const resultSet = new Set(bookedSeatsSet);
    for (const seat of bookedSeatsSet) {
      console.log(`  Processing seat: ${seat}`);
      addSeatPair(resultSet, seat);
    }
  
    return Array.from(resultSet);
  };
  
  module.exports = {
    isSeatNumberWithA,
    isSeatNumberWithX,
    processBookedSeats,
  };
