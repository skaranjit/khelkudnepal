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
        { homeTeam: searchRegex },
        { awayTeam: searchRegex },
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
      matches,
      search: req.query.search || '',
      category: req.query.category || '',
      status: req.query.status || '',
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalMatches: total
      },
      user: req.session.user
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
    const matchData = {
      ...req.body,
      startTime: new Date(req.body.startTime),
      endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      venue: {
        name: req.body.venueName,
        location: req.body.venueLocation
      }
    };
    
    // Remove form fields that don't map directly to the model
    delete matchData.venueName;
    delete matchData.venueLocation;
    
    await Match.create(matchData);
    
    req.flash('success', 'Match created successfully');
    res.redirect('/admin/matches');
  } catch (error) {
    console.error('Error creating match from admin panel:', error);
    res.status(500).render('admin/matches/create', {
      title: 'Create New Match',
      match: req.body,
      error: 'Failed to create match. Please check the form and try again.',
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
      match,
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
    const matchData = {
      ...req.body,
      startTime: new Date(req.body.startTime),
      endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      venue: {
        name: req.body.venueName,
        location: req.body.venueLocation
      }
    };
    
    // Remove form fields that don't map directly to the model
    delete matchData.venueName;
    delete matchData.venueLocation;
    
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
      error: 'Failed to update match. Please check the form and try again.',
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
    const { homeScore, awayScore } = req.body;
    
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          homeScore,
          awayScore,
          updatedAt: Date.now()
        }
      },
      { new: true }
    );
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Score updated successfully',
      data: match
    });
  } catch (error) {
    console.error('Error updating live score from admin panel:', error);
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