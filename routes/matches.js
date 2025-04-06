const express = require('express');
const router = express.Router();
const { 
  getAllMatches,
  getMatchesByCategory,
  getLiveMatches,
  getUpcomingMatches,
  getCompletedMatches,
  createMatch,
  getMatchById,
  updateMatch,
  updateScore,
  updateStatus,
  addCommentary,
  deleteMatch,
  addUpdate,
  removeUpdate,
  getWebUpdates
} = require('../controllers/matchController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getAllMatches);
router.get('/category/:category', getMatchesByCategory);
router.get('/live', getLiveMatches);
router.get('/upcoming', getUpcomingMatches);
router.get('/completed', getCompletedMatches);
router.get('/:id', getMatchById);
router.get('/:id/web-updates', getWebUpdates);

// Protected routes (admin only)
router.post('/', protect, authorize('admin'), createMatch);
router.put('/:id', protect, authorize('admin'), updateMatch);
router.patch('/:id/score', protect, authorize('admin'), updateScore);
router.patch('/:id/status', protect, authorize('admin'), updateStatus);
router.post('/:id/commentary', protect, authorize('admin'), addCommentary);
router.delete('/:id', protect, authorize('admin'), deleteMatch);

// New routes for match updates
router.post('/:id/update', protect, authorize('admin'), addUpdate);
router.delete('/:id/update/:updateId', protect, authorize('admin'), removeUpdate);

module.exports = router; 