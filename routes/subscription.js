const express = require('express');
const router = express.Router();
const { 
  subscribe, 
  unsubscribe, 
  updatePreferences, 
  getAllSubscriptions, 
  getUserSubscription 
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/', subscribe);
router.get('/unsubscribe/:token', unsubscribe);

// Protected routes
router.get('/me', protect, getUserSubscription);
router.put('/:email', protect, updatePreferences);

// Admin only routes
router.get('/', protect, authorize('admin'), getAllSubscriptions);

module.exports = router; 