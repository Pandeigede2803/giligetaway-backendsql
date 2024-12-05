const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule, SubSchedule,Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op } = require('sequelize');

const { calculatePublicCapacity } = require('../util/getCapacityReduction');

const findRelatedSubSchedulesGet = async (schedule_id, subSchedule, transaction) => {
    console.log('Schedule ID anjiung:', schedule_id);
console.log('SubSchedule ID: anjing', subSchedule);
console.log('Transaction ID: anjing', transaction);
if (!subSchedule || !schedule_id) {
    throw new Error('SubSchedule atau Schedule ID tidak valid');
}


    const transitIds = [
        subSchedule.transit_from_id,
        subSchedule.transit_1,
        subSchedule.transit_2,
        subSchedule.transit_3,
        subSchedule.transit_4,
        subSchedule.transit_to_id
    ].filter(Boolean); // Menghilangkan nilai null atau undefined

    // Mempersiapkan kondisi untuk destination_from_schedule_id dan destination_to_schedule_id
    const orConditions = [];

    if (subSchedule.destination_from_schedule_id) {
        orConditions.push({ destination_from_schedule_id: subSchedule.destination_from_schedule_id });
    }

    if (subSchedule.destination_to_schedule_id) {
        orConditions.push({ destination_to_schedule_id: subSchedule.destination_to_schedule_id });
    }

    if (transitIds.length > 0) {
        orConditions.push({
            [Op.and]: [
                { transit_from_id: { [Op.in]: transitIds } },
                { transit_to_id: subSchedule.transit_to_id }
            ]
        });

        orConditions.push({
            transit_to_id: { [Op.in]: transitIds }
        });
    }

    // Cek apakah orConditions memiliki nilai sebelum mengirimkan ke Sequelize
    if (orConditions.length === 0) {
        throw new Error('Tidak ada kondisi valid untuk query.');
    }

    // Query untuk mencari SubSchedules terkait
    const relatedSubSchedules = await SubSchedule.findAll({
        where: {
            schedule_id: schedule_id,
            [Op.or]: orConditions
        },
        include: [
            {
                model: Transit,
                as: 'TransitFrom',
                where: subSchedule.destination_from_schedule_id || subSchedule.transit_from_id
                    ? {
                        destination_id: {
                            [Op.in]: [
                                subSchedule.destination_from_schedule_id,
                                subSchedule.destination_to_schedule_id
                            ].filter(Boolean) // Menghilangkan null/undefined
                        }
                    }
                    : undefined, // Jika kondisinya tidak ada, gunakan undefined
                required: false
            },
            {
                model: Transit,
                as: 'TransitTo',
                where: subSchedule.destination_to_schedule_id || subSchedule.transit_to_id
                    ? {
                        destination_id: {
                            [Op.in]: [
                                subSchedule.destination_from_schedule_id,
                                subSchedule.destination_to_schedule_id
                            ].filter(Boolean) // Menghilangkan null/undefined
                        }
                    }
                    : undefined, // Jika kondisinya tidak ada, gunakan undefined
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
        ].filter(Boolean); // Menghilangkan nilai null atau undefined

        const isException = (
            subSchedule.transit_to_id === relatedSubSchedule.transit_from_id ||
            (subSchedule.destination_from_schedule_id &&
                subSchedule.transit_to_id &&
                !relatedTransitIds.includes(subSchedule.transit_to_id)) ||
            (!subSchedule.destination_from_schedule_id &&
                relatedSubSchedule.destination_from_schedule_id) ||
            subSchedule.transit_from_id === relatedSubSchedule.transit_to_id ||
            !transitIds.some(transitId => relatedTransitIds.includes(transitId))
        );

        return !isException;
    });
};

//UNTUK SEMENTARA INI BERHASIL
const findRelatedSubSchedules = async (schedule_id, subSchedule, transaction) => {

    // console log semua
    console.log('Schedule ID dari findRelatedSubSchedules:', schedule_id);
    console.log('SubSchedule: dari findRelatedSubSchedules', subSchedule);
    console.log('Transaction:', transaction);
    const transitIds = [
        subSchedule.transit_from_id,
        subSchedule.transit_1,
        subSchedule.transit_2,
        subSchedule.transit_3,
        subSchedule.transit_4,
        subSchedule.transit_to_id
    ].filter(Boolean); // Menghilangkan nilai null

    console.log(`[handleSubScheduleBooking] Mencari sub-schedule yang terkait dengan schedule_id: ${schedule_id} dan sub-schedule yang diberikan`);

    const relatedSubSchedules = await SubSchedule.findAll({

        // Mencari sub-schedule yang terkait
        where: {
            schedule_id: schedule_id,
            [Op.or]: [
                {
                    // Mencari sub-schedule yang terkait dengan sub-schedule yang diberikan
                    destination_from_schedule_id: subSchedule.destination_from_schedule_id
                },
                {
                    // Mencari sub-schedule yang terkait dengan sub-schedule yang diberikan
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
        // Include transit_from dan transit_to untuk memudahkan proses berikutnya
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

    console.log(`[handleSubScheduleBooking] Sub-schedule yang terkait adalah: ${relatedSubSchedules.length} buah`);

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
    // Fetch the main schedule and boat capacity
    const schedule = await Schedule.findByPk(schedule_id, {
        include: [{ model: sequelize.models.Boat, as: 'Boat' }],
        transaction
    });

    if (!schedule || !schedule.Boat) {
        console.log('Schedule atau Boat tidak ditemukan:', schedule);
        throw new Error('Boat information is missing or invalid');
    }

    // Calculate public capacity using the utility
    const publicCapacity = calculatePublicCapacity(schedule.Boat);
    console.log(`Schedule ID: ${schedule_id} - Original Capacity: ${schedule.Boat.capacity}, Public Capacity: ${publicCapacity}`);

    // Fetch the selected sub-schedule
    const subSchedule = await SubSchedule.findByPk(subschedule_id, {
        include: [
            { model: Transit, as: 'TransitFrom' },
            { model: Transit, as: 'TransitTo' },
            { model: Transit, as: 'Transit1' },
            { model: Transit, as: 'Transit2' },
            { model: Transit, as: 'Transit3' },
            { model: Transit, as: 'Transit4' }
        ],
        transaction
    });

    if (!subSchedule) {
        throw new Error('SubSchedule not found');
    }

    const seatAvailabilities = [];

    // Handle main schedule seat availability
    if (subschedule_id !== schedule_id) {
        let mainScheduleSeatAvailability = await SeatAvailability.findOne({
            where: {
                schedule_id: schedule_id,
                subschedule_id: null,
                date: booking_date
            },
            transaction
        });

        if (!mainScheduleSeatAvailability) {
            mainScheduleSeatAvailability = await SeatAvailability.create({
                schedule_id: schedule_id,
                subschedule_id: null,
                transit_id: null,
                available_seats: publicCapacity, // Using public capacity instead of boat capacity
                date: booking_date,
                availability: true
            }, { transaction });
        }

        if (mainScheduleSeatAvailability.available_seats < total_passengers) {
            throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
        }

        mainScheduleSeatAvailability.available_seats -= total_passengers;

        if (mainScheduleSeatAvailability.available_seats < 0) {
            throw new Error('Seat availability cannot go below zero in the main schedule');
        }

        await mainScheduleSeatAvailability.save({ transaction });
        seatAvailabilities.push(mainScheduleSeatAvailability);
    }

    // Find related sub-schedules
    const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

    // Handle seat availability for each related sub-schedule
    for (const relatedSubSchedule of relatedSubSchedules) {
        if (relatedSubSchedule.id === subschedule_id) continue;

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
                available_seats: publicCapacity, // Using public capacity
                date: booking_date,
                availability: true
            }, { transaction });
        }

        if (relatedSeatAvailability.available_seats < total_passengers) {
            throw new Error(`KURSI TIDAK CUKUP TERSEDIA DI SubSchedule ID: ${relatedSubSchedule.id}`);
        }

        relatedSeatAvailability.available_seats -= total_passengers;

        if (relatedSeatAvailability.available_seats < 0) {
            throw new Error(`Seat availability cannot go below zero in SubSchedule ID: ${relatedSubSchedule.id}`);
        }

        await relatedSeatAvailability.save({ transaction });
        seatAvailabilities.push(relatedSeatAvailability);
    }

    // Handle seat availability for the selected sub-schedule
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
            available_seats: publicCapacity, // Using public capacity
            date: booking_date,
            availability: true
        }, { transaction });
    }

    if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
        throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
    }

    selectedSubScheduleSeatAvailability.available_seats -= total_passengers;

    if (selectedSubScheduleSeatAvailability.available_seats < 0) {
        throw new Error('Seat availability cannot go below zero in the selected sub-schedule');
    }

    await selectedSubScheduleSeatAvailability.save({ transaction });
    seatAvailabilities.push(selectedSubScheduleSeatAvailability);

    return seatAvailabilities;
};




// const handleSubScheduleBooking = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     // Fetch the main schedule and boat capacity
//     const schedule = await Schedule.findByPk(schedule_id, {
//         include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//         transaction
//     });

//     if (!schedule || !schedule.Boat) {
//         console.log('Schedule atau Boat tidak ditemukan:', schedule);
//         throw new Error('Boat information is missing or invalid');
//     }

//     // Calculate public capacity using the utility
//     const publicCapacity = calculatePublicCapacity(schedule.Boat);
//     console.log(`Schedule ID: ${schedule_id} - Original Capacity: ${schedule.Boat.capacity}, Public Capacity: ${publicCapacity}`);

//     // Fetch the selected sub-schedule
//     const subSchedule = await SubSchedule.findByPk(subschedule_id, {
//         include: [
//             { model: Transit, as: 'TransitFrom' },
//             { model: Transit, as: 'TransitTo' },
//             { model: Transit, as: 'Transit1' },
//             { model: Transit, as: 'Transit2' },
//             { model: Transit, as: 'Transit3' },
//             { model: Transit, as: 'Transit4' }
//         ],
//         transaction
//     });

//     if (!subSchedule) {
//         throw new Error('SubSchedule not found');
//     }

//     const seatAvailabilities = [];

//     // Handle main schedule seat availability
//     if (subschedule_id !== schedule_id) {
//         let mainScheduleSeatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 subschedule_id: null,
//                 date: booking_date
//             },
//             transaction
//         });

//         if (!mainScheduleSeatAvailability) {
//             mainScheduleSeatAvailability = await SeatAvailability.create({
//                 schedule_id: schedule_id,
//                 subschedule_id: null,
//                 transit_id: null,
//                 available_seats: publicCapacity, // Using public capacity instead of boat capacity
//                 date: booking_date,
//                 availability: true
//             }, { transaction });
//         }

//         if (mainScheduleSeatAvailability.available_seats < total_passengers) {
//             throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
//         }

//         mainScheduleSeatAvailability.available_seats -= total_passengers;

//         if (mainScheduleSeatAvailability.available_seats < 0) {
//             throw new Error('Seat availability cannot go below zero in the main schedule');
//         }

//         await mainScheduleSeatAvailability.save({ transaction });
//         seatAvailabilities.push(mainScheduleSeatAvailability);
//     }

//     // Find related sub-schedules
//     const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

//     // Handle seat availability for each related sub-schedule
//     for (const relatedSubSchedule of relatedSubSchedules) {
//         if (relatedSubSchedule.id === subschedule_id) continue;

//         let relatedSeatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 subschedule_id: relatedSubSchedule.id,
//                 date: booking_date
//             },
//             transaction
//         });

//         if (!relatedSeatAvailability) {
//             relatedSeatAvailability = await SeatAvailability.create({
//                 schedule_id: schedule_id,
//                 subschedule_id: relatedSubSchedule.id,
//                 transit_id: null,
//                 available_seats: publicCapacity, // Using public capacity
//                 date: booking_date,
//                 availability: true
//             }, { transaction });
//         }

//         if (relatedSeatAvailability.available_seats < total_passengers) {
//             throw new Error(`KURSI TIDAK CUKUP TERSEDIA DI SubSchedule ID: ${relatedSubSchedule.id}`);
//         }

//         relatedSeatAvailability.available_seats -= total_passengers;

//         if (relatedSeatAvailability.available_seats < 0) {
//             throw new Error(`Seat availability cannot go below zero in SubSchedule ID: ${relatedSubSchedule.id}`);
//         }

//         await relatedSeatAvailability.save({ transaction });
//         seatAvailabilities.push(relatedSeatAvailability);
//     }

//     // Handle seat availability for the selected sub-schedule
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
//         selectedSubScheduleSeatAvailability = await SeatAvailability.create({
//             schedule_id: schedule_id,
//             subschedule_id: subschedule_id,
//             transit_id: null,
//             available_seats: publicCapacity, // Using public capacity
//             date: booking_date,
//             availability: true
//         }, { transaction });
//     }

//     if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
//         throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
//     }

//     selectedSubScheduleSeatAvailability.available_seats -= total_passengers;

//     if (selectedSubScheduleSeatAvailability.available_seats < 0) {
//         throw new Error('Seat availability cannot go below zero in the selected sub-schedule');
//     }

//     await selectedSubScheduleSeatAvailability.save({ transaction });
//     seatAvailabilities.push(selectedSubScheduleSeatAvailability);

//     return seatAvailabilities;
// };

module.exports = {
    handleSubScheduleBooking,
    findRelatedSubSchedules,
    findRelatedSubSchedulesGet
};;

// const handleSubScheduleBooking = async (schedule_id, subschedule_id, booking_date, total_passengers, transaction) => {
//     // Fetch the main schedule and boat capacity
//     const schedule = await Schedule.findByPk(schedule_id, {
//         include: [{ model: sequelize.models.Boat, as: 'Boat' }],
//         transaction
//     });

//     // Log untuk memastikan asosiasi Schedule dan Boat
//     if (!schedule || !schedule.Boat) {
//         console.log('Schedule atau Boat tidak ditemukan:', schedule);
//         throw new Error('Boat information is missing or invalid');
//     }

//     const boatCapacity = schedule.Boat.capacity;
//     console.log(`Boat capacity for Schedule ID: ${schedule_id} is ${boatCapacity}`);

//     // Fetch the selected sub-schedule
//     const subSchedule = await SubSchedule.findByPk(subschedule_id, {
//         include: [
//             { model: Transit, as: 'TransitFrom' },
//             { model: Transit, as: 'TransitTo' },
//             { model: Transit, as: 'Transit1' },
//             { model: Transit, as: 'Transit2' },
//             { model: Transit, as: 'Transit3' },
//             { model: Transit, as: 'Transit4' }
//         ],
//         transaction
//     });

//     if (!subSchedule) {
//         throw new Error('SubSchedule not found');
//     }

//     const seatAvailabilities = [];

//     // Handle main schedule seat availability
//     if (subschedule_id !== schedule_id) {
//         let mainScheduleSeatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 subschedule_id: null, // Main schedule does not have a specific sub-schedule ID
//                 date: booking_date
//             },
//             transaction
//         });

//         if (!mainScheduleSeatAvailability) {
//             mainScheduleSeatAvailability = await SeatAvailability.create({
//                 schedule_id: schedule_id,
//                 subschedule_id: null,
//                 transit_id: null,
//                 available_seats: boatCapacity,
//                 date: booking_date,
//                 availability: true
//             }, { transaction });
//         }

//         // Validate if available seats are sufficient and avoid going below 0
//         if (mainScheduleSeatAvailability.available_seats < total_passengers) {
//             throw new Error('KURSI TIDAK CUKUP TERSEDIA DI MAIN SCHEDULE');
//         }

//         mainScheduleSeatAvailability.available_seats -= total_passengers;

//         if (mainScheduleSeatAvailability.available_seats < 0) {
//             throw new Error('Seat availability cannot go below zero in the main schedule');
//         }

//         await mainScheduleSeatAvailability.save({ transaction });

//         seatAvailabilities.push(mainScheduleSeatAvailability); // Collect the updated seat availability
//     }

//     // Find related sub-schedules
//     const relatedSubSchedules = await findRelatedSubSchedules(schedule_id, subSchedule, transaction);

//     // Handle seat availability for each related sub-schedule
//     for (const relatedSubSchedule of relatedSubSchedules) {
//         // Skip if it's the selected sub-schedule to avoid double decrement
//         if (relatedSubSchedule.id === subschedule_id) continue;

//         let relatedSeatAvailability = await SeatAvailability.findOne({
//             where: {
//                 schedule_id: schedule_id,
//                 subschedule_id: relatedSubSchedule.id,
//                 date: booking_date
//             },
//             transaction
//         });

//         if (!relatedSeatAvailability) {
//             relatedSeatAvailability = await SeatAvailability.create({
//                 schedule_id: schedule_id,
//                 subschedule_id: relatedSubSchedule.id,
//                 transit_id: null,
//                 available_seats: boatCapacity,
//                 date: booking_date,
//                 availability: true
//             }, { transaction });
//         }

//         // Validate if available seats are sufficient and avoid going below 0
//         if (relatedSeatAvailability.available_seats < total_passengers) {
//             throw new Error(`KURSI TIDAK CUKUP TERSEDIA DI SubSchedule ID: ${relatedSubSchedule.id}`);
//         }

//         relatedSeatAvailability.available_seats -= total_passengers;

//         if (relatedSeatAvailability.available_seats < 0) {
//             throw new Error(`Seat availability cannot go below zero in SubSchedule ID: ${relatedSubSchedule.id}`);
//         }

//         await relatedSeatAvailability.save({ transaction });

//         seatAvailabilities.push(relatedSeatAvailability); // Collect the updated seat availability
//     }

//     // Handle seat availability for the selected sub-schedule
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
//         selectedSubScheduleSeatAvailability = await SeatAvailability.create({
//             schedule_id: schedule_id,
//             subschedule_id: subschedule_id,
//             transit_id: null,
//             available_seats: boatCapacity,
//             date: booking_date,
//             availability: true
//         }, { transaction });
//     }

//     // Validate if available seats are sufficient and avoid going below 0
//     if (selectedSubScheduleSeatAvailability.available_seats < total_passengers) {
//         throw new Error('KURSI TIDAK CUKUP TERSEDIA DI SubSchedule yang dipilih');
//     }

//     selectedSubScheduleSeatAvailability.available_seats -= total_passengers;

//     if (selectedSubScheduleSeatAvailability.available_seats < 0) {
//         throw new Error('Seat availability cannot go below zero in the selected sub-schedule');
//     }

//     await selectedSubScheduleSeatAvailability.save({ transaction });

//     seatAvailabilities.push(selectedSubScheduleSeatAvailability); // Collect the updated seat availability

//     return seatAvailabilities; // Return all updated SeatAvailability records
// };



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