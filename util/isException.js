/**
 * Utility untuk menentukan apakah sebuah relatedSubSchedule adalah pengecualian
 * @param {Object} subSchedule - SubSchedule utama yang sedang diproses
 * @param {Object} relatedSubSchedule - SubSchedule yang terkait yang sedang dibandingkan
 * @param {Array} transitIds - Daftar transit IDs dari subSchedule utama
 * @returns {Boolean} - True jika relatedSubSchedule adalah pengecualian, False jika tidak
 */
const isException = (subSchedule, relatedSubSchedule, transitIds) => {
    const relatedTransitIds = [
      relatedSubSchedule.transit_from_id,
      relatedSubSchedule.transit_1,
      relatedSubSchedule.transit_2,
      relatedSubSchedule.transit_3,
      relatedSubSchedule.transit_4,
      relatedSubSchedule.transit_to_id
    ].filter(Boolean); // Menghilangkan nilai null
  
    // Logika pengecualian
    const exceptionFound = (
      // Pengecualian 1: Jika transit_to_id dari subSchedule yang diberikan sama dengan transit_from_id dari SubSchedule terkait
      subSchedule.transit_to_id === relatedSubSchedule.transit_from_id ||
  
      // Pengecualian 2: Jika destination_from_schedule_id + transit_to_id dari subSchedule yang diberikan
      // tidak ditemukan dalam transit 1,2,3,4 & transit_to_id dari SubSchedule terkait
      (
        subSchedule.destination_from_schedule_id &&
        subSchedule.transit_to_id &&
        !relatedTransitIds.includes(subSchedule.transit_to_id)
      ) ||
  
      // Pengecualian 3: Jika destination_from_schedule_id dari subSchedule yang diberikan null
      // tetapi SubSchedule terkait memiliki destination_from_schedule_id
      (
        !subSchedule.destination_from_schedule_id &&
        relatedSubSchedule.destination_from_schedule_id
      ) ||
  
      // Pengecualian 4: Jika transit_from_id dari subSchedule yang diberikan sama dengan transit_to_id dari SubSchedule terkait
      subSchedule.transit_from_id === relatedSubSchedule.transit_to_id ||
  
      // Pengecualian 5: Jika tidak ada kecocokan antara transit_from, transit_to, atau transit 1/2/3/4
      // dengan transit_from, transit_to, atau transit 1/2/3/4 dari relatedSubSchedule
      !transitIds.some(transitId => relatedTransitIds.includes(transitId))
    );
  
    return exceptionFound;
  };
  
  module.exports = {
    isException
  };
  