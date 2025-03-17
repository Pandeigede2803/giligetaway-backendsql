const express = require('express');
const router = express.Router();
const {createSubScheduleRelation,getSubScheduleRelations,updateOrCreateSubScheduleRelation,getSubSchedulesByScheduleId,deleteSubScheduleRelation} = require('../controllers/subScheduleRelationController');
const authenticate = require('../middleware/authenticate');
// const { validateCreateSubScheduleRelation, validateSubScheduleId } = require('../middlewares/validateSubScheduleRelation');

// 📌 1. Membuat SubSchedule Relation
router.post(
    '/',authenticate,createSubScheduleRelation
);

// 📌 2. Mendapatkan SubScheduleRelation berdasarkan SubSchedule ID
router.get(
    '/:id',

    authenticate,getSubScheduleRelations
);
// getSubSchedulesByScheduleId
router.get(
    '/schedule/:id',
    authenticate,getSubSchedulesByScheduleId
);
// 📌 3. Mengupdate atau Membuat SubScheduleRelation jika belum ada
router.put(
    '/:id',

    authenticate,updateOrCreateSubScheduleRelation
);

// 📌 4. Menghapus SubScheduleRelation berdasarkan ID
router.delete(
    '/:id',
    authenticate,deleteSubScheduleRelation
);

module.exports = router;;