// utils/buildSearchConditions.js
const { Op } = require("sequelize");
/**
 * Build search conditions for schedules and sub-schedules
 *
 * @param {string} search_date - Date to search for schedules
 * @param {number} from - ID of destination to search for schedules
 * @param {number} to - ID of destination to search for schedules
 * @param {boolean|string} availability - Availability status of schedules
 * @returns {Object} Object containing two properties: `whereCondition` and `subWhereCondition`
 */
const buildSearchConditions = (search_date, from, to, availability) => {
  const whereCondition = {};
  const subWhereCondition = {};

  if (search_date) {
    const searchDate = new Date(search_date);
    const dateCondition = {
      [Op.and]: [
        { validity_start: { [Op.lte]: searchDate } },
        { validity_end: { [Op.gte]: searchDate } },
      ],
    };
    whereCondition[Op.and] = dateCondition;
    subWhereCondition[Op.and] = dateCondition;
  }

  if (from) whereCondition.destination_from_id = from;
  if (to) whereCondition.destination_to_id = to;

  if (availability !== undefined) {
    const availabilityBool = availability === "true";
    whereCondition.availability = availabilityBool;
    subWhereCondition.availability = availabilityBool;
  }

  console.log("whereCondition:", JSON.stringify(whereCondition, null, 2));
  console.log("subWhereCondition:", JSON.stringify(subWhereCondition, null, 2));

  return { whereCondition, subWhereCondition };
};

module.exports = buildSearchConditions;

