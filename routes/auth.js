const express = require('express');
const router = express.Router();
const { register, login, logout, getCurrentUser, adminLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Register a new user
router.post('/register', register);

// Login user
router.post('/login', login);

// Admin login
router.post('/admin/login', adminLogin);

// Logout user
router.get('/logout', logout);

// Get current user
router.get('/me', protect, getCurrentUser);

// Check if user is logged in and return session data
router.get('/check-session', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({
      success: true,
      isLoggedIn: true,
      user: req.session.user
    });
  } else {
    return res.status(200).json({
      success: true,
      isLoggedIn: false
    });
  }
});

module.exports = router; 