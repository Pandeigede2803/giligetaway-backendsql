
const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule, SubSchedule,Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const { findRelatedSubSchedules } = require('./handleSubScheduleBooking');
const { calculatePublicCapacity } = require('./getCapacityReduction');

/**
 * Mengembalikan kursi yang sebelumnya telah dipesan untuk SubSchedule dan SubSchedules terkait,
 * serta Main Schedule jika terkait.
 *
 * @param {number} schedule_id - ID dari Main Schedule.
 * @param {number} subschedule_id - ID dari SubSchedule yang dipilih.
 * @param {string} booking_date - Tanggal pemesanan dalam format YYYY-MM-DD.
 * @param {number} total_passengers - Jumlah total penumpang yang akan mengembalikan kursi.
 * @param {object} transaction - Transaksi aktif Sequelize untuk memastikan atomicity.
 *
 * @throws {Error} Jika SubSchedule atau SeatAvailability tidak ditemukan.
 *
 * @returns {Set} Set yang berisi ID dari SubSchedules yang telah diperbarui.
 */
const fetchAndValidateSeatAvailability = async (
    schedule_id,
    subschedule_id,
    booking_date,
    boatCapacity,
    total_passengers,
    transaction
) => {
    const seatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id,
            subschedule_id,
            date: booking_date,
        },
        transaction,
    });

    if (!seatAvailability) {
        throw new Error(`Seat availability not found for SubSchedule ID: ${subschedule_id || 'Main Schedule'}`);
    }

    const maxCapacity = seatAvailability.boost
    ? boat.capacity // Jika boost true, gunakan kapasitas kapal
    : calculatePublicCapacity(boat); // Jika boost false, gunakan kapasitas publik

 
    if (seatAvailability.available_seats + total_passengers > maxCapacity) {
        throw new Error(`Returning seats exceeds boat capacity for SubSchedule ID: ${subschedule_id || 'Main Schedule'}`);
    }

    return {
        id: seatAvailability.id,
        seatAvailability,
    };
};

// const releaseSubScheduleSeats = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     const releasedSeatIds = []; // Track updated SeatAvailability IDs
//     const releasedSeats = []; // Array untuk melacak semua seat yang direlease

//     try {
//         // Fetch Schedule and associated Boat
//         console.log(`✅ =====Fetching Schedule with ID=====: ${schedule_id}`);
//         const schedule = await Schedule.findByPk(schedule_id, {
//             include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//             transaction,
//         });

//         if (!schedule || !schedule.Boat) {
//             throw new Error('Schedule or associated Boat not found');
//         }

//         const boatCapacity = schedule.Boat.capacity;
//         console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

//         // Fetch SubSchedule by ID
//         console.log(`Fetching SubSchedule with ID: ${subschedule_id}`);
//         const subSchedule = await SubSchedule.findByPk(subschedule_id, {
//             include: [
//                 {
//                     model: Transit,
//                     as: "TransitFrom",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "TransitTo",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit1",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit2",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit3",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit4",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//             ],
//             transaction,
//         });

//         if (!subSchedule) {
//             throw new Error('❌SubSchedule not found');
//         }

//         // Fetch related SubSchedules
//         console.log(`Fetching related SubSchedules for Schedule ID: ${schedule_id}`);
//         const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

//         // Update related SubSchedules
//         for (const relatedSubSchedule of relatedSubSchedules) {
//             if (relatedSubSchedule.id === subschedule_id) continue; // Skip selected SubSchedule

//             console.log(`Processing related SubSchedule ID: ${relatedSubSchedule.id}`);
//             const { id, seatAvailability } = await fetchAndValidateSeatAvailability(
//                 schedule_id,
//                 relatedSubSchedule.id,
//                 booking_date,
//                 boatCapacity,
//                 total_passengers,
//                 transaction
//             );

//             // Log available seats sebelum diupdate
//             console.log(`✅ Current available seats for SubSchedule ID: ${relatedSubSchedule.id}, SeatAvailability ID: ${id} = ${seatAvailability.available_seats}`);
            
//             // Update seat availability
//             seatAvailability.available_seats += total_passengers;
//             await seatAvailability.save({ transaction });
            
//             // Log available seats setelah diupdate
//             console.log(`✅ Updated available seats for SubSchedule ID: ${relatedSubSchedule.id}, SeatAvailability ID: ${id} = ${seatAvailability.available_seats}`);
            
//             releasedSeatIds.push(id); // Track updated SeatAvailability ID
            
//             // Tambahkan ke array tracking
//             releasedSeats.push({
//                 subschedule_id: relatedSubSchedule.id,
//                 seat_availability_id: id,
//                 seats_returned: total_passengers,
//                 available_seats_after: seatAvailability.available_seats
//             });
//         }

//         // Update selected SubSchedule
//         console.log(`Processing selected SubSchedule ID: ${subschedule_id}`);
//         const { id: selectedSeatId, seatAvailability: selectedSeatAvailability } = await fetchAndValidateSeatAvailability(
//             schedule_id,
//             subschedule_id,
//             booking_date,
//             boatCapacity,
//             total_passengers,
//             transaction
//         );

//         // Log available seats sebelum diupdate
//         console.log(`✅ Current available seats for selected SubSchedule ID: ${subschedule_id}, SeatAvailability ID: ${selectedSeatId} = ${selectedSeatAvailability.available_seats}`);
        
//         selectedSeatAvailability.available_seats += total_passengers;
//         await selectedSeatAvailability.save({ transaction });
        
//         // Log available seats setelah diupdate
//         console.log(`✅ Updated available seats for selected SubSchedule ID: ${subschedule_id}, SeatAvailability ID: ${selectedSeatId} = ${selectedSeatAvailability.available_seats}`);
        
//         releasedSeatIds.push(selectedSeatId);
        
//         // Tambahkan ke array tracking
//         releasedSeats.push({
//             subschedule_id: subschedule_id,
//             seat_availability_id: selectedSeatId,
//             seats_returned: total_passengers,
//             available_seats_after: selectedSeatAvailability.available_seats
//         });

//         // Update Main Schedule
//         console.log(`Processing Main Schedule ID: ${schedule_id}`);
//         const { id: mainSeatId, seatAvailability: mainScheduleSeatAvailability } = await fetchAndValidateSeatAvailability(
//             schedule_id,
//             null, // Main Schedule has no subschedule_id
//             booking_date,
//             boatCapacity,
//             total_passengers,
//             transaction
//         );

//         // Log available seats sebelum diupdate
//         console.log(`✅ Current available seats for Main Schedule ID: ${schedule_id}, SeatAvailability ID: ${mainSeatId} = ${mainScheduleSeatAvailability.available_seats}`);
        
//         mainScheduleSeatAvailability.available_seats += total_passengers;
//         await mainScheduleSeatAvailability.save({ transaction });
        
//         // Log available seats setelah diupdate
//         console.log(`✅ Updated available seats for Main Schedule ID: ${schedule_id}, SeatAvailability ID: ${mainSeatId} = ${mainScheduleSeatAvailability.available_seats}`);
        
//         releasedSeatIds.push(mainSeatId);
        
//         // Tambahkan main schedule ke array tracking
//         releasedSeats.push({
//             subschedule_id: "MAIN_SCHEDULE",
//             seat_availability_id: mainSeatId,
//             seats_returned: total_passengers,
//             available_seats_after: mainScheduleSeatAvailability.available_seats
//         });

//         // Tambahkan log ringkasan seluruh seat yang telah direlease
//         console.log("✅ RELEASE SUMMARY - ALL RELEASED SEATS:", JSON.stringify(releasedSeats, null, 2));

//         console.log(`Successfully released seats for Schedule ID: ${schedule_id}`);
//         return releasedSeatIds; // Return IDs of all updated SeatAvailability
//     } catch (error) {
//         console.error(`Failed to release seats for SubSchedule ID: ${subschedule_id}`, error);
//         throw error;
//     }
// };

// const releaseSubScheduleSeats = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     try {
//         // Ambil Schedule yang relevan beserta Boat-nya
//         console.log(`Fetching Schedule with ID: ${schedule_id}`);
//         const schedule = await Schedule.findByPk(schedule_id, {
//             include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//             transaction
//         });

//         if (!schedule || !schedule.Boat) {
//             throw new Error('Schedule atau Boat tidak ditemukan');
//         }

//         const boatCapacity = schedule.Boat.capacity;
//         console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

//         // Ambil SubSchedule yang relevan berdasarkan ID
//         console.log(`Fetching SubSchedule with ID: ${subschedule_id}`);
//         const subSchedule = await SubSchedule.findByPk(subschedule_id, { transaction });

//         if (!subSchedule) {
//             throw new Error('SubSchedule tidak ditemukan');
//         }

//         // Cari SubSchedule yang terkait menggunakan fungsi findRelatedSubSchedules
//         console.log(`Fetching related SubSchedules for Schedule ID: ${schedule_id}`);
//         const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);
//         const updatedSubSchedules = new Set(); // Set untuk melacak sub-schedule yang sudah diperbarui

//         // Loop melalui SubSchedule terkait untuk mengembalikan kursi
//         for (const relatedSubSchedule of relatedSubSchedules) {
//             if (updatedSubSchedules.has(relatedSubSchedule.id) || relatedSubSchedule.id === subschedule_id) {
//                 console.log(`Skipping already updated or selected SubSchedule with ID: ${relatedSubSchedule.id}`);
//                 continue; // Hindari update dua kali atau jika sudah diperbarui
//             }

//             // Cari SeatAvailability untuk SubSchedule terkait
//             console.log(`Fetching SeatAvailability for related SubSchedule ID: ${relatedSubSchedule.id}`);
//             let relatedSeatAvailability = await SeatAvailability.findOne({
//                 where: {
//                     schedule_id: schedule_id,
//                     subschedule_id: relatedSubSchedule.id,
//                     date: booking_date
//                 },
//                 transaction
//             });

//             if (!relatedSeatAvailability) {
//                 throw new Error(`Seat availability tidak ditemukan untuk SubSchedule ID: ${relatedSubSchedule.id}`);
//             }

//             // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat
//             if (relatedSeatAvailability.available_seats + total_passengers > boatCapacity) {
//                 throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk SubSchedule ID: ${relatedSubSchedule.id}`);
//             }

//             // Tambahkan kembali kursi yang telah dipesan
//             console.log(`Returning ${total_passengers} seats to related SubSchedule ID: ${relatedSubSchedule.id}`);
//             relatedSeatAvailability.available_seats += total_passengers;
//             await relatedSeatAvailability.save({ transaction }); // Simpan perubahan ke database

//             // Tambahkan SubSchedule ke Set yang diperbarui
//             updatedSubSchedules.add(relatedSubSchedule.id);
//         }

//         // Tangani SubSchedule yang dipilih secara spesifik jika belum diperbarui di loop sebelumnya
//         if (!updatedSubSchedules.has(subschedule_id)) {
//             console.log(`Fetching SeatAvailability for selected SubSchedule ID: ${subschedule_id}`);
//             let selectedSubScheduleSeatAvailability = await SeatAvailability.findOne({
//                 where: {
//                     schedule_id: schedule_id,
//                     subschedule_id: subschedule_id,
//                     date: booking_date
//                 },
//                 transaction
//             });

//             if (!selectedSubScheduleSeatAvailability) {
//                 throw new Error('Seat availability tidak ditemukan untuk SubSchedule yang dipilih');
//             }

//             // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat
//             if (selectedSubScheduleSeatAvailability.available_seats + total_passengers > boatCapacity) {
//                 throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk SubSchedule ID: ${subschedule_id}`);
//             }

//             // Tambahkan kembali kursi yang telah dipesan untuk SubSchedule yang dipilih
//             console.log(`Returning ${total_passengers} seats to selected SubSchedule ID: ${subschedule_id}`);
//             selectedSubScheduleSeatAvailability.available_seats += total_passengers;
//             await selectedSubScheduleSeatAvailability.save({ transaction });

//             updatedSubSchedules.add(subschedule_id);
//         }

//         console.log(`Berhasil mengembalikan ${total_passengers} kursi untuk SubSchedule ID: ${subschedule_id}`);

//         // ===================== Tambahkan Logika untuk Main Schedule ===================== //

//         // Cari SeatAvailability untuk Main Schedule (subschedule_id = null)
//         console.log(`Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
//         let mainScheduleSeatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 subschedule_id: null, // Main Schedule tidak memiliki subschedule_id
//                 date: booking_date
//             },
//             transaction
//         });

//         if (!mainScheduleSeatAvailability) {
//             throw new Error('Seat availability tidak ditemukan untuk Main Schedule.');
//         }

//         // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat
//         if (mainScheduleSeatAvailability.available_seats + total_passengers > boatCapacity) {
//             throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk Main Schedule ID: ${schedule_id}`);
//         }

//         // Tambahkan kembali kursi yang telah dipesan untuk Main Schedule
//         console.log(`Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
//         mainScheduleSeatAvailability.available_seats += total_passengers;
//         await mainScheduleSeatAvailability.save({ transaction });

//         console.log(`Berhasil mengembalikan ${total_passengers} kursi untuk Main Schedule ID: ${schedule_id}.`);

//         // ============================================================================= //

//         return updatedSubSchedules; // Kembalikan Set yang berisi SubSchedule yang telah diperbarui
//     } catch (error) {
//         // Log error dan lemparkan kembali jika terjadi masalah
//         console.error(`Gagal melepaskan kursi untuk SubSchedule ID: ${subschedule_id}`, error);
//         throw error;
//     }
// };


// const releaseSubScheduleSeats = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     try {
//         // Tambahkan array untuk melacak semua release
//         const releasedSeats = [];
        
//         console.log(`✅ RELEASE SUB SCHEDULE MULAI: ${subschedule_id}`);
//         console.log(`✅ Fetching SubSchedule with ID: ${subschedule_id}`);
//         const subSchedule = await SubSchedule.findByPk(subschedule_id, {
//             include: [
//                 {
//                     model: Transit,
//                     as: "TransitFrom",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "TransitTo",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit1",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit2",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit3",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//                 {
//                     model: Transit,
//                     as: "Transit4",
//                     include: [
//                         {
//                             model: Destination,
//                             as: "Destination",
//                             attributes: ["id"],
//                         },
//                     ],
//                 },
//             ],
//             transaction,
//         });

//         console.log("subschedule", JSON.stringify(subSchedule, null, 2));

//         // Jika SubSchedule tidak ditemukan, lemparkan error
//         if (!subSchedule) {
//             throw new Error('✅ SubSchedule tidak ditemukan');
//         }

//         // Cari SubSchedule yang terkait menggunakan fungsi findRelatedSubSchedules
//         console.log(`✅ Fetching related SubSchedules for Schedule ID: ${schedule_id}`);
//         const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);
//         const updatedSubSchedules = new Set(); // Set untuk melacak sub-schedule yang sudah diperbarui

//         // Loop melalui SubSchedule terkait untuk mengembalikan kursi
//         for (const relatedSubSchedule of relatedSubSchedules) {
//             if (updatedSubSchedules.has(relatedSubSchedule.id) || relatedSubSchedule.id === subschedule_id) {
//                 console.log(`✅ Skipping already updated or selected SubSchedule with ID: ${relatedSubSchedule.id} `);
//                 continue; // Hindari update dua kali atau jika sudah diperbarui
//             }

//             // Cari SeatAvailability untuk SubSchedule terkait
//             console.log(`Fetching SeatAvailability for related SubSchedule ID: ${relatedSubSchedule.id}`);
//             let relatedSeatAvailability = await SeatAvailability.findOne({
//                 where: {
//                     schedule_id: schedule_id,
//                     subschedule_id: relatedSubSchedule.id,
//                     date: booking_date
//                 },
//                 transaction
//             });

//             console.log("relatedSeatAvailability:", relatedSeatAvailability.id);

//             if (!relatedSeatAvailability) {
//                 throw new Error(`✅ Seat availability tidak ditemukan untuk SubSchedule ID: ${relatedSubSchedule.id}`);
//             }

//             // Log available seats sebelum diupdate
//             console.log(`✅ Current available seats for SubSchedule ID: ${relatedSubSchedule.id}, SeatAvailability ID: ${relatedSeatAvailability.id} = ${relatedSeatAvailability.available_seats}`);
            
//             // Tambahkan kembali kursi yang telah dipesan
//             console.log(`✅ Returning ${total_passengers} seats to related SubSchedule ID: ${relatedSubSchedule.id}`);
//             relatedSeatAvailability.available_seats += total_passengers;
//             await relatedSeatAvailability.save({ transaction }); // Simpan perubahan ke database
            
//             // Log available seats setelah diupdate
//             console.log(`✅ Updated available seats for SubSchedule ID: ${relatedSubSchedule.id}, SeatAvailability ID: ${relatedSeatAvailability.id} = ${relatedSeatAvailability.available_seats}`);
            
//             // Tambahkan ke array tracking
//             releasedSeats.push({
//                 subschedule_id: relatedSubSchedule.id,
//                 seat_availability_id: relatedSeatAvailability.id,
//                 seats_returned: total_passengers,
//                 available_seats_after: relatedSeatAvailability.available_seats
//             });

//             // Tambahkan SubSchedule ke Set yang diperbarui
//             updatedSubSchedules.add(relatedSubSchedule.id);
//         }

//         // Tangani SubSchedule yang dipilih secara spesifik jika belum diperbarui di loop sebelumnya
//         if (!updatedSubSchedules.has(subschedule_id)) {
//             console.log(`✅ Fetching SeatAvailability for selected SubSchedule ID: ${subschedule_id}`);
//             let selectedSubScheduleSeatAvailability = await SeatAvailability.findOne({
//                 where: {
//                     schedule_id: schedule_id,
//                     subschedule_id: subschedule_id,
//                     date: booking_date
//                 },
//                 transaction
//             });

//             if (!selectedSubScheduleSeatAvailability) {
//                 throw new Error('❌ Seat availability tidak ditemukan untuk SubSchedule yang dipilih');
//             }

//             // Log available seats sebelum diupdate
//             console.log(`✅ Current available seats for selected SubSchedule ID: ${subschedule_id}, SeatAvailability ID: ${selectedSubScheduleSeatAvailability.id} = ${selectedSubScheduleSeatAvailability.available_seats}`);
            
//             // Tambahkan kembali kursi yang telah dipesan untuk SubSchedule yang dipilih
//             console.log(`✅ Returning ${total_passengers} seats to selected SubSchedule ID: ${subschedule_id}`);
//             selectedSubScheduleSeatAvailability.available_seats += total_passengers;
//             await selectedSubScheduleSeatAvailability.save({ transaction });
            
//             // Log available seats setelah diupdate
//             console.log(`✅ Updated available seats for selected SubSchedule ID: ${subschedule_id}, SeatAvailability ID: ${selectedSubScheduleSeatAvailability.id} = ${selectedSubScheduleSeatAvailability.available_seats}`);
            
//             // Tambahkan ke array tracking
//             releasedSeats.push({
//                 subschedule_id: subschedule_id,
//                 seat_availability_id: selectedSubScheduleSeatAvailability.id,
//                 seats_returned: total_passengers,
//                 available_seats_after: selectedSubScheduleSeatAvailability.available_seats
//             });

//             updatedSubSchedules.add(subschedule_id);
//         }

//         console.log(`✅ Berhasil mengembalikan ${total_passengers} kursi untuk SubSchedule ID: ${subschedule_id}`);

//         // ===================== Tambahkan Logika untuk Main Schedule ===================== //

//         // Cari SeatAvailability untuk Main Schedule (subschedule_id = null)
//         console.log(`✅ Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
//         let mainScheduleSeatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 subschedule_id: null, // Main Schedule tidak memiliki subschedule_id
//                 date: booking_date
//             },
//             transaction
//         });

//         if (!mainScheduleSeatAvailability) {
//             throw new Error('Seat availability tidak ditemukan untuk Main Schedule.');
//         }

//         // Log available seats sebelum diupdate
//         console.log(`✅ Current available seats for Main Schedule ID: ${schedule_id}, SeatAvailability ID: ${mainScheduleSeatAvailability.id} = ${mainScheduleSeatAvailability.available_seats}`);
        
//         // Tambahkan kembali kursi yang telah dipesan untuk Main Schedule
//         console.log(`✅ Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
//         mainScheduleSeatAvailability.available_seats += total_passengers;
//         await mainScheduleSeatAvailability.save({ transaction }); // Simpan perubahan ke database
        
//         // Log available seats setelah diupdate
//         console.log(`✅ Updated available seats for Main Schedule ID: ${schedule_id}, SeatAvailability ID: ${mainScheduleSeatAvailability.id} = ${mainScheduleSeatAvailability.available_seats}`);
        
//         // Tambahkan main schedule ke array tracking
//         releasedSeats.push({
//             subschedule_id: "MAIN_SCHEDULE",
//             seat_availability_id: mainScheduleSeatAvailability.id,
//             seats_returned: total_passengers,
//             available_seats_after: mainScheduleSeatAvailability.available_seats
//         });

//         console.log(`✅ Berhasil mengembalikan ${total_passengers} kursi untuk Main Schedule ID: ${schedule_id}.`);

//         // Tambahkan log ringkasan seluruh seat yang telah direlease
//         console.log("✅ RELEASE SUMMARY - ALL RELEASED SEATS:", JSON.stringify(releasedSeats, null, 2));

//         // ============================================================================= //

//         return updatedSubSchedules; // Kembalikan Set yang berisi SubSchedule yang telah diperbarui
//     } catch (error) {
//         // Log error dan lemparkan kembali jika terjadi masalah
//         console.error(`❌Gagal melepaskan kursi untuk SubSchedule ID: ${subschedule_id}`, error);
//         throw error;
//     }
// };

const adjustSeatCapacity = async (schedule_id, booking_date, transaction) => {
    try {
    //   console.log(`✅ Memulai penyesuaian kapasitas untuk Schedule ID: ${schedule_id}`);
      
      // Ambil data kapal
      const schedule = await Schedule.findByPk(schedule_id, {
        include: [
          {
            model: Boat,
            as: "Boat"
          }
        ],
        transaction
      });
      
      if (!schedule || !schedule.Boat) {
        throw new Error('Schedule atau Boat tidak ditemukan');
      }
      
      const boat = schedule.Boat;
    //   console.log(`✅ Info Boat: ID=${boat.id}, Kapasitas=${boat.capacity}`);
      
      // Ambil semua SeatAvailability untuk schedule ini pada tanggal yang ditentukan
      const seatAvailabilities = await SeatAvailability.findAll({
        where: {
          schedule_id: schedule_id,
          date: booking_date
        },
        transaction
      });
      
    //   console.log(`✅ Ditemukan ${seatAvailabilities.length} SeatAvailability untuk penyesuaian`);
      
      // Proses setiap SeatAvailability
      for (const seatAvailability of seatAvailabilities) {
        // Tentukan kapasitas maksimum berdasarkan status boost
        const maxCapacity = seatAvailability.boost 
          ? boat.capacity 
          : calculatePublicCapacity(boat);
        //   : boat.published_capacity;
        
        // Cek apakah melebihi kapasitas
        if (seatAvailability.available_seats > maxCapacity) {
        //   console.log(`⚠️ PERINGATAN: SeatAvailability ID=${seatAvailability.id} melebihi kapasitas`);
        //   console.log(`⚠️ Kursi tersedia=${seatAvailability.available_seats}, Kapasitas Maks=${maxCapacity}`);
          
          // Catat jumlah kursi sebelum disesuaikan
          const originalSeats = seatAvailability.available_seats;
          
          // Sesuaikan ke kapasitas maksimum
          seatAvailability.available_seats = maxCapacity;
          await seatAvailability.save({ transaction });
          
          console.log(`✅ Disesuaikan: ${originalSeats} -> ${seatAvailability.available_seats}`);
        } else {
          console.log(`✅ SeatAvailability ID=${seatAvailability.id} dalam batas kapasitas`);
        }
      }
      
      console.log(`✅ Penyesuaian kapasitas selesai untuk Schedule ID: ${schedule_id}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Gagal menyesuaikan kapasitas untuk Schedule ID: ${schedule_id}`, error);
      throw error;
    }
  };

  const releaseSubScheduleSeats = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
    try {
        // Tambahkan array untuk melacak semua release
        const releasedSeats = [];
        
        // console.log(`✅ RELEASE SUB SCHEDULE MULAI: ${subschedule_id}`);
        // console.log("🚨 Jumlah kursi yang akan direlease:", total_passengers);
        
        if (!total_passengers || total_passengers <= 0) {
            throw new Error("❌ Jumlah penumpang tidak valid saat release seats");
        }
        
        // Fetch boat data first
        const schedule = await Schedule.findByPk(schedule_id, {
            include: [
                {
                    model: Boat,
                    as: "Boat"
                }
            ],
            transaction
        });

        if (!schedule || !schedule.Boat) {
            throw new Error('Schedule or Boat data not found');
        }
        
        const boat = schedule.Boat;
        console.log(`✅ Boat info: ID=${boat.id}, Capacity=${boat.capacity}`);

        console.log(`✅ Fetching SubSchedule with ID: ${subschedule_id}`);
        const subSchedule = await SubSchedule.findByPk(subschedule_id, {
            include: [
                {
                    model: Transit,
                    as: "TransitFrom",
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id"],
                        },
                    ],
                },
                {
                    model: Transit,
                    as: "TransitTo",
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id"],
                        },
                    ],
                },
                {
                    model: Transit,
                    as: "Transit1",
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id"],
                        },
                    ],
                },
                {
                    model: Transit,
                    as: "Transit2",
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id"],
                        },
                    ],
                },
                {
                    model: Transit,
                    as: "Transit3",
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id"],
                        },
                    ],
                },
                {
                    model: Transit,
                    as: "Transit4",
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id"], 
                        },
                    ],
                },
            ],
            transaction,
        });

        // Jika SubSchedule tidak ditemukan, lemparkan error
        if (!subSchedule) {
            throw new Error('✅ SubSchedule tidak ditemukan');
        }

        // Cari SubSchedule yang terkait menggunakan fungsi findRelatedSubSchedules
        const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);
        const updatedSubSchedules = new Set(); // Set untuk melacak sub-schedule yang sudah diperbarui

        // Loop melalui SubSchedule terkait untuk mengembalikan kursi
        for (const relatedSubSchedule of relatedSubSchedules) {
            if (updatedSubSchedules.has(relatedSubSchedule.id)) {
                continue;
            }

            try {
                // Cari SeatAvailability untuk SubSchedule terkait
                console.log(`Fetching SeatAvailability for related SubSchedule ID: ${relatedSubSchedule.id}`);
                let seatAvailability = await SeatAvailability.findOne({
                    where: {
                        schedule_id: schedule_id,
                        subschedule_id: relatedSubSchedule.id,
                        date: booking_date
                    },
                    transaction
                });

                if (!seatAvailability) {
                    throw new Error(`✅ Seat availability tidak ditemukan untuk SubSchedule ID: ${relatedSubSchedule.id}`);
                }

                // // Log available seats sebelum diupdate
                // console.log(`✅ Current available seats for SubSchedule ID: ${relatedSubSchedule.id}, SeatAvailability ID: ${seatAvailability.id} = ${seatAvailability.available_seats}`);
                
                // // Tambahkan kembali kursi yang telah dipesan - SELALU TAMBAHKAN KURSI TERLEBIH DAHULU
                // console.log(`✅ Returning ${total_passengers} seats to related SubSchedule ID: ${relatedSubSchedule.id}`);
                seatAvailability.available_seats += total_passengers;
                await seatAvailability.save({ transaction }); // Simpan perubahan ke database
                
                // Log available seats setelah diupdate
                // console.log(`✅ Updated available seats for SubSchedule ID: ${relatedSubSchedule.id}, SeatAvailability ID: ${seatAvailability.id} = ${seatAvailability.available_seats}`);
                
                // Tambahkan ke array tracking
                releasedSeats.push({
                    subschedule_id: relatedSubSchedule.id,
                    seat_availability_id: seatAvailability.id,
                    seats_returned: total_passengers,
                    available_seats_after: seatAvailability.available_seats
                });
            
                // Tambahkan SubSchedule ke Set yang diperbarui
                updatedSubSchedules.add(relatedSubSchedule.id);
            } catch (error) {
                console.log(`⚠️ Error processing SubSchedule ${relatedSubSchedule.id}: ${error.message}`);
                // Continue with other sub-schedules rather than failing completely
            }
        }

        // Tangani SubSchedule yang dipilih secara spesifik jika belum diperbarui di loop sebelumnya
        if (!updatedSubSchedules.has(subschedule_id)) {
            try {
                // // Cari SeatAvailability untuk SubSchedule yang dipilih
                // console.log(`Fetching SeatAvailability for selected SubSchedule ID: ${subschedule_id}`);
                let selectedSeatAvailability = await SeatAvailability.findOne({
                    where: {
                        schedule_id: schedule_id,
                        subschedule_id: subschedule_id,
                        date: booking_date
                    },
                    transaction
                });

                if (!selectedSeatAvailability) {
                    throw new Error('❌ Seat availability tidak ditemukan untuk SubSchedule yang dipilih');
                }

                // Log available seats sebelum diupdate
                // console.log(`✅ Current available seats for selected SubSchedule ID: ${subschedule_id}, SeatAvailability ID: ${selectedSeatAvailability.id} = ${selectedSeatAvailability.available_seats}`);
                
                // Tambahkan kembali kursi yang telah dipesan untuk SubSchedule yang dipilih
                // console.log(`✅ Returning ${total_passengers} seats to selected SubSchedule ID: ${subschedule_id}`);
                selectedSeatAvailability.available_seats += total_passengers;
                await selectedSeatAvailability.save({ transaction });
                
                // Log available seats setelah diupdate
                // console.log(`✅ Updated available seats for selected SubSchedule ID: ${subschedule_id}, SeatAvailability ID: ${selectedSeatAvailability.id} = ${selectedSeatAvailability.available_seats}`);
                
                // Tambahkan ke array tracking
                releasedSeats.push({
                    subschedule_id: subschedule_id,
                    seat_availability_id: selectedSeatAvailability.id,
                    seats_returned: total_passengers,
                    available_seats_after: selectedSeatAvailability.available_seats
                });

                updatedSubSchedules.add(subschedule_id);
                
            } catch (error) {
                console.log(`⚠️ Error processing selected SubSchedule ${subschedule_id}: ${error.message}`);
                // Continue with main schedule rather than failing completely
            }
        }

        // console.log(`✅ Berhasil mengembalikan kursi untuk SubSchedule ID: ${subschedule_id}`);

        // ===================== Tambahkan Logika untuk Main Schedule ===================== //

        try {
            // Cari SeatAvailability untuk Main Schedule (subschedule_id = null)
            // console.log(`Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
            let mainSeatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id: schedule_id,
                    subschedule_id: null, // Main Schedule tidak memiliki subschedule_id
                    date: booking_date
                },
                transaction
            });

            if (!mainSeatAvailability) {
                throw new Error('Seat availability tidak ditemukan untuk Main Schedule.');
            }

            // // Log available seats sebelum diupdate
            // console.log(`✅ Current available seats for Main Schedule ID: ${schedule_id}, SeatAvailability ID: ${mainSeatAvailability.id} = ${mainSeatAvailability.available_seats}`);
            
            // // Tambahkan kembali kursi yang telah dipesan untuk Main Schedule
            // console.log(`✅ Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
            mainSeatAvailability.available_seats += total_passengers;
            await mainSeatAvailability.save({ transaction }); // Simpan perubahan ke database
            
            // Log available seats setelah diupdate
            // console.log(`✅ Updated available seats for Main Schedule ID: ${schedule_id}, SeatAvailability ID: ${mainSeatAvailability.id} = ${mainSeatAvailability.available_seats}`);
            
            // Tambahkan main schedule ke array tracking
            releasedSeats.push({
                subschedule_id: "MAIN_SCHEDULE",
                seat_availability_id: mainSeatAvailability.id,
                seats_returned: total_passengers,
                available_seats_after: mainSeatAvailability.available_seats
            });

        } catch (error) {
            console.log(`⚠️ Error processing Main Schedule: ${error.message}`);
            // Continue with returning results rather than failing completely
        }

        // ================== Panggil adjustSeatCapacity di akhir proses ================== //
        // console.log(`✅ Semua kursi telah dikembalikan. Menyesuaikan dengan kapasitas maksimum...`);
        await adjustSeatCapacity(schedule_id, booking_date, transaction);
        // ============================================================================= //

        // // Tambahkan log ringkasan seluruh seat yang telah direlease
        // console.log("✅ RELEASE SUMMARY - ALL RELEASED SEATS:", JSON.stringify(releasedSeats, null, 2));

        return updatedSubSchedules; // Kembalikan Set yang berisi SubSchedule yang telah diperbarui
    } catch (error) {
        // Log error dan lemparkan kembali jika terjadi masalah
        console.error(`❌ Gagal melepaskan kursi untuk SubSchedule ID: ${subschedule_id}`, error);
        throw error;
    }
};


module.exports = releaseSubScheduleSeats;

