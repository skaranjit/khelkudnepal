const Comment = require('../models/Comment');
const News = require('../models/News');

// Get comments for a news article
exports.getComments = async (req, res) => {
  console.log(`[COMMENTS API] Request for comments on news ID: ${req.params.newsId}`);
  
  try {
    const { newsId } = req.params;
    
    // Simple validation to prevent MongoDB errors
    if (!newsId || newsId.length !== 24) {
      console.log('[COMMENTS API] Invalid news ID format, returning empty array');
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    // Find comments for this news article
    const comments = await Comment.find({ news: newsId })
      .sort({ createdAt: -1 })
      .populate('user', 'username name')
      .exec();
    
    console.log(`[COMMENTS API] Found ${comments.length} comments for news ID: ${newsId}`);
    
    // Send the response
    return res.status(200).json({
      success: true,
      count: comments.length,
      data: comments || []
    });
  } catch (error) {
    console.error('[COMMENTS API] Error fetching comments:', error);
    
    // Always return a successful response with empty data
    return res.status(200).json({
      success: true,
      count: 0,
      data: [],
      error: error.message || 'Unknown error'
    });
  }
};

// Add a comment to a news article
exports.addComment = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { content } = req.body;
    
    console.log(`Adding comment to news ID: ${newsId}, User: ${req.user.id}`);
    
    // Basic validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }
    
    // Create comment without checking if news exists first
    const comment = new Comment({
      content: content.trim(),
      news: newsId,
      user: req.user.id,
      createdAt: new Date()
    });
    
    await comment.save();
    
    // Populate user data for response
    await comment.populate('user', 'username name');
    
    console.log(`Comment added successfully to news ID: ${newsId}`);
    
    return res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to add comment'
    });
  }
};

// Delete a comment (can be done by comment owner or admin)
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    
    // Find comment
    const comment = await Comment.findById(commentId);
    
    // Check if comment exists
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    // Check if user is comment owner or admin
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }
    
    // Delete comment (using deleteOne instead of deprecated remove)
    await Comment.deleteOne({ _id: commentId });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}; 