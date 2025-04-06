const News = require('../models/News');
const axios = require('axios');
const newsCache = require('../utils/newsCache');

// Check if database is empty and populate with web data
exports.checkAndPopulateNews = async () => {
  try {
    const count = await News.countDocuments();
    
    if (count === 0) {
      console.log('No news articles found in database. Database is empty.');
    } else {
      console.log(`Database already has ${count} articles.`);
      // Initialize the news cache
      await newsCache.initializeCache();
    }
  } catch (error) {
    console.error('Error checking news database:', error);
  }
};

// Get all news
exports.getAllNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // If it's not page 1, or there are filters, bypass cache
    if (page > 1 || req.query.category || (req.userLocation && req.query.local === 'true')) {
      // Basic filtering
      const filter = {};
      const skip = (page - 1) * limit;
      
      // Filter by category if provided - make it case-insensitive
      if (req.query.category) {
        // Convert first letter to uppercase for matching the enum format
        const formattedCategory = req.query.category.charAt(0).toUpperCase() + req.query.category.slice(1).toLowerCase();
        filter.category = formattedCategory;
      }
      
      // Filter by location if user has a location
      if (req.userLocation && req.query.local === 'true') {
        filter['location.country'] = req.userLocation.country;
      }
      
      // Count total documents for pagination
      const total = await News.countDocuments(filter);
      
      // Get news with pagination
      const news = await News.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit);
      
      res.status(200).json({
        success: true,
        count: news.length,
        total,
        pagination: {
          page,
          limit,
          pages: Math.ceil(total / limit)
        },
        data: news
      });
    } else {
      // Get from cache for first page without filters
      const result = await newsCache.getAllNews(limit);
      
      res.status(200).json({
        success: true,
        count: result.news.length,
        total: result.total,
        pagination: {
          page,
          limit,
          pages: Math.ceil(result.total / limit)
        },
        data: result.news,
        fromCache: result.fromCache
      });
    }
  } catch (error) {
    console.error('Error in getAllNews:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single news article
exports.getNewsById = async (req, res) => {
  try {
    const newsId = req.params.id;
    const news = await newsCache.getNewsById(newsId);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
    console.error('Error in getNewsById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create news article (admin only)
exports.createNews = async (req, res) => {
  try {
    const { title, content, summary, category, source, url, imageUrl, tags, location } = req.body;
    
    const news = await News.create({
      title,
      content,
      summary,
      category,
      source,
      url,
      imageUrl: imageUrl || '/images/placeholder.jpg',
      tags: tags || [],
      location: location || {},
      author: req.user ? req.user.username : 'Khelkud Nepal Admin'
    });
    
    // Invalidate and rebuild the relevant caches
    await newsCache.invalidateNewsCache(news.category);
    
    res.status(201).json({
      success: true,
      data: news
    });
  } catch (error) {
    console.error('Error in createNews:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update news article (admin only)
exports.updateNews = async (req, res) => {
  try {
    const { title, content, summary, category, source, url, imageUrl, tags, location, isFeatured } = req.body;
    
    let news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    const oldCategory = news.category;
    
    news = await News.findByIdAndUpdate(req.params.id, {
      title,
      content,
      summary,
      category,
      source,
      url,
      imageUrl,
      tags: tags || news.tags,
      location: location || news.location,
      isFeatured: isFeatured !== undefined ? isFeatured : news.isFeatured,
      updatedAt: Date.now()
    }, { new: true, runValidators: true });
    
    // Invalidate and rebuild the relevant caches
    await newsCache.invalidateNewsCache(oldCategory);
    if (oldCategory !== category) {
      await newsCache.invalidateNewsCache(category);
    }
    if (isFeatured !== undefined) {
      await newsCache.rebuildCache();
    }
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
    console.error('Error in updateNews:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete news article (admin only)
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    const category = news.category;
    const isFeatured = news.isFeatured;
    
    await news.remove();
    
    // Invalidate and rebuild the relevant caches
    await newsCache.invalidateNewsCache(category);
    if (isFeatured) {
      await newsCache.rebuildCache();
    }
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error in deleteNews:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Search news
exports.searchNews = async (req, res) => {
  try {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please provide a search query' });
    }
    
    // Use cache for common searches on page 1 without category
    if (page === 1 && !req.query.category) {
      const result = await newsCache.searchNews(query, limit);
      
      return res.status(200).json({
        success: true,
        count: result.news.length,
        total: result.total,
        pagination: {
          page,
          limit,
          pages: Math.ceil(result.total / limit)
        },
        data: result.news,
        fromCache: result.fromCache
      });
    }
    
    // For other cases, perform a direct database query
    const skip = (page - 1) * limit;
    
    // Build search filter
    const searchFilter = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };
    
    // Add category filter if provided
    if (req.query.category) {
      // Convert first letter to uppercase for matching the enum format
      const formattedCategory = req.query.category.charAt(0).toUpperCase() + req.query.category.slice(1).toLowerCase();
      searchFilter.category = formattedCategory;
    }
    
    // Count total documents for pagination
    const total = await News.countDocuments(searchFilter);
    
    // Execute search with pagination
    const searchResults = await News.find(searchFilter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: searchResults.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: searchResults
    });
  } catch (error) {
    console.error('Error in searchNews:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get categories (distinct values)
exports.getCategories = async (req, res) => {
  try {
    // Try to get categories from cache
    const result = await newsCache.getCategories();
    
    res.status(200).json({
      success: true,
      count: result.categories.length,
      data: result.categories,
      fromCache: result.fromCache
    });
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};