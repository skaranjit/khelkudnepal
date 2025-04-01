const fs = require('fs');
const path = require('path');
const BrowserService = require('../../utils/browserless');
const { testBrowserlessConnection } = require('../../utils/testBrowserless');
const dotenv = require('dotenv');
const { PassThrough } = require('stream');

/**
 * Show the Browserless status page
 */
exports.showBrowserlessPage = (req, res) => {
  res.render('admin/browserless', {
    title: 'Browserless Status',
    activeNav: 'browserless'
  });
};

/**
 * Check Browserless connection status
 */
exports.getStatus = async (req, res) => {
  try {
    let browser = null;
    let connected = false;
    let browserType = 'Unknown';
    const apiKeyValid = BrowserService.isValidApiKey(process.env.BROWSERLESS_API_KEY);
    
    try {
      // Try to connect to the browser
      browser = await BrowserService.getBrowser();
      connected = true;
      
      // Get browser version
      const version = await browser.version();
      browserType = version.includes('browserless') ? 'Browserless.io (Cloud)' : 'Local Puppeteer';
      
    } catch (error) {
      console.error('Error checking Browserless status:', error);
      connected = false;
    } finally {
      if (browser) {
        await BrowserService.closeBrowser(browser);
      }
    }
    
    res.json({
      apiKeyValid,
      connected,
      browserType
    });
  } catch (error) {
    console.error('Error getting Browserless status:', error);
    res.status(500).json({
      error: 'Failed to check Browserless status',
      message: error.message
    });
  }
};

/**
 * Update Browserless configuration
 */
exports.updateConfig = async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }
    
    // Read .env file
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update API key
    let newEnvContent;
    if (envContent.includes('BROWSERLESS_API_KEY=')) {
      newEnvContent = envContent.replace(
        /BROWSERLESS_API_KEY=.*/,
        `BROWSERLESS_API_KEY=${apiKey}`
      );
    } else {
      newEnvContent = envContent + `\nBROWERLESS_API_KEY=${apiKey}`;
    }
    
    // Write updated .env file
    fs.writeFileSync(envPath, newEnvContent, 'utf8');
    
    // Update process.env
    process.env.BROWSERLESS_API_KEY = apiKey;
    
    res.json({
      success: true,
      message: 'Browserless configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating Browserless configuration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Run Browserless connection test with SSE
 */
exports.runTest = (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Create custom log function
  const sendLog = (message, level = 'info') => {
    const data = {
      type: 'log',
      message,
      level
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Set up logging
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = (message, ...args) => {
    originalConsoleLog(message, ...args);
    if (typeof message === 'string') {
      sendLog(message, 'info');
    }
  };
  
  console.error = (message, ...args) => {
    originalConsoleError(message, ...args);
    if (typeof message === 'string') {
      sendLog(message, 'error');
    }
  };
  
  // Run the test
  (async () => {
    sendLog('Starting Browserless connection test...', 'info');
    
    try {
      const testResult = await testBrowserlessConnection();
      
      if (testResult) {
        sendLog('Test completed successfully!', 'success');
        
        // Notify about screenshot
        res.write(`data: ${JSON.stringify({
          type: 'screenshot',
          path: '/static/browserless-test.png'
        })}\n\n`);
      } else {
        sendLog('Test failed', 'error');
      }
    } catch (error) {
      sendLog(`Test error: ${error.message}`, 'error');
    } finally {
      // Restore original console functions
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      
      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }
  })();
}; 