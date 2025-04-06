const redisClient = require('./redisClient');
const News = require('../models/News');

// Cache keys
const CACHE_KEYS = {
  ALL_NEWS: 'news:all',
  FEATURED_NEWS: 'news:featured',
  LATEST_NEWS: 'news:latest',
  LOCAL_NEWS: 'news:local',
  NEWS_BY_CATEGORY: 'news:category:',
  NEWS_BY_ID: 'news:id:',
  SEARCH_RESULTS: 'news:search:',
  CATEGORIES: 'news:categories'
};

// Cache duration in seconds
const CACHE_DURATION = {
  LATEST_NEWS: 15 * 60, // 15 minutes
  FEATURED_NEWS: 30 * 60, // 30 minutes
  CATEGORIES: 60 * 60, // 1 hour
  NEWS_BY_ID: 24 * 60 * 60, // 24 hours
  SEARCH_RESULTS: 5 * 60 // 5 minutes
};

/**
 * Initialize news cache
 */
const initializeCache = async () => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping news cache initialization');
    return false;
  }
  
  try {
    console.log('Initializing news cache...');
    
    // Cache featured news
    const featuredNews = await News.find({ isFeatured: true })
      .sort({ publishedAt: -1 })
      .limit(10)
      .lean();
    
    if (featuredNews.length > 0) {
      await redisClient.set(
        CACHE_KEYS.FEATURED_NEWS, 
        { news: featuredNews, total: featuredNews.length }, 
        CACHE_DURATION.FEATURED_NEWS
      );
      console.log(`Cached ${featuredNews.length} featured news articles`);
    }
    
    // Cache latest news
    const latestNews = await News.find()
      .sort({ publishedAt: -1 })
      .limit(20)
      .lean();
    
    if (latestNews.length > 0) {
      await redisClient.set(
        CACHE_KEYS.LATEST_NEWS, 
        { news: latestNews, total: await News.countDocuments() }, 
        CACHE_DURATION.LATEST_NEWS
      );
      console.log(`Cached ${latestNews.length} latest news articles`);
    }
    
    // Cache news by category
    const categories = await getDistinctCategories();
    
    if (categories && categories.length > 0) {
      // Cache the categories list
      await redisClient.set(
        CACHE_KEYS.CATEGORIES,
        { categories },
        CACHE_DURATION.CATEGORIES
      );
      
      // Cache news for each category
      for (const category of categories) {
        const categoryNews = await News.find({ category })
          .sort({ publishedAt: -1 })
          .limit(10)
          .lean();
        
        if (categoryNews.length > 0) {
          // Use case-insensitive regex for category count
          const regex = new RegExp(`^${category}$`, 'i');
          await redisClient.set(
            CACHE_KEYS.NEWS_BY_CATEGORY + category,
            { news: categoryNews, total: await News.countDocuments({ category: regex }) },
            CACHE_DURATION.LATEST_NEWS
          );
          console.log(`Cached ${categoryNews.length} news articles for category ${category}`);
        }
      }
    }
    
    console.log('News cache initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing news cache:', error);
    return false;
  }
};

/**
 * Get distinct news categories
 * @returns {Array} Array of distinct categories
 */
const getDistinctCategories = async () => {
  // Get unique categories using find instead of distinct
  const allNews = await News.find({}, 'category').lean();
  const categoriesSet = new Set();
  
  allNews.forEach(news => {
    if (news.category) {
      // Make sure we only use valid enum values from the model
      categoriesSet.add(news.category);
    }
  });
  
  return Array.from(categoriesSet).sort();
};

/**
 * Get featured news from cache or database
 * @param {number} limit Maximum number of items to return
 * @returns {Object} Featured news and cache status
 */
const getFeaturedNews = async (limit = 10) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for featured news');
    
    const featuredNews = await News.find({ isFeatured: true })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    
    return { 
      news: featuredNews, 
      total: featuredNews.length, 
      fromCache: false 
    };
  }
  
  try {
    // Try to get from cache first
    let cachedData = await redisClient.get(CACHE_KEYS.FEATURED_NEWS);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || !cachedData.news || cachedData.news.length === 0) {
      console.log('Cache miss for featured news, fetching from database...');
      
      const featuredNews = await News.find({ isFeatured: true })
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();
      
      cachedData = { 
        news: featuredNews, 
        total: featuredNews.length
      };
      
      if (featuredNews.length > 0) {
        await redisClient.set(
          CACHE_KEYS.FEATURED_NEWS, 
          cachedData, 
          CACHE_DURATION.FEATURED_NEWS
        );
      }
      
      return { ...cachedData, fromCache: false };
    }
    
    console.log('Serving featured news from cache');
    
    // Limit the results if needed
    if (limit < cachedData.news.length) {
      cachedData.news = cachedData.news.slice(0, limit);
    }
    
    return { ...cachedData, fromCache: true };
  } catch (error) {
    console.error('Error getting featured news from cache:', error);
    
    // Fallback to database
    const featuredNews = await News.find({ isFeatured: true })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    
    return { 
      news: featuredNews, 
      total: featuredNews.length, 
      fromCache: false 
    };
  }
};

/**
 * Get latest news from cache or database
 * @param {number} limit Maximum number of items to return
 * @returns {Object} Latest news and cache status
 */
const getAllNews = async (limit = 10) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for latest news');
    
    const news = await News.find()
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    
    const total = await News.countDocuments();
    
    return { 
      news, 
      total, 
      fromCache: false 
    };
  }
  
  try {
    // Try to get from cache first
    let cachedData = await redisClient.get(CACHE_KEYS.LATEST_NEWS);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || !cachedData.news || cachedData.news.length === 0) {
      console.log('Cache miss for latest news, fetching from database...');
      
      const news = await News.find()
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();
      
      const total = await News.countDocuments();
      
      cachedData = { news, total };
      
      if (news.length > 0) {
        await redisClient.set(
          CACHE_KEYS.LATEST_NEWS, 
          cachedData, 
          CACHE_DURATION.LATEST_NEWS
        );
      }
      
      return { ...cachedData, fromCache: false };
    }
    
    console.log('Serving latest news from cache');
    
    // Limit the results if needed
    if (limit < cachedData.news.length) {
      cachedData.news = cachedData.news.slice(0, limit);
    }
    
    return { ...cachedData, fromCache: true };
  } catch (error) {
    console.error('Error getting latest news from cache:', error);
    
    // Fallback to database
    const news = await News.find()
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    
    const total = await News.countDocuments();
    
    return { 
      news, 
      total, 
      fromCache: false 
    };
  }
};

/**
 * Get news by category from cache or database
 * @param {string} category News category
 * @param {number} limit Maximum number of items to return
 * @returns {Object} News for the specified category and cache status
 */
const getNewsByCategory = async (category, limit = 10) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log(`Redis not available, querying database directly for category ${category}`);
    
    const news = await News.find({ category })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    
    // Use case-insensitive regex for category count
    const regex = new RegExp(`^${category}$`, 'i');
    const total = await News.countDocuments({ category: regex });
    
    return { 
      news, 
      total, 
      fromCache: false 
    };
  }
  
  try {
    // Try to get from cache first
    let cachedData = await redisClient.get(CACHE_KEYS.NEWS_BY_CATEGORY + category);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || !cachedData.news || cachedData.news.length === 0) {
      console.log(`Cache miss for category ${category}, fetching from database...`);
      
      const news = await News.find({ category })
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();
      
      // Use case-insensitive regex for category count
      const regex = new RegExp(`^${category}$`, 'i');
      const total = await News.countDocuments({ category: regex });
      
      cachedData = { news, total };
      
      if (news.length > 0) {
        await redisClient.set(
          CACHE_KEYS.NEWS_BY_CATEGORY + category, 
          cachedData, 
          CACHE_DURATION.LATEST_NEWS
        );
      }
      
      return { ...cachedData, fromCache: false };
    }
    
    console.log(`Serving category ${category} news from cache`);
    
    // Limit the results if needed
    if (limit < cachedData.news.length) {
      cachedData.news = cachedData.news.slice(0, limit);
    }
    
    return { ...cachedData, fromCache: true };
  } catch (error) {
    console.error(`Error getting news for category ${category} from cache:`, error);
    
    // Fallback to database
    const news = await News.find({ category })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    
    // Use case-insensitive regex for category count
    const regex = new RegExp(`^${category}$`, 'i');
    const total = await News.countDocuments({ category: regex });
    
    return { 
      news, 
      total, 
      fromCache: false 
    };
  }
};

/**
 * Get news by ID from cache or database
 * @param {string} id News ID
 * @returns {Object} News article
 */
const getNewsById = async (id) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log(`Redis not available, querying database directly for news ID ${id}`);
    
    const news = await News.findById(id).lean();
    if (news) {
      // Increment view count
      await News.findByIdAndUpdate(id, { $inc: { views: 1 } });
      
      // Ensure news has a valid category
      if (news.category === 'Other_sports') {
        news.category = 'Other';
      }
    }
    
    return news;
  }
  
  try {
    const cacheKey = CACHE_KEYS.NEWS_BY_ID + id;
    
    // Try to get from cache first
    let news = await redisClient.get(cacheKey);
    
    // If not found in cache, get from database and update cache
    if (!news) {
      console.log(`Cache miss for news ID ${id}, fetching from database...`);
      
      news = await News.findById(id).lean();
      
      if (news) {
        // Increment view count
        await News.findByIdAndUpdate(id, { $inc: { views: 1 } });
        
        // Ensure news has a valid category
        if (news.category === 'Other_sports') {
          news.category = 'Other';
        }
        
        // Update cache with the news article
        await redisClient.set(cacheKey, news, CACHE_DURATION.NEWS_BY_ID);
      }
    } else {
      console.log(`Serving news ID ${id} from cache`);
      
      // Ensure news from cache has a valid category
      if (news.category === 'Other_sports') {
        news.category = 'Other';
      }
      
      // Increment view count in the database, but don't wait for it
      News.findByIdAndUpdate(id, { $inc: { views: 1 } }).catch(err => {
        console.error(`Error incrementing view count for news ID ${id}:`, err);
      });
    }
    
    return news || null;
  } catch (error) {
    console.error(`Error getting news ID ${id}:`, error);
    
    // Fallback to database
    const news = await News.findById(id).lean();
    if (news) {
      // Increment view count
      await News.findByIdAndUpdate(id, { $inc: { views: 1 } });
      
      // Ensure news has a valid category
      if (news.category === 'Other_sports') {
        news.category = 'Other';
      }
    }
    
    return news;
  }
};

/**
 * Search news using cache when possible
 * @param {string} query Search query string
 * @param {number} limit Maximum number of items to return
 * @returns {Object} Search results and cache status
 */
const searchNews = async (query, limit = 10) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log(`Redis not available, querying database directly for search "${query}"`);
    
    return await directSearchNews(query, limit);
  }
  
  try {
    const cacheKey = CACHE_KEYS.SEARCH_RESULTS + query.toLowerCase();
    
    // Try to get from cache first
    let cachedData = await redisClient.get(cacheKey);
    
    // If not in cache, perform search and cache results
    if (!cachedData) {
      console.log(`Cache miss for search "${query}", fetching from database...`);
      
      cachedData = await directSearchNews(query, limit);
      
      // Only cache if we have results
      if (cachedData.news && cachedData.news.length > 0) {
        await redisClient.set(
          cacheKey, 
          { news: cachedData.news, total: cachedData.total }, 
          CACHE_DURATION.SEARCH_RESULTS
        );
      }
      
      return { ...cachedData, fromCache: false };
    }
    
    console.log(`Serving search results for "${query}" from cache`);
    
    // Limit the results if needed
    if (limit < cachedData.news.length) {
      cachedData.news = cachedData.news.slice(0, limit);
    }
    
    return { ...cachedData, fromCache: true };
  } catch (error) {
    console.error(`Error searching for "${query}" from cache:`, error);
    
    // Fallback to direct database search
    return await directSearchNews(query, limit);
  }
};

/**
 * Direct search from database without cache
 * @private
 */
const directSearchNews = async (query, limit) => {
  const searchFilter = {
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { summary: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  const news = await News.find(searchFilter)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();
  
  const total = await News.countDocuments(searchFilter);
  
  return { news, total, fromCache: false };
};

/**
 * Get news categories from cache or database
 * @returns {Object} Categories and cache status
 */
const getCategories = async () => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for categories');
    
    const categories = await getDistinctCategories();
    return { categories, fromCache: false };
  }
  
  try {
    // Try to get from cache first
    let cachedData = await redisClient.get(CACHE_KEYS.CATEGORIES);
    
    // If not in cache, get from database and cache it
    if (!cachedData || !cachedData.categories || cachedData.categories.length === 0) {
      console.log('Cache miss for categories, fetching from database...');
      
      const categories = await getDistinctCategories();
      
      if (categories.length > 0) {
        await redisClient.set(
          CACHE_KEYS.CATEGORIES, 
          { categories }, 
          CACHE_DURATION.CATEGORIES
        );
      }
      
      return { categories, fromCache: false };
    }
    
    console.log('Serving categories from cache');
    return { ...cachedData, fromCache: true };
  } catch (error) {
    console.error('Error getting categories from cache:', error);
    
    // Fallback to database
    const categories = await getDistinctCategories();
    return { categories, fromCache: false };
  }
};

/**
 * Invalidate news cache for a category
 * @param {string} category News category
 */
const invalidateNewsCache = async (category) => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    return false;
  }
  
  try {
    // Delete latest news cache
    await redisClient.del(CACHE_KEYS.LATEST_NEWS);
    console.log('Invalidated latest news cache');
    
    // Delete category-specific cache if provided
    if (category) {
      await redisClient.del(CACHE_KEYS.NEWS_BY_CATEGORY + category);
      console.log(`Invalidated news cache for category ${category}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error invalidating news cache:', error);
    return false;
  }
};

/**
 * Rebuild entire news cache
 */
const rebuildCache = async () => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping news cache rebuild');
    return false;
  }
  
  try {
    // Flush existing news cache
    const keysPattern = 'news:*';
    const keys = await redisClient.client.keys(keysPattern);
    
    if (keys && keys.length > 0) {
      await redisClient.client.del(keys);
      console.log(`Deleted ${keys.length} news cache keys`);
    }
    
    // Rebuild cache
    return await initializeCache();
  } catch (error) {
    console.error('Error rebuilding news cache:', error);
    return false;
  }
};

module.exports = {
  initializeCache,
  getFeaturedNews,
  getAllNews,
  getNewsByCategory,
  getNewsById,
  searchNews,
  getCategories,
  invalidateNewsCache,
  rebuildCache,
  CACHE_KEYS
}; 