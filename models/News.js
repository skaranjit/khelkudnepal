const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Please add content'],
    minlength: [10, 'Content must be at least 10 characters']
  },
  summary: {
    type: String,
    required: [true, 'Please add a summary'],
    trim: true,
    maxlength: [500, 'Summary cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please specify a category'],
    enum: ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Tennis', 'Athletics', 'Olympics', 'Other'],
    default: 'Other'
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'Khelkud Nepal'
  },
  author: {
    type: String,
    default: 'Staff Reporter'
  },
  url: {
    type: String,
    validate: {
      validator: function(value) {
        // Allow URLs starting with http:// or https://
        const absoluteUrlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
        // Allow relative URLs starting with a slash
        const relativeUrlPattern = /^\/.*/;
        
        return absoluteUrlPattern.test(value) || relativeUrlPattern.test(value);
      },
      message: 'Please use a valid URL (absolute with HTTP/HTTPS or relative starting with /)'
    }
  },
  imageUrl: {
    type: String,
    default: '/images/placeholder.jpg'
  },
  images: {
    type: [String],
    default: []
  },
  imageAttribution: {
    type: String,
    default: ''
  },
  tags: {
    type: [String],
    default: []
  },
  location: {
    country: {
      type: String,
      default: 'Nepal'
    },
    city: String
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
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

// Method to increment view count
NewsSchema.methods.incrementViewCount = function() {
  this.views += 1;
  return this.save();
};

// Add a pre-save hook to copy the main imageUrl to images array if empty
NewsSchema.pre('save', function(next) {
  // If images array is empty and we have an imageUrl, add it to the images array
  if (this.images.length === 0 && this.imageUrl && this.imageUrl !== '/images/placeholder.jpg') {
    this.images.push(this.imageUrl);
  }
  
  // Update the timestamps
  this.updatedAt = Date.now();
  
  next();
});

module.exports = mongoose.model('News', NewsSchema); 