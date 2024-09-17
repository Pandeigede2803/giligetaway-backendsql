// Convert the day of the week (0-6) to bitmask value (Sunday = 1, Monday = 2, ..., Saturday = 64)
const getDayOfWeekMask = (date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    return 1 << dayOfWeek; // 2^dayOfWeek bitmask value
  };
  
  // Check if the provided bitmask includes the given dayOfWeek bitmask
  const isValidDayOfWeek = (daysOfWeek, dayOfWeekMask) => {
    return (daysOfWeek & dayOfWeekMask) !== 0;
  };
  
  module.exports = { getDayOfWeekMask, isValidDayOfWeek };
  