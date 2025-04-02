const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PassThrough } = require('stream');

/**
 * Show the Browserless status page
 */
exports.showBrowserlessPage = (req, res) => {
  res.render('admin/browserless', {
    title: 'Web Scraping Disabled',
    activeNav: 'browserless'
  });
};

/**
 * Check Browserless connection status
 */
exports.getStatus = async (req, res) => {
  try {
    res.json({
      disabled: true,
      message: 'Web scraping functionality has been removed from this application.',
      status: 'Disabled',
      apiKeyValid: false,
      connected: false,
      browserType: 'None'
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      error: 'Failed to check status',
      message: error.message
    });
  }
};

/**
 * Update Browserless configuration
 */
exports.updateConfig = async (req, res) => {
  res.status(403).json({
    success: false,
    message: 'Web scraping functionality has been removed from this application.'
  });
};

/**
 * Run Browserless connection test with SSE
 */
exports.runTest = (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send log message
  const sendLog = (message, level = 'info') => {
    const data = {
      type: 'log',
      message,
      level
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Inform the user that scraping has been disabled
  sendLog('Web scraping functionality has been removed from this application.', 'error');
  sendLog('The application now relies solely on database operations.', 'info');
  
  // Send done event
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}; 