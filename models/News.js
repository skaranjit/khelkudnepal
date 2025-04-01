const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NewsSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Please add content'],
  },
  summary: {
    type: String,
    required: [true, 'Please add a summary'],
    maxlength: [500, 'Summary cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please specify a category'],
    enum: ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Tennis', 'Athletics', 'Olympics', 'Other'],
    default: 'Other'
  },
  source: {
    type: String,
    default: 'Khelkud Nepal'
  },
  author: {
    type: String,
    default: 'Khelkud Nepal'
  },
  url: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: '/img/placeholder.jpg'
  },
  // Support for multiple images
  images: {
    type: Array,
    default: []
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  tags: {
    type: [String],
    default: []
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Object,
    default: {}
  },
  location: {
    country: {
      type: String,
      default: 'Nepal'
    },
    city: String,
    venue: String
  },
  // Rich media fields
  videos: [{
    url: String,
    title: String,
    thumbnail: String,
    provider: String
  }],
  // Enhanced social sharing
  socialData: {
    shareCount: {
      type: Number,
      default: 0
    },
    likeCount: {
      type: Number,
      default: 0
    },
    commentCount: {
      type: Number,
      default: 0
    }
  },
  // Enhanced match details
  matchDetails: {
    teams: [{
      name: String,
      score: String,
      logo: String
    }],
    date: Date,
    venue: String,
    competition: String,
    status: {
      type: String,
      enum: ['Upcoming', 'Live', 'Completed', 'Postponed', 'Cancelled'],
      default: 'Completed'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to ensure images array contains imageUrl if empty
NewsSchema.pre('save', function(next) {
  if (this.imageUrl && (!this.images || this.images.length === 0)) {
    this.images = [{
      url: this.imageUrl,
      alt: this.title,
      caption: ''
    }];
  }
  
  // Update the updatedAt field
  this.updatedAt = new Date();
  
  // If metadata contains match statistics, try to update matchDetails
  if (this.metadata && this.metadata.matchStatistics && this.metadata.matchStatistics.scores) {
    const { scores } = this.metadata.matchStatistics;
    
    // Only update if matchDetails doesn't already have teams data
    if (!this.matchDetails || !this.matchDetails.teams || this.matchDetails.teams.length === 0) {
      this.matchDetails = this.matchDetails || {};
      this.matchDetails.teams = [
        { name: scores.team1?.name, score: scores.team1?.score },
        { name: scores.team2?.name, score: scores.team2?.score }
      ];
    }
    
    // Update match date if available
    if (this.metadata.eventDate && !this.matchDetails.date) {
      try {
        this.matchDetails.date = new Date(this.metadata.eventDate);
      } catch (err) {
        // If parsing fails, don't update
      }
    }
    
    // Update venue if available
    if (this.metadata.eventLocation && !this.matchDetails.venue) {
      this.matchDetails.venue = this.metadata.eventLocation;
    }
  }
  
  next();
});

// Method to increment view count
NewsSchema.methods.incrementViewCount = function() {
  this.viewCount = this.viewCount + 1;
  return this.save();
};

// Method to increment share count
NewsSchema.methods.incrementShareCount = function() {
  if (!this.socialData) {
    this.socialData = { shareCount: 0, likeCount: 0, commentCount: 0 };
  }
  this.socialData.shareCount = (this.socialData.shareCount || 0) + 1;
  return this.save();
};

// Virtual for formatted date
NewsSchema.virtual('formattedDate').get(function() {
  return this.publishedAt.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

// Virtual for reading time
NewsSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Index for better search performance
NewsSchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('News', NewsSchema); 