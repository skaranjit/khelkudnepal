const redisClient = require('./redisClient');
const Match = require('../models/Match');

// Cache keys
const CACHE_KEYS = {
  ALL_MATCHES: 'matches:all',
  MATCHES_BY_CATEGORY: 'matches:category:',
  MATCHES_BY_STATUS: 'matches:status:',
  MATCH_BY_ID: 'matches:id:',
  LIVE_MATCHES: 'matches:live',
  UPCOMING_MATCHES: 'matches:upcoming',
  COMPLETED_MATCHES: 'matches:completed'
};

// Cache duration in seconds
const CACHE_DURATION = {
  LIVE_MATCHES: 1 * 60, // 1 minute (short duration as live matches update frequently)
  UPCOMING_MATCHES: 5 * 60, // 5 minutes
  COMPLETED_MATCHES: 30 * 60, // 30 minutes
  MATCH_DETAILS: 2 * 60, // 2 minutes for single match details
  ALL_MATCHES: 15 * 60 // 15 minutes for all matches
};

/**
 * Initialize matches cache
 */
const initializeCache = async () => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping match cache initialization');
    return false;
  }
  
  try {
    console.log('Initializing matches cache...');
    
    // Cache live matches
    const liveMatches = await Match.find({ status: 'live' })
      .sort({ startTime: -1 })
      .lean();
    
    if (liveMatches.length > 0) {
      await redisClient.set(
        CACHE_KEYS.LIVE_MATCHES, 
        liveMatches, 
        CACHE_DURATION.LIVE_MATCHES
      );
      console.log(`Cached ${liveMatches.length} live matches`);
    }
    
    // Cache upcoming matches
    const upcomingMatches = await Match.find({ 
      status: 'scheduled',
      startTime: { $gt: new Date() }
    })
      .sort({ startTime: 1 })
      .limit(20)
      .lean();
    
    if (upcomingMatches.length > 0) {
      await redisClient.set(
        CACHE_KEYS.UPCOMING_MATCHES, 
        upcomingMatches, 
        CACHE_DURATION.UPCOMING_MATCHES
      );
      console.log(`Cached ${upcomingMatches.length} upcoming matches`);
    }
    
    // Cache completed matches
    const completedMatches = await Match.find({ status: 'completed' })
      .sort({ startTime: -1 })
      .limit(20)
      .lean();
    
    if (completedMatches.length > 0) {
      await redisClient.set(
        CACHE_KEYS.COMPLETED_MATCHES, 
        completedMatches, 
        CACHE_DURATION.COMPLETED_MATCHES
      );
      console.log(`Cached ${completedMatches.length} completed matches`);
    }
    
    // Cache matches by category
    const categories = ['cricket', 'football', 'basketball', 'volleyball', 'othersports'];
    
    for (const category of categories) {
      const categoryMatches = await Match.find({ 
        category: new RegExp(`^${category}$`, 'i')
      })
        .sort({ startTime: -1 })
        .limit(20)
        .lean();
      
      if (categoryMatches.length > 0) {
        await redisClient.set(
          CACHE_KEYS.MATCHES_BY_CATEGORY + category.toLowerCase(),
          categoryMatches,
          CACHE_DURATION.ALL_MATCHES
        );
        console.log(`Cached ${categoryMatches.length} ${category} matches`);
      }
    }
    
    console.log('Match cache initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing match cache:', error);
    return false;
  }
};

/**
 * Get all matches from cache or database
 * @param {number} limit - Maximum number of matches to return
 * @returns {Object} Matches and cache status
 */
const getAllMatches = async (limit = 50) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for all matches');
    
    const matches = await Match.find()
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();
    
    return { 
      matches, 
      total: await Match.countDocuments(),
      fromCache: false 
    };
  }
  
  try {
    // Try to get from cache first
    let cachedData = await redisClient.get(CACHE_KEYS.ALL_MATCHES);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || cachedData.length === 0) {
      console.log('Cache miss for all matches, fetching from database...');
      
      const matches = await Match.find()
        .sort({ startTime: -1 })
        .limit(limit)
        .lean();
      
      const total = await Match.countDocuments();
      
      cachedData = matches;
      
      if (matches.length > 0) {
        await redisClient.set(
          CACHE_KEYS.ALL_MATCHES, 
          cachedData, 
          CACHE_DURATION.ALL_MATCHES
        );
      }
      
      return { matches, total, fromCache: false };
    }
    
    console.log('Serving all matches from cache');
    
    // Limit the results if needed
    const matches = limit < cachedData.length ? cachedData.slice(0, limit) : cachedData;
    
    return { 
      matches, 
      total: await Match.countDocuments(), 
      fromCache: true 
    };
  } catch (error) {
    console.error('Error getting all matches from cache:', error);
    
    // Fallback to database
    const matches = await Match.find()
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();
    
    return { 
      matches, 
      total: await Match.countDocuments(),
      fromCache: false 
    };
  }
};

/**
 * Get live matches from cache or database
 * @param {string} category - Optional category filter
 * @returns {Object} Live matches and cache status
 */
const getLiveMatches = async (category = null) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for live matches');
    
    const query = { status: 'live' };
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const matches = await Match.find(query)
      .sort({ startTime: -1 })
      .lean();
    
    return { 
      matches, 
      total: matches.length,
      fromCache: false 
    };
  }
  
  try {
    const cacheKey = category 
      ? `${CACHE_KEYS.LIVE_MATCHES}:${category.toLowerCase()}`
      : CACHE_KEYS.LIVE_MATCHES;
    
    // Try to get from cache first
    let cachedData = await redisClient.get(cacheKey);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || cachedData.length === 0) {
      console.log(`Cache miss for live matches${category ? ` (${category})` : ''}, fetching from database...`);
      
      const query = { status: 'live' };
      if (category) {
        query.category = new RegExp(`^${category}$`, 'i');
      }
      
      const matches = await Match.find(query)
        .sort({ startTime: -1 })
        .lean();
      
      cachedData = matches;
      
      if (matches.length > 0) {
        await redisClient.set(
          cacheKey, 
          cachedData, 
          CACHE_DURATION.LIVE_MATCHES
        );
      }
      
      return { matches, total: matches.length, fromCache: false };
    }
    
    console.log(`Serving live matches${category ? ` (${category})` : ''} from cache`);
    return { 
      matches: cachedData, 
      total: cachedData.length,
      fromCache: true 
    };
  } catch (error) {
    console.error(`Error getting live matches${category ? ` (${category})` : ''} from cache:`, error);
    
    // Fallback to database
    const query = { status: 'live' };
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const matches = await Match.find(query)
      .sort({ startTime: -1 })
      .lean();
    
    return { 
      matches, 
      total: matches.length,
      fromCache: false 
    };
  }
};

/**
 * Get upcoming matches from cache or database
 * @param {string} category - Optional category filter
 * @param {number} limit - Maximum number of matches to return
 * @returns {Object} Upcoming matches and cache status
 */
const getUpcomingMatches = async (category = null, limit = 20) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for upcoming matches');
    
    const query = { 
      status: 'scheduled',
      startTime: { $gt: new Date() }
    };
    
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const matches = await Match.find(query)
      .sort({ startTime: 1 })
      .limit(limit)
      .lean();
    
    return { 
      matches, 
      total: matches.length,
      fromCache: false 
    };
  }
  
  try {
    const cacheKey = category 
      ? `${CACHE_KEYS.UPCOMING_MATCHES}:${category.toLowerCase()}`
      : CACHE_KEYS.UPCOMING_MATCHES;
    
    // Try to get from cache first
    let cachedData = await redisClient.get(cacheKey);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || cachedData.length === 0) {
      console.log(`Cache miss for upcoming matches${category ? ` (${category})` : ''}, fetching from database...`);
      
      const query = { 
        status: 'scheduled',
        startTime: { $gt: new Date() }
      };
      
      if (category) {
        query.category = new RegExp(`^${category}$`, 'i');
      }
      
      const matches = await Match.find(query)
        .sort({ startTime: 1 })
        .limit(limit)
        .lean();
      
      cachedData = matches;
      
      if (matches.length > 0) {
        await redisClient.set(
          cacheKey, 
          cachedData, 
          CACHE_DURATION.UPCOMING_MATCHES
        );
      }
      
      return { matches, total: matches.length, fromCache: false };
    }
    
    console.log(`Serving upcoming matches${category ? ` (${category})` : ''} from cache`);
    
    // Limit the results if needed
    const matches = limit < cachedData.length ? cachedData.slice(0, limit) : cachedData;
    
    return { 
      matches, 
      total: cachedData.length,
      fromCache: true 
    };
  } catch (error) {
    console.error(`Error getting upcoming matches${category ? ` (${category})` : ''} from cache:`, error);
    
    // Fallback to database
    const query = { 
      status: 'scheduled',
      startTime: { $gt: new Date() }
    };
    
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const matches = await Match.find(query)
      .sort({ startTime: 1 })
      .limit(limit)
      .lean();
    
    return { 
      matches, 
      total: matches.length,
      fromCache: false 
    };
  }
};

/**
 * Get completed matches from cache or database
 * @param {string} category - Optional category filter
 * @param {number} limit - Maximum number of matches to return
 * @returns {Object} Completed matches and cache status
 */
const getCompletedMatches = async (category = null, limit = 20) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for completed matches');
    
    const query = { status: 'completed' };
    
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const matches = await Match.find(query)
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();
    
    return { 
      matches, 
      total: matches.length,
      fromCache: false 
    };
  }
  
  try {
    const cacheKey = category 
      ? `${CACHE_KEYS.COMPLETED_MATCHES}:${category.toLowerCase()}`
      : CACHE_KEYS.COMPLETED_MATCHES;
    
    // Try to get from cache first
    let cachedData = await redisClient.get(cacheKey);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData || cachedData.length === 0) {
      console.log(`Cache miss for completed matches${category ? ` (${category})` : ''}, fetching from database...`);
      
      const query = { status: 'completed' };
      
      if (category) {
        query.category = new RegExp(`^${category}$`, 'i');
      }
      
      const matches = await Match.find(query)
        .sort({ startTime: -1 })
        .limit(limit)
        .lean();
      
      cachedData = matches;
      
      if (matches.length > 0) {
        await redisClient.set(
          cacheKey, 
          cachedData, 
          CACHE_DURATION.COMPLETED_MATCHES
        );
      }
      
      return { matches, total: matches.length, fromCache: false };
    }
    
    console.log(`Serving completed matches${category ? ` (${category})` : ''} from cache`);
    
    // Limit the results if needed
    const matches = limit < cachedData.length ? cachedData.slice(0, limit) : cachedData;
    
    return { 
      matches, 
      total: cachedData.length,
      fromCache: true 
    };
  } catch (error) {
    console.error(`Error getting completed matches${category ? ` (${category})` : ''} from cache:`, error);
    
    // Fallback to database
    const query = { status: 'completed' };
    
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const matches = await Match.find(query)
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();
    
    return { 
      matches, 
      total: matches.length,
      fromCache: false 
    };
  }
};

/**
 * Get match by ID from cache or database
 * @param {string} id - Match ID
 * @returns {Object} Match and cache status
 */
const getMatchById = async (id) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log(`Redis not available, querying database directly for match ID: ${id}`);
    
    const match = await Match.findById(id).lean();
    
    return { 
      match, 
      fromCache: false 
    };
  }
  
  try {
    const cacheKey = `${CACHE_KEYS.MATCH_BY_ID}${id}`;
    
    // Try to get from cache first
    let cachedData = await redisClient.get(cacheKey);
    
    // If not in cache or cached data is empty, get from database and cache it
    if (!cachedData) {
      console.log(`Cache miss for match ID: ${id}, fetching from database...`);
      
      const match = await Match.findById(id).lean();
      
      if (!match) {
        return { match: null, fromCache: false };
      }
      
      cachedData = match;
      
      await redisClient.set(
        cacheKey, 
        cachedData, 
        CACHE_DURATION.MATCH_DETAILS
      );
      
      return { match, fromCache: false };
    }
    
    console.log(`Serving match ID: ${id} from cache`);
    return { 
      match: cachedData,
      fromCache: true 
    };
  } catch (error) {
    console.error(`Error getting match ID: ${id} from cache:`, error);
    
    // Fallback to database
    const match = await Match.findById(id).lean();
    
    return { 
      match,
      fromCache: false 
    };
  }
};

/**
 * Invalidate match cache for a specific match
 * @param {string} id - Match ID to invalidate
 * @returns {boolean} Success status
 */
const invalidateMatchCache = async (id) => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping match cache invalidation');
    return false;
  }
  
  try {
    console.log(`Invalidating cache for match ID: ${id}`);
    
    // Delete specific match cache
    await redisClient.del(`${CACHE_KEYS.MATCH_BY_ID}${id}`);
    
    // Delete category caches since they might include this match
    // We'll get the match first to know its category
    const match = await Match.findById(id).lean();
    if (match && match.category) {
      const category = match.category.toLowerCase();
      await redisClient.del(`${CACHE_KEYS.MATCHES_BY_CATEGORY}${category}`);
    }
    
    // Delete status-based caches
    await redisClient.del(CACHE_KEYS.LIVE_MATCHES);
    await redisClient.del(CACHE_KEYS.UPCOMING_MATCHES);
    await redisClient.del(CACHE_KEYS.COMPLETED_MATCHES);
    
    // Delete all matches cache
    await redisClient.del(CACHE_KEYS.ALL_MATCHES);
    
    console.log(`Match cache invalidated for ID: ${id}`);
    return true;
  } catch (error) {
    console.error(`Error invalidating match cache for ID: ${id}:`, error);
    return false;
  }
};

/**
 * Rebuild the entire match cache
 * @returns {boolean} Success status
 */
const rebuildCache = async () => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping match cache rebuild');
    return false;
  }
  
  try {
    console.log('Rebuilding match cache...');
    
    // Delete all match-related cache keys
    const allKeys = await redisClient.client.keys('matches:*');
    if (allKeys.length > 0) {
      await Promise.all(allKeys.map(key => redisClient.del(key)));
    }
    
    // Rebuild cache
    const success = await initializeCache();
    
    console.log(`Match cache rebuild ${success ? 'successful' : 'failed'}`);
    return success;
  } catch (error) {
    console.error('Error rebuilding match cache:', error);
    return false;
  }
};

module.exports = {
  initializeCache,
  getAllMatches,
  getLiveMatches,
  getUpcomingMatches,
  getCompletedMatches,
  getMatchById,
  invalidateMatchCache,
  rebuildCache
}; 