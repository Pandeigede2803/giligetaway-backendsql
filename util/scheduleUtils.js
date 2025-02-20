const { Destination, Transit, Schedule, SubSchedule, Boat } = require('../models');
const { Op, fn, col } = require('sequelize');; // Import fn and col from Sequelize

const getScheduleAndSubScheduleByDate = async (date) => {
    try {
        // Query to fetch schedules that are valid on the given date
        const schedules = await Schedule.findAll({
            where: {
                validity_start: { [Op.lte]: date },
                validity_end: { [Op.gte]: date }
            },
        
            include: [
                {
                    model: Destination,
                    as: 'FromDestination',
                    attributes: ['name'] // Only get the 'name' of the destination
                },
                {
                    model: Destination,
                    as: 'ToDestination',
                    attributes: ['name']
                },
                {
                    model: Transit,
                    as: 'Transits',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'] // Nested include to get the name of transit destination
                        }
                    ]
                },
                {
                    model: Boat,
                    as: 'Boat', // Include the Boat model
                    attributes: ['id', 'boat_name', 'capacity']
                   
                }
            ]
        });

        // Query to fetch sub-schedules that are valid on the given date
        const subSchedules = await SubSchedule.findAll({
            where: {
                validity_start: { [Op.lte]: date },
                validity_end: { [Op.gte]: date }
            },
            include: [
                {
                    model: Schedule,
                    as: 'Schedule',
                    include: [
                        {
                            model: Boat,
                            as: 'Boat',
                            attributes: ['capacity']
                        }
                    ]

                },
                {
                    model: Destination,
                    as: 'DestinationFrom',
                    attributes: ['name']
                },
                {
                    model: Destination,
                    as: 'DestinationTo',
                    attributes: ['name']
                },
                {
                    model: Transit,
                    as: 'TransitFrom',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'TransitTo',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit1',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit2',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit3',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit4',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                }
            ]
        });

        // Return schedules and subSchedules in an object
        return {
            schedules,
            subSchedules
        };
    } catch (error) {
        console.error('Error fetching schedules and subschedules:', error);
        throw new Error('Failed to fetch schedule and subschedule data.');
    }
};


const getScheduleAndSubScheduleByDate2 = async (date, boat_id) => {
    try {

        console.log("boat id adalah", boat_id);
        // Query to fetch schedules that are valid on the given date and belong to the given boat
        const schedules = await Schedule.findAll({
            where: {
                validity_start: { [Op.lte]: date },
                validity_end: { [Op.gte]: date },
                boat_id: boat_id // Langsung filter berdasarkan boat_id
            },
            include: [
                {
                    model: Destination,
                    as: 'FromDestination',
                    attributes: ['name']
                },
                {
                    model: Destination,
                    as: 'ToDestination',
                    attributes: ['name']
                },
                {
                    model: Transit,
                    as: 'Transits',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Boat,
                    as: 'Boat',
                    attributes: ['id', 'boat_name', 'capacity']
                }
            ]
        });

        // Query to fetch sub-schedules that are valid on the given date and belong to the given boat
        const subSchedules = await SubSchedule.findAll({
            where: {
                validity_start: { [Op.lte]: date },
                validity_end: { [Op.gte]: date }
            },
            include: [
                {
                    model: Schedule,
                    as: 'Schedule',
                    where: { boat_id: boat_id }, // Filter langsung dari awal
                    include: [
                        {
                            model: Boat,
                            as: 'Boat',
                            attributes: ['capacity']
                        }
                    ]
                },
                {
                    model: Destination,
                    as: 'DestinationFrom',
                    attributes: ['name']
                },
                {
                    model: Destination,
                    as: 'DestinationTo',
                    attributes: ['name']
                },
                {
                    model: Transit,
                    as: 'TransitFrom',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'TransitTo',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit1',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit2',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit3',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                },
                {
                    model: Transit,
                    as: 'Transit4',
                    include: [
                        {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name']
                        }
                    ]
                }
            ]
        });

        return {
            schedules,
            subSchedules
        };
    } catch (error) {
        console.error('Error fetching schedules and subschedules:', error);
        throw new Error('Failed to fetch schedule and subschedule data.');
    }
};

module.exports = { getScheduleAndSubScheduleByDate2, getScheduleAndSubScheduleByDate };
