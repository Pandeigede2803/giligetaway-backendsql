// controllers/scheduleController.js
const { Schedule,SubSchedule, User, Boat,Transit,SeatAvailability, Destination,sequelize } = require('../models');
const { uploadImageToImageKit } = require('../middleware/upload');
const { Op } = require('sequelize');

// Create a new schedule with transits
const createScheduleWithTransit = async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const {
        boat_id,
        destination_from_id,
        destination_to_id,
        user_id,
        validity_start,
        validity_end,
        check_in_time,
        low_season_price,
        high_season_price,
        peak_season_price,
        return_low_season_price,
        return_high_season_price,
        return_peak_season_price,
        arrival_time,
        journey_time,
        transits,
        schedule_type,
        departure_time, // Include the departure_time field
      } = req.body;;
  
      console.log("Received schedule data:", req.body);
  
      // Call the upload middleware to handle image upload
      await uploadImageToImageKit(req, res, async () => {
        if (!req.file.url) {
          throw new Error('Image file is required');
        }
  
        // Create the schedule
        const schedule = await Schedule.create({
          boat_id,
          destination_from_id,
          destination_to_id,
          user_id,
          validity_start,
          validity_end,
          check_in_time,
          low_season_price,
          high_season_price,
          peak_season_price,
          return_low_season_price,
          return_high_season_price,
          return_peak_season_price,
          arrival_time,
          journey_time,
          schedule_type,
          departure_time, // Include the departure_time field
          route_image: req.file.url // Use ImageKit URL for route_image
        }, { transaction: t });
  
        console.log("Created schedule:", schedule);
  
        // Create the transits
        const createdTransits = [];
        if (transits && transits.length > 0) {
          for (const transit of transits) {
            const { destination_id, check_in_time, departure_time, arrival_time, journey_time } = transit;
  
            console.log("Processing transit:", transit);
  
            // Validate destination_id
            const destination = await Destination.findByPk(destination_id, { transaction: t });
            if (!destination) {
              throw new Error(`Destination ID ${destination_id} not found.`);
            }
  
            const createdTransit = await Transit.create({
              schedule_id: schedule.id,
              destination_id,
              check_in_time,
              departure_time,
              arrival_time,
              journey_time
            }, { transaction: t });
  
            console.log("Created transit:", createdTransit);
  
            // Include destination details
            const transitWithDestination = await Transit.findByPk(createdTransit.id, {
              include: {
                model: Destination,
                as: 'Destination'
              },
              transaction: t
            });
  
            console.log("Transit with destination details:", transitWithDestination);
  
            createdTransits.push(transitWithDestination);
          }
        }
  
        await t.commit();
        res.status(201).json({
          schedule,
          transits: createdTransits
        });
      });
    } catch (error) {
      await t.rollback();
      console.error("Error creating schedule with transits:", error);
      res.status(400).json({ error: error.message });
    }
  };





//wihtout transit
const createSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.create(req.body);
        res.status(201).json(schedule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
// Get all schedules (existing function)
const getSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.findAll({
            attributes: ['id', 'validity_start', 'validity_end'], // Select specific fields from the Schedule
            include: [
                {
                    model: Destination,
                    as: 'FromDestination', // Ensure this alias matches your model associations
                    attributes: ['id', 'name'] // Select specific fields from the Destination
                },
                {
                    model: Destination,
                    as: 'ToDestination', // Ensure this alias matches your model associations
                    attributes: ['id', 'name'] // Select specific fields from the Destination
                },
                  {
                    model: Boat,
                    attributes: ['id', 'boat_name', 'capacity', 'boat_image']
                },
            ]
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all schedules with destination and transit details
const getAllSchedulesWithDetails = async (req, res) => {
    try {
        const schedules = await Schedule.findAll({
            include: [
                {
                    model: Destination,
                    as: 'FromDestination',
                    attributes: ['id', 'name', 'port_map_url', 'image_url']
                },
                {
                    model: Destination,
                    as: 'ToDestination',
                    attributes: ['id', 'name', 'port_map_url', 'image_url']
                },
                {
                    model: Transit,
                    include: {
                        model: Destination,
                        as: 'Destination',
                        attributes: ['id', 'name', 'port_map_url', 'image_url']
                    }
                },
                {
                    model: Boat,
                    as: 'Boat',
                    attributes: ['id', 'boat_name', 'capacity', 'boat_image']
                },
                // {
                //     model: User,
                //     attributes: ['id', 'name', 'email']
                // }
            ]
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



const getSchedulesByMultipleParams = async (req, res) => {
    const { search_date, from, to, availability, passengers_total } = req.query;

    // Parse availability to a boolean value
    const availabilityBool = availability === 'true';

    try {
        // Fetch destination IDs based on the names
        const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
        const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

        const whereCondition = {};
        const subWhereCondition = {};

        if (search_date) {
            const searchDate = new Date(search_date);
            whereCondition[Op.and] = [
                { validity_start: { [Op.lte]: searchDate } },
                { validity_end: { [Op.gte]: searchDate } }
            ];
            subWhereCondition[Op.and] = [
                { validity_start: { [Op.lte]: searchDate } },
                { validity_end: { [Op.gte]: searchDate } }
            ];
        }

        if (fromDestination) {
            whereCondition.destination_from_id = fromDestination.id;
            subWhereCondition.destination_from_schedule_id = fromDestination.id;
        }

        if (toDestination) {
            whereCondition.destination_to_id = toDestination.id;
            subWhereCondition.destination_to_schedule_id = toDestination.id;
        }

        if (availability !== undefined) {
            whereCondition.availability = availabilityBool;
            subWhereCondition.availability = availabilityBool;
        }

        // Log the whereCondition to debug
        console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));
        console.log('subWhereCondition:', JSON.stringify(subWhereCondition, null, 2));

        const schedules = await Schedule.findAll({
            where: whereCondition,
            include: [
                {
                    model: Destination,
                    as: 'FromDestination',
                    attributes: ['id', 'name', 'port_map_url', 'image_url']
                },
                {
                    model: Destination,
                    as: 'ToDestination',
                    attributes: ['id', 'name', 'port_map_url', 'image_url']
                },
                {
                    model: Transit,
                    include: {
                        model: Destination,
                        as: 'Destination',
                        attributes: ['id', 'name', 'port_map_url', 'image_url']
                    }
                }
            ]
        });

        const subSchedules = await SubSchedule.findAll({
            where: subWhereCondition,
            include: [
                {
                    model: SeatAvailability,
                    as: 'SeatAvailabilities',
                    required: false,
                    where: {
                        date: new Date(search_date),
                        available_seats: {
                            [Op.gte]: passengers_total ? parseInt(passengers_total) : 0
                        }
                    }
                }
            ]
        });

        // Log the result to debug
        console.log('schedules:', JSON.stringify(schedules, null, 2));
        console.log('subSchedules:', JSON.stringify(subSchedules, null, 2));

        const formattedSchedules = schedules.map(schedule => ({
            ...schedule.get({ plain: true }),
            type: 'Schedule'
        }));

        // Format subSchedules
        const formattedSubSchedules = subSchedules.map(subSchedule => ({
            ...subSchedule.get({ plain: true }),
            type: 'SubSchedule',
            SeatAvailabilities: subSchedule.SeatAvailabilities.length > 0
                ? subSchedule.SeatAvailabilities
                : 'Seat availability not created'
        }));

        // Separate results based on seat availability
        const availableSchedules = [];
        const fullSchedules = [];
        const noSeatAvailabilitySchedules = [];

        formattedSubSchedules.forEach(subSchedule => {
            if (subSchedule.SeatAvailabilities === 'Seat availability not created') {
                availableSchedules.push(subSchedule);
            } else if (subSchedule.SeatAvailabilities.length > 0) {
                const seatAvailability = subSchedule.SeatAvailabilities[0];
                if (seatAvailability.available_seats === 0) {
                    fullSchedules.push(subSchedule);
                } else if (seatAvailability.availability) {
                    availableSchedules.push(subSchedule);
                } else {
                    noSeatAvailabilitySchedules.push(subSchedule);
                }
            }
        });

        // Filter out schedules with availability false
        const filteredFormattedSchedules = formattedSchedules.filter(schedule => schedule.availability !== false);

        // Combine formattedSchedules with availableSchedules
        const combinedAvailableResults = [...filteredFormattedSchedules, ...availableSchedules];

        // Log the combined results for debugging
        console.log('combinedAvailableResults:', JSON.stringify(combinedAvailableResults, null, 2));
        console.log('fullSchedules:', JSON.stringify(fullSchedules, null, 2));
        console.log('noSeatAvailabilitySchedules:', JSON.stringify(noSeatAvailabilitySchedules, null, 2));

        // Determine response status and content
        let responseStatus = 'success';
        let responseData = {
            availableSchedules: combinedAvailableResults,
            noSeatAvailabilitySchedules: noSeatAvailabilitySchedules
        };

        if (fullSchedules.length > 0 && combinedAvailableResults.length === 0) {
            responseStatus = 'full';
            responseData = 'The schedule for the selected date is full';
        } else if (combinedAvailableResults.length === 0 && noSeatAvailabilitySchedules.length === 0) {
            responseStatus = 'no schedules found';
            responseData = [];
        }

        // Send response
        res.status(200).json({
            status: responseStatus,
            data: responseData
        });
    } catch (error) {
        console.error('Error fetching schedules and subschedules:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};


const getSchedulesWithTransits = async (req, res) => {
    try {
        const schedules = await Schedule.findAll({
            attributes: ['id', 'validity_start', 'validity_end'], // Select specific fields from the Schedule
            include: [
                {
                    model: Destination,
                    as: 'FromDestination', // Ensure this alias matches your model associations
                    attributes: ['id', 'name'] // Select specific fields from the Destination
                },
                {
                    model: Boat,
                    as: 'Boat',
                    attributes: ['id', 'boat_name', 'capacity', 'boat_image']
                },
                {
                    model: Destination,
                    as: 'ToDestination', // Ensure this alias matches your model associations
                    attributes: ['id', 'name'] // Select specific fields from the Destination
                },
                {
                    model: Transit,
                    required: true, // This ensures only schedules with transits are included
                    attributes: ['id'], // You can include more attributes from Transit if needed
                }
            ]
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};





// Get schedule by ID (existing function)
const getScheduleById = async (req, res) => {
    try {
      const schedule = await Schedule.findByPk(req.params.id, {
        include: [
          {
            model: Destination,
            as: 'DestinationFrom', // Pastikan alias ini sesuai dengan asosiasi model Anda
            attributes: ['id', 'name', 'port_map_url', 'image_url']
          },
          {
            model: Destination,
            as: 'DestinationTo', // Pastikan alias ini sesuai dengan asosiasi model Anda
            attributes: ['id', 'name', 'port_map_url', 'image_url']
          },
          {
            model: Boat,
            as: 'Boat',
            attributes: ['id', 'boat_name', 'capacity', 'boat_image']
        },
          {
            model: Transit,
            include: {
                model: Destination,
                as: 'Destination',
                attributes: ['id', 'name', 'port_map_url', 'image_url']
            }
        },
          
          {
            model: SubSchedule,
            as: 'SubSchedules',
            include: [
              {
                model: Transit,
                as: 'TransitFrom',
                attributes: ['id'],
                include: {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['id', 'name']
                }
              },
              {
                model: Transit,
                as: 'TransitTo',
                attributes: ['id'],
                include: {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['id', 'name']
                }
              },
              {
                model: Transit,
                as: 'Transit1',
                attributes: ['id'],
                include: {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['id', 'name']
                }
              },
              {
                model: Transit,
                as: 'Transit2',
                attributes: ['id'],
                include: {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['id', 'name']
                }
              },
              {
                model: Transit,
                as: 'Transit3',
                attributes: ['id'],
                include: {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['id', 'name']
                }
              },
              {
                model: Transit,
                as: 'Transit4',
                attributes: ['id'],
                include: {
                  model: Destination,
                  as: 'Destination',
                  attributes: ['id', 'name']
                }
              }
            ]
          }
        ]
      });
  
      if (schedule) {
        res.status(200).json(schedule);
      } else {
        res.status(404).json({ error: 'Schedule not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
  ;



// Get schedules by destination
const getSchedulesByDestination = async (req, res) => {
    try {
        const { destinationId } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                [Op.or]: [
                    { destination_from_id: destinationId },
                    { destination_to_id: destinationId }
                ]
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by validity period
const getSchedulesByValidity = async (req, res) => {
    try {
        const { validity } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                validity_period: validity
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by boat ID
const getSchedulesByBoat = async (req, res) => {
    try {
        const { boatId } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                boat_id: boatId
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by user ID
const getSchedulesByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                user_id: userId
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};;

//update schedule tanpa transit
// Update schedule tanpa transit dengan middleware upload image
const updateSchedule = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const scheduleId = req.params.id;
        const scheduleData = req.body;

   
        console.log('DATA BODY YNG DITERMIMA`:', scheduleData);

        const schedule = await Schedule.findByPk(scheduleId, {
            transaction: t
        });

        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Jika ada file, panggil middleware uploadImageToImageKit
        if (req.file) {
            await uploadImageToImageKit(req, res, async () => {
                if (req.file && req.file.url) {
                    scheduleData.route_image = req.file.url;
                }
                // Update schedule
                await schedule.update(scheduleData, { transaction: t });
                console.log('Schedule updated with image:', schedule);

                await t.commit();
                console.log('Transaction committed.');
                res.status(200).json(schedule);
            });
        } else {
            // Update schedule tanpa file
            await schedule.update(scheduleData, { transaction: t });
            console.log('Schedule updated without image:', schedule);

            await t.commit();
            console.log('Transaction committed.');
            res.status(200).json(schedule);
        }
    } catch (error) {
        await t.rollback();
        console.error('Error updating schedule:', error);
        res.status(400).json({ error: error.message });
    }
};






// Delete schedule (existing function)
const deleteSchedule = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log(`Attempting to delete schedule with ID: ${req.params.id}`);
        
        const schedule = await Schedule.findByPk(req.params.id);
        if (!schedule) {
            console.log(`Schedule with ID ${req.params.id} not found`);
            return res.status(404).json({ error: 'Schedule not found' });
        }

        console.log(`Found schedule with ID: ${req.params.id}. Proceeding to delete related transits.`);

        // Delete all related transits
        await Transit.destroy({
            where: { schedule_id: schedule.id },
            transaction: t
        });

        console.log(`Deleted transits related to schedule with ID: ${req.params.id}. Proceeding to delete the schedule.`);

        // Delete the schedule
        await schedule.destroy({ transaction: t });

        await t.commit();
        console.log(`Successfully deleted schedule with ID: ${req.params.id} and related transits.`);
        return res.status(200).json({ message: `Successfully deleted schedule with ID: ${req.params.id} and all related transits.` });
    } catch (error) {
        await t.rollback();
        console.error(`Error deleting schedule with ID: ${req.params.id} and related transits:`, error);
        return res.status(400).json({ error: error.message });
    }
};


// 

// Upload schedules (existing function)
const uploadSchedules = async (req, res) => {
    const schedules = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream.pipe(csvParser())
        .on('data', async (row) => {
            try {
                const { boat_id, destination_from_id, destination_to_id, user_id, validity_period, check_in_time, low_season_price, high_season_price, peak_season_price, return_low_season_price, return_high_season_price, return_peak_season_price, arrival_time, journey_time, route_image, available_seats } = row;

                // Validate IDs
                const user = await User.findByPk(user_id);
                const boat = await Boat.findByPk(boat_id);
                const destinationFrom = await Destination.findByPk(destination_from_id);
                const destinationTo = await Destination.findByPk(destination_to_id);

                if (!user || !boat || !destinationFrom || !destinationTo) {
                    throw new Error('Invalid ID(s) provided.');
                }

                schedules.push({
                    boat_id,
                    destination_from_id,
                    destination_to_id,
                    user_id,
                    validity_period,
                    check_in_time,
                    low_season_price,
                    high_season_price,
                    peak_season_price,
                    return_low_season_price,
                    return_high_season_price,
                    return_peak_season_price,
                    arrival_time,
                    journey_time,
                    route_image,
                    available_seats,
                });
            } catch (error) {
                console.log('Error processing row:', error.message);
            }
        })
        .on('end', async () => {
            try {
                await Schedule.bulkCreate(schedules);
                res.status(201).json({ message: 'Schedules uploaded successfully', schedules });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        })
        .on('error', (error) => {
            console.log('Error reading CSV:', error.message);
            res.status(500).json({ error: error.message });
        });
};

module.exports = {
    createSchedule,
    getAllSchedulesWithDetails,
    getSchedules,
    getScheduleById,
    getSchedulesByDestination,
    getSchedulesByValidity,
    getSchedulesByBoat,
    getSchedulesByUser,
    updateSchedule,
    deleteSchedule,
    uploadSchedules,
    createScheduleWithTransit,getSchedulesByMultipleParams,getSchedulesWithTransits,
};


// Get schedules by multiple parametersconst { Op } = require('sequelize'); // Pastikan Anda mengimpor Op dari sequelize



//SEARCH BY MULTIPLE PARAMS WITH DESTINATION ID

// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     // Build the dynamic where condition
//     const whereCondition = {};

//     if (search_date) {
//         console.log('search_date:', search_date);
//         whereCondition.validity_start = {
//             [Op.lte]: new Date(search_date) // Pastikan format tanggal benar
//         };
//         whereCondition.validity_end = {
//             [Op.gte]: new Date(search_date) // Pastikan format tanggal benar
//         };
//     }

//     if (from) {
//         console.log('from:', from);
//         whereCondition.destination_from_id = parseInt(from); // Pastikan ini adalah integer
//     }

//     if (to) {
//         console.log('to:', to);
//         whereCondition.destination_to_id = parseInt(to); // Pastikan ini adalah integer
//     }

//     if (availability !== undefined) {
//         console.log('availability:', availability);
//         whereCondition.availability = availabilityBool;
//     }

//     // Log the whereCondition to debug
//     console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));

//     try {
//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 },
//                 {
//                     model: SubSchedule,
//                     as: 'SubSchedules',
//                     required: false, // Make SubSchedule optional
//                     where: {
//                         [Op.or]: [
//                             { availability: availabilityBool },
//                             { availability: { [Op.is]: null } }
//                         ]
//                     }
//                 },
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false, // Make SeatAvailability optional
//                     where: {
//                         date: new Date(search_date), // Filter berdasarkan search_date
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0 // Filter berdasarkan passengers_total
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));

//         const response = schedules.map(schedule => {
//             const seatAvailability = schedule.SeatAvailabilities.length > 0 ? schedule.SeatAvailabilities : null;
//             console.log('schedule:', JSON.stringify(schedule, null, 2));
//             return {
//                 ...schedule.get({ plain: true }),
//                 SeatAvailabilities: seatAvailability || 'Seat availability not available or not created for the given date'
//             };
//         });

//         const responseStatus = response.length > 0 ? 'success' : 'no schedules found';

//         console.log('response:', JSON.stringify(response, null, 2));

//         res.status(200).json({
//             status: responseStatus,
//             data: response
//         });
//     } catch (error) {
//         console.error('Error fetching schedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };


// search by multiple params with destination name

// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     try {
//         // Fetch destination IDs based on the names
//         const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
//         const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

//         const whereCondition = {};

//         if (search_date) {
//             const searchDate = new Date(search_date);
//             whereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//         }

//         console.log("whereCondition:", whereCondition);

//         if (fromDestination) {
//             whereCondition.destination_from_id = fromDestination.id; // Use the found ID
//         }

//         if (toDestination) {
//             whereCondition.destination_to_id = toDestination.id; // Use the found ID
//         }

//         if (availability !== undefined) {
//             whereCondition.availability = availabilityBool;
//         }

//         // Log the whereCondition to debug
//         console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));

//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 },
//                 // {
//                 //     model: SubSchedule,
//                 //     as: 'SubSchedules',
//                 //     required: false, // Make SubSchedule optional
//                 //     where: {
//                 //         [Op.or]: [
//                 //             { availability: availabilityBool },
//                 //             { availability: { [Op.is]: null } }
//                 //         ]
//                 //     }
//                 // },
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false, // Make SeatAvailability optional
//                     where: {
//                         date: new Date(search_date), // Filter by search_date
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0 // Filter by passengers_total
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));

//         const response = schedules.map(schedule => {
//             const seatAvailability = schedule.SeatAvailabilities.length > 0 ? schedule.SeatAvailabilities : null;
//             return {
//                 ...schedule.get({ plain: true }),
//                 SeatAvailabilities: seatAvailability || 'Seat availability not available or not created for the given date'
//             };
//         });

//         const responseStatus = response.length > 0 ? 'success' : 'no schedules found';

//         res.status(200).json({
//             status: responseStatus,
//             data: response
//         });
//     } catch (error) {
//         console.error('Error fetching schedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };

//SEARCH DESTINATION AND INCLUDE SUBSCDULE
// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     try {
//         // Fetch destination IDs based on the names
//         const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
//         const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

//         const whereCondition = {};
//         const subWhereCondition = {};

//         if (search_date) {
//             const searchDate = new Date(search_date);
//             whereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//             subWhereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//         }

//         if (fromDestination) {
//             whereCondition.destination_from_id = fromDestination.id;
//             subWhereCondition.destination_from_schedule_id = fromDestination.id;
//         }

//         if (toDestination) {
//             whereCondition.destination_to_id = toDestination.id;
//             subWhereCondition.destination_to_schedule_id = toDestination.id;
//         }

//         if (availability !== undefined) {
//             whereCondition.availability = availabilityBool;
//             subWhereCondition.availability = availabilityBool;
//         }

//         // Log the whereCondition to debug
//         console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));
//         console.log('subWhereCondition:', JSON.stringify(subWhereCondition, null, 2));

//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 }
//             ]
//         });

//         const subSchedules = await SubSchedule.findAll({
//             where: subWhereCondition,
//             include: [
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false,
//                     where: {
//                         date: new Date(search_date),
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));
//         console.log('subSchedules:', JSON.stringify(subSchedules, null, 2));

//         const formattedSchedules = schedules.map(schedule => ({
//             ...schedule.get({ plain: true }),
//             type: 'Schedule'
//         }));

//         // Format subSchedules
//         const formattedSubSchedules = subSchedules.map(subSchedule => ({
//             ...subSchedule.get({ plain: true }),
//             type: 'SubSchedule',
//             SeatAvailabilities: subSchedule.SeatAvailabilities.length > 0
//                 ? subSchedule.SeatAvailabilities
//                 : 'Seat availability not available or not created for the given date'
//         }));

//         // Combine results
//         const combinedResults = [...formattedSchedules, ...formattedSubSchedules];
//         // console.log('combinedResults:', JSON.stringify(combinedResults, null, 2));
//         const responseStatus = combinedResults.length > 0 ? 'success' : 'no schedules found';

//         // Send response
//         res.status(200).json({
//             status: responseStatus,
//             data: combinedResults
//         });
//     } catch (error) {
//         console.error('Error fetching schedules and subschedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };


//SEARCH SCHEDULE WITH MULTIPLE RESPONSES
// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     try {
//         // Fetch destination IDs based on the names
//         const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
//         const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

//         const whereCondition = {};
//         const subWhereCondition = {};

//         if (search_date) {
//             const searchDate = new Date(search_date);
//             whereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//             subWhereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//         }

//         if (fromDestination) {
//             whereCondition.destination_from_id = fromDestination.id;
//             subWhereCondition.destination_from_schedule_id = fromDestination.id;
//         }

//         if (toDestination) {
//             whereCondition.destination_to_id = toDestination.id;
//             subWhereCondition.destination_to_schedule_id = toDestination.id;
//         }

//         if (availability !== undefined) {
//             whereCondition.availability = availabilityBool;
//             subWhereCondition.availability = availabilityBool;
//         }

//         // Log the whereCondition to debug
//         console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));
//         console.log('subWhereCondition:', JSON.stringify(subWhereCondition, null, 2));

//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 }
//             ]
//         });

//         const subSchedules = await SubSchedule.findAll({
//             where: subWhereCondition,
//             include: [
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false,
//                     where: {
//                         date: new Date(search_date),
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));
//         console.log('subSchedules:', JSON.stringify(subSchedules, null, 2));

//         const formattedSchedules = schedules.map(schedule => ({
//             ...schedule.get({ plain: true }),
//             type: 'Schedule'
//         }));

//         // Format subSchedules
//         const formattedSubSchedules = subSchedules.map(subSchedule => ({
//             ...subSchedule.get({ plain: true }),
//             type: 'SubSchedule',
//             SeatAvailabilities: subSchedule.SeatAvailabilities.length > 0
//                 ? subSchedule.SeatAvailabilities
//                 : 'Seat availability not created'
//         }));;

//         // Separate results based on seat availability
//         const availableSchedules = [];
//         const fullSchedules = [];
//         const noSeatAvailabilitySchedules = [];

//         formattedSubSchedules.forEach(subSchedule => {
//             if (subSchedule.SeatAvailabilities === 'Seat availability not created') {
//                 noSeatAvailabilitySchedules.push(subSchedule);
//             } else if (subSchedule.SeatAvailabilities.length > 0 && subSchedule.SeatAvailabilities[0].available_seats === 0) {
//                 fullSchedules.push(subSchedule);
//             } else {
//                 availableSchedules.push(subSchedule);
//             }
//         });

//         // Combine formattedSchedules with availableSchedules
//         const combinedAvailableResults = [...formattedSchedules, ...availableSchedules];
        
//         // Log the combined results for debugging
//         console.log('combinedAvailableResults:', JSON.stringify(combinedAvailableResults, null, 2));
//         console.log('fullSchedules:', JSON.stringify(fullSchedules, null, 2));
//         console.log('noSeatAvailabilitySchedules:', JSON.stringify(noSeatAvailabilitySchedules, null, 2));

//         // Determine response status and content
//         let responseStatus = 'success';
//         let responseData = {
//             availableSchedules: combinedAvailableResults,
//             noSeatAvailabilitySchedules: noSeatAvailabilitySchedules
//         };

//         if (fullSchedules.length > 0) {
//             responseStatus = 'full';
//             responseData = 'The schedule for the selected date is full';
//         } else if (combinedAvailableResults.length === 0 && noSeatAvailabilitySchedules.length === 0) {
//             responseStatus = 'no schedules found';
//             responseData = [];
//         }

//         // Send response
//         res.status(200).json({
//             status: responseStatus,
//             data: responseData
//         });
//     } catch (error) {
//         console.error('Error fetching schedules and subschedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };

//search schedule multiple params with 4 respond available scheulde, and f



// const createScheduleWithTransit = async (req, res) => {
//     const t = await sequelize.transaction();
//     try {
//         const {
//             boat_id,
//             destination_from_id,
//             destination_to_id,
//             user_id,
//             validity_start,
//             validity_end,
//             check_in_time,
//             low_season_price,
//             high_season_price,
//             peak_season_price,
//             return_low_season_price,
//             return_high_season_price,
//             return_peak_season_price,
//             arrival_time,
//             journey_time,
//             route_image,
//             transits
//         } = req.body;

//         // Create the schedule
//         const schedule = await Schedule.create({
//             boat_id,
//             destination_from_id,
//             destination_to_id,
//             user_id,
//             validity_start,
//             validity_end,
//             check_in_time,
//             low_season_price,
//             high_season_price,
//             peak_season_price,
//             return_low_season_price,
//             return_high_season_price,
//             return_peak_season_price,
//             arrival_time,
//             journey_time,
//             route_image
//         }, { transaction: t });

//         // Create the transits
//         const createdTransits = [];
//         if (transits && transits.length > 0) {
//             for (const transit of transits) {
//                 const { destination_id, check_in_time, departure_time, arrival_time, journey_time } = transit;

//                 // Validate destination_id
//                 const destination = await Destination.findByPk(destination_id);
//                 if (!destination) {
//                     throw new Error(`Destination ID ${destination_id} not found.`);
//                 }

//                 const createdTransit = await Transit.create({
//                     schedule_id: schedule.id,
//                     destination_id,
//                     check_in_time,
//                     departure_time,
//                     arrival_time,
//                     journey_time
//                 }, { transaction: t });

//                 // Include destination details
//                 const transitWithDestination = await Transit.findByPk(createdTransit.id, {
//                     include: {
//                         model: Destination,
//                         as: 'Destination'
//                     },
//                     transaction: t
//                 });

//                 createdTransits.push(transitWithDestination);
//             }
//         }

//         await t.commit();
//         res.status(201).json({
//             schedule,
//             transits: createdTransits
//         });
//     } catch (error) {
//         await t.rollback();
//         res.status(400).json({ error: error.message });
//     }
// };

