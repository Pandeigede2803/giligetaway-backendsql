// utils/formatSchedules.js
const { Op } = require("sequelize");

const formatSchedules = (schedules) => {
    return schedules.map((schedule) => ({
      ...schedule.get({ plain: true }),
      type: "Schedule",
    }));
  };
  
  const formatSubSchedules = (subSchedules) => {
    return subSchedules.map((subSchedule) => ({
      ...subSchedule.get({ plain: true }),
      type: "SubSchedule",
      SeatAvailabilities:
        subSchedule.SeatAvailabilities.length > 0
          ? subSchedule.SeatAvailabilities
          : "Seat availability not created",
    }));
  };
  
  module.exports = { formatSchedules, formatSubSchedules };
  