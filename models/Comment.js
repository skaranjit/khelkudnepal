const mongoose = require('mongoose');

// Define the Comment schema
const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  news: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'News',
    required: [true, 'News article is required']
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

// Add indexes for faster queries
commentSchema.index({ news: 1 });
commentSchema.index({ user: 1 });
commentSchema.index({ createdAt: -1 });

// Create and export the model
const Comment = mongoose.model('Comment', commentSchema);

// Test that the model was created successfully
console.log('Comment model initialized successfully');

module.exports = Comment; 