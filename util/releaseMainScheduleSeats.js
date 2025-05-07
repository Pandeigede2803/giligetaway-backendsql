const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');


/**
 * Mengembalikan kursi yang sebelumnya telah dipesan untuk Main Schedule dan SubSchedules terkait.
 *
 * @param {number} schedule_id - ID dari Main Schedule.
 * @param {string} booking_date - Tanggal pemesanan dalam format YYYY-MM-DD.
 * @param {number} total_passengers - Jumlah total penumpang yang akan mengembalikan kursi.
 * @param {object} transaction - Transaksi aktif Sequelize untuk memastikan atomicity.
 *
 * @throws {Error} Jika SeatAvailability tidak ditemukan atau kursi melebihi kapasitas.
 */

const fetchAndValidateSeatAvailability = async (
    schedule_id,
    subschedule_id,
    booking_date,
    boatCapacity,
    total_passengers,
    transaction
) => {
    console.log(`✅ RELEASE MAIN SCHEDULE MULAI: ${schedule_id}`);
    console.log(`🗺️Fetching SeatAvailability for SubSchedule ID: ${subschedule_id || 'Main Schedule'}`);

    const seatAvailability = await SeatAvailability.findOne({
        where: {
            schedule_id,
            subschedule_id,
            date: booking_date,
        },
        transaction,
    });

    if (!seatAvailability) {
        throw new Error(`🗺️Seat availability not found for SubSchedule ID: ${subschedule_id || 'Main Schedule'}`);
    }

    // Log warning if returning seats would exceed capacity, but do not throw
    if (seatAvailability.available_seats + total_passengers > boatCapacity) {
        console.warn(
            `⚠️ Returning ${total_passengers} seats will exceed boat capacity (${boatCapacity}) for SubSchedule ID: ${subschedule_id || 'Main Schedule'}. Will cap later in update.`
        );
        // No throw — allow continuation
    }

    return seatAvailability;;
};
const releaseMainScheduleSeats = async (schedule_id, booking_date, total_passengers, transaction) => {
    const releasedSeatIds = []; // Track updated SeatAvailability IDs
    
    try {
        // Format booking date to 'YYYY-MM-DD'
        const formattedDate = booking_date.split('T')[0];
        
        // Fetch Schedule and associated Boat
        console.log(`✅ Fetching Schedule with ID: ${schedule_id}`);
        const schedule = await Schedule.findByPk(schedule_id, {
            include: [{ model: sequelize.models.Boat, as: 'Boat' }],
            transaction,
        });
        
        if (!schedule || !schedule.Boat) {
            throw new Error('Schedule or associated Boat not found.');
        }
        
        const boat = schedule.Boat;
        console.log(`✅ Boat info: ID=${boat.id}, Capacity=${boat.capacity}`);
        
        // Fetch and validate Main Schedule SeatAvailability
        console.log(`✅ Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
        let mainScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: null, // Main Schedule has no subschedule_id
                date: formattedDate
            },
            transaction
        });
        
        if (!mainScheduleSeatAvailability) {
            throw new Error('Seat availability tidak ditemukan untuk Main Schedule.');
        }
        
        // SELALU TAMBAHKAN KURSI TERLEBIH DAHULU - tanpa pengecekan kapasitas
        console.log(`✅ Current available seats for Main Schedule: ${mainScheduleSeatAvailability.available_seats}`);
        console.log(`✅ Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
        
        mainScheduleSeatAvailability.available_seats += total_passengers;
        await mainScheduleSeatAvailability.save({ transaction });
        
        console.log(`✅ Updated available seats for Main Schedule: ${mainScheduleSeatAvailability.available_seats}`);
        releasedSeatIds.push(mainScheduleSeatAvailability.id);
        
        // Fetch related SubSchedules
        console.log(`✅ Fetching related SubSchedules for Main Schedule ID: ${schedule_id}`);
        const relatedSubSchedules = await SubSchedule.findAll({
            where: { schedule_id: schedule_id },
            transaction,
        });
        
        // Process each related SubSchedule
        for (const subSchedule of relatedSubSchedules) {
            console.log(`✅ Processing SubSchedule ID: ${subSchedule.id}`);
            
            let subScheduleSeatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id: schedule_id,
                    subschedule_id: subSchedule.id,
                    date: formattedDate
                },
                transaction
            });
            
            if (!subScheduleSeatAvailability) {
                console.log(`⚠️ SeatAvailability not found for SubSchedule ID: ${subSchedule.id}. Creating new entry.`);
                subScheduleSeatAvailability = await SeatAvailability.create({
                    schedule_id: schedule_id,
                    subschedule_id: subSchedule.id,
                    date: formattedDate,
                    available_seats: 0, // Will be updated below
                    boost: false // Default value
                }, { transaction });
            }
            
            // SELALU TAMBAHKAN KURSI TERLEBIH DAHULU - tanpa pengecekan kapasitas
            console.log(`✅ Current available seats for SubSchedule ID ${subSchedule.id}: ${subScheduleSeatAvailability.available_seats}`);
            console.log(`✅ Returning ${total_passengers} seats to SubSchedule ID: ${subSchedule.id}`);
            
            subScheduleSeatAvailability.available_seats += total_passengers;
            await subScheduleSeatAvailability.save({ transaction });
            
            console.log(`✅ Updated available seats for SubSchedule ID ${subSchedule.id}: ${subScheduleSeatAvailability.available_seats}`);
            releasedSeatIds.push(subScheduleSeatAvailability.id);
        }
        
        // Panggil adjustSeatCapacity di akhir untuk memastikan semua kapasitas sesuai
        console.log(`✅ Semua kursi telah dikembalikan. Menyesuaikan dengan kapasitas maksimum...`);
        await adjustSeatCapacity(schedule_id, formattedDate, transaction);
        
        return releasedSeatIds; // Return all updated SeatAvailability IDs
        
    } catch (error) {
        console.error(`❌ Failed to release seats for Main Schedule ID: ${schedule_id}`, error);
        throw error;
    }
};

// Fungsi adjustSeatCapacity yang konsisten
const adjustSeatCapacity = async (schedule_id, booking_date, transaction) => {
    try {
        console.log(`✅ Memulai penyesuaian kapasitas untuk Schedule ID: ${schedule_id}`);
        
        // Ambil data kapal
        const schedule = await Schedule.findByPk(schedule_id, {
            include: [
                {
                    model: sequelize.models.Boat,
                    as: "Boat"
                }
            ],
            transaction
        });
        
        if (!schedule || !schedule.Boat) {
            throw new Error('Schedule atau Boat tidak ditemukan');
        }
        
        const boat = schedule.Boat;
        console.log(`✅ Info Boat: ID=${boat.id}, Kapasitas=${boat.capacity}`);
        
        // Ambil semua SeatAvailability untuk schedule ini pada tanggal yang ditentukan
        const seatAvailabilities = await SeatAvailability.findAll({
            where: {
                schedule_id: schedule_id,
                date: booking_date
            },
            transaction
        });
        
        console.log(`✅ Ditemukan ${seatAvailabilities.length} SeatAvailability untuk penyesuaian`);
        
        // Proses setiap SeatAvailability
        for (const seatAvailability of seatAvailabilities) {
            // Tentukan kapasitas maksimum berdasarkan status boost
            const maxCapacity = seatAvailability.boost 
                ? boat.capacity 
                : calculatePublicCapacity(boat);
            
            // Cek apakah melebihi kapasitas
            if (seatAvailability.available_seats > maxCapacity) {
                console.log(`⚠️ PERINGATAN: SeatAvailability ID=${seatAvailability.id} melebihi kapasitas`);
                console.log(`⚠️ Kursi tersedia=${seatAvailability.available_seats}, Kapasitas Maks=${maxCapacity}`);
                
                // Catat jumlah kursi sebelum disesuaikan
                const originalSeats = seatAvailability.available_seats;
                
                // Sesuaikan ke kapasitas maksimum
                seatAvailability.available_seats = maxCapacity;
                await seatAvailability.save({ transaction });
                
                console.log(`✅ Disesuaikan: ${originalSeats} -> ${seatAvailability.available_seats}`);
            } else {
                console.log(`✅ SeatAvailability ID=${seatAvailability.id} dalam batas kapasitas (${seatAvailability.available_seats} <= ${maxCapacity})`);
            }
        }
        
        console.log(`✅ Penyesuaian kapasitas selesai untuk Schedule ID: ${schedule_id}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Gagal menyesuaikan kapasitas untuk Schedule ID: ${schedule_id}`, error);
        throw error;
    }
};

// Fungsi calculatePublicCapacity (jika belum ada)
const calculatePublicCapacity = (boat) => {
    // Implementasi sesuai dengan logika bisnis Anda
    // Contoh: 80% dari kapasitas total
    return Math.floor(boat.capacity * 0.8);
};

// const releaseMainScheduleSeats = async (schedule_id, booking_date, total_passengers, transaction) => {
//     const releasedSeatIds = []; // Track updated SeatAvailability IDs

//     try {
//         // Format booking date to 'YYYY-MM-DD'
//         const formattedDate = booking_date.split('T')[0];

//         // Fetch Schedule and associated Boat
//         console.log(`✅Fetching Schedule with ID: ${schedule_id}`);
//         const schedule = await Schedule.findByPk(schedule_id, {
//             include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//             transaction,
//         });

//         if (!schedule || !schedule.Boat) {
//             throw new Error('Schedule or associated Boat not found.');
//         }

//         const boatCapacity = schedule.Boat.capacity;
//         console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

//         // Fetch and validate Main Schedule SeatAvailability
//         console.log(`✅Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
//         const mainScheduleSeatAvailability = await fetchAndValidateSeatAvailability(
//             schedule_id,
//             null, // Main Schedule has no subschedule_id
//             formattedDate,
//             boatCapacity,
//             total_passengers,
//             transaction
//         );

//         // Update seat availability for Main Schedule
//       // Update seat availability for Main Schedule (safe update)
// mainScheduleSeatAvailability.available_seats = Math.min(
//     mainScheduleSeatAvailability.available_seats + total_passengers,
//     boatCapacity
//   );
//   await mainScheduleSeatAvailability.save({ transaction });
//   releasedSeatIds.push(mainScheduleSeatAvailability.id);
  
//   console.log(`✅Returned seats for Main Schedule ID: ${schedule_id} (Capped to capacity if exceeded).`);

//         // Fetch related SubSchedules
//         console.log(`Fetching related SubSchedules for Main Schedule ID: ${schedule_id}`);
//         const relatedSubSchedules = await SubSchedule.findAll({
//             where: { schedule_id: schedule_id },
//             transaction,
//         });

//         // Process each related SubSchedule
//         for (const subSchedule of relatedSubSchedules) {
//             console.log(`✅Processing SubSchedule ID: ${subSchedule.id}`);
//             const subScheduleSeatAvailability = await fetchAndValidateSeatAvailability(
//                 schedule_id,
//                 subSchedule.id,
//                 formattedDate,
//                 boatCapacity,
//                 total_passengers,
//                 transaction
//             );

//             // Update seat availability for SubSchedule
//             subScheduleSeatAvailability.available_seats += total_passengers;
//             await subScheduleSeatAvailability.save({ transaction });
//             releasedSeatIds.push(subScheduleSeatAvailability.id);

//             console.log(`✅Successfully returned ${total_passengers} seats for SubSchedule ID: ${subSchedule.id}.`);
//         }

//         return releasedSeatIds; // Return all updated SeatAvailability IDs
//     } catch (error) {
//         console.error(`❌Failed to release seats for Main Schedule ID: ${schedule_id}`, error);
//         throw error;
//     }
// };

// const releaseMainScheduleSeats = async (schedule_id, booking_date, total_passengers, transaction) => {
//     try {
//         // Format tanggal menjadi 'YYYY-MM-DD'
//         const formattedDate = booking_date.split('T')[0];

//         // Ambil Schedule dan Boat untuk mendapatkan kapasitas perahu
//         console.log(`Fetching Schedule with ID: ${schedule_id}`);
//         const schedule = await Schedule.findByPk(schedule_id, {
//             include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//             transaction
//         });

//         if (!schedule || !schedule.Boat) {
//             throw new Error('Schedule atau Boat tidak ditemukan.');
//         }

//         const boatCapacity = schedule.Boat.capacity;
//         console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

//         // Cek ketersediaan kursi di Main Schedule
//         console.log(`Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
//         let seatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 transit_id: null,
//                 subschedule_id: null, // Main Schedule tidak memiliki subschedule_id
//                 date: formattedDate
//             },
//             transaction
//         });

//         if (!seatAvailability) {
//             throw new Error('SeatAvailability untuk Main Schedule tidak ditemukan.');
//         }

//         // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat
//         if (seatAvailability.available_seats + total_passengers > boatCapacity) {
//             throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk Main Schedule ID: ${schedule_id}`);
//         }

//         // Kembalikan kursi yang dilepaskan di Main Schedule
//         console.log(`Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
//         seatAvailability.available_seats += total_passengers;
//         await seatAvailability.save({ transaction });

//         console.log(`Berhasil mengembalikan ${total_passengers} kursi untuk Main Schedule ID: ${schedule_id}.`);

//         // Cari sub-schedule yang terkait dengan main schedule
//         console.log(`Fetching related SubSchedules for Main Schedule ID: ${schedule_id}`);
//         const relatedSubSchedules = await SubSchedule.findAll({
//             where: {
//                 schedule_id: schedule_id
//             },
//             transaction
//         });

//         // Kembalikan kursi untuk setiap SubSchedule yang terkait
//         for (const subSchedule of relatedSubSchedules) {
//             console.log(`Fetching SeatAvailability for SubSchedule ID: ${subSchedule.id}`);
//             let subScheduleSeatAvailability = await SeatAvailability.findOne({
//                 where: {
//                     schedule_id: schedule_id,
//                     subschedule_id: subSchedule.id, // Mengembalikan kursi di sub-schedule terkait
//                     date: formattedDate
//                 },
//                 transaction
//             });

//             if (!subScheduleSeatAvailability) {
//                 console.error(`Seat availability tidak ditemukan untuk SubSchedule ID: ${subSchedule.id}.`);
//                 continue;
//             }

//             // Validasi apakah kursi yang dikembalikan melebihi kapasitas boat di sub-schedule
//             if (subScheduleSeatAvailability.available_seats + total_passengers > boatCapacity) {
//                 throw new Error(`Kursi yang dikembalikan melebihi kapasitas boat untuk SubSchedule ID: ${subSchedule.id}`);
//             }

//             // Kembalikan kursi di sub-schedule terkait
//             console.log(`Returning ${total_passengers} seats to SubSchedule ID: ${subSchedule.id}`);
//             subScheduleSeatAvailability.available_seats += total_passengers;
//             await subScheduleSeatAvailability.save({ transaction });

//             console.log(`Berhasil mengembalikan ${total_passengers} kursi untuk SubSchedule ID: ${subSchedule.id}.`);
//         }

//     } catch (error) {
//         console.error(`Gagal melepaskan kursi untuk Main Schedule ID: ${schedule_id}`, error);
//         throw error;
//     }
// };

module.exports = releaseMainScheduleSeats;
