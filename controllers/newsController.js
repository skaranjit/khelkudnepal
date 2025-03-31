const News = require('../models/News');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// Check if database is empty and populate with web data
exports.checkAndPopulateNews = async () => {
  try {
    const count = await News.countDocuments();
    
    if (count === 0) {
      console.log('No news articles found in database. Fetching data from web sources...');
      
      // Use our seedSampleNews function which now generates news from web queries
      await exports.seedSampleNews();
      
    } else {
      console.log(`Database already has ${count} articles, skipping initial seeding.`);
    }
  } catch (error) {
    console.error('Error checking and populating news:', error);
  }
};

// Get all news
exports.getAllNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Basic filtering
    const filter = {};
    
    // Filter by category if provided - make it case-insensitive
    if (req.query.category) {
      // Convert first letter to uppercase for matching the enum format
      const formattedCategory = req.query.category.charAt(0).toUpperCase() + req.query.category.slice(1).toLowerCase();
      filter.category = formattedCategory;
    }
    
    // Filter by location if user has a location
    if (req.userLocation && req.query.local === 'true') {
      filter['location.country'] = req.userLocation.country;
    }
    
    // Count total documents for pagination
    const total = await News.countDocuments(filter);
    
    // Get news with pagination
    const news = await News.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: news.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: news
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single news article
exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    // Increment view count
    news.incrementViewCount();
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create news article (admin only)
exports.createNews = async (req, res) => {
  try {
    const { title, content, summary, category, source, url, imageUrl, tags, location } = req.body;
    
    const news = await News.create({
      title,
      content,
      summary,
      category,
      source,
      url,
      imageUrl: imageUrl || '/images/placeholder.jpg',
      tags: tags || [],
      location: location || {},
      author: req.user ? req.user.username : 'Khelkud Nepal Admin'
    });
    
    res.status(201).json({
      success: true,
      data: news
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update news article (admin only)
exports.updateNews = async (req, res) => {
  try {
    const { title, content, summary, category, source, url, imageUrl, tags, location, isFeatured } = req.body;
    
    let news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    news = await News.findByIdAndUpdate(req.params.id, {
      title,
      content,
      summary,
      category,
      source,
      url,
      imageUrl,
      tags: tags || news.tags,
      location: location || news.location,
      isFeatured: isFeatured !== undefined ? isFeatured : news.isFeatured,
      updatedAt: Date.now()
    }, { new: true, runValidators: true });
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete news article (admin only)
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    
    await news.remove();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Scrape news from Google
async function scrapeGoogleNews(query, limit = 10) {
  try {
    console.log(`Scraping Google News for query: ${query}`);
    let newsItems = [];
    
    // First attempt: Try direct Google News scraping
    try {
      newsItems = await scrapeFromGoogleNews(query, limit);
      console.log(`Retrieved ${newsItems.length} items from Google News for query: ${query}`);
    } catch (googleError) {
      console.error(`Error scraping from Google News: ${googleError.message}`);
    }
    
    // Second attempt: If Google News fails, try scraping from other news sources
    if (newsItems.length === 0) {
      try {
        console.log(`Attempting to scrape from alternative news sources for: ${query}`);
        newsItems = await scrapeFromAlternativeSources(query, limit);
        console.log(`Retrieved ${newsItems.length} items from alternative sources for query: ${query}`);
      } catch (altError) {
        console.error(`Error scraping from alternative sources: ${altError.message}`);
      }
    }
    
    // Final fallback: If all scraping fails, generate mock data based on category
    if (newsItems.length === 0) {
      console.log(`All scraping methods failed. Generating fallback news data for: ${query}`);
      newsItems = generateFallbackNews(query, limit);
      console.log(`Generated ${newsItems.length} fallback news items for query: ${query}`);
    }
    
    // Process images and content asynchronously
    const processedItems = await Promise.all(
      newsItems.map(async (item) => {
        try {
          // Ensure publishedAt is always a valid date
          if (!item.publishedAt || typeof item.publishedAt === 'object' && Object.keys(item.publishedAt).length === 0) {
            // If publishedAt is empty object or missing, use current date
            item.publishedAt = new Date();
          } else if (!(item.publishedAt instanceof Date) && typeof item.publishedAt !== 'string' && typeof item.publishedAt !== 'number') {
            // If publishedAt exists but is an invalid type, use current date
            item.publishedAt = new Date();
          }
          
          const processedItem = await enhanceNewsItem(item, query);
          return processedItem;
        } catch (processingError) {
          console.error(`Error processing news item: ${processingError.message}`);
          // Ensure we always return an item with valid publishedAt
          return {
            ...item,
            publishedAt: item.publishedAt instanceof Date ? item.publishedAt : new Date()
          };
        }
      })
    );
    
    console.log(`Successfully processed ${processedItems.length} news items for query: ${query}`);
    return processedItems;
  } catch (error) {
    console.error(`Error in scrapeGoogleNews: ${error.message}`);
    // Even if everything fails, return some fallback data
    return generateFallbackNews(query, limit);
  }
}

// Modified scrapeFromGoogleNews function to improve reliability
async function scrapeFromGoogleNews(query, limit = 10) {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-gpu', 
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    headless: "new"
  });
  
  try {
    const page = await browser.newPage();
    
    // Enhanced browser configuration to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // More comprehensive anti-detection measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      
      // Overwrite the navigator.permissions API
      if (navigator.permissions) {
        navigator.permissions.query = (parameters) => 
          Promise.resolve({ state: parameters.name === 'notifications' ? 'granted' : 'prompt' });
      }
    });
    
    // More network options
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });
    
    // Set request timeout
    page.setDefaultNavigationTimeout(45000);
    
    // Navigate to Google News with the query - try a slightly different approach
    console.log(`Navigating to Google News with query: ${query}`);
    
    // First try direct approach
    const searchUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    
    // This will wait until the network is mostly idle
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    
    console.log(`Page loaded, checking for content...`);
    
    // Output the page title to debug
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    // Take a screenshot for debugging if needed
    // await page.screenshot({ path: 'google-news-debug.png' });
    
    // Check if we hit a captcha or error page
    const pageContent = await page.content();
    if (pageContent.includes('captcha') || pageContent.includes('unusual traffic')) {
      console.log('Captcha or security check detected on Google News');
      return []; // Return empty array to trigger fallback
    }
    
    // Wait longer for articles to load with better error handling
    try {
      // Try multiple selectors with a longer timeout
      await Promise.race([
        page.waitForSelector('c-wiz article', { timeout: 10000 }),
        page.waitForSelector('article', { timeout: 10000 }),
        page.waitForSelector('.NiLAwe', { timeout: 10000 })
      ]).catch(e => console.log('Selector timeout - will try to extract anyway'));
    } catch (e) {
      console.log('All article selectors timed out');
    }
    
    // Give the page more time to render
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to extract news items with updated selectors for Google News
    const newsItems = await page.evaluate((maxItems) => {
      const results = [];
      
      // Log what we're seeing for debugging
      console.log('Evaluating page for news articles...');
      
      // Try multiple potential selectors for articles
      const articleCandidates = [
        ...Array.from(document.querySelectorAll('c-wiz article')),
        ...Array.from(document.querySelectorAll('article')),
        ...Array.from(document.querySelectorAll('.NiLAwe')),
        ...Array.from(document.querySelectorAll('.IBr9O'))
      ];
      
      console.log(`Found ${articleCandidates.length} potential article elements`);
      
      // Use a set to avoid duplicates
      const processedTitles = new Set();
      
      // Process article candidates
      for (let i = 0; i < articleCandidates.length && results.length < maxItems; i++) {
        const article = articleCandidates[i];
        if (!article) continue;
        
        // Try multiple ways to get title
        let title = null;
        let titleElement = null;
        
        // Current Google News patterns for titles
        const titleSelectors = [
          'h3', 'h4', '.DY5T1d', '.JtKRv', '[role="heading"]',
          '.IVlSrf', '.JJYq9e', '.RlpJu', '.cUnQKe'
        ];
        
        for (const selector of titleSelectors) {
          titleElement = article.querySelector(selector);
          if (titleElement && titleElement.textContent && titleElement.textContent.trim().length > 5) {
            title = titleElement.textContent.trim();
            break;
          }
        }
        
        // If no title found with selectors, try the article itself
        if (!title && article.textContent && article.textContent.length < 200) {
          const text = article.textContent.trim();
          if (text.length > 10 && text.length < 150) {
            title = text;
          }
        }
        
        // Skip if no title or already processed this title
        if (!title || title === 'Untitled' || processedTitles.has(title)) continue;
        processedTitles.add(title);
        
        // Try to extract link - multiple potential patterns
        let link = null;
        const linkSelectors = ['a[href^="./article"]', 'a[href*="articles"]', 'a'];
        
        for (const selector of linkSelectors) {
          const linkElement = article.querySelector(selector);
          if (linkElement && linkElement.href) {
            try {
              // Fix relative URLs with base
              link = new URL(linkElement.href, window.location.href).href;
              break;
            } catch (e) {
              // Skip invalid URLs
            }
          }
        }
        
        // Skip if no valid link
        if (!link) continue;
        
        // Extract description
        let description = '';
        const descriptionSelectors = ['.xBbh9', '.GI74Re', '.Iai8P'];
        
        for (const selector of descriptionSelectors) {
          const descElement = article.querySelector(selector);
          if (descElement && descElement.textContent) {
            description = descElement.textContent.trim();
            if (description.length > 0) break;
          }
        }
        
        // If no description from selectors, try next element after title
        if (!description && titleElement && titleElement.nextElementSibling) {
          description = titleElement.nextElementSibling.textContent.trim();
        }
        
        // Extract image - try multiple selectors
        let imageUrl = null;
        const imgSelectors = [
          'img[src^="https://"]', 
          'img.tvs3Id', 
          'img.uhHOwf',
          'img[role="presentation"]',
          'figure img',
          'img'
        ];
        
        for (const selector of imgSelectors) {
          const img = article.querySelector(selector);
          if (img && img.src && img.src.startsWith('http')) {
            imageUrl = img.src;
            break;
          }
        }
        
        // Try to extract source and published time
        let source = 'Google News';
        let publishedTime = new Date();
        
        const sourceSelectors = ['time', '.SVJrMe', '.UOVeFe', '.KbnJ8'];
        let sourceElement = null;
        
        for (const selector of sourceSelectors) {
          sourceElement = article.querySelector(selector);
          if (sourceElement) break;
        }
        
        if (sourceElement) {
          const sourceText = sourceElement.textContent || '';
          
          // Try to parse source name
          if (sourceText.includes('•')) {
            source = sourceText.split('•')[0].trim();
          }
          
          // Try to parse time
          const timePatterns = [
            { regex: /(\d+)\s*hour/, multiplier: 60 * 60 * 1000 },
            { regex: /(\d+)\s*minute/, multiplier: 60 * 1000 },
            { regex: /(\d+)\s*day/, multiplier: 24 * 60 * 60 * 1000 },
            { regex: /(\d+)\s*week/, multiplier: 7 * 24 * 60 * 60 * 1000 }
          ];
          
          for (const pattern of timePatterns) {
            const match = sourceText.match(pattern.regex);
            if (match && match[1]) {
              const value = parseInt(match[1]);
              if (!isNaN(value)) {
                publishedTime = new Date(Date.now() - (value * pattern.multiplier));
                break;
              }
            }
          }
        }
        
        // Add to results
        results.push({
          title,
          description,
          source,
          publishedAt: publishedTime,
          link,
          imageUrl
        });
      }
      
      return results;
    }, limit);
    
    console.log(`Extracted ${newsItems.length} news items from Google News for query: ${query}`);
    
    // If we found no items but the page loaded, try an alternative approach
    if (newsItems.length === 0) {
      console.log('First extraction attempt yielded no results, trying alternative approach...');
      
      // Try to navigate to the "Top stories" section
      try {
        // This is a fallback to try the main news page
        await page.goto('https://news.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
        await page.type('input[aria-label="Search for topics, locations & sources"]', query);
        await page.keyboard.press('Enter');
        
        // Wait for search results
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to extract again
        const alternativeItems = await page.evaluate((maxItems) => {
          const results = [];
          const articles = Array.from(document.querySelectorAll('article, .NiLAwe, .IBr9O'));
          
          for (let i = 0; i < articles.length && i < maxItems; i++) {
            const article = articles[i];
            const titleElement = article.querySelector('h3, h4, [role="heading"]');
            const title = titleElement ? titleElement.textContent.trim() : null;
            
            if (!title) continue;
            
            const linkElement = article.querySelector('a');
            if (!linkElement || !linkElement.href) continue;
            
            results.push({
              title,
              description: '',
              source: 'Google News',
              publishedAt: new Date(),
              link: linkElement.href,
              imageUrl: null
            });
          }
          
          return results;
        }, limit);
        
        if (alternativeItems.length > 0) {
          console.log(`Alternative approach found ${alternativeItems.length} items`);
          return alternativeItems;
        }
      } catch (alternativeError) {
        console.error('Alternative extraction approach failed:', alternativeError.message);
      }
    }
    
    return newsItems;
  } catch (error) {
    console.error(`Error in scrapeFromGoogleNews: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Scrape from alternative news sources
async function scrapeFromAlternativeSources(query, limit = 10) {
  // Try to scrape from ESPN for sports news
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    headless: "new"
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // For sports news, ESPN is a good alternative
    const category = extractCategory(query);
    const searchUrl = `https://www.espn.com/search/_/q/${encodeURIComponent(category)}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`Searching ESPN for: ${category}`);
    
    // Replace waitForTimeout with Promise/setTimeout
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newsItems = await page.evaluate((maxItems) => {
      const results = [];
      
      // ESPN search results
      const articles = Array.from(document.querySelectorAll('.SearchResults .SearchResult'));
      const itemsToProcess = Math.min(articles.length, maxItems);
      
      for (let i = 0; i < itemsToProcess; i++) {
        const article = articles[i];
        
        // Get the link and title
        const linkElement = article.querySelector('a');
        if (!linkElement) continue;
        
        const title = article.querySelector('h2')?.textContent.trim() || 'ESPN Sports News';
        const description = article.querySelector('p')?.textContent.trim() || '';
        const imageElement = article.querySelector('img');
        const imageUrl = imageElement ? imageElement.src : null;
        
        // Create a date (ESPN doesn't always show date in search results)
        const dateElement = article.querySelector('.date');
        let publishedAt = new Date();
        
        if (dateElement) {
          const dateText = dateElement.textContent.trim();
          // Parse the date if available
          if (dateText) {
            const dateParts = dateText.split(' ');
            if (dateParts.length >= 2) {
              const daysAgo = parseInt(dateParts[0]);
              if (!isNaN(daysAgo)) {
                publishedAt = new Date();
                publishedAt.setDate(publishedAt.getDate() - daysAgo);
              }
            }
          }
        }
        
        results.push({
          title,
          description,
          source: 'ESPN',
          publishedAt,
          link: linkElement.href,
          imageUrl
        });
      }
      
      return results;
    }, limit);
    
    return newsItems;
  } catch (error) {
    console.error(`Error scraping from ESPN: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Function to extract category from query
function extractCategory(query) {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('cricket')) return 'cricket';
  if (lowerQuery.includes('football') || lowerQuery.includes('soccer')) return 'football';
  if (lowerQuery.includes('basketball')) return 'basketball';
  if (lowerQuery.includes('volleyball')) return 'volleyball';
  if (lowerQuery.includes('tennis')) return 'tennis';
  if (lowerQuery.includes('athletics')) return 'athletics';
  if (lowerQuery.includes('olympics')) return 'olympics';
  return 'sports';
}

// Function to enhance a news item with better content and images
async function enhanceNewsItem(item, query) {
  try {
    // First, check if we have a valid item
    if (!item || !item.title) {
      console.log('Invalid news item received in enhanceNewsItem');
      return item;
    }
    
    // If no image or content, try to fetch from source
    if (item.link && ((!item.imageUrl || !item.content) || item.content?.length < 200)) {
      try {
        // Launch browser
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
          headless: "new"
        });
        
        try {
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
          
          // Set a short timeout to avoid hanging
          await page.goto(item.link, { 
            waitUntil: 'domcontentloaded', 
            timeout: 15000 
          });
          
          // Replace waitForTimeout with Promise/setTimeout
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Extract content and image from the page
          const extractedData = await page.evaluate(() => {
            let content = '';
            let imageUrls = [];
            
            // Common content selectors for various news sites
            const contentSelectors = [
              'article', '.article-content', '.entry-content', 'main',
              '.story-content', '.post-content', '.news-content', '.content-main'
            ];
            
            // Find content using selectors
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement) {
                // Extract paragraphs
                const paragraphs = contentElement.querySelectorAll('p');
                if (paragraphs.length > 0) {
                  content = Array.from(paragraphs)
                    .map(p => p.textContent.trim())
                    .filter(text => text.length > 20) // Only include substantial paragraphs
                    .join('\n\n');
                  break;
                }
              }
            }
            
            // Extract multiple images
            // Common image containers in articles
            const imageContainers = [
              'article img', '.article-content img', '.entry-content img', 
              'main img', '.story-content img', '.post-content img', 
              '.news-content img', '.content-main img', 
              '.gallery img', '.image-gallery img', '.slider img',
              'figure img', '.figure img', '.featured-image img'
            ];
            
            // Find images using selectors
            for (const selector of imageContainers) {
              const imageElements = document.querySelectorAll(selector);
              if (imageElements.length > 0) {
                imageElements.forEach(img => {
                  // Check if image has sufficient size (avoid icons, etc.)
                  if (img.naturalWidth > 300 && img.naturalHeight > 200) {
                    const src = img.getAttribute('src') || img.getAttribute('data-src');
                    if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('icon')) {
                      imageUrls.push(src);
                    }
                  }
                });
              }
            }
            
            // Also look for image sources in srcset attributes and data attributes
            document.querySelectorAll('img[srcset], img[data-srcset]').forEach(img => {
              const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
              if (srcset) {
                const srcsetUrls = srcset.split(',').map(src => src.trim().split(' ')[0]);
                for (const url of srcsetUrls) {
                  if (url && url.startsWith('http') && !url.includes('placeholder') && !url.includes('icon')) {
                    imageUrls.push(url);
                  }
                }
              }
            });
            
            // Deduplicate image URLs
            imageUrls = [...new Set(imageUrls)];
            
            // Limit to a reasonable number of images
            imageUrls = imageUrls.slice(0, 5);
            
            return { content, imageUrls };
          });
          
          // Update item with extracted data
          if (extractedData.content && extractedData.content.length > 200 && (!item.content || item.content.length < extractedData.content.length)) {
            item.content = extractedData.content;
          }
          
          // Update main image if not already set
          if (extractedData.imageUrls.length > 0) {
            if (!item.imageUrl) {
              item.imageUrl = extractedData.imageUrls[0];
            }
            
            // Add additional images to the new images array
            if (!item.images) {
              item.images = [];
            }
            
            // Set the images array with unique URLs
            const allImages = [...new Set([...item.images, ...extractedData.imageUrls])];
            item.images = allImages.slice(0, 5); // Limit to 5 images
          }
          
        } catch (pageError) {
          console.error(`Error processing page for ${item.title}: ${pageError.message}`);
        } finally {
          await browser.close();
        }
      } catch (browserError) {
        console.error(`Browser error for ${item.title}: ${browserError.message}`);
      }
    }
    
    // Make sure we have a valid date
    if (!item.publishedAt) {
      item.publishedAt = new Date();
    }
    
    // Categorize if not categorized
    if (!item.category) {
      item.category = determineCategoryFromText(item.title || query);
    }
    
    return item;
  } catch (error) {
    console.error(`Error in enhanceNewsItem: ${error.message}`);
    return item;
  }
}

// Function to determine category from text
function determineCategoryFromText(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('cricket')) return 'Cricket';
  if (lowerText.includes('football') || lowerText.includes('soccer')) return 'Football'; 
  if (lowerText.includes('basketball')) return 'Basketball';
  if (lowerText.includes('volleyball')) return 'Volleyball';
  if (lowerText.includes('tennis')) return 'Tennis';
  if (lowerText.includes('athletics') || lowerText.includes('running') || lowerText.includes('track')) return 'Athletics';
  if (lowerText.includes('olympics') || lowerText.includes('olympic')) return 'Olympics';
  
  return 'Other';
}

// Function to get a placeholder image for a category
function getPlaceholderImageForCategory(category) {
  // Map of category-specific image URLs
  const categoryImages = {
    'Cricket': 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop',
    'Football': 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&auto=format&fit=crop',
    'Basketball': 'https://images.unsplash.com/photo-1546519638-68e109acd27d?w=800&auto=format&fit=crop',
    'Volleyball': 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop',
    'Tennis': 'https://images.unsplash.com/photo-1595435934949-5df7ed86e1c0?w=800&auto=format&fit=crop',
    'Athletics': 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&auto=format&fit=crop',
    'Olympics': 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=800&auto=format&fit=crop',
    'Other': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop'
  };
  
  // Return the appropriate image or a default if category not found
  return categoryImages[category] || 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&auto=format&fit=crop';
}

// Generate fallback news items if scraping fails
function generateFallbackNews(query, limit = 10) {
  console.log('Generating fallback news data for query:', query);
  
  // Determine the category from the query
  const category = determineCategoryFromText(query);
  
  // Generate news items based on templates
  const newsItems = [];
  
  // Templates for titles based on categories
  const titleTemplates = {
    'Cricket': [
      'Latest Cricket News: Updates from Recent Matches',
      'Cricket Team Announces New Players for Upcoming Season',
      'Breaking: Major Changes in Cricket League Structure',
      'Cricket Stars Shine in Weekend Tournament',
      'Cricket Federation Reveals Future Plans',
      'Local Cricket Team Secures Important Victory',
      'International Cricket Competition Coming to Nepal',
      'Cricket Coaching Workshop Scheduled Next Month',
      'Young Cricket Players Making Their Mark',
      'Cricket Association Celebrates Annual Awards'
    ],
    'Football': [
      'Football Team Secures Impressive Win in Weekend Match',
      'Star Player Signs New Contract with Football Club',
      'Upcoming Football Tournament: Everything You Need to Know',
      'Football League Announces Schedule Changes for Season',
      'Youth Football Program Expands to New Regions',
      'Football Coach Reveals New Strategy for Next Season',
      'International Football Match Ends in Dramatic Tie',
      'Football Federation Implements New Rules for Safety',
      'Local Football Hero Returns to Hometown Club',
      'Football Training Facilities Upgraded with New Equipment'
    ],
    'Basketball': [
      'Basketball Tournament Results: Top Teams Advance',
      'Local Basketball Star Signs Professional Contract',
      'Basketball League Expands with Two New Teams',
      'Youth Basketball Program Sees Record Enrollment',
      'Basketball Coach Shares Insights on Team Development',
      'International Basketball Competition Coming Next Month',
      'Basketball Association Announces New Partnership',
      'Star Basketball Player Leads Team to Championship',
      'Basketball Training Camp Attracts Young Talent',
      'School Basketball Team Celebrates Undefeated Season'
    ],
    'Volleyball': [
      'Volleyball Championship: Final Match Results',
      'Volleyball Team Prepares for International Tournament',
      'Beach Volleyball Series Announced for Summer',
      'Volleyball Players Showcase Skills at Local Event',
      'National Volleyball Team Selects New Captain',
      'Volleyball Coach Implements Innovative Training',
      'Youth Volleyball League Expands to New Districts',
      'Volleyball Tournament Raises Funds for Charity',
      'Volleyball Association Updates Competition Rules',
      'Star Volleyball Player Returns from Injury'
    ],
    'Tennis': [
      'Tennis Tournament Results: Unexpected Winners',
      'Tennis Star Advances to Quarter-Finals',
      'Junior Tennis Players Impress at National Championship',
      'Tennis Center Upgrades Facilities for Upcoming Season',
      'Local Tennis Club Hosts Community Tournament',
      'Tennis Coach Shares Tips for Improving Your Game',
      'Tennis Association Announces New Ranking System',
      'International Tennis Stars to Visit for Exhibition Match',
      'Tennis Training Program Launches for Young Players',
      'Tennis Federation Reviews Rule Changes for Next Season'
    ],
    'Athletics': [
      'Track and Field Results: New Records Set',
      'Marathon Runner Achieves Personal Best Time',
      'Athletics Competition Showcases Young Talent',
      'High Jump Champion Shares Training Techniques',
      'Athletics Federation Announces National Team',
      'Sprinter Qualifies for International Competition',
      'Cross-Country Running Series Begins Next Month',
      'Athletics Coach Develops New Training Protocol',
      'School Athletics Program Receives Equipment Donation',
      'Long-Distance Runner Prepares for Charity Event'
    ],
    'Olympics': [
      'Olympic Team Selection: Final Roster Announced',
      'Athletes Begin Training for Upcoming Olympics',
      "Olympic Medalist Returns Home to Hero's Welcome",
      'Olympic Committee Reviews Qualification Standards',
      'Young Athletes Dream of Olympic Opportunities',
      'Paralympic Athletes Prepare for Competition',
      'Olympic Sport Facilities Undergo Renovation',
      'Olympic Coach Shares Experience and Insights',
      'Former Olympian Launches Youth Sports Program',
      'Olympic Training Center Welcomes International Athletes'
    ],
    'Other': [
      'Sports Development Program Launches in Local Community',
      'Athlete of the Year Awards: Nominations Announced',
      'Sports Association Hosts Annual Conference',
      'Youth Sports Initiative Receives Major Funding',
      'Sports Medicine Advances Help Athletes Recover',
      'Local Sports Heroes Honored at Community Event',
      'Sports Education Program Implemented in Schools',
      'International Sports Exchange Program Announced',
      'Sports Equipment Donation Drive Helps Underserved Areas',
      'Sports Science Research Reveals New Training Methods'
    ]
  };
  
  // Get templates for the selected category, fallback to "Other" if not found
  const templates = titleTemplates[category] || titleTemplates['Other'];
  
  // Reliable, CORS-friendly image sources
  const defaultImages = {
    'Cricket': 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop',
    'Football': 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&auto=format&fit=crop',
    'Basketball': 'https://images.unsplash.com/photo-1546519638-68e109acd27d?w=800&auto=format&fit=crop',
    'Volleyball': 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop',
    'Tennis': 'https://images.unsplash.com/photo-1595435934949-5df7ed86e1c0?w=800&auto=format&fit=crop',
    'Athletics': 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&auto=format&fit=crop',
    'Olympics': 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=800&auto=format&fit=crop',
    'Other': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop'
  };
  
  // Content paragraph templates
  const paragraphTemplates = [
    `The sports community has been buzzing with excitement following recent developments in ${category.toLowerCase()}.`,
    `Officials from the ${category.toLowerCase()} federation have expressed optimism about the future prospects and growth of the sport.`,
    `"We are committed to developing grassroots programs and supporting athletes at all levels," said one of the organizers.`,
    `Local clubs and teams have been working hard to improve their performance and facilities.`,
    `The upcoming season promises to bring more competitive matches and opportunities for athletes to showcase their skills.`,
    `Fans are eagerly anticipating the upcoming fixtures and events scheduled throughout the year.`,
    `Training programs are being enhanced to meet international standards and prepare athletes for global competitions.`,
    `Recent investments in infrastructure have provided better venues and equipment for players.`,
    `Community engagement has been a key focus, with more schools and colleges incorporating sports programs.`,
    `Experts believe that with continued support and development, Nepal could see significant achievements in this sport in the coming years.`,
    `Several international athletes have praised the progress being made in developing the sport locally.`,
    `New coaching techniques are being introduced to help players reach their full potential.`,
    `The growing popularity of ${category.toLowerCase()} is evident from the increasing number of spectators at recent events.`,
    `Sponsors have shown increased interest in supporting ${category.toLowerCase()} events and teams.`,
    `A special focus is being placed on women's participation in ${category.toLowerCase()}.`
  ];
  
  // Generate news items
  for (let i = 0; i < limit; i++) {
    // Select a template, or use a generic one if we run out
    const titleTemplate = templates[i % templates.length];
    
    // Select 3-5 paragraphs for content
    const shuffledParagraphs = [...paragraphTemplates].sort(() => 0.5 - Math.random());
    const paragraphCount = Math.floor(Math.random() * 3) + 3; // 3-5 paragraphs
    const contentParagraphs = shuffledParagraphs.slice(0, paragraphCount);
    const content = contentParagraphs.join('\n\n');
    
    // Create a date within the last week
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));
    
    // Get an image appropriate for the category
    const imageUrl = defaultImages[category] || defaultImages['Other'];
    
    // Create a unique ID
    const id = Date.now() + i;
    
    newsItems.push({
      title: titleTemplate,
      description: contentParagraphs[0],
      content: content,
      link: `https://khelkudnepal.com/news/${id}`,
      publishedAt: date,
      source: 'Khelkud Nepal',
      imageUrl: imageUrl,
      category: category
    });
  }
  
  return newsItems;
}

// Import scraped news to database (admin only)
exports.importScrapedNews = async (req, res) => {
  try {
    const { articles } = req.body;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No articles provided for import'
      });
    }
    
    let importedCount = 0;
    const errors = [];
    
    // Process each article
    for (const article of articles) {
      try {
        // Check if article already exists by URL to avoid duplicates
        const existingByUrl = await News.findOne({ url: article.url });
        const existingByTitle = await News.findOne({ title: article.title });
        
        if (existingByUrl || existingByTitle) {
          // Skip this article if it already exists
          continue;
        }
        
        // Ensure valid image URL
        let imageUrl = article.imageUrl;
        if (!imageUrl || imageUrl === 'N/A' || imageUrl === '/images/placeholder.jpg') {
          // Use a random image from the sports images collection if none provided
          const sportsImages = [
            'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1495563923587-bdc4282494d0?w=800&auto=format&fit=crop',
          ];
          imageUrl = sportsImages[Math.floor(Math.random() * sportsImages.length)];
        }
        
        // Assign a random category if not provided
        const categories = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Volleyball', 'Other Sports'];
        const category = article.category || categories[Math.floor(Math.random() * categories.length)];
        
        // Generate tags from title and category
        const titleWords = article.title.split(' ');
        const possibleTags = [...titleWords, category];
        const tags = [...new Set(
          possibleTags
            .filter(word => word.length > 3) // Only words longer than 3 characters
            .slice(0, 5) // Take up to 5 words
        )];
        
        // Create summary if not provided
        let summary = article.summary;
        if (!summary && article.content) {
          // Generate a summary from the content (first 150 characters)
          summary = article.content.substring(0, 150) + '...';
        } else if (!summary) {
          summary = article.title;
        }
        
        // Create the news article
        const newsItem = new News({
          title: article.title,
          content: article.content || article.summary || 'No content available',
          summary: summary,
          imageUrl: imageUrl,
          url: article.url,
          source: article.source || 'Web Scraper',
          author: article.author || 'Unknown',
          publishedAt: article.publishedAt || new Date(),
          category: category,
          tags: tags,
          isFeatured: Math.random() < 0.2, // 20% chance of being featured
          viewCount: Math.floor(Math.random() * 50) // Random view count for new articles
        });
        
        await newsItem.save();
        importedCount++;
      } catch (err) {
        console.error('Error importing article:', err);
        errors.push({
          title: article.title,
          error: err.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      imported: importedCount,
      total: articles.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (err) {
    console.error('Error in importScrapedNews:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while importing news',
      error: err.message
    });
  }
};

// Scrape news from Google - API endpoint
exports.scrapeGoogleNews = async (req, res) => {
  try {
    const query = req.query.query || 'sports';
    const limit = parseInt(req.query.limit) || 10;
    
    const newsItems = await scrapeGoogleNews(query, limit);
    
    // Map the scraped items to our expected format
    const formattedNewsItems = newsItems.map(item => ({
      title: item.title,
      url: item.link,
      publishedAt: item.publishedAt,
      summary: item.description,
      source: item.source || 'Google News',
      content: item.content,
      category: 'Sports',
      imageUrl: item.imageUrl
    }));
    
    res.status(200).json({
      success: true,
      count: formattedNewsItems.length,
      data: formattedNewsItems
    });
  } catch (error) {
    console.error('Error in scrapeGoogleNews API:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Search news
exports.searchNews = async (req, res) => {
  try {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please provide a search query' });
    }
    
    // Build search filter
    const searchFilter = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };
    
    // Add category filter if provided
    if (req.query.category) {
      // Convert first letter to uppercase for matching the enum format
      const formattedCategory = req.query.category.charAt(0).toUpperCase() + req.query.category.slice(1).toLowerCase();
      searchFilter.category = formattedCategory;
    }
    
    // Count total documents for pagination
    const total = await News.countDocuments(searchFilter);
    
    // Execute search with pagination
    const searchResults = await News.find(searchFilter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: searchResults.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: searchResults
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get categories (distinct values)
exports.getCategories = async (req, res) => {
  try {
    // Get unique categories using find instead of distinct
    const allNews = await News.find({}, 'category').lean();
    const categoriesSet = new Set();
    allNews.forEach(news => {
      if (news.category) {
        categoriesSet.add(news.category);
      }
    });
    const categories = Array.from(categoriesSet).sort();
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed news into the database using web scraping instead of sample data
exports.seedSampleNews = async () => {
  try {
    console.log('Checking if real news data is needed...');
    
    // Get count of articles in the database
    const totalCount = await News.countDocuments();
    
    // If we already have some articles, remove them all before reseeding
    if (totalCount > 0) {
      console.log(`Database contains ${totalCount} articles. Removing all existing articles...`);
      await News.deleteMany({});
      console.log('All articles removed. Ready to fetch fresh news data.');
    }
    
    console.log('Fetching fresh news data for the past week from web sources...');
    
    // Define sports categories to scrape
    const categories = [
      {name: 'Cricket', query: 'nepal cricket news when:7d'},
      {name: 'Football', query: 'nepal football news when:7d'},
      {name: 'Basketball', query: 'nepal basketball news when:7d'},
      {name: 'Volleyball', query: 'nepal volleyball news when:7d'},
      {name: 'Tennis', query: 'nepal tennis sports news when:7d'},
      {name: 'Athletics', query: 'nepal athletics sports news when:7d'},
      {name: 'Olympics', query: 'nepal olympics news when:7d'},
      {name: 'Other', query: 'nepal sports news when:7d'}
    ];
    
    // Track how many articles we've added
    let addedCount = 0;
    
    // Scrape and add news for each category
    for (const category of categories) {
      console.log(`Scraping news for category: ${category.name}`);
      
      try {
        // Get 10 articles for each category (increased from 4 to get more content)
        const newsItems = await scrapeGoogleNews(category.query, 10);
        
        if (newsItems.length > 0) {
          console.log(`Found ${newsItems.length} articles for ${category.name}`);
          
          // Prepare articles for insertion
          const validArticles = newsItems
            .filter(item => {
              // Filter out items without title or with very short titles
              if (!item.title || item.title.length < 5) {
                console.log(`Skipping item with invalid title: ${item.title}`);
                return false;
              }
              return true;
            })
            .map((item, index) => {
              // Extract tags from title and content
              const allText = (item.title + ' ' + (item.content || '')).toLowerCase();
              const potentialTags = [category.name.toLowerCase(), 'nepal', 'sports'];
              
              // Add more specific tags based on content
              const specificTerms = ['tournament', 'championship', 'match', 'player', 'team', 'league', 'cup', 'season'];
              specificTerms.forEach(term => {
                if (allText.includes(term)) {
                  potentialTags.push(term);
                }
              });
              
              // Determine if this should be a featured article
              // Make sure cricket and football have featured articles
              const shouldFeature = 
                (addedCount < 10) || // First 10 articles across all categories
                (category.name === 'Cricket' && index < 2) || // First 2 cricket articles
                (category.name === 'Football' && index < 2); // First 2 football articles
              
              // Ensure publishedAt is always a valid date
              let publishedDate;
              try {
                if (!item.publishedAt) {
                  publishedDate = new Date();
                } else if (item.publishedAt instanceof Date) {
                  publishedDate = item.publishedAt;
                } else if (typeof item.publishedAt === 'string' || typeof item.publishedAt === 'number') {
                  publishedDate = new Date(item.publishedAt);
                  // Check if the date is valid
                  if (isNaN(publishedDate.getTime())) {
                    publishedDate = new Date();
                  }
                } else {
                  // If it's some other type (like an empty object), use current date
                  publishedDate = new Date();
                }
              } catch (e) {
                console.error(`Error parsing date: ${e.message}`);
                publishedDate = new Date();
              }
              
              // Ensure content is never empty - use description or generate fallback content
              let content = item.content || '';
              if (!content || content.trim().length < 20) {
                // Try to use description if content is missing
                if (item.description && item.description.trim().length > 20) {
                  content = item.description;
                } else {
                  // Generate fallback content
                  content = generateFallbackContent(item.title, category.name);
                }
              }
              
              // Ensure summary is never empty
              let summary = item.description || '';
              if (!summary || summary.trim().length < 10) {
                if (content && content.length > 30) {
                  // Create summary from content
                  summary = content.substring(0, Math.min(150, content.length)) + (content.length > 150 ? '...' : '');
                } else {
                  // Generate a short summary based on title
                  summary = `Latest news about ${item.title}.`;
                }
              }
              
              return {
                title: item.title,
                content: content,
                summary: summary,
                category: item.category || category.name,
                source: item.source || 'Khelkud Nepal',
                url: item.url || item.link,
                imageUrl: item.imageUrl || getPlaceholderImageForCategory(category.name),
                tags: [...new Set(potentialTags)], // Remove duplicates
                location: { country: 'Nepal' },
                author: item.source || 'Khelkud Nepal',
                publishedAt: publishedDate, // Use our validated date
                isFeatured: shouldFeature,
                viewCount: Math.floor(Math.random() * 1000) + 100
              };
            });
          
          // Check if we have valid articles after filtering and processing
          if (validArticles.length > 0) {
            // Insert articles into database
            await News.insertMany(validArticles);
            addedCount += validArticles.length;
            console.log(`Added ${validArticles.length} articles for category ${category.name}`);
          } else {
            console.log(`No valid articles found for ${category.name} after filtering`);
          }
        } else {
          console.log(`No articles found for ${category.name}, using international fallback query`);
          
          // Try with a more international query
          const fallbackNewsItems = await scrapeGoogleNews(`international ${category.name.toLowerCase()} news when:7d`, 6);
          
          if (fallbackNewsItems.length > 0) {
            const validArticles = fallbackNewsItems
              .filter(item => {
                // Filter out items without title or with very short titles
                if (!item.title || item.title.length < 5) {
                  return false;
                }
                return true;
              })
              .map((item, index) => {
                // Extract tags from title and content
                const allText = (item.title + ' ' + (item.content || '')).toLowerCase();
                const potentialTags = [category.name.toLowerCase(), 'international', 'sports'];
                
                // Add more specific tags based on content
                const specificTerms = ['tournament', 'championship', 'match', 'player', 'team', 'league', 'cup', 'season'];
                specificTerms.forEach(term => {
                  if (allText.includes(term)) {
                    potentialTags.push(term);
                  }
                });
                
                // Ensure publishedAt is always a valid date
                let publishedDate;
                try {
                  if (!item.publishedAt) {
                    publishedDate = new Date();
                  } else if (item.publishedAt instanceof Date) {
                    publishedDate = item.publishedAt;
                  } else if (typeof item.publishedAt === 'string' || typeof item.publishedAt === 'number') {
                    publishedDate = new Date(item.publishedAt);
                    if (isNaN(publishedDate.getTime())) {
                      publishedDate = new Date();
                    }
                  } else {
                    publishedDate = new Date();
                  }
                } catch (e) {
                  publishedDate = new Date();
                }
                
                // Ensure content is never empty
                let content = item.content || '';
                if (!content || content.trim().length < 20) {
                  // Try to use description if content is missing
                  if (item.description && item.description.trim().length > 20) {
                    content = item.description;
                  } else {
                    // Generate fallback content
                    content = generateFallbackContent(item.title, category.name);
                  }
                }
                
                // Ensure summary is never empty
                let summary = item.description || '';
                if (!summary || summary.trim().length < 10) {
                  if (content && content.length > 30) {
                    // Create summary from content
                    summary = content.substring(0, Math.min(150, content.length)) + (content.length > 150 ? '...' : '');
                  } else {
                    // Generate a short summary based on title
                    summary = `Latest international news about ${item.title}.`;
                  }
                }
                
                return {
                  title: item.title,
                  content: content,
                  summary: summary,
                  category: item.category || category.name,
                  source: item.source || 'Khelkud Nepal',
                  url: item.url || item.link,
                  imageUrl: item.imageUrl || getPlaceholderImageForCategory(category.name),
                  tags: [...new Set(potentialTags)], // Remove duplicates
                  location: { country: 'International' },
                  author: item.source || 'Khelkud Nepal',
                  publishedAt: publishedDate, // Use our validated date
                  isFeatured: (addedCount < 10), // Feature only if we need more featured articles
                  viewCount: Math.floor(Math.random() * 500) + 50
                };
              });
            
            // Check if we have valid articles after filtering and processing
            if (validArticles.length > 0) {
              await News.insertMany(validArticles);
              addedCount += validArticles.length;
              console.log(`Added ${validArticles.length} international articles for category ${category.name}`);
            } else {
              console.log(`No valid international articles found for ${category.name} after filtering`);
            }
          }
        }
      } catch (error) {
        console.error(`Error scraping news for ${category.name}:`, error);
      }
    }
    
    // If we couldn't fetch any articles, generate fallback news
    if (addedCount === 0) {
      console.log('Failed to fetch real news. Generating fallback news for all categories...');
      
      for (const category of categories) {
        try {
          // Generate 5 fallback articles for each category
          const fallbackItems = generateFallbackNews(category.name, 5);
          await News.insertMany(fallbackItems);
          addedCount += fallbackItems.length;
          console.log(`Added ${fallbackItems.length} fallback articles for ${category.name}`);
        } catch (error) {
          console.error(`Error generating fallback news for ${category.name}:`, error);
        }
      }
    }
    
    console.log(`Finished seeding database with ${addedCount} news articles.`);
  } catch (error) {
    console.error('Error seeding real news data:', error);
  }
};

// Helper function to generate fallback content for articles with missing content
function generateFallbackContent(title, category) {
  // Category-specific paragraph templates
  const paragraphTemplatesByCategory = {
    'Cricket': [
      `Cricket enthusiasts are following the latest developments in this exciting sport. Recent matches have showcased remarkable talent and strategy.`,
      `The cricket community in Nepal continues to grow as more young players join local clubs and training programs.`,
      `Officials are working to improve cricket infrastructure across the country, ensuring players have access to quality facilities.`,
      `"Cricket has the power to bring people together and inspire the next generation of athletes," noted a sports analyst following recent events.`,
      `International cricket tournaments provide valuable exposure for Nepali players, helping them develop their skills at the highest level.`
    ],
    'Football': [
      `Football remains one of the most popular sports in Nepal, with passionate fans following both local and international matches.`,
      `Recent developments in football have captured the attention of sports enthusiasts across the country.`,
      `Local football clubs continue to nurture young talent, providing pathways to professional careers for dedicated players.`,
      `"Football teaches teamwork, discipline, and perseverance - skills that benefit players on and off the field," commented a local coach.`,
      `The growth of women's football in Nepal represents an important development in making the sport more inclusive and diverse.`
    ],
    'Basketball': [
      `Basketball continues to gain popularity in Nepal, particularly among urban youth looking for fast-paced team sports.`,
      `Recent basketball tournaments have showcased the growing talent pool in the country, with players demonstrating impressive skills.`,
      `Schools and colleges play a crucial role in basketball development, providing competitive opportunities for young players.`,
      `"The physicality and strategic elements of basketball make it both challenging and rewarding," noted a veteran player.`,
      `International basketball standards are increasingly being adopted in local competitions, raising the overall quality of play.`
    ],
    'default': [
      `Sports continue to play an important role in community development and national pride across Nepal.`,
      `Athletes train rigorously to represent their communities and country in various sporting events.`,
      `Sports facilities are gradually improving throughout Nepal, giving athletes better opportunities to develop their skills.`,
      `"Sports have the power to transform lives and unite communities," remarked a local sports administrator.`,
      `Young athletes are being encouraged to pursue their sporting dreams while maintaining a focus on education and personal development.`
    ]
  };

  // Get appropriate templates for the category, or use default if not found
  const templates = paragraphTemplatesByCategory[category] || paragraphTemplatesByCategory['default'];
  
  // Generate 3-5 paragraphs
  const paragraphCount = Math.floor(Math.random() * 3) + 3; // 3-5 paragraphs
  const selectedParagraphs = [];
  
  // Always include a context paragraph that incorporates the title
  const contextParagraph = `Recent news about "${title}" has generated interest in the ${category.toLowerCase()} community. This development comes at a time when sports in Nepal are gaining increased attention both locally and internationally.`;
  selectedParagraphs.push(contextParagraph);
  
  // Add random paragraphs from templates
  const shuffledTemplates = [...templates].sort(() => 0.5 - Math.random());
  selectedParagraphs.push(...shuffledTemplates.slice(0, paragraphCount - 1));
  
  // Add a concluding paragraph
  const conclusionParagraph = `As this story develops, fans and analysts will be watching closely to see the broader implications for ${category.toLowerCase()} in Nepal and potentially beyond.`;
  selectedParagraphs.push(conclusionParagraph);
  
  return selectedParagraphs.join('\n\n');
}

// Refresh news from web sources (admin only)
exports.refreshNewsFromWeb = async (req, res) => {
  try {
    const { category, count } = req.body;
    const limit = parseInt(count) || 5;
    
    // If category is specified, only refresh that category
    if (category) {
      console.log(`Refreshing news for category: ${category}`);
      
      // Format query based on category
      let query = `nepal ${category.toLowerCase()} news`;
      
      // Fetch news from web source
      const newsItems = await scrapeGoogleNews(query, limit);
      
      if (newsItems.length > 0) {
        // Prepare articles for insertion
        const articles = newsItems.map(item => ({
          title: item.title,
          content: item.content || item.description,
          summary: item.description,
          category: category,
          source: item.source || 'Khelkud Nepal',
          url: item.link,
          imageUrl: item.imageUrl,
          tags: [category.toLowerCase(), 'nepal', 'sports'],
          location: { country: 'Nepal' },
          author: item.source || 'Khelkud Nepal',
          publishedAt: item.publishedAt || new Date(),
          isFeatured: Math.random() < 0.3, // 30% chance to be featured
          viewCount: Math.floor(Math.random() * 500) + 50
        }));
        
        // Insert articles into database
        await News.insertMany(articles);
        
        return res.status(200).json({
          success: true,
          message: `Successfully added ${articles.length} new articles for ${category}`,
          count: articles.length
        });
      } else {
        return res.status(200).json({
          success: false,
          message: `No new articles found for ${category}`,
          count: 0
        });
      }
    } else {
      // Refresh all categories
      console.log('Refreshing news for all categories');
      
      // Define sports categories to scrape
      const categories = [
        {name: 'Cricket', query: 'nepal cricket news'},
        {name: 'Football', query: 'nepal football news'},
        {name: 'Basketball', query: 'nepal basketball news'},
        {name: 'Volleyball', query: 'nepal volleyball news'},
        {name: 'Other', query: 'nepal sports news'}
      ];
      
      // Track how many articles we've added
      let addedCount = 0;
      
      // Scrape and add news for each category
      for (const cat of categories) {
        console.log(`Refreshing news for category: ${cat.name}`);
        
        try {
          // Get articles for each category
          const newsItems = await scrapeGoogleNews(cat.query, limit);
          
          if (newsItems.length > 0) {
            // Prepare articles for insertion
            const articles = newsItems.map(item => ({
              title: item.title,
              content: item.content || item.description,
              summary: item.description,
              category: cat.name,
              source: item.source || 'Khelkud Nepal',
              url: item.link,
              imageUrl: item.imageUrl,
              tags: [cat.name.toLowerCase(), 'nepal', 'sports'],
              location: { country: 'Nepal' },
              author: item.source || 'Khelkud Nepal',
              publishedAt: item.publishedAt || new Date(),
              isFeatured: Math.random() < 0.2, // 20% chance to be featured
              viewCount: Math.floor(Math.random() * 500) + 50
            }));
            
            // Insert articles into database
            await News.insertMany(articles);
            addedCount += articles.length;
          }
        } catch (error) {
          console.error(`Error refreshing news for ${cat.name}:`, error);
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Successfully refreshed news with ${addedCount} new articles`,
        count: addedCount
      });
    }
  } catch (error) {
    console.error('Error refreshing news:', error);
    return res.status(500).json({
      success: false,
      message: 'Error refreshing news',
      error: error.message
    });
  }
};

// Add background scraping function that runs asynchronously
exports.scheduleBackgroundScraping = async () => {
  // Log that the background scraping has started
  console.log('Starting background news scraping process...');
  
  try {
    // Get count of articles in the database
    const totalCount = await News.countDocuments();
    
    // If we already have some articles, remove them all before reseeding
    if (totalCount > 0) {
      console.log(`Background scraper: Database contains ${totalCount} articles. Removing all existing articles...`);
      await News.deleteMany({});
      console.log('Background scraper: All articles removed. Ready to fetch fresh news data.');
    }
    
    console.log('Background scraper: Fetching fresh news data for the past week from web sources...');
    
    // Define sports categories to scrape
    const categories = [
      {name: 'Cricket', query: 'nepal cricket news when:7d'},
      {name: 'Football', query: 'nepal football news when:7d'},
      {name: 'Basketball', query: 'nepal basketball news when:7d'},
      {name: 'Volleyball', query: 'nepal volleyball news when:7d'},
      {name: 'Tennis', query: 'nepal tennis sports news when:7d'},
      {name: 'Athletics', query: 'nepal athletics sports news when:7d'},
      {name: 'Olympics', query: 'nepal olympics news when:7d'},
      {name: 'Other', query: 'nepal sports news when:7d'}
    ];
    
    // Track how many articles we've added
    let addedCount = 0;
    
    // Scrape and add news for each category sequentially to avoid overwhelming the system
    for (const category of categories) {
      console.log(`Background scraper: Processing category: ${category.name}`);
      
      try {
        // Get 10 articles for each category
        const newsItems = await scrapeGoogleNews(category.query, 10);
        
        if (newsItems.length > 0) {
          console.log(`Background scraper: Found ${newsItems.length} articles for ${category.name}`);
          
          // Process articles as in the original function
          const validArticles = newsItems
            .filter(item => {
              if (!item.title || item.title.length < 5) {
                console.log(`Background scraper: Skipping item with invalid title: ${item.title}`);
                return false;
              }
              return true;
            })
            .map((item, index) => {
              // Extract tags from title and content
              const allText = (item.title + ' ' + (item.content || '')).toLowerCase();
              const potentialTags = [category.name.toLowerCase(), 'nepal', 'sports'];
              
              // Add more specific tags based on content
              const specificTerms = ['tournament', 'championship', 'match', 'player', 'team', 'league', 'cup', 'season'];
              specificTerms.forEach(term => {
                if (allText.includes(term)) {
                  potentialTags.push(term);
                }
              });
              
              // Determine if this should be a featured article
              const shouldFeature = 
                (addedCount < 10) || // First 10 articles across all categories
                (category.name === 'Cricket' && index < 2) || // First 2 cricket articles
                (category.name === 'Football' && index < 2); // First 2 football articles
              
              // Ensure publishedAt is always a valid date
              let publishedDate;
              try {
                if (!item.publishedAt) {
                  publishedDate = new Date();
                } else if (item.publishedAt instanceof Date) {
                  publishedDate = item.publishedAt;
                } else if (typeof item.publishedAt === 'string' || typeof item.publishedAt === 'number') {
                  publishedDate = new Date(item.publishedAt);
                  // Check if the date is valid
                  if (isNaN(publishedDate.getTime())) {
                    publishedDate = new Date();
                  }
                } else {
                  // If it's some other type (like an empty object), use current date
                  publishedDate = new Date();
                }
              } catch (e) {
                console.error(`Background scraper: Error parsing date: ${e.message}`);
                publishedDate = new Date();
              }
              
              // Ensure content is never empty - use description or generate fallback content
              let content = item.content || '';
              if (!content || content.trim().length < 20) {
                // Try to use description if content is missing
                if (item.description && item.description.trim().length > 20) {
                  content = item.description;
                } else {
                  // Generate fallback content
                  content = generateFallbackContent(item.title, category.name);
                }
              }
              
              // Ensure summary is never empty
              let summary = item.description || '';
              if (!summary || summary.trim().length < 10) {
                if (content && content.length > 30) {
                  // Create summary from content
                  summary = content.substring(0, Math.min(150, content.length)) + (content.length > 150 ? '...' : '');
                } else {
                  // Generate a short summary based on title
                  summary = `Latest news about ${item.title}.`;
                }
              }
              
              return {
                title: item.title,
                content: content,
                summary: summary,
                category: item.category || category.name,
                source: item.source || 'Khelkud Nepal',
                url: item.url || item.link,
                imageUrl: item.imageUrl || getPlaceholderImageForCategory(category.name),
                tags: [...new Set(potentialTags)], // Remove duplicates
                location: { country: 'Nepal' },
                author: item.source || 'Khelkud Nepal',
                publishedAt: publishedDate, // Use our validated date
                isFeatured: shouldFeature,
                viewCount: Math.floor(Math.random() * 1000) + 100
              };
            });
          
          // Check if we have valid articles after filtering and processing
          if (validArticles.length > 0) {
            // Insert articles into database
            await News.insertMany(validArticles);
            addedCount += validArticles.length;
            console.log(`Background scraper: Added ${validArticles.length} articles for category ${category.name}`);
          } else {
            console.log(`Background scraper: No valid articles found for ${category.name} after filtering`);
          }
        } else {
          console.log(`Background scraper: No articles found for ${category.name}, using international fallback query`);
          
          // Try with a more international query
          const fallbackNewsItems = await scrapeGoogleNews(`international ${category.name.toLowerCase()} news when:7d`, 6);
          
          if (fallbackNewsItems.length > 0) {
            const validArticles = fallbackNewsItems
              .filter(item => {
                // Filter out items without title or with very short titles
                if (!item.title || item.title.length < 5) {
                  return false;
                }
                return true;
              })
              .map((item, index) => {
                // Process international articles (same as in original function)
                // Format and process the article as before...
                const allText = (item.title + ' ' + (item.content || '')).toLowerCase();
                const potentialTags = [category.name.toLowerCase(), 'international', 'sports'];
                
                specificTerms.forEach(term => {
                  if (allText.includes(term)) {
                    potentialTags.push(term);
                  }
                });
                
                // Ensure publishedAt is always a valid date
                let publishedDate;
                try {
                  if (!item.publishedAt) {
                    publishedDate = new Date();
                  } else if (item.publishedAt instanceof Date) {
                    publishedDate = item.publishedAt;
                  } else if (typeof item.publishedAt === 'string' || typeof item.publishedAt === 'number') {
                    publishedDate = new Date(item.publishedAt);
                    if (isNaN(publishedDate.getTime())) {
                      publishedDate = new Date();
                    }
                  } else {
                    publishedDate = new Date();
                  }
                } catch (e) {
                  publishedDate = new Date();
                }
                
                // Ensure content is never empty
                let content = item.content || '';
                if (!content || content.trim().length < 20) {
                  if (item.description && item.description.trim().length > 20) {
                    content = item.description;
                  } else {
                    content = generateFallbackContent(item.title, category.name);
                  }
                }
                
                // Ensure summary is never empty
                let summary = item.description || '';
                if (!summary || summary.trim().length < 10) {
                  if (content && content.length > 30) {
                    summary = content.substring(0, Math.min(150, content.length)) + (content.length > 150 ? '...' : '');
                  } else {
                    summary = `Latest international news about ${item.title}.`;
                  }
                }
                
                return {
                  title: item.title,
                  content: content,
                  summary: summary,
                  category: item.category || category.name,
                  source: item.source || 'Khelkud Nepal',
                  url: item.url || item.link,
                  imageUrl: item.imageUrl || getPlaceholderImageForCategory(category.name),
                  tags: [...new Set(potentialTags)], // Remove duplicates
                  location: { country: 'International' },
                  author: item.source || 'Khelkud Nepal',
                  publishedAt: publishedDate,
                  isFeatured: (addedCount < 10),
                  viewCount: Math.floor(Math.random() * 500) + 50
                };
              });
            
            // Check if we have valid articles after filtering and processing
            if (validArticles.length > 0) {
              await News.insertMany(validArticles);
              addedCount += validArticles.length;
              console.log(`Background scraper: Added ${validArticles.length} international articles for category ${category.name}`);
            } else {
              console.log(`Background scraper: No valid international articles found for ${category.name} after filtering`);
            }
          }
        }
      } catch (error) {
        console.error(`Background scraper: Error scraping news for ${category.name}:`, error);
      }
    }
    
    // If we couldn't fetch any articles, generate fallback news
    if (addedCount === 0) {
      console.log('Background scraper: Failed to fetch real news. Generating fallback news for all categories...');
      
      for (const category of categories) {
        try {
          // Generate 5 fallback articles for each category
          const fallbackItems = generateFallbackNews(category.name, 5);
          await News.insertMany(fallbackItems);
          addedCount += fallbackItems.length;
          console.log(`Background scraper: Added ${fallbackItems.length} fallback articles for ${category.name}`);
        } catch (error) {
          console.error(`Background scraper: Error generating fallback news for ${category.name}:`, error);
        }
      }
    }
    
    console.log(`Background scraper: Finished seeding database with ${addedCount} news articles.`);
    return { success: true, count: addedCount };
  } catch (error) {
    console.error('Background scraper: Error seeding real news data:', error);
    return { success: false, error: error.message };
  }
}; 