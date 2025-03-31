const Comment = require('../models/Comment');
const News = require('../models/News');

// Get comments for a news article
exports.getComments = async (req, res) => {
  try {
    const { newsId } = req.params;
    
    const comments = await Comment.find({ news: newsId })
      .sort({ createdAt: -1 })
      .populate('user', 'username name')
      .exec();
    
    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Add a comment to a news article
exports.addComment = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { content } = req.body;
    
    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }
    
    // Check if news article exists
    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }
    
    // Create comment
    const comment = await Comment.create({
      content,
      news: newsId,
      user: req.user.id
    });
    
    // Populate user data
    await comment.populate('user', 'username name');
    
    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
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