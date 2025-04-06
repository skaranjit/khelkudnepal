/**
 * Simple logger utility for the application
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Configure the current log level based on environment
const currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

/**
 * Format the current date and time for log messages
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log an error message
 * @param {string} message - The message to log
 * @param {Error|Object} [error] - Optional error object or data
 */
function error(message, error) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(`[${getTimestamp()}] ERROR: ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(`Stack: ${error.stack || error.message}`);
      } else {
        console.error(error);
      }
    }
  }
}

/**
 * Log a warning message
 * @param {string} message - The message to log
 * @param {Object} [data] - Optional data
 */
function warn(message, data) {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(`[${getTimestamp()}] WARN: ${message}`);
    if (data) console.warn(data);
  }
}

/**
 * Log an info message
 * @param {string} message - The message to log
 * @param {Object} [data] - Optional data
 */
function info(message, data) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.info(`[${getTimestamp()}] INFO: ${message}`);
    if (data) console.info(data);
  }
}

/**
 * Log a debug message
 * @param {string} message - The message to log
 * @param {Object} [data] - Optional data
 */
function debug(message, data) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.debug(`[${getTimestamp()}] DEBUG: ${message}`);
    if (data) console.debug(data);
  }
}

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS
}; 