const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { protect, authorize } = require('../../middleware/auth');

// Routes that need admin privileges
router.use(protect);

// Get all users (admin only)
router.get('/', authorize('admin'), userController.getAllUsers);

// Create new user (admin only)
router.post('/', authorize('admin'), userController.createUser);

// Get single user (admin or owner)
router.get('/:id', userController.getUserById);

// Update user (admin or owner)
router.put('/:id', userController.updateUser);

// Delete user (admin only)
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router; 