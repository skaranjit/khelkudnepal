const redis = require('redis');
const News = require('../models/News');
const League = require('../models/League');
const User = require('../models/User');

/**
 * Rebuild news cache
 */
exports.rebuildNewsCache = async () => {
  try {
    const redisClient = global.redisClient;
    if (!redisClient || !redisClient.isReady) {
      console.log('Redis not available for news cache rebuild');
      return;
    }

    console.log('Rebuilding news cache...');
    
    // Clear existing news cache
    const newsCacheKeys = await redisClient.keys('news:*');
    if (newsCacheKeys.length > 0) {
      await redisClient.del(newsCacheKeys);
    }
    
    // Fetch all news
    const allNews = await News.find()
      .sort({ publishDate: -1 })
      .select('title slug category publishDate thumbnailUrl viewCount');
    
    // Cache by category
    const categories = ['cricket', 'football', 'basketball', 'volleyball', 'othersports'];
    for (const category of categories) {
      const categoryNews = allNews.filter(news => news.category === category);
      if (categoryNews.length > 0) {
        await redisClient.set(`news:category:${category}`, JSON.stringify(categoryNews), {
          EX: 3600 // 1 hour
        });
      }
    }
    
    // Cache latest news
    const latestNews = allNews.slice(0, 10);
    if (latestNews.length > 0) {
      await redisClient.set('news:latest', JSON.stringify(latestNews), {
        EX: 3600 // 1 hour
      });
    }
    
    // Cache most viewed news
    const mostViewedNews = [...allNews].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);
    if (mostViewedNews.length > 0) {
      await redisClient.set('news:mostviewed', JSON.stringify(mostViewedNews), {
        EX: 3600 // 1 hour
      });
    }
    
    console.log('News cache rebuilt successfully');
    return true;
  } catch (error) {
    console.error('Error rebuilding news cache:', error);
    throw error;
  }
};

/**
 * Rebuild leagues cache
 */
exports.rebuildLeaguesCache = async () => {
  try {
    const redisClient = global.redisClient;
    if (!redisClient || !redisClient.isReady) {
      console.log('Redis not available for leagues cache rebuild');
      return;
    }

    console.log('Rebuilding leagues cache...');
    
    // Clear existing leagues cache
    const leaguesCacheKeys = await redisClient.keys('leagues:*');
    if (leaguesCacheKeys.length > 0) {
      await redisClient.del(leaguesCacheKeys);
    }
    
    // Fetch all leagues
    const allLeagues = await League.find()
      .sort({ createdAt: -1 });
    
    // Cache all leagues
    if (allLeagues.length > 0) {
      await redisClient.set('leagues:all', JSON.stringify(allLeagues), {
        EX: 3600 // 1 hour
      });
    }
    
    // Cache leagues by category
    const categories = ['cricket', 'football', 'basketball', 'volleyball', 'othersports'];
    for (const category of categories) {
      const categoryLeagues = allLeagues.filter(league => 
        league.category.toLowerCase() === category
      );
      if (categoryLeagues.length > 0) {
        await redisClient.set(`leagues:category:${category}`, JSON.stringify(categoryLeagues), {
          EX: 3600 // 1 hour
        });
      }
    }
    
    // Cache featured leagues
    const featuredLeagues = allLeagues.filter(league => league.featured);
    if (featuredLeagues.length > 0) {
      await redisClient.set('leagues:featured', JSON.stringify(featuredLeagues), {
        EX: 3600 // 1 hour
      });
    }
    
    // Cache ongoing leagues
    const ongoingLeagues = allLeagues.filter(league => league.status === 'ongoing');
    if (ongoingLeagues.length > 0) {
      await redisClient.set('leagues:ongoing', JSON.stringify(ongoingLeagues), {
        EX: 3600 // 1 hour
      });
    }
    
    console.log('Leagues cache rebuilt successfully');
    return true;
  } catch (error) {
    console.error('Error rebuilding leagues cache:', error);
    throw error;
  }
};

/**
 * Rebuild users cache
 */
exports.rebuildUsersCache = async () => {
  try {
    const redisClient = global.redisClient;
    if (!redisClient || !redisClient.isReady) {
      console.log('Redis not available for users cache rebuild');
      return;
    }

    console.log('Rebuilding users cache...');
    
    // Clear existing users cache
    const usersCacheKeys = await redisClient.keys('users:*');
    if (usersCacheKeys.length > 0) {
      await redisClient.del(usersCacheKeys);
    }
    
    // Fetch active users
    const activeUsers = await User.find({ status: 'active' })
      .select('username email role createdAt')
      .sort({ createdAt: -1 });
    
    if (activeUsers.length > 0) {
      await redisClient.set('users:active', JSON.stringify(activeUsers), {
        EX: 3600 // 1 hour
      });
    }
    
    console.log('Users cache rebuilt successfully');
    return true;
  } catch (error) {
    console.error('Error rebuilding users cache:', error);
    throw error;
  }
};

/**
 * Rebuild all caches
 */
exports.rebuildAllCaches = async () => {
  try {
    await this.rebuildNewsCache();
    await this.rebuildLeaguesCache();
    await this.rebuildUsersCache();
    return true;
  } catch (error) {
    console.error('Error rebuilding all caches:', error);
    throw error;
  }
}; 