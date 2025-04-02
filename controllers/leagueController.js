const League = require('../models/League');
const News = require('../models/News');

// Get all leagues (with optional category filter)
exports.getAllLeagues = async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    const leagues = await League.find(query).sort({ featured: -1, name: 1 });
    
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
    const leagues = await League.find({ category: req.params.category })
      .sort({ featured: -1, name: 1 });
    
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
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).json({
        success: false,
        error: 'League not found'
      });
    }
    
    // Calculate standings
    league.calculateStandings();
    
    res.status(200).json({
      success: true,
      data: league
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
    
    const league = await League.findById(leagueId);
    
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
    // Get featured leagues for each category
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other'];
    const featuredLeagues = {};
    
    for (const category of categories) {
      featuredLeagues[category] = await League.find({ 
        category,
        status: 'ongoing'
      }).sort({ featured: -1 }).limit(2);
    }
    
    res.render('leagues', {
      title: 'Nepali Leagues',
      featuredLeagues,
      categories,
      activeNav: 'leagues'
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
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).render('error', {
        title: 'League Not Found',
        message: 'League not found',
        status: 404
      });
    }
    
    // Calculate standings
    league.calculateStandings();
    
    // Get recent news related to this league
    const leagueNews = await News.find({
      $or: [
        { title: { $regex: league.name, $options: 'i' } },
        { content: { $regex: league.name, $options: 'i' } }
      ]
    }).sort({ publishedAt: -1 }).limit(5);
    
    res.render('league-details', {
      title: `${league.name} | ${league.season}`,
      league,
      leagueNews,
      activeNav: 'leagues'
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
    
    const league = await League.findById(leagueId);
    
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
      activeNav: 'leagues'
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