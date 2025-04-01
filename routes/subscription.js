const express = require('express');
const router = express.Router();
const { 
  subscribe, 
  unsubscribe, 
  updatePreferences, 
  getAllSubscriptions, 
  getUserSubscription,
  confirmSubscription,
  sendNewsletter
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/', subscribe);
router.get('/confirm/:token', confirmSubscription);
router.get('/unsubscribe/:token', unsubscribe);

// Protected routes
router.get('/me', protect, getUserSubscription);
router.put('/:email', protect, updatePreferences);

// Admin routes
router.get('/', protect, authorize('admin'), getAllSubscriptions);
router.post('/send-newsletter', protect, authorize('admin'), sendNewsletter);

module.exports = router; 