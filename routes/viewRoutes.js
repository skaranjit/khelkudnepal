// Import required modules
const express = require('express');
const router = express.Router();
const News = require('../models/News'); // Adjust path if necessary for your project structure
const Settings = require('../models/Settings'); // Adjust path if necessary for your project structure

// Import the league controller
const { 
  getLeaguesPage, 
  getLeagueDetailsPage, 
  getTeamDetailsPage 
} = require('../controllers/leagueController');

// Add middleware to pass user data to all views
router.use((req, res, next) => {
  // Make user session data available to all views
  res.locals.user = req.session.user || null;
  next();
});

// Login page
router.get('/login', (req, res) => {
  res.render('user/login', {
    title: 'Login',
    user: req.session.user
  });
});

// Register page
router.get('/register', (req, res) => {
  res.render('user/register', {
    title: 'Register',
    user: req.session.user
  });
});

// Category page
router.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    
    console.log(`Rendering category page for: ${formattedCategory}`);
    
    // Create a case-insensitive regex for flexible matching
    const categoryRegex = new RegExp('^' + formattedCategory + '$', 'i');
    let newsItems = await News.find({ category: categoryRegex })
      .sort({ publishedAt: -1 })
      .limit(20);
    
    // If no exact matches, try partial matching
    if (newsItems.length === 0) {
      console.log('No exact matches, trying partial match');
      newsItems = await News.find({
        category: { $regex: formattedCategory, $options: 'i' }
      })
      .sort({ publishedAt: -1 })
      .limit(20);
    }
    
    res.render('category', {
      title: `${formattedCategory} News`,
      category: formattedCategory,
      news: newsItems,
      user: req.session.user,
      activeNav: 'category'
    });
  } catch (error) {
    console.error('Error getting category page:', error);
    res.render('error', {
      title: 'Error',
      message: 'There was an error loading this category.',
      status: 500,
      user: req.session.user
    });
  }
});

// All categories page
router.get('/categories', async (req, res) => {
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
    console.log('Available categories:', categories);
    
    // Get sample news for each category
    const categoryNews = {};
    
    for (const category of categories) {
      const items = await News.find({ category })
        .sort({ publishedAt: -1 })
        .limit(4);
      
      categoryNews[category] = items;
    }
    
    res.render('categories', {
      title: 'All Categories',
      categories,
      categoryNews,
      user: req.session.user,
      activeNav: 'category'
    });
  } catch (error) {
    console.error('Error getting categories page:', error);
    res.render('error', {
      title: 'Error',
      message: 'There was an error loading categories.',
      status: 500,
      user: req.session.user
    });
  }
});

// Show a single news article
router.get('/news/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if the ID is a valid MongoDB ObjectId (24 hex characters)
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.render('error', {
        title: 'Invalid Article ID',
        message: 'The provided article ID is not valid.',
        status: 400,
        user: req.session.user
      });
    }
    
    const news = await News.findById(id);
    
    if (!news) {
      return res.render('error', {
        title: 'Article Not Found',
        message: 'The article you are looking for does not exist or may have been removed.',
        status: 404,
        user: req.session.user
      });
    }
    
    // Fix category if it's using an invalid enum value
    if (news.category === 'Other_sports') {
      news.category = 'Other';
      await news.save();
    }
    
    // Increment view count
    news.views = (news.views || 0) + 1;
    await news.save();
    
    // Process the content for better display
    if (news.content) {
      // Ensure content is properly formatted with paragraphs
      news.content = news.content.replace(/\n{3,}/g, '\n\n');
    }
    
    // Get news counts by category for the Popular Categories section
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other_sports'];
    const categoryCounts = {};
    
    for (const category of categories) {
      // Use case-insensitive regex to match both capitalized and lowercase categories
      const regex = new RegExp(`^${category}$`, 'i');
      categoryCounts[category] = await News.countDocuments({ category: regex });
    }
    
    res.render('news/show', {
      title: news.title,
      news,
      categoryCounts,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error getting news article:', error);
    
    res.render('error', {
      title: 'Error',
      message: 'There was an error loading this article.',
      status: 500,
      user: req.session.user
    });
  }
});

// Profile page
router.get('/profile', (req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    return res.redirect('/login?redirect=/profile');
  }
  
  res.render('user/profile', {
    title: 'My Profile',
    user: req.session.user,
    activeNav: 'profile'
  });
});

// Live Scores page
router.get('/live-scores', async (req, res) => {
  try {
    // Get settings for site configuration
    const settings = await Settings.findOne();
    
    res.render('live-scores', {
      title: 'Live Scores',
      user: req.session.user || null,
      settings,
      activeNav: 'live-scores'
    });
  } catch (error) {
    console.error('Error loading Live Scores page:', error);
    res.status(500).render('error', { 
      message: 'There was an error loading the Live Scores page. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Leagues routes
router.get('/leagues', getLeaguesPage);
router.get('/leagues/:id', getLeagueDetailsPage);
router.get('/leagues/:leagueId/teams/:teamName', getTeamDetailsPage);

// Export the router
module.exports = router; 