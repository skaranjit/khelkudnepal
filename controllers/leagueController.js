const League = require('../models/League');
const News = require('../models/News');
const LeagueUpdateScraper = require('../utils/leagueUpdateScraper');

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

// @desc    Fetch league standings from web sources
// @route   GET /api/leagues/:id/web-standings
// @access  Public
exports.fetchWebStandings = async (req, res) => {
  try {
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).json({ 
        success: false, 
        error: 'League not found' 
      });
    }
    
    // Only fetch standings for ongoing or upcoming leagues
    if (league.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot update standings for completed leagues' 
      });
    }
    
    console.log(`Fetching web standings for ${league.name} (${league.category})`);
    
    // Fetch standings from web
    const standings = await LeagueUpdateScraper.fetchStandingsForLeague(league);
    
    if (standings.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No standings found online',
        data: league
      });
    }
    
    // Process each team in the scraped standings
    const updatedTeams = [];
    
    for (const standingTeam of standings) {
      // Try to find existing team in the league
      const existingTeamIndex = league.teams.findIndex(
        t => t.name.toLowerCase() === standingTeam.name.toLowerCase()
      );
      
      if (existingTeamIndex !== -1) {
        // Update existing team stats
        league.teams[existingTeamIndex].played = standingTeam.played;
        league.teams[existingTeamIndex].won = standingTeam.won;
        league.teams[existingTeamIndex].drawn = standingTeam.drawn;
        league.teams[existingTeamIndex].lost = standingTeam.lost;
        league.teams[existingTeamIndex].goalsFor = standingTeam.goalsFor;
        league.teams[existingTeamIndex].goalsAgainst = standingTeam.goalsAgainst;
        league.teams[existingTeamIndex].points = standingTeam.points;
        
        updatedTeams.push(league.teams[existingTeamIndex]);
      } else {
        // Create new team if it doesn't exist
        const newTeam = {
          name: standingTeam.name,
          played: standingTeam.played,
          won: standingTeam.won,
          drawn: standingTeam.drawn,
          lost: standingTeam.lost,
          goalsFor: standingTeam.goalsFor,
          goalsAgainst: standingTeam.goalsAgainst,
          points: standingTeam.points,
          logo: '/images/default-team-logo.png', // Default logo
          location: 'Unknown' // Default location
        };
        
        league.teams.push(newTeam);
        updatedTeams.push(newTeam);
      }
    }
    
    // Add an update about the standings refresh
    league.updates.unshift({
      title: 'Standings Updated',
      text: `Standings have been updated with the latest results. ${updatedTeams.length} teams were updated.`,
      time: new Date(),
      source: 'Web Scraper',
      important: false
    });
    
    // Update lastUpdated timestamp
    league.lastUpdated = new Date();
    
    // Save the updated league
    await league.save();
    
    // Calculate standings (sort teams)
    league.calculateStandings();
    
    res.status(200).json({
      success: true,
      message: `Updated standings for ${updatedTeams.length} teams`,
      data: league
    });
  } catch (error) {
    console.error('Error fetching web standings:', error);
    
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

// @desc    Fetch league updates from web sources
// @route   GET /api/leagues/:id/web-updates
// @access  Public
exports.fetchWebUpdates = async (req, res) => {
  try {
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).json({ 
        success: false, 
        error: 'League not found' 
      });
    }
    
    console.log(`Fetching web updates for ${league.name} (${league.category})`);
    
    // Fetch updates from web
    const updates = await LeagueUpdateScraper.fetchUpdatesForLeague(league);
    
    if (updates.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No updates found online',
        data: league
      });
    }
    
    // Add new updates to the league
    // Check for duplicates to avoid adding the same update multiple times
    let addedCount = 0;
    
    for (const update of updates) {
      // Check if we already have this update by comparing title and text
      const duplicate = league.updates.find(u => 
        u.title === update.title && 
        u.text === update.text
      );
      
      if (!duplicate) {
        league.updates.unshift(update);
        addedCount++;
      }
    }
    
    // Limit the number of updates to keep
    if (league.updates.length > 20) {
      league.updates = league.updates.slice(0, 20);
    }
    
    // Update lastUpdated timestamp
    league.lastUpdated = new Date();
    
    // Save the updated league
    await league.save();
    
    res.status(200).json({
      success: true,
      message: `Added ${addedCount} new updates`,
      data: league
    });
  } catch (error) {
    console.error('Error fetching web updates:', error);
    
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

// @desc    Fetch team news from web sources
// @route   GET /api/leagues/:leagueId/teams/:teamId/web-news
// @access  Public
exports.fetchTeamWebNews = async (req, res) => {
  try {
    const { leagueId, teamId } = req.params;
    const { full } = req.query; // If full=true, fetch more detailed news
    
    const league = await League.findById(leagueId);
    
    if (!league) {
      return res.status(404).json({ 
        success: false, 
        error: 'League not found' 
      });
    }
    
    // Find the team by ID
    const team = league.teams.id(teamId);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }
    
    console.log(`Fetching web news for team: ${team.name}`);
    
    // Fetch news from web
    const newsItems = await LeagueUpdateScraper.fetchTeamNews(team, league);
    
    if (newsItems.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No news found online for this team',
        data: { team, news: [] }
      });
    }
    
    // Save news to the database
    const savedNews = [];
    
    for (const item of newsItems) {
      // Check if we already have similar news
      const exists = await News.findOne({
        $or: [
          { title: item.title },
          { url: item.url }
        ]
      });
      
      if (!exists) {
        const news = new News({
          title: item.title,
          content: item.content,
          excerpt: item.content.substring(0, 200) + '...',
          source: item.source,
          url: item.url,
          publishedAt: item.publishedAt,
          imageUrl: item.imageUrl,
          category: item.category,
          tags: item.tags
        });
        
        await news.save();
        savedNews.push(news);
      }
    }
    
    // Get all team news (existing + new)
    const teamNews = await News.find({
      $or: [
        { title: { $regex: team.name, $options: 'i' } },
        { content: { $regex: team.name, $options: 'i' } },
        { tags: team.name }
      ]
    }).sort({ publishedAt: -1 }).limit(10);
    
    res.status(200).json({
      success: true,
      message: `Added ${savedNews.length} new news items`,
      data: {
        team,
        news: teamNews
      }
    });
  } catch (error) {
    console.error('Error fetching team web news:', error);
    
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