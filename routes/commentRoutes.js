const express = require('express');
const router = express.Router();
const { getComments, addComment, deleteComment } = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

// Get comments for news article - no auth required
router.get('/news/:newsId', getComments);

// Add comment to news article - auth required
router.post('/news/:newsId', protect, addComment);

// Delete comment - auth required (owner or admin)
router.delete('/:commentId', protect, deleteComment);

module.exports = router; 