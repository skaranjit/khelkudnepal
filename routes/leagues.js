const express = require('express');
const router = express.Router();
const League = require('../models/League');
const { validateObjectId } = require('../middleware/validateId');

// Get all leagues
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = {};
    if (category && ['cricket', 'football', 'basketball', 'volleyball', 'othersports'].includes(category)) {
      query.category = category;
    }
    
    // Check for Redis cache
    const redisClient = global.redisClient;
    let leagues = [];
    
    if (redisClient && redisClient.isReady) {
      const cacheKey = category ? `leagues:category:${category}` : 'leagues:all';
      const cachedLeagues = await redisClient.get(cacheKey);
      
      if (cachedLeagues) {
        leagues = JSON.parse(cachedLeagues);
      } else {
        leagues = await League.find(query)
          .sort({ featured: -1, createdAt: -1 })
          .select('name category logo season status teams');
      }
    } else {
      leagues = await League.find(query)
        .sort({ featured: -1, createdAt: -1 })
        .select('name category logo season status teams');
    }
    
    res.render('leagues/index', {
      title: 'Leagues - Khelkud Nepal',
      leagues,
      activeCategory: category || 'all'
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).render('error', {
      message: 'Error fetching leagues',
      error
    });
  }
});

// Get a specific league
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).render('error', {
        message: 'League not found',
        error: { status: 404 }
      });
    }
    
    // Sort teams by points
    const sortedTeams = [...league.teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGD = (a.goalsFor || 0) - (a.goalsAgainst || 0);
      const bGD = (b.goalsFor || 0) - (b.goalsAgainst || 0);
      if (bGD !== aGD) return bGD - aGD;
      return (b.goalsFor || 0) - (a.goalsFor || 0);
    });
    
    res.render('leagues/show', {
      title: `${league.name} - Standings - Khelkud Nepal`,
      league,
      standings: sortedTeams
    });
  } catch (error) {
    console.error('Error fetching league:', error);
    res.status(500).render('error', {
      message: 'Error fetching league',
      error
    });
  }
});

module.exports = router; 