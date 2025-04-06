const mongoose = require('mongoose');

// Define a team schema to standardize team data
const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String,
    default: ''
  }
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  // Match details
  homeTeam: {
    type: TeamSchema,
    required: true
  },
  awayTeam: {
    type: TeamSchema,
    required: true
  },
  homeScore: {
    type: Number,
    default: 0
  },
  awayScore: {
    type: Number,
    default: 0
  },
  // Score object for more detailed scores
  score: {
    home: {
      type: Number,
      default: 0
    },
    away: {
      type: Number,
      default: 0
    },
    home_detail: {
      type: String,
      trim: true
    },
    away_detail: {
      type: String,
      trim: true
    },
    home_overs: {
      type: String,
      trim: true
    },
    away_overs: {
      type: String,
      trim: true
    }
  },
  startTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: 'Invalid start time date format'
    }
  },
  endTime: {
    type: Date,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (v instanceof Date && !isNaN(v));
      },
      message: 'Invalid end time date format'
    }
  },
  category: {
    type: String,
    required: true,
    enum: ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Tennis', 'Athletics', 'Olympics', 'Other', 
      'cricket', 'football', 'basketball', 'volleyball', 'tennis', 'athletics', 'olympics', 'other',
      'badminton', 'Badminton', 'Table Tennis', 'table tennis', 'Golf', 'golf', 'Swimming', 'swimming',
      'Other_sports', 'other_sports'],
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
    home: {
      runs: {
        type: Number,
        default: 0
      },
      wickets: {
        type: Number,
        default: 0
      },
      overs: {
        type: String,
        trim: true
      },
      runRate: {
        type: Number,
        default: 0
      },
      extras: {
        type: Number,
        default: 0
      },
      fours: {
        type: Number,
        default: 0
      },
      sixes: {
        type: Number,
        default: 0
      }
    },
    away: {
      runs: {
        type: Number,
        default: 0
      },
      wickets: {
        type: Number,
        default: 0
      },
      overs: {
        type: String,
        trim: true
      },
      runRate: {
        type: Number,
        default: 0
      },
      extras: {
        type: Number,
        default: 0
      },
      fours: {
        type: Number,
        default: 0
      },
      sixes: {
        type: Number,
        default: 0
      }
    }
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
  },
  // Cricket specific
  format: {
    type: String,
    trim: true,
    enum: ['Test', 'ODI', 'T20', 'T10', 'Other']
  },
  overs: {
    type: Number
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Make sure team names are always properly formatted when serialized to JSON
      if (ret.homeTeam && typeof ret.homeTeam === 'object' && !ret.homeTeam.name) {
        ret.homeTeam = { name: 'Unknown Team' };
      }
      
      if (ret.awayTeam && typeof ret.awayTeam === 'object' && !ret.awayTeam.name) {
        ret.awayTeam = { name: 'Unknown Team' };
      }
      
      return ret;
    }
  }
});

// Create indexes for faster queries
MatchSchema.index({ category: 1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ startTime: -1 });
MatchSchema.index({ 'venue.location': 1 });

// Pre-save middleware to ensure team objects are properly structured
MatchSchema.pre('save', function(next) {
  // Ensure homeTeam has a name property
  if (this.homeTeam) {
    if (typeof this.homeTeam === 'string') {
      this.homeTeam = { name: this.homeTeam };
    } else if (typeof this.homeTeam === 'object' && !this.homeTeam.name) {
      this.homeTeam.name = 'Unknown Team';
    }
  } else {
    this.homeTeam = { name: 'Unknown Team' };
  }
  
  // Ensure awayTeam has a name property
  if (this.awayTeam) {
    if (typeof this.awayTeam === 'string') {
      this.awayTeam = { name: this.awayTeam };
    } else if (typeof this.awayTeam === 'object' && !this.awayTeam.name) {
      this.awayTeam.name = 'Unknown Team';
    }
  } else {
    this.awayTeam = { name: 'Unknown Team' };
  }
  
  next();
});

module.exports = mongoose.model('Match', MatchSchema); 