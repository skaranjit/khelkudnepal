/**
 * Test script for Browserless connection
 * Run with: node utils/testBrowserless.js
 */

const dotenv = require('dotenv');
dotenv.config();

const BrowserService = require('./browserless');

/**
 * Test Browserless connection
 */
async function testBrowserlessConnection() {
  let browser = null;
  try {
    console.log('Testing Browserless connection...');
    
    // Check if API key is configured
    const apiKey = process.env.BROWSERLESS_API_KEY;
    if (!BrowserService.isValidApiKey(apiKey)) {
      console.log('\n⚠️  Warning: BROWSERLESS_API_KEY may not be valid');
      
      if (!apiKey) {
        console.log('The API key is not defined in the .env file');
      } else if (apiKey === 'your-browserless-api-key-here') {
        console.log('The API key is set to the example placeholder value');
      } else if (apiKey.length < 20) {
        console.log('The API key appears to be too short to be valid');
      } else {
        console.log('The API key appears to have an invalid format');
      }
      
      console.log('\nThe system will fall back to using local Puppeteer\n');
    } else {
      console.log(`Using Browserless API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
      console.log('API key appears to be valid');
    }
    
    // Get browser instance
    console.log('Attempting to connect to browser...');
    browser = await BrowserService.getBrowser();
    console.log('✅ Successfully connected to browser');
    
    // Create stealth page
    console.log('Creating stealth page...');
    const page = await BrowserService.createStealthPage(browser);
    console.log('✅ Successfully created stealth page');
    
    // Navigate to a test page
    console.log('Testing navigation to example.com...');
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('✅ Successfully navigated to example.com');
    
    // Test page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Take a screenshot
    console.log('Taking a screenshot...');
    await page.screenshot({ path: 'browserless-test.png' });
    console.log('✅ Screenshot saved as browserless-test.png');
    
    console.log('\n✅ All tests passed! Browserless is working correctly.');
    return true;
  } catch (error) {
    console.error('\n❌ Error testing Browserless connection:', error.message);
    console.error(error);
    return false;
  } finally {
    // Clean up
    if (browser) {
      console.log('Closing browser...');
      await BrowserService.closeBrowser(browser);
      console.log('Browser closed');
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testBrowserlessConnection()
    .then(success => {
      if (success) {
        console.log('\nBrowserless test completed successfully');
      } else {
        console.error('\nBrowserless test failed');
      }
    })
    .catch(err => {
      console.error('Unexpected error:', err);
    });
}

module.exports = { testBrowserlessConnection }; 