const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const { protect, authorize } = require('../middleware/auth');
const locationMiddleware = require('../middleware/location');
const News = require('../models/News');
const mongoose = require('mongoose');

// Apply location middleware to all routes in this router
router.use(locationMiddleware);

// Public routes
router.get('/', newsController.getAllNews);
router.get('/search', newsController.searchNews);
router.get('/scrape', newsController.scrapeGoogleNews);
router.get('/categories', newsController.getCategories);

// Debug endpoint to check MongoDB connection and data
router.get('/debug', async (req, res) => {
    try {
        // Check connection status
        const isConnected = mongoose.connection.readyState === 1;
        
        // Try to get counts
        const totalCount = await News.countDocuments();
        const featuredCount = await News.countDocuments({ isFeatured: true });
        
        // Get a sample of each type
        const latestSample = await News.find().sort({ publishedAt: -1 }).limit(1);
        const featuredSample = await News.find({ isFeatured: true }).limit(1);
        
        res.json({
            success: true,
            dbStatus: {
                connected: isConnected,
                connectionState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                name: mongoose.connection.name
            },
            counts: {
                total: totalCount,
                featured: featuredCount
            },
            samples: {
                latest: latestSample.length > 0 ? {
                    id: latestSample[0]._id,
                    title: latestSample[0].title,
                    publishedAt: latestSample[0].publishedAt
                } : null,
                featured: featuredSample.length > 0 ? {
                    id: featuredSample[0]._id,
                    title: featuredSample[0].title,
                    isFeatured: featuredSample[0].isFeatured
                } : null
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in debug endpoint',
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

// Refresh news from web sources (admin only)
router.post('/refresh', protect, authorize('admin'), newsController.refreshNewsFromWeb);

// Featured news
router.get('/featured', async (req, res) => {
    try {
        const featured = await News.find({ isFeatured: true })
            .sort({ publishedAt: -1 })
            .limit(5);
        
        res.json({
            success: true,
            data: featured
        });
    } catch (error) {
        console.error('Error fetching featured news:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching featured news'
        });
    }
});

// Latest news
router.get('/latest', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;
        
        const news = await News.find()
            .sort({ publishedAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const total = await News.countDocuments();
        const hasMore = total > skip + news.length;
        
        res.json({
            success: true,
            data: news,
            hasMore
        });
    } catch (error) {
        console.error('Error fetching latest news:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching latest news'
        });
    }
});

// Local news
router.get('/local', async (req, res) => {
    try {
        const localNews = await News.find({ category: { $in: ['Local', 'Football', 'Cricket'] } })
            .sort({ publishedAt: -1 })
            .limit(5);
        
        res.json({
            success: true,
            data: localNews
        });
    } catch (error) {
        console.error('Error fetching local news:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching local news'
        });
    }
});

// Category specific news
router.get('/category/:category', async (req, res) => {
    try {
        const category = req.params.category;
        console.log('Received category request for:', category);
        
        if (!category) {
            console.log('No category provided');
            return res.status(400).json({
                success: false,
                message: 'Category parameter is required'
            });
        }
        
        console.log(`Finding news with category: "${category}"`);
        
        // Create a case-insensitive regex for flexible matching
        const categoryRegex = new RegExp('^' + category + '$', 'i');
        const news = await News.find({ 
                category: categoryRegex 
            })
            .sort({ publishedAt: -1 })
            .limit(10);
        
        console.log(`Found ${news.length} items for category "${category}"`);
        
        if (news.length === 0) {
            // Try to find with partial match if exact match returns no results
            console.log('No exact matches, trying partial match');
            const partialMatchNews = await News.find({
                    category: { $regex: category, $options: 'i' }
                })
                .sort({ publishedAt: -1 })
                .limit(10);
                
            console.log(`Found ${partialMatchNews.length} items with partial match for "${category}"`);
            
            return res.json({
                success: true,
                data: partialMatchNews
            });
        }
        
        res.json({
            success: true,
            data: news
        });
    } catch (error) {
        console.error(`Error fetching news for category ${req.params.category}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error fetching category news'
        });
    }
});

// Related news by ID
router.get('/related/:id', async (req, res) => {
    try {
        const newsId = req.params.id;
        
        // Find the original news article first to get its category
        const originalNews = await News.findById(newsId);
        
        if (!originalNews) {
            return res.status(404).json({
                success: false,
                message: 'News article not found'
            });
        }
        
        // Find related news with the same category, excluding the original article
        const relatedNews = await News.find({
                _id: { $ne: newsId },
                category: originalNews.category
            })
            .sort({ publishedAt: -1 })
            .limit(5);
        
        res.json({
            success: true,
            data: relatedNews
        });
    } catch (error) {
        console.error(`Error fetching related news for ID ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error fetching related news'
        });
    }
});

// Single news item by ID
router.get('/:id', newsController.getNewsById);

// Protected routes (admin only)
router.post('/', protect, authorize('admin'), newsController.createNews);
router.post('/import', protect, authorize('admin'), newsController.importScrapedNews);
router.put('/:id', protect, authorize('admin'), newsController.updateNews);
router.delete('/:id', protect, authorize('admin'), newsController.deleteNews);

// Clear database and refresh with web data (admin only)
router.post('/clear-and-refresh', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('Admin requested to clear database and fetch fresh news from web');
    
    // Clear all existing news articles
    await News.deleteMany({});
    console.log('Cleared all existing news articles');
    
    // Call seedSampleNews to repopulate with fresh data
    await newsController.seedSampleNews();
    
    // Count new articles
    const count = await News.countDocuments();
    
    return res.status(200).json({
      success: true,
      message: `Successfully cleared database and added ${count} fresh news articles from web sources`,
      count: count
    });
  } catch (error) {
    console.error('Error clearing and refreshing news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing and refreshing news from web',
      error: error.message
    });
  }
});

module.exports = router; 