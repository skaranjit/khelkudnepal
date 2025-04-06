const League = require('../models/League');
const News = require('../models/News');
const leagueCache = require('../utils/leagueCache');

// Get all leagues (with optional category filter)
exports.getAllLeagues = async (req, res) => {
  try {
    const { category } = req.query;
    
    // If category is specified, get leagues by category
    if (category) {
      const leagues = await leagueCache.getLeaguesByCategory(category);
      
      return res.status(200).json({
        success: true,
        count: leagues.length,
        data: leagues
      });
    }
    
    // Otherwise get all leagues
    const leagues = await leagueCache.getAllLeagues();
    
    res.status(200).json({
      success: true,
      count: leagues.length,
      data: leagues
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get leagues by category
exports.getLeaguesByCategory = async (req, res) => {
  try {
    const leagues = await leagueCache.getLeaguesByCategory(req.params.category);
    
    res.status(200).json({
      success: true,
      count: leagues.length,
      data: leagues
    });
  } catch (error) {
    console.error('Error fetching leagues by category:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get single league details
exports.getLeagueById = async (req, res) => {
  try {
    const league = await leagueCache.getLeagueById(req.params.id);
    
    if (!league) {
      return res.status(404).json({
        success: false,
        error: 'League not found'
      });
    }
    
    // We need to ensure the league object has the calculateStandings method
    // Since cached objects don't have methods, create a League instance
    const leagueModel = new League(league);
    leagueModel.calculateStandings();
    
    res.status(200).json({
      success: true,
      data: leagueModel
    });
  } catch (error) {
    console.error('Error fetching league:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'League not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get team details and related news
exports.getTeamNews = async (req, res) => {
  try {
    const { leagueId, teamName } = req.params;
    
    // Get league from cache
    const league = await leagueCache.getLeagueById(leagueId);
    
    if (!league) {
      return res.status(404).json({
        success: false,
        error: 'League not found'
      });
    }
    
    // Find the team in the league
    const team = league.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
    
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }
    
    // Find news related to the team
    const teamNews = await News.find({
      $or: [
        { title: { $regex: team.name, $options: 'i' } },
        { content: { $regex: team.name, $options: 'i' } }
      ]
    }).sort({ publishedAt: -1 }).limit(10);
    
    res.status(200).json({
      success: true,
      data: {
        team,
        news: teamNews
      }
    });
  } catch (error) {
    console.error('Error fetching team details and news:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'League or team not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// View controller for leagues page
exports.getLeaguesPage = async (req, res) => {
  try {
    console.log('Fetching leagues for page display...');
    
    // Get all leagues from cache
    const allLeagues = await leagueCache.getAllLeagues();
    
    // Get featured leagues for each category
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other'];
    const featuredLeagues = {};
    
    for (const category of categories) {
      // Filter leagues by category (case-insensitive) and sort by featured flag
      const categoryLowerCase = category.toLowerCase();
      featuredLeagues[category] = allLeagues
        .filter(league => league.category.toLowerCase() === categoryLowerCase)
        .sort((a, b) => {
          // Sort by featured flag (true first) then by name
          if (a.featured === b.featured) {
            return a.name.localeCompare(b.name);
          }
          return a.featured ? -1 : 1;
        })
        .slice(0, 5); // Limit to 5 leagues per category
      
      console.log(`Found ${featuredLeagues[category].length} ${category} leagues`);
    }
    
    console.log('All categories fetched, rendering leagues page from cache');
    
    res.render('leagues', {
      title: 'Nepali Leagues',
      featuredLeagues,
      categories,
      activeNav: 'leagues',
      cacheInfo: { enabled: true, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error loading leagues page:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load leagues information',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// View controller for single league page
exports.getLeagueDetailsPage = async (req, res) => {
  try {
    // Get league from cache
    const league = await leagueCache.getLeagueById(req.params.id);
    
    if (!league) {
      return res.status(404).render('error', {
        title: 'League Not Found',
        message: 'League not found',
        status: 404
      });
    }
    
    // We need to ensure the league object has the calculateStandings method
    // Since cached objects don't have methods, create a League instance
    const leagueModel = new League(league);
    leagueModel.calculateStandings();
    
    // Get recent news related to this league
    const leagueNews = await News.find({
      $or: [
        { title: { $regex: league.name, $options: 'i' } },
        { content: { $regex: league.name, $options: 'i' } }
      ]
    }).sort({ publishedAt: -1 }).limit(5);
    
    res.render('league-details', {
      title: `${league.name} | ${league.season}`,
      league: leagueModel,
      leagueNews,
      activeNav: 'leagues',
      cacheInfo: { enabled: true, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error loading league details page:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).render('error', {
        title: 'League Not Found',
        message: 'League not found',
        status: 404
      });
    }
    
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load league details',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// View controller for team details page
exports.getTeamDetailsPage = async (req, res) => {
  try {
    const { leagueId, teamName } = req.params;
    
    // Get league from cache
    const league = await leagueCache.getLeagueById(leagueId);
    
    if (!league) {
      return res.status(404).render('error', {
        title: 'League Not Found',
        message: 'League not found',
        status: 404
      });
    }
    
    // Find the team in the league
    const team = league.teams.find(t => 
      t.name.toLowerCase().replace(/\s+/g, '-') === teamName.toLowerCase());
    
    if (!team) {
      return res.status(404).render('error', {
        title: 'Team Not Found',
        message: 'Team not found',
        status: 404
      });
    }
    
    // Find news related to the team
    const teamNews = await News.find({
      $or: [
        { title: { $regex: team.name, $options: 'i' } },
        { content: { $regex: team.name, $options: 'i' } }
      ]
    }).sort({ publishedAt: -1 }).limit(10);
    
    res.render('team-details', {
      title: team.name,
      team,
      league,
      teamNews,
      teamMatches: [], // This would be populated if you have match data
      activeNav: 'leagues',
      cacheInfo: { enabled: true, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error loading team details page:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'League or team not found',
        status: 404
      });
    }
    
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load team details',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Check if leagues exist and populate with sample data if not
exports.checkAndPopulateLeagues = async () => {
  try {
    // Check if leagues already exist
    const leagueCount = await League.countDocuments();
    
    if (leagueCount === 0) {
      console.log('No leagues found in database. Sample data population is disabled.');
      
      // Initialize empty cache
      await leagueCache.initializeCache();
      
      return true;
    } else {
      console.log(`Database already has ${leagueCount} leagues.`);
      
      // Initialize the cache with existing data
      await leagueCache.initializeCache();
      
      return false;
    }
  } catch (error) {
    console.error('Error checking/populating leagues:', error);
    return false;
  }
}; 