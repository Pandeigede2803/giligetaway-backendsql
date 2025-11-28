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
 * Generate journey steps for round-trip bookings with chronological sorting.
 * This version sorts transits by time to handle both directions correctly.
 * @param {Object} schedule - Schedule object from DB (with Transits, FromDestination, ToDestination).
 * @param {Object} subSchedule - SubSchedule object (optional, for filtering actual route).
 * @returns {JourneyStep[]}
 */
const mapJourneyStepsRoundTrip = (schedule, subSchedule = null) => {
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
  let transits = [];

  // ✅ Use subSchedule's Transit1-4 if available (these are the correct route transits)
  if (subSchedule) {
    const subTransits = [
      subSchedule.Transit1,
      subSchedule.Transit2,
      subSchedule.Transit3,
      subSchedule.Transit4,
    ].filter(t => t !== null && t !== undefined);

    if (subTransits.length > 0) {
      // Sort by departure time to ensure chronological order
      transits = subTransits.sort((a, b) => {
        const timeA = a.departure_time || a.arrival_time;
        const timeB = b.departure_time || b.arrival_time;
        return timeA.localeCompare(timeB);
      });
    }
  } else {
    // Main schedule: use all transits from schedule
    const allTransits = schedule.Transits || [];
    transits = [...allTransits].sort((a, b) => {
      const timeA = a.departure_time || a.arrival_time;
      const timeB = b.departure_time || b.arrival_time;
      return timeA.localeCompare(timeB);
    });
  }

  console.log('  ✅ Using transits:', transits.map(t => `${t.Destination?.name} (dep: ${t.departure_time}, arr: ${t.arrival_time})`));

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

module.exports = { mapJourneyStepsRoundTrip };
