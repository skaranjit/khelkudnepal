const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const matchesController = require('../controllers/admin/matchesController');
const browserlessController = require('../controllers/admin/browserlessController');
const leagueController = require('../controllers/admin/leagueController');

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

router.get('/system', isAdmin, (req, res) => {
  res.render('admin/system', {
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
router.get('/matches/:id', isAdmin, matchesController.showMatchDetails);

// New match updates routes
router.post('/matches/update/:id', isAdmin, matchesController.addUpdate);
router.delete('/matches/update/:id/:updateId', isAdmin, matchesController.removeUpdate);

// Browserless routes
router.get('/browserless', isAdmin, browserlessController.showBrowserlessPage);
router.get('/api/browserless/status', isAdmin, browserlessController.getStatus);
router.post('/api/browserless/config', isAdmin, browserlessController.updateConfig);
router.get('/api/browserless/test', isAdmin, browserlessController.runTest);

// Admin System Management
router.get('/system', isAdmin, (req, res) => {
  res.render('admin/system', {
    title: 'System Management - Admin',
    user: req.session.user
  });
});

// League management routes
router.get('/leagues', isAdmin, leagueController.getLeagues);
router.get('/leagues/create', isAdmin, leagueController.showCreateForm);
router.post('/leagues', isAdmin, leagueController.createLeague);
router.get('/leagues/edit/:id', isAdmin, leagueController.showEditForm);
router.post('/leagues/edit/:id', isAdmin, leagueController.updateLeague);
router.post('/leagues/delete/:id', isAdmin, leagueController.deleteLeague);

// Team management routes
router.post('/leagues/:id/teams', isAdmin, leagueController.addTeamToLeague);
router.post('/leagues/:id/teams/bulk', isAdmin, leagueController.bulkAddTeamsToLeague);
router.post('/leagues/:id/teams/:teamId', isAdmin, leagueController.updateTeam);
router.post('/leagues/:id/teams/:teamId/remove', isAdmin, leagueController.removeTeamFromLeague);
router.post('/leagues/:id/calculate-standings', isAdmin, leagueController.calculateStandings);

// Debug route for testing team addition
router.get('/debug/add-team/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const testTeam = {
      name: `Test Team ${Date.now()}`,
      logo: '/images/default-team-logo.png',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    };
    
    // Manually prepare the request for the controller
    req.body = testTeam;
    
    // Call the controller function directly
    await leagueController.addTeamToLeague(req, {
      status: (code) => ({
        json: (data) => {
          res.json({
            statusCode: code,
            ...data,
            debug: true
          });
        }
      })
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Debug route error: ' + error.message,
      debug: true
    });
  }
});

module.exports = router; 