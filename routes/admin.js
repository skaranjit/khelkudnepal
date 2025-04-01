const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const matchesController = require('../controllers/admin/matchesController');
const browserlessController = require('../controllers/admin/browserlessController');

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

// Match management routes
router.get('/matches', isAdmin, matchesController.getMatches);
router.get('/matches/create', isAdmin, matchesController.showCreateForm);
router.post('/matches', isAdmin, matchesController.createMatch);
router.get('/matches/edit/:id', isAdmin, matchesController.showEditForm);
router.post('/matches/edit/:id', isAdmin, matchesController.updateMatch);
router.post('/matches/delete/:id', isAdmin, matchesController.deleteMatch);
router.post('/matches/score/:id', isAdmin, matchesController.updateLiveScore);
router.post('/matches/commentary/:id', isAdmin, matchesController.addCommentary);
router.delete('/matches/commentary/:id/:commentId', isAdmin, matchesController.removeCommentary);

// New match updates routes
router.post('/matches/update/:id', isAdmin, matchesController.addUpdate);
router.delete('/matches/update/:id/:updateId', isAdmin, matchesController.removeUpdate);

// Browserless routes
router.get('/browserless', isAdmin, browserlessController.showBrowserlessPage);
router.get('/api/browserless/status', isAdmin, browserlessController.getStatus);
router.post('/api/browserless/config', isAdmin, browserlessController.updateConfig);
router.get('/api/browserless/test', isAdmin, browserlessController.runTest);

module.exports = router; 