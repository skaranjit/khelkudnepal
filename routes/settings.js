const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, isAdmin } = require('../middleware/auth');

// Public routes - accessible to frontend without authentication
router.get('/', settingsController.getSettings);
router.get('/:section', settingsController.getSettingsBySection);

// Protected routes - require admin authentication
router.put('/', protect, isAdmin, settingsController.updateSettings);
router.put('/:section', protect, isAdmin, settingsController.updateSettingsBySection);
router.post('/reset', protect, isAdmin, settingsController.resetSettings);

// File upload route for logo
router.post('/upload-logo', protect, isAdmin, settingsController.uploadLogo);

module.exports = router; 