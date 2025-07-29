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
 * @returns {JourneyStep[]}
 */
const mapJourneySteps = (schedule) => {
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

  const steps = [];
  const transits = schedule.Transits || [];

  if (transits.length > 0) {
    steps.push({
      departuretime: schedule.departure_time,
      timearrived: transits[0].arrival_time,
      duration: calculateDuration(schedule.departure_time, transits[0].arrival_time),
      departure: schedule.FromDestination?.name || 'Origin',
      arrived: transits[0].Destination?.name || 'Transit',
      checkInTime: schedule.check_in_time,
    });

    for (let i = 0; i < transits.length - 1; i++) {
      steps.push({
        departuretime: transits[i].departure_time,
        timearrived: transits[i + 1].arrival_time,
        duration: calculateDuration(transits[i].departure_time, transits[i + 1].arrival_time),
        departure: transits[i].Destination?.name || 'Transit',
        arrived: transits[i + 1].Destination?.name || 'Transit',
        checkInTime: subtractThirtyMinutes(transits[i + 1].departure_time),
      });
    }

    const lastTransit = transits[transits.length - 1];
    steps.push({
      departuretime: lastTransit.departure_time,
      timearrived: schedule.arrival_time,
      duration: calculateDuration(lastTransit.departure_time, schedule.arrival_time),
      departure: lastTransit.Destination?.name || 'Transit',
      arrived: schedule.ToDestination?.name || 'Destination',
      checkInTime: subtractThirtyMinutes(schedule.departure_time),
    });
  } else {
    steps.push({
      departuretime: schedule.departure_time,
      timearrived: schedule.arrival_time,
      duration: calculateDuration(schedule.departure_time, schedule.arrival_time),
      departure: schedule.FromDestination?.name || 'Origin',
      arrived: schedule.ToDestination?.name || 'Destination',
      checkInTime: schedule.check_in_time,
    });
  }

  return steps;
};

module.exports = { mapJourneySteps };