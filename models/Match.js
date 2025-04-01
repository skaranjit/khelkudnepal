const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  // Match details
  homeTeam: {
    type: String,
    required: true,
    trim: true
  },
  awayTeam: {
    type: String,
    required: true,
    trim: true
  },
  homeScore: {
    type: Number,
    default: 0
  },
  awayScore: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  category: {
    type: String,
    required: true,
    enum: ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'live', 'completed', 'postponed', 'cancelled'],
    default: 'scheduled'
  },
  venue: {
    name: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    }
  },
  
  // Additional match information
  tournament: {
    type: String,
    trim: true
  },
  round: {
    type: String,
    trim: true
  },
  
  // Cricket specific
  innings: [{
    team: String,
    runs: Number,
    wickets: Number,
    overs: Number
  }],
  
  // Football specific
  goals: [{
    team: String, // 'home' or 'away'
    player: String,
    minute: Number
  }],
  
  // Basketball specific
  quarters: [{
    quarter: Number,
    homeScore: Number,
    awayScore: Number
  }],

  // Volleyball specific
  sets: [{
    homeScore: Number,
    awayScore: Number
  }],
  
  // Match stats for football
  stats: {
    homePossession: Number,
    awayPossession: Number,
    homeShots: Number,
    awayShots: Number,
    homeShotsOnTarget: Number,
    awayShotsOnTarget: Number,
    homeCorners: Number,
    awayCorners: Number,
    homeFouls: Number,
    awayFouls: Number,
    homeYellowCards: Number,
    awayYellowCards: Number,
    homeRedCards: Number,
    awayRedCards: Number
  },
  
  // Live commentary
  commentary: [{
    time: {
      type: Date,
      default: Date.now
    },
    text: {
      type: String,
      required: true
    },
    important: {
      type: Boolean,
      default: false
    }
  }],
  
  // Latest match updates
  updates: [
    {
      time: {
        type: Date,
        default: Date.now
      },
      text: {
        type: String,
        required: true
      },
      important: {
        type: Boolean,
        default: false
      },
      source: {
        type: String,
        default: 'Manual'
      }
    }
  ],
  
  // Additional metadata
  highlights: [String],
  imageUrl: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
MatchSchema.index({ category: 1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ startTime: -1 });
MatchSchema.index({ 'venue.location': 1 });

module.exports = mongoose.model('Match', MatchSchema); 