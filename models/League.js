const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a team name']
  },
  logo: {
    type: String,
    default: '/images/default-team-logo.png'
  },
  played: {
    type: Number,
    default: 0
  },
  won: {
    type: Number,
    default: 0
  },
  drawn: {
    type: Number,
    default: 0
  },
  lost: {
    type: Number,
    default: 0
  },
  goalsFor: {
    type: Number,
    default: 0
  },
  goalsAgainst: {
    type: Number,
    default: 0
  },
  points: {
    type: Number,
    default: 0
  },
  description: {
    type: String
  },
  location: {
    type: String
  },
  website: {
    type: String
  },
  founded: {
    type: Number
  }
});

// Schema for league updates
const UpdateSchema = new mongoose.Schema({
  title: {
    type: String
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String
  },
  important: {
    type: Boolean,
    default: false
  }
});

const LeagueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a league name'],
    unique: true,
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: ['cricket', 'football', 'basketball', 'volleyball', 'othersports']
  },
  logo: {
    type: String,
    default: '/images/default-league-logo.png'
  },
  season: {
    type: String,
    required: [true, 'Please add a season'],
    trim: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  teams: [TeamSchema],
  updates: [UpdateSchema],
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed'],
    default: 'upcoming'
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Calculate points method (this can be used for different sports with different scoring systems)
LeagueSchema.methods.calculateStandings = function() {
  // Sort teams based on points, then goal difference, then goals scored
  this.teams.sort((a, b) => {
    if (a.points !== b.points) {
      return b.points - a.points; // Higher points first
    }
    
    const aGoalDiff = a.goalsFor - a.goalsAgainst;
    const bGoalDiff = b.goalsFor - b.goalsAgainst;
    
    if (aGoalDiff !== bGoalDiff) {
      return bGoalDiff - aGoalDiff; // Higher goal difference first
    }
    
    return b.goalsFor - a.goalsFor; // Higher goals scored first
  });
  
  return this.teams;
};

module.exports = mongoose.model('League', LeagueSchema); 