const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');


// // CREATE user (register)
// router.post('/', userController.createUser);

router.get('/',authenticate, userController.getUsers);

// update user
router.put('/:id',authenticate, userController.updateUser);

// // UPDATE user
router.post('/forgot-password', userController.forgotPassword);


router.post('/reset-password', userController.resetPasswordWithToken);
// // DELETE user

// Authentication routes
router.post('/register',authenticate, userController.createUser); // Or use the same route as above
router.post('/login', userController.loginUser);
router.post('/change-password', authenticate, userController.changePassword);

module.exports = router;
