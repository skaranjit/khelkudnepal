const puppeteer = require('puppeteer-core');

/**
 * Utility for connecting to Browserless.io service or local Puppeteer
 */
class BrowserService {
  /**
   * Check if a Browserless API key is valid
   * @param {string} key - The API key to validate
   * @returns {boolean} Whether the key appears valid
   */
  static isValidApiKey(key) {
    // Basic validation - check if it's a non-empty string and not the placeholder
    return Boolean(
      key && 
      typeof key === 'string' && 
      key.length > 20 && 
      key !== 'your-browserless-api-key-here' &&
      !/^(your|my|test|demo|example|sample)/.test(key.toLowerCase())
    );
  }

  /**
   * Get a connected browser instance
   * @param {Object} options - Browser launch options
   * @returns {Promise<Browser>} Browser instance
   */
  static async getBrowser(options = {}) {
    try {
      // Check if we have a Browserless API key
      const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
      
      if (this.isValidApiKey(browserlessApiKey)) {
        console.log('Connecting to Browserless.io service...');
        
        try {
          return await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessApiKey}`,
            ...options
          });
        } catch (connectError) {
          console.error('Failed to connect to Browserless.io:', connectError.message);
          console.log('Falling back to local Puppeteer...');
        }
      }
      
      // Fall back to regular puppeteer if no Browserless API key or connection failed
      console.log('Using local Puppeteer instance...');
      const localPuppeteer = require('puppeteer');
      
      return await localPuppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ],
        timeout: 30000,
        ...options
      });
    } catch (error) {
      console.error('Error creating browser instance:', error);
      
      // Last resort fallback with minimal options
      console.log('Attempting fallback browser launch with minimal options...');
      const localPuppeteer = require('puppeteer');
      
      return localPuppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }
  
  /**
   * Create a new page with stealth settings
   * @param {Browser} browser - Browser instance
   * @returns {Promise<Page>} Page instance
   */
  static async createStealthPage(browser) {
    try {
      const page = await browser.newPage();
      
      // Set realistic browser behavior
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });
      
      // Apply additional page settings
      await page.setJavaScriptEnabled(true);
      await page.setDefaultNavigationTimeout(30000);
      
      // Add stealth settings to avoid detection
      await page.evaluateOnNewDocument(() => {
        // Overwrite the 'webdriver' property to prevent detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Overwrite the plugins length to prevent detection
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        // Overwrite the languages property to prevent detection
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Add a fake chrome object to fool checks
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {},
        };
      });
      
      return page;
    } catch (error) {
      console.error('Error creating stealth page:', error);
      throw error;
    }
  }
  
  /**
   * Safely close a browser instance
   * @param {Browser} browser - Browser instance to close
   */
  static async closeBrowser(browser) {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (error) {
      console.error('Error closing browser:', error.message);
    }
  }
}

module.exports = BrowserService; 