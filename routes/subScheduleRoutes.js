const express = require('express');
const router = express.Router();
const { upload,uploadImageToImageKit } = require('../middleware/upload');

const authenticate = require('../middleware/authenticate');
const {
    createSubSchedule,
    getAllSubSchedules,
    getSubScheduleById,
    updateSubSchedule,
    deleteSubSchedule
} = require('../controllers/subScheduleController');

router.post('/',authenticate,upload, createSubSchedule);
router.get('/', authenticate,getAllSubSchedules);
router.get('/:id',authenticate, getSubScheduleById);
router.put('/:id',authenticate,updateSubSchedule);
router.delete('/:id',authenticate, deleteSubSchedule);

module.exports = router;;