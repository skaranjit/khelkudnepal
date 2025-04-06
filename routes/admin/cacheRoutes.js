const express = require('express');
const router = express.Router();
const cacheController = require('../../controllers/admin/cacheController');
const { protect, authorize } = require('../../middleware/auth');

// All routes need admin authorization
router.use(protect, authorize('admin'));

// Get cache status
router.get('/status', cacheController.getCacheStatus);

// Clear all cache
router.post('/clear/all', cacheController.clearAllCache);

// Clear specific caches
router.post('/clear/news', cacheController.clearNewsCache);
router.post('/clear/leagues', cacheController.clearLeaguesCache);
router.post('/clear/users', cacheController.clearUsersCache);
router.post('/clear/matches', cacheController.clearMatchesCache);

// Refresh caches from database
router.post('/refresh/news', cacheController.refreshNewsCache);
router.post('/refresh/leagues', cacheController.refreshLeaguesCache);
router.post('/refresh/matches', cacheController.refreshMatchesCache);

// Clear database collections
router.post('/clear-db', cacheController.clearDatabase);

module.exports = router; 