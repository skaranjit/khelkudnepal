const News = require('../models/News');
const axios = require('axios');

// Check if database is empty and populate with web data
exports.checkAndPopulateNews = async () => {
  try {
    const count = await News.countDocuments();
    
    if (count === 0) {
      console.log('No news articles found in database. Database is empty.');
    } else {
      console.log(`Database already has ${count} articles.`);
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
    const skip = (page - 1) * limit;
    
    // Basic filtering
    const filter = {};
    
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single news article
exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    // Increment view count
    news.incrementViewCount();
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
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
    
    res.status(201).json({
      success: true,
      data: news
    });
  } catch (error) {
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
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
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
    
    await news.remove();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Search news
exports.searchNews = async (req, res) => {
  try {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please provide a search query' });
    }
    
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get categories (distinct values)
exports.getCategories = async (req, res) => {
  try {
    // Get unique categories using find instead of distinct
    const allNews = await News.find({}, 'category').lean();
    const categoriesSet = new Set();
    allNews.forEach(news => {
      if (news.category) {
        categoriesSet.add(news.category);
      }
    });
    const categories = Array.from(categoriesSet).sort();
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};