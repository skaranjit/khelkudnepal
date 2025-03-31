const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');

// Admin login page
router.get('/login', (req, res) => {
  res.render('admin/login');
});

// Admin dashboard (protected)
router.get('/dashboard', isAdmin, (req, res) => {
  res.render('admin/dashboard', {
    user: req.session.user
  });
});

// News management (protected)
router.get('/news', isAdmin, (req, res) => {
  res.render('admin/news', {
    user: req.session.user
  });
});

// News editor (protected)
router.get('/news/create', isAdmin, (req, res) => {
  res.render('admin/news-editor', {
    user: req.session.user,
    mode: 'create'
  });
});

// News editor for editing existing news (protected)
router.get('/news/edit/:id', isAdmin, (req, res) => {
  res.render('admin/news-editor', {
    user: req.session.user,
    mode: 'edit',
    newsId: req.params.id
  });
});

// Subscription management (protected)
router.get('/subscriptions', isAdmin, (req, res) => {
  res.render('admin/subscriptions', {
    user: req.session.user
  });
});

// User management (protected)
router.get('/users', isAdmin, (req, res) => {
  res.render('admin/users', {
    user: req.session.user
  });
});

// Settings (protected)
router.get('/settings', isAdmin, (req, res) => {
  res.render('admin/settings', {
    user: req.session.user
  });
});

module.exports = router; 