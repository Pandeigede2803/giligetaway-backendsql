const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule, SubSchedule,Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op } = require('sequelize');


// const findRelatedSubSchedules = async (schedule_id, subSchedule, transaction) => {
//     // Mencari semua SubSchedule yang memiliki relasi dengan subSchedule yang diberikan
//     const relatedSubSchedules = await SubSchedule.findAll({
//         where: {
//             schedule_id: schedule_id,
//             [Op.or]: [
//                 { destination_from_schedule_id: subSchedule.destination_from_schedule_id },
//                 { destination_to_schedule_id: subSchedule.destination_to_schedule_id },
//                 { transit_from_id: subSchedule.transit_from_id },
//                 { transit_to_id: subSchedule.transit_to_id }
//             ]
//         },
//         include: [
//             {
//                 model: Transit,
//                 as: 'TransitFrom',
//                 where: {
//                     destination_id: {
//                         [Op.in]: [
//                             subSchedule.destination_from_schedule_id,
//                             subSchedule.destination_to_schedule_id
//                         ]
//                     }
//                 },
//                 required: false
//             },
//             {
//                 model: Transit,
//                 as: 'TransitTo',
//                 where: {
//                     destination_id: {
//                         [Op.in]: [
//                             subSchedule.destination_from_schedule_id,
//                             subSchedule.destination_to_schedule_id
//                         ]
//                     }
//                 },
//                 required: false
//             }
//         ],
//         transaction
//     });

//     return relatedSubSchedules;
// };

//UNTUK SEMENTARA INI BERHASIL
const findRelatedSubSchedules = async (schedule_id, subSchedule, transaction) => {
    const transitIds = [
        subSchedule.transit_from_id,
        subSchedule.transit_1,
        subSchedule.transit_2,
        subSchedule.transit_3,
        subSchedule.transit_4,
        subSchedule.transit_to_id
    ].filter(Boolean); // Menghilangkan nilai null

    const relatedSubSchedules = await SubSchedule.findAll({
        where: {
            schedule_id: schedule_id,
            [Op.or]: [
                {
                    destination_from_schedule_id: subSchedule.destination_from_schedule_id
                },
                {
                    destination_to_schedule_id: subSchedule.destination_to_schedule_id
                },
                {
                    [Op.and]: [
                        { transit_from_id: { [Op.in]: transitIds } },
                        { transit_to_id: subSchedule.transit_to_id }
                    ]
                },
                {
                    transit_to_id: { [Op.in]: transitIds }
                }
            ]
        },
        include: [
            {
                model: Transit,
                as: 'TransitFrom',
                where: {
                    destination_id: {
                        [Op.in]: [
                            subSchedule.destination_from_schedule_id,
                            subSchedule.destination_to_schedule_id
                        ]
                    }
                },
                required: false
            },
            {
                model: Transit,
                as: 'TransitTo',
                where: {
                    destination_id: {
                        [Op.in]: [
                            subSchedule.destination_from_schedule_id,
                            subSchedule.destination_to_schedule_id
                        ]
                    }
                },
                required: false
            }
        ],
        transaction
    });

    // Implementasi Pengecualian Berdasarkan Skenario yang Diberikan
    return relatedSubSchedules.filter(relatedSubSchedule => {
        const relatedTransitIds = [
            relatedSubSchedule.transit_from_id,
            relatedSubSchedule.transit_1,
            relatedSubSchedule.transit_2,
            relatedSubSchedule.transit_3,
            relatedSubSchedule.transit_4,
            relatedSubSchedule.transit_to_id
        ].filter(Boolean); // Menghilangkan nilai null

        const isException = (
            // Pengecualian 1: Jika transit_to_id dari subSchedule yang diberikan sama dengan transit_from_id dari subSchedule terkait
            subSchedule.transit_to_id === relatedSubSchedule.transit_from_id ||

            // Pengecualian 2: Jika destination_from_schedule_id + transit_to_id dari subSchedule yang diberikan
            // tidak ditemukan dalam transit 1,2,3,4 & transit_to_id dari subSchedule terkait
            (
                subSchedule.destination_from_schedule_id &&
                subSchedule.transit_to_id &&
                !relatedTransitIds.includes(subSchedule.transit_to_id)
            ) ||

            // Pengecualian 3: Jika destination_from_schedule_id dari subSchedule yang diberikan null
            // tetapi subSchedule terkait memiliki destination_from_schedule_id
            (
                !subSchedule.destination_from_schedule_id &&
                relatedSubSchedule.destination_from_schedule_id
            ) ||

            // Pengecualian 4: Jika transit_from_id dari subSchedule yang diberikan sama dengan transit_to_id dari subSchedule terkait
            subSchedule.transit_from_id === relatedSubSchedule.transit_to_id ||

            // Pengecualian 5: Jika tidak ada kecocokan antara transit_from, transit_to, atau transit 1/2/3/4 dari subSchedule
            // dengan transit_from, transit_to, atau transit 1/2/3/4 dari relatedSubSchedule
            !transitIds.some(transitId => relatedTransitIds.includes(transitId))
        );

        return !isException;
    });
};



const handleSubScheduleBooking = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
    const schedule = await Schedule.findByPk(schedule_id, {
        include: [{ model: sequelize.models.Boat, as: 'Boat' }],
        transaction
    });

    if (!schedule || !schedule.Boat) {
        throw new Error('Boat information is missing or invalid');
    }

    const boatCapacity = schedule.Boat.capacity;

    const subSchedule = await SubSchedule.findByPk(subschedule_id, {
        include: [
            {
                model: Transit,
                as: 'TransitFrom'
            },
            {
                model: Transit,
                as: 'TransitTo'
            },
            {
                model: Transit,
                as: 'Transit1'
            },
            {
                model: Transit,
                as: 'Transit2'
            },
            {
                model: Transit,
                as: 'Transit3'
            },
            {
                model: Transit,
                as: 'Transit4'
            }
        ],
        transaction
    });

    if (!subSchedule) {
        throw new Error('SubSchedule not found');
    }

    // Update the main schedule if it's not the same as the sub-schedule (to avoid double update)
    if (subschedule_id !== schedule_id) {
        let mainScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: null, // Main schedule does not have a specific sub-schedule ID
                date: booking_date
            },
            transaction
        });

        if (!mainScheduleSeatAvailability) {
            mainScheduleSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                subschedule_id: null,
                transit_id: null,
                available_seats: boatCapacity,
                date: booking_date,
                availability: true
            }, { transaction });
        }

        if (mainScheduleSeatAvailability.available_seats < total_passengers) {
            throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
        }

        mainScheduleSeatAvailability.available_seats -= total_passengers;
        await mainScheduleSeatAvailability.save({ transaction });
    }

    // Temukan semua SubSchedule yang terkait
    const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

    // Keep track of updated sub-schedules to avoid double updates
    const updatedSubSchedules = new Set();

    // Update SeatAvailability for each related SubSchedule
    for (const relatedSubSchedule of relatedSubSchedules) {
        if (updatedSubSchedules.has(relatedSubSchedule.id)) {
            continue; // Skip if this sub-schedule was already updated
        }

        let relatedSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: relatedSubSchedule.id,
                date: booking_date
            },
            transaction
        });

        if (!relatedSeatAvailability) {
            relatedSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                subschedule_id: relatedSubSchedule.id,
                transit_id: null,
                available_seats: boatCapacity,
                date: booking_date,
                availability: true
            }, { transaction });
        }

        if (relatedSeatAvailability.available_seats < total_passengers) {
            throw new Error(`KURSI TIDAK CUKUP TERSEDIA DI SubSchedule ID: ${relatedSubSchedule.id}`);
        }

        relatedSeatAvailability.available_seats -= total_passengers;
        await relatedSeatAvailability.save({ transaction });

        updatedSubSchedules.add(relatedSubSchedule.id);
    }

    // Update the specific sub-schedule passed in the request if it hasn't been updated yet
    if (!updatedSubSchedules.has(subschedule_id)) {
        let selectedSubScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: subschedule_id,
                transit_id: null,
                date: booking_date
            },
            transaction
        });

        if (!selectedSubScheduleSeatAvailability) {
            selectedSubScheduleSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                subschedule_id: subschedule_id,
                transit_id: null,
                available_seats: boatCapacity,
                date: booking_date,
                availability: true
            }, { transaction });
        }

        if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
            throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
        }

        selectedSubScheduleSeatAvailability.available_seats -= total_passengers;
        await selectedSubScheduleSeatAvailability.save({ transaction });

        updatedSubSchedules.add(subschedule_id);
    }

    return updatedSubSchedules;
};

//TESTING 2






module.exports = handleSubScheduleBooking;




// const handleSubScheduleBooking = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     // 1. Dapatkan informasi Boat dan cek kapasitas kapal
//     console.log(`Mencari informasi Boat untuk Schedule ID: ${schedule_id}`);
    
//     const schedule = await Schedule.findByPk(schedule_id, {
//         include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//         transaction
//     });

//     if (!schedule || !schedule.Boat) {
//         throw new Error('Boat information is missing or invalid');
//     }

//     const boatCapacity = schedule.Boat.capacity;
//     console.log(`Boat Capacity: ${boatCapacity}`);

//     // 2. Cek SeatAvailability dari MainSchedule
//     console.log(`Mencari SeatAvailability untuk MainSchedule ID: ${schedule_id}`);
    
//     let mainScheduleSeatAvailability = await SeatAvailability.findOne({
//         where: {
//             schedule_id: schedule_id,
//             subschedule_id: null,
//             transit_id: null,
//             date: booking_date
//         },
//         transaction
//     });

//     if (!mainScheduleSeatAvailability) {
//         throw new Error('Main Schedule SeatAvailability tidak ditemukan');
//     }

//     console.log(`Main Schedule SeatAvailability ID: ${mainScheduleSeatAvailability.id}, tersedia: ${mainScheduleSeatAvailability.available_seats}`);

//     // 3. Cek SeatAvailability untuk SubSchedule yang dipilih
//     console.log(`Mencari SeatAvailability untuk SubSchedule ID: ${subschedule_id}`);
    
//     let selectedSubScheduleSeatAvailability = await SeatAvailability.findOne({
//         where: {
//             schedule_id: schedule_id,
//             subschedule_id: subschedule_id,
//             transit_id: null,
//             date: booking_date
//         },
//         transaction
//     });

//     if (!selectedSubScheduleSeatAvailability) {
//         // Jika SeatAvailability belum ada, buat baru dengan jumlah kursi yang sama seperti MainSchedule
//         selectedSubScheduleSeatAvailability = await SeatAvailability.create({
//             schedule_id: schedule_id,
//             subschedule_id: subschedule_id,
//             transit_id: null,
//             available_seats: mainScheduleSeatAvailability.available_seats, // Menggunakan jumlah kursi dari MainSchedule
//             date: booking_date,
//             availability: true
//         }, { transaction });

//         console.log(`SeatAvailability baru dibuat untuk SubSchedule ID: ${subschedule_id} dengan available_seats: ${mainScheduleSeatAvailability.available_seats}`);
//     }

//     // Kurangi jumlah kursi untuk SubSchedule yang dipilih
//     if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
//         throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
//     }

//     selectedSubScheduleSeatAvailability.available_seats -= total_passengers;
//     await selectedSubScheduleSeatAvailability.save({ transaction });

//     console.log(`SeatAvailability untuk SubSchedule ID: ${subschedule_id} diperbarui, setelah pengurangan kursi: ${selectedSubScheduleSeatAvailability.available_seats}`);

//     // 4. Update juga MainSchedule dengan mengurangi jumlah kursi
//     if (mainScheduleSeatAvailability.available_seats < total_passengers) {
//         throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
//     }

//     mainScheduleSeatAvailability.available_seats -= total_passengers;
//     await mainScheduleSeatAvailability.save({ transaction });

//     console.log(`Main Schedule SeatAvailability ID: ${mainScheduleSeatAvailability.id} diperbarui, setelah pengurangan kursi: ${mainScheduleSeatAvailability.available_seats}`);

//     return [selectedSubScheduleSeatAvailability, mainScheduleSeatAvailability];
// };








//TESTING SUB SCHEDULE DENGAN TRANSIT

//menemukan relasi subscehdule





// const findOrCreateSeatAvailability = async (schedule_id, subschedule_id, booking_date, mainScheduleSeatAvailability, transaction) => {
//     console.log(`Mencari SeatAvailability untuk Schedule ID: ${schedule_id}, SubSchedule ID: ${subschedule_id}`);

//     let seatAvailability = await SeatAvailability.findOne({
//         where: {
//             schedule_id: schedule_id,
//             subschedule_id: subschedule_id,
//             transit_id: null,
//             date: booking_date
//         },
//         transaction
//     });

//     if (!seatAvailability) {
//         const initialSeats = subschedule_id ? mainScheduleSeatAvailability.available_seats : schedule.Boat.capacity;
//         seatAvailability = await SeatAvailability.create({
//             schedule_id: schedule_id,
//             subschedule_id: subschedule_id,
//             transit_id: null,
//             available_seats: initialSeats,
//             date: booking_date,
//             availability: true
//         }, { transaction });

//         console.log(`SeatAvailability baru dibuat untuk Schedule ID: ${schedule_id}, SubSchedule ID: ${subschedule_id} dengan available_seats: ${initialSeats}`);
//     }

//     return seatAvailability;
// };

// const handleSubScheduleBooking = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     console.log(`Mencari informasi Boat untuk Schedule ID: ${schedule_id}`);

//     const schedule = await Schedule.findByPk(schedule_id, {
//         include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//         transaction
//     });

//     if (!schedule || !schedule.Boat) {
//         throw new Error('Boat information is missing or invalid');
//     }

//     const boatCapacity = schedule.Boat.capacity;
//     console.log(`Boat Capacity: ${boatCapacity}`);

//     console.log(`Mencari SeatAvailability untuk MainSchedule ID: ${schedule_id}`);
    
//     const mainScheduleSeatAvailability = await findOrCreateSeatAvailability(schedule_id, null, booking_date, null, transaction);
    
//     console.log(`Main Schedule SeatAvailability ID: ${mainScheduleSeatAvailability.id}, tersedia: ${mainScheduleSeatAvailability.available_seats}`);
    
//     const selectedSubScheduleSeatAvailability = await findOrCreateSeatAvailability(schedule_id, subschedule_id, booking_date, mainScheduleSeatAvailability, transaction);
    
//     console.log(`SeatAvailability untuk SubSchedule ID: ${subschedule_id} ditemukan dengan available_seats: ${selectedSubScheduleSeatAvailability.available_seats}`);
    
//     if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
//         throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
//     }

//     selectedSubScheduleSeatAvailability.available_seats -= total_passengers;
//     await selectedSubScheduleSeatAvailability.save({ transaction });

//     console.log(`SeatAvailability untuk SubSchedule ID: ${subschedule_id} diperbarui, setelah pengurangan kursi: ${selectedSubScheduleSeatAvailability.available_seats}`);
    
//     if (mainScheduleSeatAvailability.available_seats < total_passengers) {
//         throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
//     }

//     mainScheduleSeatAvailability.available_seats -= total_passengers;
//     await mainScheduleSeatAvailability.save({ transaction });

//     console.log(`Main Schedule SeatAvailability ID: ${mainScheduleSeatAvailability.id} diperbarui, setelah pengurangan kursi: ${mainScheduleSeatAvailability.available_seats}`);

//     return [selectedSubScheduleSeatAvailability, mainScheduleSeatAvailability];
// };