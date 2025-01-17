const calculateDepartureAndArrivalTimes = (schedule, subSchedule) => {
    if (!subSchedule) {
      // Jika subschedule null, gunakan departure_time dan arrival_time dari schedule
      return {
        departure_time: schedule.departure_time,
        arrival_time: schedule.arrival_time,
      };
    }
  
    // Jika subschedule tidak null, cek setiap kondisi
    const times = {
      departure_time: null,
      arrival_time: null,
    };
  
    // Periksa destination_from_schedule_id
    if (subSchedule.destination_from_schedule_id) {
      times.departure_time = schedule.departure_time;
    }
  
    // Periksa destination_to_schedule_id
    if (subSchedule.destination_to_schedule_id) {
      times.arrival_time = schedule.arrival_time;
    }
  
    // Periksa transit_from_id
    if (subSchedule.transit_from_id && subSchedule.TransitFrom) {
      times.departure_time = subSchedule.TransitFrom.departure_time;
    }
  
    // Periksa transit_to_id
    if (subSchedule.transit_to_id && subSchedule.TransitTo) {
      times.arrival_time = subSchedule.TransitTo.arrival_time;
    }
  
    // Periksa transit_1
    if (subSchedule.transit_1 && subSchedule.Transit1) {
      times.departure_time = subSchedule.Transit1.departure_time;
    }
  
    // Periksa transit_2
    if (subSchedule.transit_2 && subSchedule.Transit2) {
      times.arrival_time = subSchedule.Transit2.arrival_time;
    }
  
    // Periksa transit_3
    if (subSchedule.transit_3 && subSchedule.Transit3) {
      times.departure_time = subSchedule.Transit3.departure_time;
    }
  
    // Periksa transit_4
    if (subSchedule.transit_4 && subSchedule.Transit4) {
      times.arrival_time = subSchedule.Transit4.arrival_time;
    }
  
    return times;
  };
  
  module.exports = calculateDepartureAndArrivalTimes;