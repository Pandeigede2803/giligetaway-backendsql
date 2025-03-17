/**
 * Menentukan apakah related subSchedule merupakan pengecualian berdasarkan kriteria perbandingan
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Object} relatedSubSchedule - SubSchedule terkait yang akan diperiksa
 * @returns {Boolean} - true jika merupakan pengecualian, false jika tidak
 */
const isException = (subSchedule, relatedSubSchedule) => {

  console.log("subschedule",subSchedule)
  // Ekstrak destination IDs dari subSchedule utama
  const mainDestinationIds = [
    subSchedule.TransitFrom?.Destination?.id,
    subSchedule.TransitTo?.Destination?.id,
    subSchedule.Transit1?.Destination?.id,
    subSchedule.Transit2?.Destination?.id,
    subSchedule.Transit3?.Destination?.id,
    subSchedule.Transit4?.Destination?.id
  ].filter(Boolean);
  
  // Ekstrak destination IDs dari related subSchedule
  const relatedDestinationIds = [
    relatedSubSchedule.TransitFrom?.Destination?.id,
    relatedSubSchedule.TransitTo?.Destination?.id,
    relatedSubSchedule.Transit1?.Destination?.id,
    relatedSubSchedule.Transit2?.Destination?.id,
    relatedSubSchedule.Transit3?.Destination?.id,
    relatedSubSchedule.Transit4?.Destination?.id
  ].filter(Boolean);
  
  // Pengecualian 1: TransitTo dari subSchedule utama sama dengan TransitFrom dari related
  const exception1 = (
    subSchedule.TransitTo?.Destination?.id &&
    relatedSubSchedule.TransitFrom?.Destination?.id &&
    subSchedule.TransitTo.Destination.id === relatedSubSchedule.TransitFrom.Destination.id
  );
  
  // // Pengecualian 2: destination_from_schedule_id ada dan TransitTo ada, 
  // // tetapi tidak ada destination pada related yang cocok dengan TransitTo
  const exception2 = (
    subSchedule.destination_from_schedule_id &&
    subSchedule.TransitTo?.Destination?.id &&
    !relatedDestinationIds.includes(subSchedule.TransitTo.Destination.id)
  );
  
  // // Pengecualian 3: subSchedule tidak memiliki destination_from_schedule_id
  // // tetapi related memilikinya
  const exception3 = (
    !subSchedule.destination_from_schedule_id &&
    relatedSubSchedule.destination_from_schedule_id
  );
  
  // // Pengecualian 4: TransitFrom pada subSchedule sama dengan TransitTo pada related
  // const exception4 = (
  //   subSchedule.TransitFrom?.Destination?.id &&
  //   relatedSubSchedule.TransitTo?.Destination?.id &&
  //   subSchedule.TransitFrom.Destination.id === relatedSubSchedule.TransitTo.Destination.id
  // );
  
  // // Pengecualian 5: Tidak ada destination yang cocok antara kedua subSchedule
  // const exception5 = !mainDestinationIds.some(
  //   destId => relatedDestinationIds.includes(destId)
  // );

  // pengecualian 6 : jika subschedule.TransitFrom.Destination.id sama dengan relatedSubSchedule.TransitTo.Destination.id
  const exception6 = (
    subSchedule.TransitFrom?.Destination?.id &&
    relatedSubSchedule.TransitTo?.Destination?.id &&
    subSchedule.TransitFrom.Destination.id === relatedSubSchedule.TransitTo.Destination.id
  );
  
  // Mengembalikan true jika salah satu kondisi pengecualian terpenuhi
  return exception1 || exception3 ||exception6  ;
};


/**
 * Fungsi untuk memeriksa apakah subschedule terkait harus difilter 
 * berdasarkan TransitTo.Destination.id dan TransitFrom.Destination.id
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Array} relatedSubSchedules - Array berisi subschedule terkait
 * @returns {Array} - Array berisi subschedule yang lolos filter
 */
/**
 * Fungsi untuk memeriksa apakah subschedule terkait harus difilter 
 * berdasarkan TransitTo.Destination.id dan TransitFrom.Destination.id
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Array} relatedSubSchedules - Array berisi subschedule terkait
 * @returns {Array} - Array berisi subschedule yang lolos filter
 */
/**
 * Fungsi untuk memeriksa apakah subschedule terkait harus difilter 
 * berdasarkan TransitTo.Destination.id dan TransitFrom.Destination.id
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Array} relatedSubSchedules - Array berisi subschedule terkait
 * @returns {Array} - Array berisi subschedule yang lolos filter
 */
/**
 * Fungsi untuk memeriksa apakah subschedule terkait harus difilter 
 * berdasarkan TransitTo.Destination.id dan TransitFrom.Destination.id
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Array} relatedSubSchedules - Array berisi subschedule terkait
 * @returns {Array} - Array berisi subschedule yang lolos filter
 */

/**
 * Fungsi untuk memeriksa apakah subschedule terkait harus difilter 
 * berdasarkan TransitTo.Destination.id dan TransitFrom.Destination.id
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Array} relatedSubSchedules - Array berisi subschedule terkait
 * @returns {Array} - Array berisi subschedule yang lolos filter
 */
/**
 * Memeriksa dan memfilter subschedule berdasarkan pengecualian
 * @param {Object} subSchedule - SubSchedule utama yang menjadi referensi
 * @param {Array} relatedSubSchedules - Array berisi subschedule terkait
 * @returns {Array} - Array berisi subschedule yang lolos filter
 */
const checkExceptions = (subSchedule, relatedSubSchedules) => {
  console.log(`===Total related subschedules before filter===: ${relatedSubSchedules.length}`);
  
  // Filter semua subschedule
  const filteredResults = relatedSubSchedules.filter(relatedSubSchedule => {
    // ===== Deteksi kondisi rute =====
    
    // Kondisi 11: Kasus untuk subschedule dengan TransitFrom, Transit1,2,3 (semuanya harus ada) dan DestinationTo
    const isComplexDestinationToRoute = 
      !subSchedule.destination_from_schedule_id && 
      subSchedule.TransitFrom?.Destination?.id && 
      subSchedule.destination_to_schedule_id &&
      subSchedule.Transit1?.Destination?.id && 
      subSchedule.Transit2?.Destination?.id && 
      subSchedule.Transit3?.Destination?.id;
    
    // ===== Kondisi Special: Rute kompleks dengan destination_to =====
    // Periksa kondisi 11 terlebih dahulu, sebelum melakukan filter lainnya
    if (isComplexDestinationToRoute) {
      console.log(`Special case detected: destination_from is null, TransitFrom exists, has Transit1-3, and has destination_to`);
      console.log(`Keeping ALL related subschedules without filtering`);
      console.log(`RelatedSubSchedule ID: ${relatedSubSchedule.id}, Complex destination route, KEEP`);
      
      // Return true langsung tanpa memeriksa filter lainnya
      return true;
    }
    
    // ===== Kondisi-kondisi filter =====
    
    // Ekstrak main transit points
    const mainDestinationIds = [
      subSchedule.TransitFrom?.Destination?.id,
      subSchedule.TransitTo?.Destination?.id,
      subSchedule.Transit1?.Destination?.id,
      subSchedule.Transit2?.Destination?.id,
      subSchedule.Transit3?.Destination?.id,
      subSchedule.Transit4?.Destination?.id
    ].filter(Boolean);
    
    // Ekstrak related transit points
    const relatedDestinationIds = [
      relatedSubSchedule.TransitFrom?.Destination?.id,
      relatedSubSchedule.TransitTo?.Destination?.id,
      relatedSubSchedule.Transit1?.Destination?.id,
      relatedSubSchedule.Transit2?.Destination?.id,
      relatedSubSchedule.Transit3?.Destination?.id,
      relatedSubSchedule.Transit4?.Destination?.id
    ].filter(Boolean);
    
    // Kondisi 1: TransitTo dari main = TransitFrom dari related
    const isTransitToFromMatch = 
      subSchedule.TransitTo?.Destination?.id && 
      relatedSubSchedule.TransitFrom?.Destination?.id &&
      subSchedule.TransitTo.Destination.id === relatedSubSchedule.TransitFrom.Destination.id;
    
    // Kondisi 2: TransitFrom dari main = TransitTo dari related
    const isTransitFromToMatch =
      subSchedule.TransitFrom?.Destination?.id &&
      relatedSubSchedule.TransitTo?.Destination?.id &&
      subSchedule.TransitFrom.Destination.id === relatedSubSchedule.TransitTo.Destination.id;
      
    // Kondisi 3: TransitFrom dari main tidak ada dalam daftar transit dari related
    const isTransitFromNotInRelated = 
      subSchedule.TransitFrom?.Destination?.id && 
      !relatedDestinationIds.includes(subSchedule.TransitFrom.Destination.id);
    
    // Kondisi 4 (PENGECUALIAN): TransitTo dari main ada dalam daftar Transit1-4 dari related
    const isTransitToInRelatedTransits = 
      subSchedule.TransitTo?.Destination?.id &&
      [
        relatedSubSchedule.Transit1?.Destination?.id,
        relatedSubSchedule.Transit2?.Destination?.id,
        relatedSubSchedule.Transit3?.Destination?.id,
        relatedSubSchedule.Transit4?.Destination?.id
      ].filter(Boolean).includes(subSchedule.TransitTo.Destination.id);
    
    // Kondisi 5: TransitTo dari main = TransitFrom dari related DAN tidak ada titik cocok lainnya
    const hasMatchingTransits = mainDestinationIds.some(id => 
      relatedDestinationIds.includes(id)
    );
    
    const isTransitToEqualsFromWithNoMatches = 
      subSchedule.TransitTo?.Destination?.id && 
      relatedSubSchedule.TransitFrom?.Destination?.id &&
      subSchedule.TransitTo.Destination.id === relatedSubSchedule.TransitFrom.Destination.id &&
      !hasMatchingTransits;
    
    // Kondisi 6: TransitFrom dari related tidak cocok dengan transit utama
    const relatedTransitFromId = relatedSubSchedule.TransitFrom?.Destination?.id;
    const isRelatedTransitFromNotMatchAny = 
      relatedTransitFromId && 
      !mainDestinationIds.includes(relatedTransitFromId);
    
    // Deteksi rute sederhana (TransitFrom dan DestinationTo only)
    const isSimpleRoute = 
      subSchedule.TransitFrom?.Destination?.id && 
      subSchedule.destination_to_schedule_id &&
      !subSchedule.Transit1?.Destination?.id && 
      !subSchedule.Transit2?.Destination?.id && 
      !subSchedule.Transit3?.Destination?.id && 
      !subSchedule.Transit4?.Destination?.id;
    
    // Kondisi rute sederhana
    const isRelatedMatchingTransitFrom = 
      subSchedule.TransitFrom?.Destination?.id && (
        relatedSubSchedule.TransitFrom?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit1?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit2?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit3?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit4?.Destination?.id === subSchedule.TransitFrom.Destination.id
      );
    
    // Deteksi rute kompleks (TransitFrom, Transit1-4, DestinationTo)
    const isComplexRoute = 
      subSchedule.TransitFrom?.Destination?.id && 
      subSchedule.destination_to_schedule_id &&
      (subSchedule.Transit1?.Destination?.id || 
       subSchedule.Transit2?.Destination?.id || 
       subSchedule.Transit3?.Destination?.id || 
       subSchedule.Transit4?.Destination?.id);
    
    // Kondisi rute kompleks
    const isRelatedValidForComplexRoute = 
      isRelatedMatchingTransitFrom;
    
    // Deteksi rute dengan TransitTo (TransitFrom, Transit1-4, TransitTo)
    const isTransitToEndingRoute = 
      subSchedule.TransitFrom?.Destination?.id && 
      subSchedule.TransitTo?.Destination?.id &&
      !subSchedule.destination_to_schedule_id &&
      (subSchedule.Transit1?.Destination?.id || 
       subSchedule.Transit2?.Destination?.id || 
       subSchedule.Transit3?.Destination?.id || 
       subSchedule.Transit4?.Destination?.id);
    
    // Kondisi rute dengan TransitTo di akhir
    const transitFromMatches = 
      subSchedule.TransitFrom?.Destination?.id && (
        relatedSubSchedule.TransitFrom?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit1?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit2?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit3?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit4?.Destination?.id === subSchedule.TransitFrom.Destination.id
      );
    
    const transitMatchesMainTransits = 
      relatedSubSchedule.TransitFrom?.Destination?.id && (
        subSchedule.Transit1?.Destination?.id === relatedSubSchedule.TransitFrom.Destination.id ||
        subSchedule.Transit2?.Destination?.id === relatedSubSchedule.TransitFrom.Destination.id ||
        subSchedule.Transit3?.Destination?.id === relatedSubSchedule.TransitFrom.Destination.id ||
        subSchedule.Transit4?.Destination?.id === relatedSubSchedule.TransitFrom.Destination.id
      );
    
    const isRelatedValidForTransitToRoute = 
      transitFromMatches || transitMatchesMainTransits;
    
    // Deteksi rute transit sederhana (TransitFrom, TransitTo)
    const isSimpleTransitRoute = 
      subSchedule.TransitFrom?.Destination?.id && 
      subSchedule.TransitTo?.Destination?.id &&
      !subSchedule.destination_to_schedule_id &&
      !subSchedule.Transit1?.Destination?.id && 
      !subSchedule.Transit2?.Destination?.id && 
      !subSchedule.Transit3?.Destination?.id && 
      !subSchedule.Transit4?.Destination?.id;
    
    // Kondisi rute transit sederhana
    const relatedTransitFromMatchesMainTransitFrom = 
      subSchedule.TransitFrom?.Destination?.id && 
      relatedSubSchedule.TransitFrom?.Destination?.id === subSchedule.TransitFrom.Destination.id;
    
    const mainTransitFromMatchesRelatedTransits = 
      subSchedule.TransitFrom?.Destination?.id && (
        relatedSubSchedule.Transit1?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit2?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit3?.Destination?.id === subSchedule.TransitFrom.Destination.id ||
        relatedSubSchedule.Transit4?.Destination?.id === subSchedule.TransitFrom.Destination.id
      );
    
    const isRelatedValidForSimpleTransitRoute = 
      relatedTransitFromMatchesMainTransitFrom || mainTransitFromMatchesRelatedTransits;
    
    // Log informasi debugging
    console.log(`Checking subSchedule ID: ${relatedSubSchedule.id}`);
    console.log(`Main TransitTo.Destination.id: ${subSchedule.TransitTo?.Destination?.id}`);
    console.log(`Main TransitFrom.Destination.id: ${subSchedule.TransitFrom?.Destination?.id}`);
    console.log(`Related Transit destination IDs: ${relatedDestinationIds.join(', ')}`);
    console.log(`Should filter out (TransitTo = TransitFrom): ${isTransitToFromMatch}`);
    console.log(`Should filter out (TransitFrom = TransitTo): ${isTransitFromToMatch}`);
    console.log(`Should filter out (TransitFrom not in related transits): ${isTransitFromNotInRelated}`);
    console.log(`Main transit IDs: ${mainDestinationIds.join(', ')}`);
    console.log(`Main transit points: ${mainDestinationIds.join(', ')}`);
    
    // ===== LOGIKA FILTER =====
    
    // Filter out jika salah satu kondisi terpenuhi, KECUALI jika kondisi pengecualian terpenuhi
    let shouldFilterOut = isTransitToFromMatch || 
                          isTransitFromToMatch || 
                          isTransitFromNotInRelated ||
                          isTransitToEqualsFromWithNoMatches || 
                          isRelatedTransitFromNotMatchAny;
    
    // Jika TransitTo dari main cocok dengan salah satu Transit1-4 dari related, pertahankan
    if (isTransitToInRelatedTransits) {
      shouldFilterOut = false;
    }
    
    // ===== KASUS KHUSUS =====
    
    // Kasus khusus: Jika merupakan rute sederhana, filter semua yang TIDAK memiliki kecocokan TransitFrom
    if (isSimpleRoute) {
      // Jika related TIDAK memiliki TransitFrom/Transit1-4 yang cocok dengan TransitFrom dari main, filter keluar
      shouldFilterOut = !isRelatedMatchingTransitFrom;
      
      console.log(`RelatedSubSchedule ID: ${relatedSubSchedule.id}, Route is simple, ${shouldFilterOut ? 'TAKE OUT' : 'KEEP'}`);
    }
    // Kasus khusus: Jika merupakan rute kompleks, filter semua yang TIDAK memiliki kecocokan dengan kriteria
    else if (isComplexRoute) {
      // Jika related TIDAK memiliki TransitFrom yang sama ATAU Transit1-4 yang sama dengan TransitFrom dari main, filter keluar
      shouldFilterOut = !isRelatedValidForComplexRoute;
      
      console.log(`RelatedSubSchedule ID: ${relatedSubSchedule.id}, Route is complex, ${shouldFilterOut ? 'TAKE OUT' : 'KEEP'}`);
    }
    // Kasus khusus: Jika merupakan rute dengan TransitTo di akhir, filter semua yang tidak valid
    else if (isTransitToEndingRoute) {
      // Filter keluar jika TIDAK memenuhi kriteria validitas
      shouldFilterOut = !isRelatedValidForTransitToRoute;
      
      console.log(`RelatedSubSchedule ID: ${relatedSubSchedule.id}, Route ends with TransitTo, ${shouldFilterOut ? 'TAKE OUT' : 'KEEP'}`);
    }
    // Kasus khusus: Jika merupakan rute transit sederhana, filter semua yang tidak valid
    else if (isSimpleTransitRoute) {
      // Filter keluar jika TIDAK memenuhi kriteria validitas
      shouldFilterOut = !isRelatedValidForSimpleTransitRoute;
      
      console.log(`RelatedSubSchedule ID: ${relatedSubSchedule.id}, Simple transit route, ${shouldFilterOut ? 'TAKE OUT' : 'KEEP'}`);
    }
    
    // Pertahankan jika TIDAK memenuhi kriteria filter
    return !shouldFilterOut;
  });
  
  console.log(`Total subschedules after filter: ${filteredResults.length}`);
  
  return filteredResults;
};

module.exports = { checkExceptions };

