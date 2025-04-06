const League = require('../../models/League');
const { rebuildLeaguesCache } = require('../../utils/cacheManager');
const mongoose = require('mongoose');

/**
 * Get all leagues
 */
exports.getLeagues = async (req, res) => {
  try {
    console.log('getLeagues controller method called');
    
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      console.log('User is not an admin, redirecting to login');
      return res.redirect('/admin/login');
    }

    // Fetch leagues with specific fields, sorted by creation date
    const leagues = await League.find()
      .select('name category logo season teams status featured')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${leagues.length} leagues`);

    // Render leagues template
    res.render('admin/leagues', {
      title: 'League Management',
      user: req.session.user,
      leagues
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).render('error', {
      message: 'Error fetching leagues',
      error
    });
  }
};

/**
 * Show create league form
 */
exports.showCreateForm = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/admin/login');
    }

    // Render create league form
    res.render('admin/league-form', {
      title: 'Create New League',
      user: req.session.user,
      mode: 'create',
      league: {
        status: 'upcoming',
        category: '',
        featured: false
      }
    });
  } catch (error) {
    console.error('Error showing create form:', error);
    res.status(500).render('error', {
      message: 'Error showing create form',
      error
    });
  }
};

/**
 * Create a new league
 */
exports.createLeague = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Extract league details from request body
    const { name, category, logo, season, status } = req.body;
    const featured = req.body.featured === 'on' || req.body.featured === true;

    // Validate required fields
    if (!name || !category || !season || !status) {
      return res.redirect('/admin/leagues/create?error=' + encodeURIComponent('Missing required fields'));
    }

    // Check if league with same name already exists
    const existingLeague = await League.findOne({ name });
    if (existingLeague) {
      return res.redirect('/admin/leagues/create?error=' + encodeURIComponent('League with this name already exists'));
    }

    // Create new league
    const league = new League({
      name,
      category,
      logo,
      season,
      status,
      featured,
      teams: []
    });

    // Save league to database
    await league.save();

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Redirect to leagues list with success message
    res.redirect('/admin/leagues?success=' + encodeURIComponent('League created successfully'));
  } catch (error) {
    console.error('Error creating league:', error);
    res.redirect('/admin/leagues/create?error=' + encodeURIComponent('Error creating league: ' + error.message));
  }
};

/**
 * Show edit league form
 */
exports.showEditForm = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/admin/login');
    }

    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/admin/leagues?error=' + encodeURIComponent('Invalid league ID'));
    }

    // Find league by ID
    const league = await League.findById(id);

    // Check if league exists
    if (!league) {
      return res.redirect('/admin/leagues?error=' + encodeURIComponent('League not found'));
    }

    // Render edit league form
    res.render('admin/league-form', {
      title: `Edit League: ${league.name}`,
      user: req.session.user,
      mode: 'edit',
      league
    });
  } catch (error) {
    console.error('Error showing edit form:', error);
    res.redirect('/admin/leagues?error=' + encodeURIComponent('Error showing edit form: ' + error.message));
  }
};

/**
 * Update an existing league
 */
exports.updateLeague = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect(`/admin/leagues?error=${encodeURIComponent('Invalid league ID')}`);
    }

    // Extract league details from request body
    const { name, category, logo, season, status } = req.body;
    const featured = req.body.featured === 'on' || req.body.featured === true;

    // Validate required fields
    if (!name || !category || !season || !status) {
      return res.redirect(`/admin/leagues/edit/${id}?error=${encodeURIComponent('Missing required fields')}`);
    }

    // Check if league with same name already exists (excluding current league)
    const existingLeague = await League.findOne({ name, _id: { $ne: id } });
    if (existingLeague) {
      return res.redirect(`/admin/leagues/edit/${id}?error=${encodeURIComponent('Another league with this name already exists')}`);
    }

    // Find and update league
    const league = await League.findByIdAndUpdate(
      id,
      {
        name,
        category,
        logo,
        season,
        status,
        featured
      },
      { new: true, runValidators: true }
    );

    // Check if league exists
    if (!league) {
      return res.redirect('/admin/leagues?error=' + encodeURIComponent('League not found'));
    }

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Redirect to leagues list with success message
    res.redirect('/admin/leagues?success=' + encodeURIComponent('League updated successfully'));
  } catch (error) {
    console.error('Error updating league:', error);
    res.redirect(`/admin/leagues/edit/${req.params.id}?error=${encodeURIComponent('Error updating league: ' + error.message)}`);
  }
};

/**
 * Delete a league
 */
exports.deleteLeague = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid league ID'
      });
    }

    // Find and delete league
    const league = await League.findByIdAndDelete(id);

    // Check if league exists
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting league:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting league: ' + error.message
    });
  }
};

/**
 * Add team to league
 */
exports.addTeamToLeague = async (req, res) => {
  try {
    console.log('addTeamToLeague called with params:', req.params);
    console.log('Request body:', req.body);
    
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      console.log('Unauthorized: User is not admin');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    console.log('League ID:', id);
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid league ID:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid league ID'
      });
    }

    // Extract team details from request body
    const { name, logo, played, won, drawn, lost, goalsFor, goalsAgainst, points } = req.body;
    console.log('Team data extracted:', { name, logo, played, won, drawn, lost, goalsFor, goalsAgainst, points });

    // Extract the actual name if it's an object with a name property
    let teamName = name;
    if (typeof name === 'object' && name !== null && name.name) {
      teamName = name.name;
      console.log('Extracted name from object:', teamName);
    } else if (typeof name === 'string' && (name.includes('{') || name.includes('name:'))) {
      // Try to extract name from string representation of object
      try {
        if (name.startsWith('{') && name.endsWith('}')) {
          const nameObj = JSON.parse(name);
          if (nameObj && nameObj.name) {
            teamName = nameObj.name;
            console.log('Parsed name from JSON string:', teamName);
          }
        } else {
          // Try regex extraction
          const nameMatch = name.match(/name['"]?\s*:\s*['"]([^'"]+)['"]/i);
          if (nameMatch && nameMatch[1]) {
            teamName = nameMatch[1].trim();
            console.log('Extracted name using regex:', teamName);
          }
        }
      } catch (e) {
        console.error('Error parsing team name string:', e);
      }
    }

    // Validate team name
    if (!teamName) {
      console.log('Team name is missing');
      return res.status(400).json({
        success: false,
        message: 'Team name is required'
      });
    }

    // Find league by ID
    const league = await League.findById(id);
    console.log('League found:', league ? 'yes' : 'no');

    // Check if league exists
    if (!league) {
      console.log('League not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    // Check if team with same name already exists in the league
    const teamExists = league.teams.some(team => team.name.toLowerCase() === teamName.toLowerCase());
    console.log('Team exists check:', teamExists);
    
    if (teamExists) {
      console.log('Team already exists with name:', teamName);
      return res.status(400).json({
        success: false,
        message: 'Team with this name already exists in the league'
      });
    }

    // Create new team object
    const team = {
      name: teamName,
      logo,
      played: parseInt(played) || 0,
      won: parseInt(won) || 0,
      drawn: parseInt(drawn) || 0,
      lost: parseInt(lost) || 0,
      goalsFor: parseInt(goalsFor) || 0,
      goalsAgainst: parseInt(goalsAgainst) || 0,
      points: parseInt(points) || 0
    };
    console.log('New team object created:', team);

    // Add team to league
    league.teams.push(team);
    console.log('Team added to league.teams array, new length:', league.teams.length);

    // Save league
    await league.save();
    console.log('League saved successfully');

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
      console.log('Leagues cache rebuilt successfully');
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Return success response
    console.log('Sending success response');
    res.status(200).json({
      success: true,
      message: 'Team added successfully',
      team
    });
  } catch (error) {
    console.error('Error adding team to league:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding team to league: ' + error.message
    });
  }
};

/**
 * Update team in league
 */
exports.updateTeam = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id, teamId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid league ID'
      });
    }

    // Extract team details from request body
    const { name, logo, played, won, drawn, lost, goalsFor, goalsAgainst, points } = req.body;

    // Validate team name
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Team name is required'
      });
    }

    // Find league by ID
    const league = await League.findById(id);

    // Check if league exists
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    // Check if team exists in the league
    if (!league.teams[teamId]) {
      return res.status(404).json({
        success: false,
        message: 'Team not found in this league'
      });
    }

    // Check if another team with the same name exists in the league
    const nameExists = league.teams.some((team, index) => 
      team.name.toLowerCase() === name.toLowerCase() && index.toString() !== teamId);
    
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Another team with this name already exists in the league'
      });
    }

    // Update team
    league.teams[teamId] = {
      ...league.teams[teamId],
      name,
      logo,
      played: parseInt(played) || 0,
      won: parseInt(won) || 0,
      drawn: parseInt(drawn) || 0,
      lost: parseInt(lost) || 0,
      goalsFor: parseInt(goalsFor) || 0,
      goalsAgainst: parseInt(goalsAgainst) || 0,
      points: parseInt(points) || 0
    };

    // Save league
    await league.save();

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      team: league.teams[teamId]
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating team: ' + error.message
    });
  }
};

/**
 * Remove team from league
 */
exports.removeTeamFromLeague = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id, teamId } = req.params;

    // Validate league ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid league ID'
      });
    }

    // Find league by ID
    const league = await League.findById(id);

    // Check if league exists
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    // Check if team index is valid
    if (!league.teams[teamId]) {
      return res.status(404).json({
        success: false,
        message: 'Team not found in this league'
      });
    }

    // Remove team from league
    league.teams.splice(teamId, 1);

    // Save league
    await league.save();

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Team removed successfully'
    });
  } catch (error) {
    console.error('Error removing team from league:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing team from league: ' + error.message
    });
  }
};

/**
 * Calculate standings for league
 */
exports.calculateStandings = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;

    // Validate league ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid league ID'
      });
    }

    // Find league by ID
    const league = await League.findById(id);

    // Check if league exists
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    // Calculate standings using the model method
    league.calculateStandings();

    // Save league with updated standings
    await league.save();

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Standings calculated successfully',
      teams: league.teams
    });
  } catch (error) {
    console.error('Error calculating standings:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating standings: ' + error.message
    });
  }
};

/**
 * Add multiple teams to a league at once
 */
exports.bulkAddTeamsToLeague = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid league ID'
      });
    }

    // Extract teams array from request body
    const { teams } = req.body;

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No teams provided or invalid format'
      });
    }

    // Find league by ID
    const league = await League.findById(id);

    // Check if league exists
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    // Process each team
    const existingTeamNames = league.teams.map(team => team.name.toLowerCase());
    const addedTeams = [];
    const skippedTeams = [];

    for (const team of teams) {
      // Extract proper name if it's an object
      let teamName = team.name;
      if (typeof team.name === 'object' && team.name !== null && team.name.name) {
        teamName = team.name.name;
      } else if (typeof team.name === 'string' && (team.name.includes('{') || team.name.includes('name:'))) {
        // Try to extract name from string representation of object
        try {
          if (team.name.startsWith('{') && team.name.endsWith('}')) {
            const nameObj = JSON.parse(team.name);
            if (nameObj && nameObj.name) {
              teamName = nameObj.name;
            }
          } else {
            // Try regex extraction
            const nameMatch = team.name.match(/name['"]?\s*:\s*['"]([^'"]+)['"]/i);
            if (nameMatch && nameMatch[1]) {
              teamName = nameMatch[1].trim();
            }
          }
        } catch (e) {
          console.error('Error parsing team name string:', e);
        }
      }
      
      // Validate team name
      if (!teamName) {
        skippedTeams.push({ ...team, reason: 'Missing team name' });
        continue;
      }

      // Check if team with same name already exists
      if (existingTeamNames.includes(teamName.toLowerCase())) {
        skippedTeams.push({ ...team, reason: 'Team with this name already exists' });
        continue;
      }

      // Add to existing team names to prevent duplicates in bulk import
      existingTeamNames.push(teamName.toLowerCase());

      // Create new team object
      const newTeam = {
        name: teamName,
        logo: team.logo || '',
        played: parseInt(team.played) || 0,
        won: parseInt(team.won) || 0,
        drawn: parseInt(team.drawn) || 0,
        lost: parseInt(team.lost) || 0,
        goalsFor: parseInt(team.goalsFor) || 0,
        goalsAgainst: parseInt(team.goalsAgainst) || 0,
        points: parseInt(team.points) || 0
      };

      // Add team to league
      league.teams.push(newTeam);
      addedTeams.push(newTeam);
    }

    if (addedTeams.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No teams were added. All teams were invalid or already exist.',
        skippedTeams
      });
    }

    // Save league
    await league.save();

    // Rebuild cache if using Redis
    try {
      await rebuildLeaguesCache();
    } catch (cacheError) {
      console.error('Error rebuilding cache:', cacheError);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: `${addedTeams.length} teams added successfully${skippedTeams.length > 0 ? `, ${skippedTeams.length} teams skipped` : ''}`,
      addedTeams,
      skippedTeams
    });
  } catch (error) {
    console.error('Error bulk adding teams to league:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding teams to league: ' + error.message
    });
  }
}; 