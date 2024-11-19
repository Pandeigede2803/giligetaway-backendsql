const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');


// // CREATE user (register)
// router.post('/', userController.createUser);

// // READ users
// router.get('/', userController.getUsers);`

// // READ user by id
// router.get('/:id', userController.getUserById);

// // UPDATE user
router.post('/forgot-password', userController.forgotPassword);


router.post('/reset-password', userController.resetPasswordWithToken);
// // DELETE user
// router.delete('/:id', userController.deleteUser);

// Authentication routes
router.post('/register', userController.createUser); // Or use the same route as above
router.post('/login', userController.loginUser);
router.post('/change-password', authenticate, userController.changePassword);

module.exports = router;
