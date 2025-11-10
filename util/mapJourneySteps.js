/**
 * @typedef {Object} JourneyStep
 * @property {string} departuretime
 * @property {string} timearrived
 * @property {string} duration
 * @property {string} departure
 * @property {string} arrived
 * @property {string} checkInTime
 */

/**
 * Generate journey steps based on schedule and transits.
 * @param {Object} schedule - Schedule object from DB (with Transits, FromDestination, ToDestination).
 * @param {Object} subSchedule - SubSchedule object (optional, for filtering actual route).
 * @returns {JourneyStep[]}
 */
const mapJourneySteps = (schedule, subSchedule = null) => {
  if (!schedule) return [];

  const calculateDuration = (startTime, endTime) => {
    const [sh, sm, ss] = startTime.split(':').map(Number);
    const [eh, em, es] = endTime.split(':').map(Number);

    let startDate = new Date();
    let endDate = new Date();
    startDate.setHours(sh, sm, ss);
    endDate.setHours(eh, em, es);

    if (endDate < startDate) endDate.setDate(endDate.getDate() + 1);

    const diff = endDate - startDate;
    const h = String(Math.floor(diff / 36e5)).padStart(2, '0');
    const m = String(Math.floor((diff % 36e5) / 6e4)).padStart(2, '0');
    return `${h}:${m}:00`;
  };

  const subtractThirtyMinutes = (time) => {
    const [h, m, s] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m - 30, s);
    return date.toTimeString().slice(0, 8);
  };

  // If subSchedule exists, use its from/to destinations
  let fromDestination, toDestination, departureTime, arrivalTime, checkInTime;

  if (subSchedule) {
    // SubSchedule has specific route segment
    fromDestination = subSchedule.DestinationFrom || subSchedule.TransitFrom?.Destination;
    toDestination = subSchedule.DestinationTo || subSchedule.TransitTo?.Destination;

    // Determine departure time
    if (subSchedule.TransitFrom) {
      departureTime = subSchedule.TransitFrom.departure_time;
    } else {
      departureTime = schedule.departure_time;
    }

    // Determine arrival time
    if (subSchedule.TransitTo) {
      arrivalTime = subSchedule.TransitTo.arrival_time;
    } else if (subSchedule.DestinationTo) {
      arrivalTime = schedule.arrival_time;
    } else {
      arrivalTime = schedule.arrival_time;
    }

    checkInTime = subSchedule.Schedule?.check_in_time || schedule.check_in_time;
  } else {
    // Main schedule: full route
    fromDestination = schedule.FromDestination;
    toDestination = schedule.ToDestination;
    departureTime = schedule.departure_time;
    arrivalTime = schedule.arrival_time;
    checkInTime = schedule.check_in_time;
  }

  const steps = [];
  const allTransits = schedule.Transits || [];

  // Filter transits: only include those BETWEEN fromDestination and toDestination
  let filteredTransits = [];

  if (subSchedule && allTransits.length > 0) {
    const fromDestId = fromDestination?.id;
    const toDestId = toDestination?.id;

    // Find indices of from/to in the transit chain
    let fromIsOrigin = fromDestId === schedule.FromDestination?.id;
    let toIsFinalDest = toDestId === schedule.ToDestination?.id;

    let fromTransitIndex = fromIsOrigin ? -1 : allTransits.findIndex(t => t.destination_id === fromDestId);
    let toTransitIndex = toIsFinalDest ? allTransits.length : allTransits.findIndex(t => t.destination_id === toDestId);

    // Get transits BETWEEN from and to (not including them)
    if (fromTransitIndex !== -1 && toTransitIndex !== -1) {
      // fromTransitIndex + 1 = start after the from transit
      // toTransitIndex = stop before the to transit
      filteredTransits = allTransits.slice(fromTransitIndex + 1, toTransitIndex);
    } else if (fromIsOrigin && toTransitIndex !== -1) {
      // From origin to a transit: include transits before the to transit
      filteredTransits = allTransits.slice(0, toTransitIndex);
    } else if (fromTransitIndex !== -1 && toIsFinalDest) {
      // From a transit to final destination: include transits after the from transit
      filteredTransits = allTransits.slice(fromTransitIndex + 1);
    } else if (fromIsOrigin && toIsFinalDest) {
      // Full route
      filteredTransits = allTransits;
    }
  } else if (!subSchedule) {
    // Use all transits for main schedule
    filteredTransits = allTransits;
  }

  const transits = filteredTransits;

  if (transits.length > 0) {
    steps.push({
      departuretime: departureTime,
      timearrived: transits[0].arrival_time,
      duration: calculateDuration(departureTime, transits[0].arrival_time),
      departure: fromDestination?.name || 'Origin',
      arrived: transits[0].Destination?.name || 'Transit',
      checkInTime: checkInTime,
    });

    for (let i = 0; i < transits.length - 1; i++) {
      steps.push({
        departuretime: transits[i].departure_time,
        timearrived: transits[i + 1].arrival_time,
        duration: calculateDuration(transits[i].departure_time, transits[i + 1].arrival_time),
        departure: transits[i].Destination?.name || 'Transit',
        arrived: transits[i + 1].Destination?.name || 'Transit',
        checkInTime: subtractThirtyMinutes(transits[i].departure_time),
      });
    }

    const lastTransit = transits[transits.length - 1];
    steps.push({
      departuretime: lastTransit.departure_time,
      timearrived: arrivalTime,
      duration: calculateDuration(lastTransit.departure_time, arrivalTime),
      departure: lastTransit.Destination?.name || 'Transit',
      arrived: toDestination?.name || 'Destination',
      checkInTime: subtractThirtyMinutes(lastTransit.departure_time),
    });
  } else {
    steps.push({
      departuretime: departureTime,
      timearrived: arrivalTime,
      duration: calculateDuration(departureTime, arrivalTime),
      departure: fromDestination?.name || 'Origin',
      arrived: toDestination?.name || 'Destination',
      checkInTime: checkInTime,
    });
  }

  return steps;
};

module.exports = { mapJourneySteps };