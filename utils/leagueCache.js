const redisClient = require('./redisClient');
const League = require('../models/League');

// Cache keys
const CACHE_KEYS = {
  ALL_LEAGUES: 'leagues:all',
  LEAGUES_BY_CATEGORY: 'leagues:category:',
  LEAGUE_BY_ID: 'leagues:id:'
};

// Cache duration in seconds
const CACHE_DURATION = {
  LEAGUES: 24 * 60 * 60, // 24 hours
  LEAGUE_DETAILS: 6 * 60 * 60 // 6 hours
};

/**
 * Initialize leagues cache from database
 */
const initializeCache = async () => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping league cache initialization');
    return false;
  }
  
  try {
    console.log('Initializing leagues cache...');
    
    // Load all leagues from database
    const leagues = await League.find({}).lean();
    if (!leagues || leagues.length === 0) {
      console.log('No leagues found for caching');
      return false;
    }
    
    console.log(`Caching ${leagues.length} leagues...`);
    
    // Process leagues to ensure standings are properly sorted
    const processedLeagues = leagues.map(league => {
      // Sort teams by points (highest first)
      if (league.teams && league.teams.length > 0) {
        league.teams.sort((a, b) => {
          // First by points
          if (a.points !== b.points) return b.points - a.points;
          
          // Then by goal difference
          const aGoalDiff = a.goalsFor - a.goalsAgainst;
          const bGoalDiff = b.goalsFor - b.goalsAgainst;
          if (aGoalDiff !== bGoalDiff) return bGoalDiff - aGoalDiff;
          
          // Then by goals scored
          return b.goalsFor - a.goalsFor;
        });
      }
      return league;
    });
    
    // Cache all leagues
    await redisClient.set(CACHE_KEYS.ALL_LEAGUES, processedLeagues, CACHE_DURATION.LEAGUES);
    
    // Cache leagues by category
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other'];
    for (const category of categories) {
      // Filter leagues by category (case-insensitive)
      const categoryLowerCase = category.toLowerCase();
      const categoryLeagues = processedLeagues.filter(league => 
        league.category.toLowerCase() === categoryLowerCase
      );
      await redisClient.set(
        CACHE_KEYS.LEAGUES_BY_CATEGORY + category.toLowerCase(), 
        categoryLeagues, 
        CACHE_DURATION.LEAGUES
      );
      console.log(`Cached ${categoryLeagues.length} ${category} leagues`);
    }
    
    // Cache individual leagues by ID
    for (const league of processedLeagues) {
      await redisClient.set(
        CACHE_KEYS.LEAGUE_BY_ID + league._id.toString(),
        league,
        CACHE_DURATION.LEAGUE_DETAILS
      );
    }
    
    console.log('League cache initialization complete');
    return true;
  } catch (error) {
    console.error('Error initializing leagues cache:', error);
    return false;
  }
};

/**
 * Get all leagues from cache or database
 */
const getAllLeagues = async () => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, querying database directly for all leagues');
    return await League.find({}).lean();
  }
  
  try {
    // Try to get from cache first
    let leagues = await redisClient.get(CACHE_KEYS.ALL_LEAGUES);
    
    // If not found in cache, get from database and update cache
    if (!leagues) {
      console.log('Cache miss for all leagues, fetching from database...');
      leagues = await League.find({}).lean();
      
      if (leagues && leagues.length > 0) {
        await redisClient.set(CACHE_KEYS.ALL_LEAGUES, leagues, CACHE_DURATION.LEAGUES);
      }
    } else {
      console.log('Serving all leagues from cache');
    }
    
    return leagues || [];
  } catch (error) {
    console.error('Error getting all leagues:', error);
    // Fallback to database if cache fails
    return await League.find({}).lean();
  }
};

/**
 * Get leagues by category from cache or database
 * @param {string} category - Category name
 */
const getLeaguesByCategory = async (category) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log(`Redis not available, querying database directly for ${category} leagues`);
    return await League.find({ category }).lean();
  }
  
  try {
    const cacheKey = CACHE_KEYS.LEAGUES_BY_CATEGORY + category.toLowerCase();
    
    // Try to get from cache first
    let leagues = await redisClient.get(cacheKey);
    
    // If not found in cache, get from database and update cache
    if (!leagues) {
      console.log(`Cache miss for ${category} leagues, fetching from database...`);
      leagues = await League.find({ category }).lean();
      
      if (leagues && leagues.length > 0) {
        await redisClient.set(cacheKey, leagues, CACHE_DURATION.LEAGUES);
      }
    } else {
      console.log(`Serving ${category} leagues from cache`);
    }
    
    return leagues || [];
  } catch (error) {
    console.error(`Error getting ${category} leagues:`, error);
    // Fallback to database if cache fails
    return await League.find({ category }).lean();
  }
};

/**
 * Get league by ID from cache or database
 * @param {string} id - League ID
 */
const getLeagueById = async (id) => {
  // If Redis is not available, query the database directly
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log(`Redis not available, querying database directly for league ID ${id}`);
    return await League.findById(id).lean();
  }
  
  try {
    const cacheKey = CACHE_KEYS.LEAGUE_BY_ID + id;
    
    // Try to get from cache first
    let league = await redisClient.get(cacheKey);
    
    // If not found in cache, get from database and update cache
    if (!league) {
      console.log(`Cache miss for league ID ${id}, fetching from database...`);
      league = await League.findById(id).lean();
      
      if (league) {
        await redisClient.set(cacheKey, league, CACHE_DURATION.LEAGUE_DETAILS);
      }
    } else {
      console.log(`Serving league ID ${id} from cache`);
    }
    
    return league || null;
  } catch (error) {
    console.error(`Error getting league ID ${id}:`, error);
    // Fallback to database if cache fails
    return await League.findById(id).lean();
  }
};

/**
 * Invalidate cache for a specific league when it's updated
 * @param {string} id - League ID
 */
const invalidateLeagueCache = async (id) => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    return false;
  }
  
  try {
    // Get the league to determine its category
    const league = await League.findById(id).lean();
    
    if (league) {
      // Delete specific league cache
      await redisClient.del(CACHE_KEYS.LEAGUE_BY_ID + id);
      
      // Delete category cache
      await redisClient.del(CACHE_KEYS.LEAGUES_BY_CATEGORY + league.category.toLowerCase());
      
      // Delete all leagues cache
      await redisClient.del(CACHE_KEYS.ALL_LEAGUES);
      
      console.log(`Cache invalidated for league ID ${id}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error invalidating cache for league ID ${id}:`, error);
    return false;
  }
};

/**
 * Rebuild entire leagues cache 
 */
const rebuildCache = async () => {
  // Skip if Redis is not available
  if (!redisClient.isEnabled() || !redisClient.isConnected()) {
    console.log('Redis not available, skipping league cache rebuild');
    return false;
  }
  
  try {
    console.log('Rebuilding leagues cache...');
    
    // Flush existing league cache
    const keysPattern = 'leagues:*';
    const keys = await redisClient.client.keys(keysPattern);
    
    if (keys && keys.length > 0) {
      await redisClient.client.del(keys);
      console.log(`Deleted ${keys.length} league cache keys`);
    }
    
    // Rebuild cache with fresh data from database
    const success = await initializeCache();
    console.log(`League cache rebuild ${success ? 'completed successfully' : 'failed'}`);
    return success;
  } catch (error) {
    console.error('Error rebuilding leagues cache:', error);
    return false;
  }
};

module.exports = {
  initializeCache,
  getAllLeagues,
  getLeaguesByCategory,
  getLeagueById,
  invalidateLeagueCache,
  rebuildCache,
  CACHE_KEYS
}; 