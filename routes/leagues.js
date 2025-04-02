const express = require('express');
const router = express.Router();
const { 
  getAllLeagues, 
  getLeaguesByCategory, 
  getLeagueById, 
  getTeamNews
} = require('../controllers/leagueController');

// Get all leagues with optional category filter
router.get('/', getAllLeagues);

// Get leagues by category
router.get('/category/:category', getLeaguesByCategory);

// Get single league details
router.get('/:id', getLeagueById);

// Get team details and related news
router.get('/:leagueId/teams/:teamName/news', getTeamNews);

module.exports = router; 