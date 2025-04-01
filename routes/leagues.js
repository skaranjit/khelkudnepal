const express = require('express');
const router = express.Router();
const { 
  getAllLeagues, 
  getLeaguesByCategory, 
  getLeagueById, 
  getTeamNews,
  fetchWebStandings,
  fetchWebUpdates,
  fetchTeamWebNews
} = require('../controllers/leagueController');

// Get all leagues with optional category filter
router.get('/', getAllLeagues);

// Get leagues by category
router.get('/category/:category', getLeaguesByCategory);

// Fetch league standings from web
router.get('/:id/web-standings', fetchWebStandings);

// Fetch league updates from web
router.get('/:id/web-updates', fetchWebUpdates);

// Get single league details
router.get('/:id', getLeagueById);

// Fetch team news from web
router.get('/:leagueId/teams/:teamId/web-news', fetchTeamWebNews);

// Get team details and related news
router.get('/:leagueId/teams/:teamName/news', getTeamNews);

module.exports = router; 