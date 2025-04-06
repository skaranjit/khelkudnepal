const Match = require('../../models/Match');

// Get all matches for admin panel with pagination
exports.getMatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query based on filters
    const query = {};
    
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { 'homeTeam.name': searchRegex },
        { 'awayTeam.name': searchRegex },
        { tournament: searchRegex },
        { 'venue.name': searchRegex },
        { 'venue.location': searchRegex }
      ];
    }
    
    // Count total matches for pagination
    const total = await Match.countDocuments(query);
    
    // Fetch matches with pagination
    const matches = await Match.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);
    
    res.render('admin/matches/index', {
      title: 'Manage Matches',
      matches: matches,
      search: req.query.search || '',
      category: req.query.category || '',
      status: req.query.status || '',
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalMatches: total
      },
      user: req.session.user,
      messages: {
        success: req.flash ? req.flash('success') : null,
        error: req.flash ? req.flash('error') : null
      }
    });
  } catch (error) {
    console.error('Error getting matches for admin panel:', error);
    res.status(500).render('error', {
      message: 'Failed to load matches. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Show form to create a new match
exports.showCreateForm = async (req, res) => {
  try {
    res.render('admin/matches/create', {
      title: 'Create New Match',
      match: {},
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing create match form:', error);
    res.status(500).render('error', {
      message: 'Failed to load create match form. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Create a new match from admin panel
exports.createMatch = async (req, res) => {
  try {
    // Format venue data
    const venue = {
      name: req.body.venueName || '',
      location: req.body.venueLocation || ''
    };
    
    // Create match data object
    const matchData = {
      homeTeam: req.body.homeTeam,
      awayTeam: req.body.awayTeam,
      category: req.body.category,
      status: req.body.status,
      startTime: req.body.startTime,
      endTime: req.body.endTime || null,
      tournament: req.body.tournament || '',
      round: req.body.round || '',
      venue: venue,
      imageUrl: req.body.imageUrl || '',
      homeScore: req.body.homeScore || 0,
      awayScore: req.body.awayScore || 0,
    };
    
    // Ensure required object fields are formatted correctly
    if (!matchData.homeTeam || typeof matchData.homeTeam !== 'object') {
      matchData.homeTeam = { name: String(matchData.homeTeam || ''), logo: '' };
    }
    
    if (!matchData.awayTeam || typeof matchData.awayTeam !== 'object') {
      matchData.awayTeam = { name: String(matchData.awayTeam || ''), logo: '' };
    }
    
    // Create new match
    const match = await Match.create(matchData);
    
    // Set success message and redirect to match list
    if (req.flash) req.flash('success', 'Match created successfully');
    res.redirect('/admin/matches');
  } catch (error) {
    console.error('Error creating match from admin panel:', error);
    
    // Check for validation errors
    const errorMessage = error.name === 'ValidationError' 
      ? Object.values(error.errors).map(e => e.message).join(', ')
      : 'Failed to create match. Please try again later.';
    
    res.render('admin/matches/create', {
      title: 'Create New Match',
      match: req.body,
      error: errorMessage,
      user: req.session.user
    });
  }
};

// Show form to edit a match
exports.showEditForm = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      req.flash('error', 'Match not found');
      return res.redirect('/admin/matches');
    }
    
    res.render('admin/matches/edit', {
      title: 'Edit Match',
      match: match,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing edit match form:', error);
    res.status(500).render('error', {
      message: 'Failed to load edit match form. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Update a match from admin panel
exports.updateMatch = async (req, res) => {
  try {
    // Format homeTeam and awayTeam properly
    const homeTeam = {
      name: req.body.homeTeam && req.body.homeTeam.name ? req.body.homeTeam.name : '',
      logo: req.body.homeTeam && req.body.homeTeam.logo ? req.body.homeTeam.logo : ''
    };
    
    const awayTeam = {
      name: req.body.awayTeam && req.body.awayTeam.name ? req.body.awayTeam.name : '',
      logo: req.body.awayTeam && req.body.awayTeam.logo ? req.body.awayTeam.logo : ''
    };
    
    // Basic match data
    const matchData = {
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeScore: parseInt(req.body.homeScore) || 0,
      awayScore: parseInt(req.body.awayScore) || 0,
      category: req.body.category,
      status: req.body.status,
      startTime: new Date(req.body.startTime),
      tournament: req.body.tournament,
      round: req.body.round,
      imageUrl: req.body.imageUrl,
      venue: {
        name: req.body.venueName,
        location: req.body.venueLocation
      }
    };
    
    // Only set endTime if it has a valid value
    if (req.body.endTime) {
      const endTime = new Date(req.body.endTime);
      if (!isNaN(endTime.getTime())) {
        matchData.endTime = endTime;
      }
    }
    
    // Add cricket specific fields if category is cricket
    if (req.body.category.toLowerCase() === 'cricket') {
      matchData.format = req.body.format || 'ODI';
      matchData.overs = req.body.overs || 50;
      
      // Add detailed score information
      if (req.body.homeRuns || req.body.awayRuns) {
        matchData.score = {
          home: req.body.homeScore || 0,
          away: req.body.awayScore || 0,
          home_detail: req.body.homeScoreDetail || `${req.body.homeRuns || 0}/${req.body.homeWickets || 0}`,
          away_detail: req.body.awayScoreDetail || `${req.body.awayRuns || 0}/${req.body.awayWickets || 0}`,
          home_overs: req.body.homeOvers || '0.0',
          away_overs: req.body.awayOvers || '0.0'
        };

        // Add detailed stats
        matchData.stats = {
          home: {
            runs: req.body.homeRuns || 0,
            wickets: req.body.homeWickets || 0,
            overs: req.body.homeOvers || '0.0',
            runRate: req.body.homeRunRate || 0,
            extras: req.body.homeExtras || 0,
            fours: req.body.homeFours || 0,
            sixes: req.body.homeSixes || 0
          },
          away: {
            runs: req.body.awayRuns || 0,
            wickets: req.body.awayWickets || 0,
            overs: req.body.awayOvers || '0.0',
            runRate: req.body.awayRunRate || 0,
            extras: req.body.awayExtras || 0,
            fours: req.body.awayFours || 0,
            sixes: req.body.awaySixes || 0
          }
        };
      }
    }
    // Add football specific fields if category is football
    else if (req.body.category.toLowerCase() === 'football') {
      // For football matches, add football-specific statistics
      matchData.stats = {
        homePossession: req.body.homePossession || 50,
        awayPossession: req.body.awayPossession || 50,
        homeShots: req.body.homeShots || 0,
        awayShots: req.body.awayShots || 0,
        homeCorners: req.body.homeCorners || 0,
        awayCorners: req.body.awayCorners || 0,
        homeYellowCards: req.body.homeYellowCards || 0,
        awayYellowCards: req.body.awayYellowCards || 0,
        homeRedCards: req.body.homeRedCards || 0,
        awayRedCards: req.body.awayRedCards || 0
      };
    }
    
    const match = await Match.findByIdAndUpdate(req.params.id, matchData, {
      new: true,
      runValidators: true
    });
    
    if (!match) {
      req.flash('error', 'Match not found');
      return res.redirect('/admin/matches');
    }
    
    req.flash('success', 'Match updated successfully');
    res.redirect('/admin/matches');
  } catch (error) {
    console.error('Error updating match from admin panel:', error);
    res.status(500).render('admin/matches/edit', {
      title: 'Edit Match',
      match: { ...req.body, _id: req.params.id },
      error: 'Failed to update match: ' + (error.message || 'Unknown error'),
      user: req.session.user
    });
  }
};

// Delete a match from admin panel
exports.deleteMatch = async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    
    if (!match) {
      req.flash('error', 'Match not found');
      return res.redirect('/admin/matches');
    }
    
    req.flash('success', 'Match deleted successfully');
    res.redirect('/admin/matches');
  } catch (error) {
    console.error('Error deleting match from admin panel:', error);
    req.flash('error', 'Failed to delete match. Please try again later.');
    res.redirect('/admin/matches');
  }
};

// Update match score from admin panel
exports.updateLiveScore = async (req, res) => {
  try {
    // Get the match first to check its category
    const existingMatch = await Match.findById(req.params.id);
    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    let updateData = {};
    
    // Handle different updates based on category
    if (existingMatch.category.toLowerCase() === 'cricket') {
      // Cricket-specific updates
      updateData = {
        $set: {
          // Basic score (for compatibility)
          homeScore: req.body.homeRuns || 0,
          awayScore: req.body.awayRuns || 0,
          
          // Detailed score
          'score.home': req.body.homeRuns || 0,
          'score.away': req.body.awayRuns || 0,
          'score.home_detail': req.body.homeScoreDetail || `${req.body.homeRuns || 0}/${req.body.homeWickets || 0}`,
          'score.away_detail': req.body.awayScoreDetail || `${req.body.awayRuns || 0}/${req.body.awayWickets || 0}`,
          'score.home_overs': req.body.homeOvers || '0.0',
          'score.away_overs': req.body.awayOvers || '0.0',
          
          // Detailed stats
          'stats.home.runs': req.body.homeRuns || 0,
          'stats.home.wickets': req.body.homeWickets || 0,
          'stats.home.overs': req.body.homeOvers || '0.0',
          'stats.home.runRate': req.body.homeRunRate || 0,
          'stats.home.extras': req.body.homeExtras || 0,
          'stats.home.fours': req.body.homeFours || 0,
          'stats.home.sixes': req.body.homeSixes || 0,
          
          'stats.away.runs': req.body.awayRuns || 0,
          'stats.away.wickets': req.body.awayWickets || 0, 
          'stats.away.overs': req.body.awayOvers || '0.0',
          'stats.away.runRate': req.body.awayRunRate || 0,
          'stats.away.extras': req.body.awayExtras || 0,
          'stats.away.fours': req.body.awayFours || 0,
          'stats.away.sixes': req.body.awaySixes || 0,
          
          updatedAt: Date.now()
        }
      };
    } else if (existingMatch.category.toLowerCase() === 'football') {
      // Football-specific updates
      updateData = {
        $set: {
          homeScore: parseInt(req.body.homeScore) || 0,
          awayScore: parseInt(req.body.awayScore) || 0,
          
          // Football stats
          'stats.homePossession': req.body.homePossession || 50,
          'stats.awayPossession': req.body.awayPossession || 50,
          'stats.homeShots': req.body.homeShots || 0,
          'stats.awayShots': req.body.awayShots || 0,
          'stats.homeCorners': req.body.homeCorners || 0,
          'stats.awayCorners': req.body.awayCorners || 0,
          'stats.homeYellowCards': req.body.homeYellowCards || 0,
          'stats.awayYellowCards': req.body.awayYellowCards || 0,
          'stats.homeRedCards': req.body.homeRedCards || 0,
          'stats.awayRedCards': req.body.awayRedCards || 0,
          
          updatedAt: Date.now()
        }
      };
    } else {
      // Regular score update for other sports
      updateData = {
        $set: {
          homeScore: parseInt(req.body.homeScore) || 0,
          awayScore: parseInt(req.body.awayScore) || 0,
          updatedAt: Date.now()
        }
      };
    }
    
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Score updated successfully',
      data: match
    });
  } catch (error) {
    console.error('Error updating match from admin panel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update score. Please try again later.'
    });
  }
};

// Add commentary to a match
exports.addCommentary = async (req, res) => {
  try {
    const { text, important } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Please provide commentary text'
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Add commentary
    match.commentary.push({
      time: new Date(),
      text,
      important: important || false
    });
    
    await match.save();
    
    res.status(200).json({
      success: true,
      message: 'Commentary added successfully',
      data: match
    });
  } catch (error) {
    console.error('Error adding commentary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add commentary'
    });
  }
};

// Remove commentary from a match
exports.removeCommentary = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Find commentary by ID and remove it
    const commentaryIndex = match.commentary.findIndex(
      comment => comment._id.toString() === req.params.commentId
    );
    
    if (commentaryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Commentary not found'
      });
    }
    
    match.commentary.splice(commentaryIndex, 1);
    await match.save();
    
    res.status(200).json({
      success: true,
      message: 'Commentary removed successfully',
      data: match
    });
  } catch (error) {
    console.error('Error removing commentary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove commentary'
    });
  }
};

// Add update to a match
exports.addUpdate = async (req, res) => {
  try {
    const { text, important } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Please provide update text'
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Add update
    match.updates.push({
      time: new Date(),
      text,
      important: important || false
    });
    
    await match.save();
    
    res.status(200).json({
      success: true,
      message: 'Update added successfully',
      data: match
    });
  } catch (error) {
    console.error('Error adding update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add update'
    });
  }
};

// Remove update from a match
exports.removeUpdate = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Find update by ID and remove it
    const updateIndex = match.updates.findIndex(
      update => update._id.toString() === req.params.updateId
    );
    
    if (updateIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Update not found'
      });
    }
    
    match.updates.splice(updateIndex, 1);
    await match.save();
    
    res.status(200).json({
      success: true,
      message: 'Update removed successfully',
      data: match
    });
  } catch (error) {
    console.error('Error removing update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove update'
    });
  }
};

// Show match details
exports.showMatchDetails = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      req.flash('error', 'Match not found');
      return res.redirect('/admin/matches');
    }
    
    res.render('admin/matches/show', {
      title: 'Match Details',
      match: match,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing match details:', error);
    res.status(500).render('error', {
      message: 'Failed to load match details. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
}; 