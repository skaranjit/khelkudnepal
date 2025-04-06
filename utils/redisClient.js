const redis = require('redis');
const { promisify } = require('util');

// Environment variables (using defaults if not provided)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Track if Redis is connected
let isRedisConnected = false;

// Create Redis client only if enabled
const client = REDIS_ENABLED ? redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
}) : null;

// Promisify Redis commands if client exists
const getAsync = client ? promisify(client.get).bind(client) : null;
const setAsync = client ? promisify(client.set).bind(client) : null;
const delAsync = client ? promisify(client.del).bind(client) : null;
const flushAsync = client ? promisify(client.flushAll).bind(client) : null;
const keysAsync = client ? promisify(client.keys).bind(client) : null;

// Set up event handlers if client exists
if (client) {
  client.on('connect', () => {
    console.log('Redis client connected');
    isRedisConnected = true;
  });
  
  client.on('error', (err) => {
    console.error('Redis client error:', err);
    isRedisConnected = false;
  });
  
  client.on('reconnecting', () => {
    console.log('Redis client reconnecting...');
    isRedisConnected = false;
  });
  
  client.on('end', () => {
    console.log('Redis client disconnected');
    isRedisConnected = false;
  });
}

/**
 * Connect to Redis
 */
const connect = async () => {
  if (!REDIS_ENABLED || !client) {
    console.log('Redis is disabled in configuration');
    return false;
  }
  
  try {
    await client.connect();
    isRedisConnected = true;
    console.log('Connected to Redis successfully');
    return true;
  } catch (error) {
    console.error('Redis connection error:', error);
    isRedisConnected = false;
    return false;
  }
};

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached data (parsed from JSON)
 */
const get = async (key) => {
  if (!isRedisConnected || !client) {
    return null;
  }
  
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
};

/**
 * Set data in cache
 * @param {string} key - Cache key
 * @param {any} value - Data to cache (will be stringified)
 * @param {number} [expiry=3600] - Cache expiry in seconds (default: 1 hour)
 * @returns {Promise<boolean>} - Success/failure
 */
const set = async (key, value, expiry = 3600) => {
  if (!isRedisConnected || !client) {
    return false;
  }
  
  try {
    await client.set(key, JSON.stringify(value), {
      EX: expiry
    });
    return true;
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
};

/**
 * Delete a cache key
 * @param {string} key - Cache key to delete
 * @returns {Promise<boolean>} - Success/failure
 */
const del = async (key) => {
  if (!isRedisConnected || !client) {
    return false;
  }
  
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Error deleting cache for key ${key}:`, error);
    return false;
  }
};

/**
 * Flush all cache
 * @returns {Promise<boolean>} - Success/failure
 */
const flushAll = async () => {
  if (!isRedisConnected || !client) {
    return false;
  }
  
  try {
    await client.flushAll();
    console.log('Cache flushed successfully');
    return true;
  } catch (error) {
    console.error('Error flushing cache:', error);
    return false;
  }
};

module.exports = {
  connect,
  get,
  set,
  del,
  flushAll,
  client,
  isConnected: () => isRedisConnected,
  isEnabled: () => REDIS_ENABLED
}; 