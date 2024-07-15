const { SubSchedule, Schedule, Transit,Destination } = require('../models');
const { uploadImageToImageKit } = require('../middleware/upload');
const { sequelize } = require('../models');

// Create a new subschedule
// const createSubSchedule = async (req, res) => {
//     const {
//         schedule_id, transit_from_id, transit_to_id, departure_time, arrival_time, journey_time,
//         low_season_price, high_season_price, peak_season_price, return_low_season_price, return_high_season_price,
//         return_peak_season_price, validity_start, validity_end, check_in_time, route_image
//     } = req.body;

//     try {
//         // Check if the schedule_id exists
//         const schedule = await Schedule.findByPk(schedule_id);
//         if (!schedule) {
//             return res.status(404).json({ error: 'Schedule not found' });
//         }

//         // Check if the transit_from_id exists
//         const transitFrom = await Transit.findByPk(transit_from_id);
//         if (!transitFrom) {
//             return res.status(404).json({ error: 'Transit from ID not found' });
//         }

//         // Check if the transit_to_id exists
//         const transitTo = await Transit.findByPk(transit_to_id);
//         if (!transitTo) {
//             return res.status(404).json({ error: 'Transit to ID not found' });
//         }
//    // Create the new subschedule with availability set to true
//         const newSubSchedule = await SubSchedule.create({
//             schedule_id, transit_from_id, transit_to_id, departure_time, arrival_time, journey_time,
//             low_season_price, high_season_price, peak_season_price, return_low_season_price, return_high_season_price,
//             return_peak_season_price, validity_start, validity_end, check_in_time, route_image, availability: true
//         });

//         res.status(201).json(newSubSchedule);
//     } catch (error) {
//         console.error('Error creating subschedule:', error.message);
//         res.status(400).json({ error: error.message });
//     }
// };

// Utility function to validate existence of an ID in a model
const createSubSchedule = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            schedule_id, destination_from_schedule_id, transit_from_id, transit_to_id, low_season_price, high_season_price, peak_season_price,
            return_low_season_price, return_high_season_price, return_peak_season_price, validity_start, validity_end,
            transit_1, transit_2, transit_3, transit_4
        } = req.body;

        console.log("Received subschedule data:", req.body);

        // Call the upload middleware to handle image upload
        await uploadImageToImageKit(req, res, async () => {
            if (!req.file.url) {
                throw new Error('Image file is required');
            }

            // Check if the schedule_id exists
            const schedule = await Schedule.findByPk(schedule_id, { transaction: t });
            if (!schedule) {
                throw new Error('Schedule not found');
            }

            // Validate destination_from_schedule_id if provided
            if (destination_from_schedule_id) {
                const destinationSchedule = await Schedule.findByPk(destination_from_schedule_id, { transaction: t });
                if (!destinationSchedule) {
                    console.error(`Destination schedule ID ${destination_from_schedule_id} not found`);
                    throw new Error('Destination schedule ID not found');
                }
            }

            // Validate transit_from_id if provided
            if (transit_from_id) {
                const transitFrom = await Transit.findByPk(transit_from_id, { transaction: t });
                if (!transitFrom) {
                    console.error(`Transit from ID ${transit_from_id} not found`);
                    throw new Error('Transit from ID not found');
                }
            }

            // Check if the transit_to_id exists
            if (transit_to_id) {
                const transitTo = await Transit.findByPk(transit_to_id, { transaction: t });
                if (!transitTo) {
                    console.error(`Transit to ID ${transit_to_id} not found`);
                    throw new Error('Transit to ID not found');
                }
            }

            // Validate transit_1, transit_2, transit_3, transit_4 if provided
            const transits = [transit_1, transit_2, transit_3, transit_4];
            for (const transit of transits) {
                if (transit) {
                    const transitExists = await Transit.findByPk(transit, { transaction: t });
                    if (!transitExists) {
                        console.error(`Transit ID ${transit} not found`);
                        throw new Error(`Transit ID ${transit} not found`);
                    }
                }
            }

            // Create the new subschedule with availability set to true
            const newSubSchedule = await SubSchedule.create({
                schedule_id, destination_from_schedule_id, transit_from_id: transit_from_id || null, transit_to_id, low_season_price, high_season_price, peak_season_price,
                return_low_season_price, return_high_season_price, return_peak_season_price, validity_start, validity_end,
                route_image: req.file.url, availability: true,
                transit_1: transit_1 || null, transit_2: transit_2 || null, transit_3: transit_3 || null, transit_4: transit_4 || null
            }, { transaction: t });

            await t.commit();
            res.status(201).json(newSubSchedule);
        });
    } catch (error) {
        await t.rollback();
        console.error('Error creating subschedule:', error.message);
        res.status(400).json({ error: error.message });
    }
};


// Get all subschedules
const getAllSubSchedules = async (req, res) => {
    try {
        const subschedules = await SubSchedule.findAll({
            include: [{ model: Schedule, as: 'Schedule' }]
        });
        res.status(200).json(subschedules);
    } catch (error) {
        console.error('Error fetching subschedules:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Get a single subschedule by ID
const getSubScheduleById = async (req, res) => {
    const { id } = req.params;

    try {
        const subschedule = await SubSchedule.findByPk(id, {
            include: [{ model: Schedule, as: 'Schedule' }]
        });

        if (!subschedule) {
            return res.status(404).json({ error: 'Subschedule not found' });
        }

        res.status(200).json(subschedule);
    } catch (error) {
        console.error('Error fetching subschedule:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Update a subschedule
const updateSubSchedule = async (req, res) => {
    const { id } = req.params;
    const {
        schedule_id, sub_schedule_name, departure_time, arrival_time, low_season_price, high_season_price,
        peak_season_price, return_low_season_price, return_high_season_price, return_peak_season_price,
        validity_start, validity_end, check_in_time, route_image, availability
    } = req.body;

    try {
        const subschedule = await SubSchedule.findByPk(id);

        if (!subschedule) {
            return res.status(404).json({ error: 'Subschedule not found' });
        }

        await subschedule.update({
            schedule_id, sub_schedule_name, departure_time, arrival_time, low_season_price, high_season_price,
            peak_season_price, return_low_season_price, return_high_season_price, return_peak_season_price,
            validity_start, validity_end, check_in_time, route_image, availability
        });

        res.status(200).json(subschedule);
    } catch (error) {
        console.error('Error updating subschedule:', error.message);
        res.status(400).json({ error: error.message });
    }
};

// Delete a subschedule
const deleteSubSchedule = async (req, res) => {
    const { id } = req.params;

    try {
        const subschedule = await SubSchedule.findByPk(id);

        if (!subschedule) {
            return res.status(404).json({ error: 'Subschedule not found' });
        }

        await subschedule.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting subschedule:', error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createSubSchedule,
    getAllSubSchedules,
    getSubScheduleById,
    updateSubSchedule,
    deleteSubSchedule
 
};;