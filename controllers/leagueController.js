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
    console.log('Fetching leagues for page display...');
    
    // Get featured leagues for each category
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other'];
    const featuredLeagues = {};
    
    for (const category of categories) {
      // Modified to fetch all leagues, not just 'ongoing' ones
      featuredLeagues[category] = await League.find({ 
        category
      }).sort({ featured: -1 }).limit(5);
      
      console.log(`Found ${featuredLeagues[category].length} ${category} leagues`);
    }
    
    console.log('All categories fetched, rendering leagues page');
    
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

// Check if leagues exist and populate with sample data if not
exports.checkAndPopulateLeagues = async () => {
  try {
    // Check if leagues already exist
    const leagueCount = await League.countDocuments();
    
    if (leagueCount === 0) {
      console.log('No leagues found in database. Adding sample leagues...');
      
      // Sample league data
      const sampleLeagues = [
        {
          name: 'Nepal Premier League',
          category: 'Football',
          season: new Date().getFullYear().toString(),
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
          status: 'ongoing',
          featured: true,
          description: 'Top football league in Nepal',
          teams: [
            {
              name: 'Kathmandu FC',
              logo: '/images/default-team-logo.png',
              location: 'Kathmandu',
              played: 12,
              won: 8,
              drawn: 2,
              lost: 2,
              goalsFor: 22,
              goalsAgainst: 10,
              points: 26
            },
            {
              name: 'Pokhara United',
              logo: '/images/default-team-logo.png',
              location: 'Pokhara',
              played: 12,
              won: 7,
              drawn: 3,
              lost: 2,
              goalsFor: 18,
              goalsAgainst: 9,
              points: 24
            },
            {
              name: 'Lalitpur City',
              logo: '/images/default-team-logo.png',
              location: 'Lalitpur',
              played: 12,
              won: 6,
              drawn: 3,
              lost: 3,
              goalsFor: 15,
              goalsAgainst: 12,
              points: 21
            },
            {
              name: 'Chitwan Tigers',
              logo: '/images/default-team-logo.png',
              location: 'Chitwan',
              played: 12,
              won: 5,
              drawn: 2,
              lost: 5,
              goalsFor: 14,
              goalsAgainst: 16,
              points: 17
            }
          ]
        },
        {
          name: 'Nepal Cricket League',
          category: 'Cricket',
          season: new Date().getFullYear().toString(),
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
          status: 'ongoing',
          featured: true,
          description: 'Premier cricket competition in Nepal',
          teams: [
            {
              name: 'Kathmandu Kings',
              logo: '/images/default-team-logo.png',
              location: 'Kathmandu',
              played: 10,
              won: 7,
              drawn: 1,
              lost: 2,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 15
            },
            {
              name: 'Pokhara Rhinos',
              logo: '/images/default-team-logo.png',
              location: 'Pokhara',
              played: 10,
              won: 6,
              drawn: 0,
              lost: 4,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 12
            },
            {
              name: 'Bhairahawa Gladiators',
              logo: '/images/default-team-logo.png',
              location: 'Bhairahawa',
              played: 10,
              won: 5,
              drawn: 0,
              lost: 5,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 10
            }
          ]
        },
        {
          name: 'Nepal Basketball Association League',
          category: 'Basketball',
          season: new Date().getFullYear().toString(),
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
          status: 'ongoing',
          featured: true,
          description: 'Top basketball league in Nepal',
          teams: [
            {
              name: 'Kathmandu Bulls',
              logo: '/images/default-team-logo.png',
              location: 'Kathmandu',
              played: 8,
              won: 6,
              drawn: 0,
              lost: 2,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 12
            },
            {
              name: 'Patan Warriors',
              logo: '/images/default-team-logo.png',
              location: 'Patan',
              played: 8,
              won: 5,
              drawn: 0,
              lost: 3,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 10
            },
            {
              name: 'Butwal Riders',
              logo: '/images/default-team-logo.png',
              location: 'Butwal',
              played: 8,
              won: 3,
              drawn: 0,
              lost: 5,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 6
            }
          ]
        }
      ];
      
      // Insert sample leagues
      await League.insertMany(sampleLeagues);
      console.log(`Added ${sampleLeagues.length} sample leagues to database`);
      return true;
    } else {
      console.log(`Database already has ${leagueCount} leagues.`);
      return false;
    }
  } catch (error) {
    console.error('Error checking/populating leagues:', error);
    return false;
  }
}; 