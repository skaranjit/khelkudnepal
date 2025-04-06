const User = require('../models/User');
const redisClient = require('./redisClient');
const logger = require('./logger');

// Cache keys
const CACHE_KEYS = {
  ALL_USERS: 'users:all',
  USER_BY_ID: 'user:id:', // user:id:123
  USER_BY_EMAIL: 'user:email:', // user:email:user@example.com
};

// Cache durations in seconds
const CACHE_DURATION = {
  ALL_USERS: 3600, // 1 hour
  USER: 1800,      // 30 minutes
};

/**
 * Initialize the user cache
 */
async function initializeCache() {
  if (!redisClient.isConnected() || !redisClient.isEnabled()) {
    logger.info('Redis not available, skipping user cache initialization');
    return;
  }

  try {
    logger.info('Initializing user cache...');
    
    // Get all users from database
    const users = await User.find({})
      .select('-password')
      .lean();
    
    if (users && users.length > 0) {
      // Store all users in cache
      await redisClient.set(
        CACHE_KEYS.ALL_USERS,
        JSON.stringify(users),
        CACHE_DURATION.ALL_USERS
      );
      
      // Store individual users in cache
      for (const user of users) {
        // Cache by ID
        await redisClient.set(
          `${CACHE_KEYS.USER_BY_ID}${user._id}`,
          JSON.stringify(user),
          CACHE_DURATION.USER
        );
        
        // Cache by email
        if (user.email) {
          await redisClient.set(
            `${CACHE_KEYS.USER_BY_EMAIL}${user.email}`,
            JSON.stringify(user),
            CACHE_DURATION.USER
          );
        }
      }
      
      logger.info(`User cache initialized with ${users.length} users`);
    } else {
      logger.info('No users found to cache');
    }
  } catch (error) {
    logger.error('Error initializing user cache:', error);
  }
}

/**
 * Get all users from cache or database
 */
async function getAllUsers(skipCache = false) {
  // Return from database if Redis is not available
  if (!redisClient.isConnected() || !redisClient.isEnabled() || skipCache) {
    return await User.find({}).select('-password').lean();
  }
  
  try {
    // Try to get from cache
    const cachedUsers = await redisClient.get(CACHE_KEYS.ALL_USERS);
    
    if (cachedUsers) {
      logger.debug('Retrieved all users from cache');
      return JSON.parse(cachedUsers);
    }
    
    // Cache miss, get from database
    logger.debug('Users cache miss, retrieving from database');
    const users = await User.find({}).select('-password').lean();
    
    // Store in cache
    if (users && users.length > 0) {
      await redisClient.set(
        CACHE_KEYS.ALL_USERS,
        JSON.stringify(users),
        CACHE_DURATION.ALL_USERS
      );
    }
    
    return users;
  } catch (error) {
    logger.error('Error getting all users:', error);
    // Fallback to database on error
    return await User.find({}).select('-password').lean();
  }
}

/**
 * Get a user by ID from cache or database
 */
async function getUserById(id, skipCache = false) {
  if (!id) return null;
  
  // Return from database if Redis is not available
  if (!redisClient.isConnected() || !redisClient.isEnabled() || skipCache) {
    return await User.findById(id).select('-password').lean();
  }
  
  try {
    // Try to get from cache
    const cacheKey = `${CACHE_KEYS.USER_BY_ID}${id}`;
    const cachedUser = await redisClient.get(cacheKey);
    
    if (cachedUser) {
      logger.debug(`Retrieved user ${id} from cache`);
      return JSON.parse(cachedUser);
    }
    
    // Cache miss, get from database
    logger.debug(`User ${id} cache miss, retrieving from database`);
    const user = await User.findById(id).select('-password').lean();
    
    // Store in cache if found
    if (user) {
      await redisClient.set(
        cacheKey,
        JSON.stringify(user),
        CACHE_DURATION.USER
      );
    }
    
    return user;
  } catch (error) {
    logger.error(`Error getting user by ID ${id}:`, error);
    // Fallback to database on error
    return await User.findById(id).select('-password').lean();
  }
}

/**
 * Get a user by email from cache or database
 */
async function getUserByEmail(email, skipCache = false) {
  if (!email) return null;
  
  // Return from database if Redis is not available
  if (!redisClient.isConnected() || !redisClient.isEnabled() || skipCache) {
    return await User.findOne({ email }).lean();
  }
  
  try {
    // Try to get from cache
    const cacheKey = `${CACHE_KEYS.USER_BY_EMAIL}${email}`;
    const cachedUser = await redisClient.get(cacheKey);
    
    if (cachedUser) {
      logger.debug(`Retrieved user with email ${email} from cache`);
      return JSON.parse(cachedUser);
    }
    
    // Cache miss, get from database
    logger.debug(`User with email ${email} cache miss, retrieving from database`);
    const user = await User.findOne({ email }).lean();
    
    // Store in cache if found
    if (user) {
      await redisClient.set(
        cacheKey,
        JSON.stringify(user),
        CACHE_DURATION.USER
      );
      
      // Also update ID cache
      await redisClient.set(
        `${CACHE_KEYS.USER_BY_ID}${user._id}`,
        JSON.stringify(user),
        CACHE_DURATION.USER
      );
    }
    
    return user;
  } catch (error) {
    logger.error(`Error getting user by email ${email}:`, error);
    // Fallback to database on error
    return await User.findOne({ email }).lean();
  }
}

/**
 * Invalidate user cache when a user is updated/created/deleted
 */
async function invalidateUserCache(userId, email = null) {
  if (!redisClient.isConnected() || !redisClient.isEnabled()) {
    logger.info('Redis not available, skipping user cache invalidation');
    return;
  }
  
  try {
    logger.info(`Invalidating cache for user ${userId}`);
    
    // Delete user from ID cache
    if (userId) {
      await redisClient.del(`${CACHE_KEYS.USER_BY_ID}${userId}`);
    }
    
    // Delete user from email cache
    if (email) {
      await redisClient.del(`${CACHE_KEYS.USER_BY_EMAIL}${email}`);
    }
    
    // Delete all users cache
    await redisClient.del(CACHE_KEYS.ALL_USERS);
    
    logger.info('User cache invalidated successfully');
  } catch (error) {
    logger.error('Error invalidating user cache:', error);
  }
}

/**
 * Rebuild the entire user cache
 */
async function rebuildCache() {
  if (!redisClient.isConnected() || !redisClient.isEnabled()) {
    logger.info('Redis not available, skipping user cache rebuild');
    return;
  }
  
  try {
    // Clear related cache keys first
    await redisClient.del(CACHE_KEYS.ALL_USERS);
    
    // Find and delete all user cache keys
    const userIdPattern = `${CACHE_KEYS.USER_BY_ID}*`;
    const userEmailPattern = `${CACHE_KEYS.USER_BY_EMAIL}*`;
    
    // This would ideally use SCAN + DEL but we'll approximate with our current method
    // Delete user by ID cache keys
    const userIdKeys = await redisClient.keys(userIdPattern);
    if (userIdKeys && userIdKeys.length > 0) {
      for (const key of userIdKeys) {
        await redisClient.del(key);
      }
    }
    
    // Delete user by email cache keys
    const userEmailKeys = await redisClient.keys(userEmailPattern);
    if (userEmailKeys && userEmailKeys.length > 0) {
      for (const key of userEmailKeys) {
        await redisClient.del(key);
      }
    }
    
    // Now rebuild the cache
    await initializeCache();
    
    logger.info('User cache rebuilt successfully');
  } catch (error) {
    logger.error('Error rebuilding user cache:', error);
  }
}

module.exports = {
  initializeCache,
  getAllUsers,
  getUserById,
  getUserByEmail,
  invalidateUserCache,
  rebuildCache
}; 