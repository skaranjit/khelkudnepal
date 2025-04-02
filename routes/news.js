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

// Category news
router.get('/category/:category', async (req, res) => {
    console.log(`[API] Fetching news for category: ${req.params.category}`);
    try {
        const { category } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        
        // Find news for this category
        const query = { category: category };
        
        // Get count for pagination
        const total = await News.countDocuments(query);
        
        // Get news articles
        const news = await News.find(query)
            .sort({ publishedAt: -1 })
            .skip(skip)
            .limit(limit);
        
        console.log(`[API] Found ${news.length} articles for category: ${category}`);
        
        // Calculate pagination data
        const hasMore = total > skip + news.length;
        const totalPages = Math.ceil(total / limit);
        
        return res.status(200).json({
            success: true,
            data: news,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages,
                hasMore
            }
        });
    } catch (error) {
        console.error(`[API] Error fetching news for category ${req.params.category}:`, error);
        return res.status(200).json({
            success: false,
            message: 'Error fetching category news',
            data: []
        });
    }
});

// Single news item by ID
router.get('/:id', newsController.getNewsById);

// Protected routes (admin only)
router.post('/', protect, authorize('admin'), newsController.createNews);
router.post('/import', protect, authorize('admin'), async (req, res) => {
  try {
    const { articles } = req.body;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No articles provided for import'
      });
    }
    
    let importedCount = 0;
    const errors = [];
    
    // Process each article
    for (const article of articles) {
      try {
        // Check if article already exists by URL to avoid duplicates
        const existingByUrl = article.url ? await News.findOne({ url: article.url }) : null;
        const existingByTitle = await News.findOne({ title: article.title });
        
        if (existingByUrl || existingByTitle) {
          // Skip this article if it already exists
          continue;
        }
        
        // Ensure required fields
        if (!article.title || !article.content) {
          errors.push({
            title: article.title || 'Unknown',
            error: 'Missing required fields (title or content)'
          });
          continue;
        }
        
        // Prepare a summary if not available
        let summary = article.summary;
        if (!summary && article.content) {
          // Generate a summary from the content (first 150 characters)
          summary = article.content.substring(0, 150) + '...';
        } else if (!summary) {
          summary = article.title;
        }
        
        // Create the news article
        const newsItem = new News({
          title: article.title,
          content: article.content,
          summary: summary,
          imageUrl: article.imageUrl || '/img/placeholder.jpg',
          url: article.url || '',
          source: article.source || 'Web Import',
          author: article.author || 'Khelkud Nepal',
          publishedAt: article.publishedAt || new Date(),
          category: article.category || 'Other',
          tags: article.tags || [],
          isFeatured: article.isFeatured || false
        });
        
        await newsItem.save();
        importedCount++;
      } catch (err) {
        console.error('Error importing article:', err);
        errors.push({
          title: article.title || 'Unknown',
          error: err.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      imported: importedCount,
      total: articles.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error importing news articles:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while importing news',
      error: err.message
    });
  }
});
router.put('/:id', protect, authorize('admin'), newsController.updateNews);
router.delete('/:id', protect, authorize('admin'), newsController.deleteNews);

// Clear database and refresh with web data (admin only)
router.post('/clear-and-refresh', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('Admin requested to clear news database');
    
    // Clear all existing news articles
    await News.deleteMany({});
    console.log('Cleared all existing news articles');
    
    return res.status(200).json({
      success: true,
      message: `Successfully cleared news database`,
      count: 0
    });
  } catch (error) {
    console.error('Error clearing news database:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing news database',
      error: error.message
    });
  }
});

module.exports = router; 