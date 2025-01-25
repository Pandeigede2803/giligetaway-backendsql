const SeatAvailability = require('../models/SeatAvailability');
const SubSchedule = require('../models/SubSchedule');
const { findRelatedSubSchedules } = require('./handleSubScheduleBooking');

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

const releaseSubScheduleSeats = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
    const releasedSeatIds = []; // Track updated SeatAvailability IDs

    try {
        // Fetch Schedule and associated Boat
        console.log(`✅ =====Fetching Schedule with ID=====: ${schedule_id}`);
        const schedule = await Schedule.findByPk(schedule_id, {
            include: [{ model: sequelize.models.Boat, as: 'Boat' }],
            transaction,
        });

        if (!schedule || !schedule.Boat) {
            throw new Error('Schedule or associated Boat not found');
        }

        const boatCapacity = schedule.Boat.capacity;
        console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

        // Fetch SubSchedule by ID
        console.log(`Fetching SubSchedule with ID: ${subschedule_id}`);
        const subSchedule = await SubSchedule.findByPk(subschedule_id, { transaction });

        if (!subSchedule) {
            throw new Error('❌SubSchedule not found');
        }

        // Fetch related SubSchedules
        console.log(`Fetching related SubSchedules for Schedule ID: ${schedule_id}`);
        const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

        // Update related SubSchedules
        for (const relatedSubSchedule of relatedSubSchedules) {
            if (relatedSubSchedule.id === subschedule_id) continue; // Skip selected SubSchedule

            console.log(`Processing related SubSchedule ID: ${relatedSubSchedule.id}`);
            const { id, seatAvailability } = await fetchAndValidateSeatAvailability(
                schedule_id,
                relatedSubSchedule.id,
                booking_date,
                boatCapacity,
                total_passengers,
                transaction
            );

            // Update seat availability
            seatAvailability.available_seats += total_passengers;
            await seatAvailability.save({ transaction });
            releasedSeatIds.push(id); // Track updated SeatAvailability ID
        }

        // Update selected SubSchedule
        console.log(`Processing selected SubSchedule ID: ${subschedule_id}`);
        const { id: selectedSeatId, seatAvailability: selectedSeatAvailability } = await fetchAndValidateSeatAvailability(
            schedule_id,
            subschedule_id,
            booking_date,
            boatCapacity,
            total_passengers,
            transaction
        );

        selectedSeatAvailability.available_seats += total_passengers;
        await selectedSeatAvailability.save({ transaction });
        releasedSeatIds.push(selectedSeatId);

        // Update Main Schedule
        console.log(`Processing Main Schedule ID: ${schedule_id}`);
        const { id: mainSeatId, seatAvailability: mainScheduleSeatAvailability } = await fetchAndValidateSeatAvailability(
            schedule_id,
            null, // Main Schedule has no subschedule_id
            booking_date,
            boatCapacity,
            total_passengers,
            transaction
        );

        mainScheduleSeatAvailability.available_seats += total_passengers;
        await mainScheduleSeatAvailability.save({ transaction });
        releasedSeatIds.push(mainSeatId);

        console.log(`Successfully released seats for Schedule ID: ${schedule_id}`);
        return releasedSeatIds; // Return IDs of all updated SeatAvailability
    } catch (error) {
        console.error(`Failed to release seats for SubSchedule ID: ${subschedule_id}`, error);
        throw error;
    }
};


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
const releaseSubScheduleSeatsSuccess = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
    try {
        console.log(`✅ RELEASE SUB SCHEDULE MULAI: ${subschedule_id}`);
        console.log(`✅ Fetching SubSchedule with ID: ${subschedule_id}`);
        const subSchedule = await SubSchedule.findByPk(subschedule_id, { transaction });

        // Jika SubSchedule tidak ditemukan, lemparkan error
        if (!subSchedule) {
            throw new Error('✅ SubSchedule tidak ditemukan');
        }

        // Cari SubSchedule yang terkait menggunakan fungsi findRelatedSubSchedules
        console.log(`✅ Fetching related SubSchedules for Schedule ID: ${schedule_id}`);
        const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);
        const updatedSubSchedules = new Set(); // Set untuk melacak sub-schedule yang sudah diperbarui

        // Loop melalui SubSchedule terkait untuk mengembalikan kursi
        for (const relatedSubSchedule of relatedSubSchedules) {
            if (updatedSubSchedules.has(relatedSubSchedule.id) || relatedSubSchedule.id === subschedule_id) {
                console.log(`✅ Skipping already updated or selected SubSchedule with ID: ${relatedSubSchedule.id}`);
                continue; // Hindari update dua kali atau jika sudah diperbarui
            }

            // Cari SeatAvailability untuk SubSchedule terkait
            console.log(`Fetching SeatAvailability for related SubSchedule ID: ${relatedSubSchedule.id}`);
            let relatedSeatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id: schedule_id,
                    subschedule_id: relatedSubSchedule.id,
                    date: booking_date
                },
                transaction
            });

            console.log("relatedSeatAvailability:", relatedSeatAvailability);

            if (!relatedSeatAvailability) {
                throw new Error(`✅ Seat availability tidak ditemukan untuk SubSchedule ID: ${relatedSubSchedule.id}`);
            }

            // Tambahkan kembali kursi yang telah dipesan
            console.log(`✅ Returning ${total_passengers} seats to related SubSchedule ID: ${relatedSubSchedule.id}`);
            relatedSeatAvailability.available_seats += total_passengers;
            await relatedSeatAvailability.save({ transaction }); // Simpan perubahan ke database

            // Tambahkan SubSchedule ke Set yang diperbarui
            updatedSubSchedules.add(relatedSubSchedule.id);
        }

        // Tangani SubSchedule yang dipilih secara spesifik jika belum diperbarui di loop sebelumnya
        if (!updatedSubSchedules.has(subschedule_id)) {
            console.log(`✅ Fetching SeatAvailability for selected SubSchedule ID: ${subschedule_id}`);
            let selectedSubScheduleSeatAvailability = await SeatAvailability.findOne({
                where: {
                    schedule_id: schedule_id,
                    subschedule_id: subschedule_id,
                    date: booking_date
                },
                transaction
            });

            if (!selectedSubScheduleSeatAvailability) {
                throw new Error('❌ Seat availability tidak ditemukan untuk SubSchedule yang dipilih');
            }

            // Tambahkan kembali kursi yang telah dipesan untuk SubSchedule yang dipilih
            console.log(`✅ Returning ${total_passengers} seats to selected SubSchedule ID: ${subschedule_id}`);
            selectedSubScheduleSeatAvailability.available_seats += total_passengers;
            await selectedSubScheduleSeatAvailability.save({ transaction });

            updatedSubSchedules.add(subschedule_id);
        }

        console.log(`✅ Berhasil mengembalikan ${total_passengers} kursi untuk SubSchedule ID: ${subschedule_id}`);

        // ===================== Tambahkan Logika untuk Main Schedule ===================== //

        // Cari SeatAvailability untuk Main Schedule (subschedule_id = null)
        console.log(`✅ Fetching SeatAvailability for Main Schedule ID: ${schedule_id}`);
        let mainScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: null, // Main Schedule tidak memiliki subschedule_id
                date: booking_date
            },
            transaction
        });

        if (!mainScheduleSeatAvailability) {
            throw new Error('Seat availability tidak ditemukan untuk Main Schedule.');
        }

        // Tambahkan kembali kursi yang telah dipesan untuk Main Schedule
        console.log(`✅ Returning ${total_passengers} seats to Main Schedule ID: ${schedule_id}`);
        mainScheduleSeatAvailability.available_seats += total_passengers;
        await mainScheduleSeatAvailability.save({ transaction }); // Simpan perubahan ke database

        console.log(`✅ Berhasil mengembalikan ${total_passengers} kursi untuk Main Schedule ID: ${schedule_id}.`);

        // ============================================================================= //

        return updatedSubSchedules; // Kembalikan Set yang berisi SubSchedule yang telah diperbarui
    } catch (error) {
        // Log error dan lemparkan kembali jika terjadi masalah
        console.error(`❌Gagal melepaskan kursi untuk SubSchedule ID: ${subschedule_id}`, error);
        throw error;
    }
};


module.exports = releaseSubScheduleSeats;



module.exports = releaseSubScheduleSeatsSuccess;