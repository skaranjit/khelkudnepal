const News = require('../models/News');
const axios = require('axios');
const cheerio = require('cheerio');
const BrowserService = require('../utils/browserless');

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

// Function to enhance a news item with detailed content from its source
async function enhanceNewsItem(newsItem, originalQuery) {
  try {
    if (!newsItem.link || !newsItem.link.startsWith('http')) {
      return newsItem;
    }
    
    console.log(`Enhancing news item from: ${newsItem.link}`);
    
    // Get browser instance from BrowserService
    const browser = await BrowserService.getBrowser();
    const page = await BrowserService.createStealthPage(browser);
    
    // Try to navigate to the source page
    try {
      await page.goto(newsItem.link, { 
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
    } catch (navigationError) {
      console.log(`Navigation error for ${newsItem.link}: ${navigationError.message}`);
      await browser.close();
      return newsItem;
    }
    
    // Extract more detailed content
    const enhancedItem = await page.evaluate((item) => {
      // Use different strategies to find the main content
      const possibleContentSelectors = [
        'article', '.article-body', '.story-body', '.entry-content', '.post-content',
        'main', '.main-content', '.content', '#content', '[itemprop="articleBody"]',
        '.news-content', '.article-content', '.story-content', '.post-body'
      ];
      
      // Use different strategies to find images
      const possibleImageSelectors = [
        '.article-featured-image img', '.featured-image img', '.post-thumbnail img',
        'article img:first-of-type', '.story img:first-of-type', 'header img',
        '.article-img img', '[property="og:image"]', 'meta[property="og:image"]',
        '.image img', '.main-image img', '.article__featured-image'
      ];
      
      // Function to extract text content
      function extractText(element) {
        // Skip extracting from common non-content elements
        const excludeSelectors = [
          'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar', '.comments',
          '.related', '.share', '.social', '.advertisement', '.ad', '.promo',
          '.recommendation', '.subscribe', '.newsletter', '.tags', '.author-bio'
        ];
        
        let foundExcluded = false;
        for (const selector of excludeSelectors) {
          if (element.matches(selector) || element.closest(selector)) {
            foundExcluded = true;
            break;
          }
        }
        
        if (foundExcluded) return '';
        
        // Skip hidden elements
        if (element.offsetParent === null) return '';
        
        let text = '';
        for (const node of element.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent.trim() + ' ';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            
            // Skip script, style, etc.
            if (['script', 'style', 'noscript', 'iframe', 'object'].includes(tag)) continue;
            
            // Special handling for paragraphs and headers
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
              const childText = extractText(node).trim();
              if (childText) {
                text += childText + '\n\n';
              }
            } else {
              text += extractText(node);
            }
          }
        }
        
        return text;
      }
      
      // Extract main content
      let content = item.content || '';
      for (const selector of possibleContentSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Get the longest content from matching elements
          for (const element of elements) {
            const extractedText = extractText(element).trim();
            if (extractedText.length > content.length) {
              content = extractedText;
            }
          }
          if (content.length > 100) break; // Found good content
        }
      }
      
      // Get better images if available
      let imageUrl = item.imageUrl || '';
      
      // Try meta tags first
      const metaImage = document.querySelector('meta[property="og:image"]') || 
                         document.querySelector('meta[name="twitter:image"]');
      if (metaImage) {
        const metaSrc = metaImage.getAttribute('content');
        if (metaSrc && metaSrc.length > 10) {
          imageUrl = metaSrc;
        }
      }
      
      // Try image elements if meta didn't work
      if (!imageUrl || imageUrl.length < 10) {
        for (const selector of possibleImageSelectors) {
          const imgElement = document.querySelector(selector);
          if (imgElement) {
            const imgSrc = imgElement.getAttribute('src') || imgElement.getAttribute('data-src');
            if (imgSrc && imgSrc.length > 10) {
              imageUrl = imgSrc;
              break;
            }
          }
        }
      }
      
      // Process content to improve readability
      if (content.length > item.content?.length) {
        // Clean up content
        content = content
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      }
      
      // Create a better summary from the content
      let summary = item.summary || '';
      if (content.length > 150 && (!summary || summary.length < 50)) {
        summary = content.substring(0, 200).trim() + '...';
      }
      
      // Add additional images from the page
      const additionalImages = [];
      const allImgs = document.querySelectorAll('article img, .article img, .content img, .main-content img');
      for (let i = 0; i < Math.min(allImgs.length, 5); i++) {
        const img = allImgs[i];
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && src.length > 10 && !src.includes('data:') && !src.includes('blank.') && !src.includes('placeholder')) {
          additionalImages.push(src);
        }
      }
      
      // Extract country and location information
      let location = {
        country: '',
        city: ''
      };
      
      // Try to find location metadata
      const cityCountryPairs = [
        // Check meta tags
        document.querySelector('meta[property="og:locality"]')?.content,
        document.querySelector('meta[property="og:country-name"]')?.content,
        document.querySelector('meta[name="geo.placename"]')?.content,
        
        // Check structured data
        document.querySelector('[itemprop="addressLocality"]')?.textContent,
        document.querySelector('[itemprop="addressCountry"]')?.textContent,
        document.querySelector('[itemprop="contentLocation"]')?.textContent,
        
        // Check common elements that might contain location info
        document.querySelector('.location')?.textContent,
        document.querySelector('.dateline')?.textContent,
        document.querySelector('.article-location')?.textContent,
        document.querySelector('.geo')?.textContent
      ].filter(Boolean);
      
      // Check country in the URL
      const urlParts = window.location.hostname.split('.');
      const possibleCountryCode = urlParts[urlParts.length - 1];
      if (['np', 'in', 'uk', 'us'].includes(possibleCountryCode)) {
        if (possibleCountryCode === 'np') location.country = 'Nepal';
        else if (possibleCountryCode === 'in') location.country = 'India';
        else if (possibleCountryCode === 'uk') location.country = 'United Kingdom';
        else if (possibleCountryCode === 'us') location.country = 'United States';
      }
      
      // Common Nepali city names to look for in content
      const nepaliCities = ['Kathmandu', 'Pokhara', 'Lalitpur', 'Bhaktapur', 'Biratnagar', 
                           'Birgunj', 'Dharan', 'Nepalgunj', 'Butwal', 'Hetauda', 'Janakpur', 
                           'Dhangadhi', 'Itahari', 'Kirtipur', 'Lumbini'];
      
      // Check if the content mentions Nepal or Nepali cities
      if (!location.country && content) {
        if (content.includes('Nepal') || 
            nepaliCities.some(city => content.includes(city))) {
          location.country = 'Nepal';
        }
      }
      
      // Extract city from content if country is Nepal
      if (location.country === 'Nepal' && content) {
        for (const city of nepaliCities) {
          if (content.includes(city)) {
            location.city = city;
            break;
          }
        }
      }
      
      return {
        content: content.length > item.content?.length ? content : item.content,
        summary: summary || item.summary,
        imageUrl: imageUrl || item.imageUrl,
        images: additionalImages.length > 0 ? additionalImages : null,
        location: location
      };
    }, newsItem);
    
    await browser.close();
    
    // Update the original news item with the enhanced content
    if (enhancedItem.content && enhancedItem.content.length > newsItem.content?.length) {
      newsItem.content = enhancedItem.content;
    }
    
    if (enhancedItem.summary && enhancedItem.summary.length > 0) {
      newsItem.summary = enhancedItem.summary;
    }
    
    if (enhancedItem.imageUrl && enhancedItem.imageUrl.length > 0) {
      newsItem.imageUrl = enhancedItem.imageUrl;
    }
    
    // Add any additional images found
    if (enhancedItem.images && enhancedItem.images.length > 0) {
      newsItem.images = enhancedItem.images;
    }
    
    // Update location information
    if (enhancedItem.location) {
      // Check if the query indicates Nepal content
      if (originalQuery && originalQuery.toLowerCase().includes('nepal')) {
        enhancedItem.location.country = enhancedItem.location.country || 'Nepal';
      }
      
      newsItem.location = newsItem.location || {};
      
      // Update country if one was found
      if (enhancedItem.location.country) {
        newsItem.location.country = enhancedItem.location.country;
      }
      
      // Update city if one was found
      if (enhancedItem.location.city) {
        newsItem.location.city = enhancedItem.location.city;
      }
    }
    
    // If we still don't have a country but it's clearly about Nepal sports (from the query)
    if ((!newsItem.location || !newsItem.location.country) && 
        originalQuery && originalQuery.toLowerCase().includes('nepal')) {
      newsItem.location = newsItem.location || {};
      newsItem.location.country = 'Nepal';
    }
    
    return newsItem;
  } catch (error) {
    console.error(`Error enhancing news item: ${error.message}`);
    return newsItem; // Return the original item if enhancement fails
  }
}

// Function to scrape and process news from Google News
async function scrapeGoogleNews(query, limit = 10) {
  try {
    console.log(`Scraping Google News for query: ${query}`);
    
    // Try to launch a local browser instance instead of using browserless.io
    const browser = await BrowserService.getBrowser();
    const page = await BrowserService.createStealthPage(browser);
    
    // Enhanced browser settings for better reliability
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set longer navigation timeout
    page.setDefaultNavigationTimeout(45000);
    
    // Add more request headers to look like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'max-age=0'
    });
    
    // Try multiple search sources for higher success rate
    const sources = [
      {
        name: 'Google News',
        url: `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
        articleSelector: 'article',
        process: async () => {
          const results = await page.evaluate((maxResults) => {
            const newsItems = [];
            const articles = document.querySelectorAll('article');
            
            for (let i = 0; i < Math.min(articles.length, maxResults); i++) {
              const article = articles[i];
              
              // Extract article elements
              const titleElement = article.querySelector('h3, h4');
              const linkElement = article.querySelector('a');
              const imageElement = article.querySelector('img');
              const publishedElement = article.querySelector('time');
              const descriptionElement = article.querySelector('p, .zaJd6');
              
              if (!titleElement) continue; // Skip if no title found
              
              // Get publisher name
              const publisherElement = article.querySelector('.vr1PYe');
              const publisher = publisherElement ? publisherElement.textContent.trim() : 'Google News';
              
              // Get article URL - Google News links redirect through their site, get the real URL
              let articleUrl = '';
              if (linkElement) {
                // Try to get the actual article URL, not Google's redirect URL
                const href = linkElement.getAttribute('href');
                if (href && href.startsWith('./articles/')) {
                  articleUrl = `https://news.google.com/${href.substring(2)}`;
                } else if (href && href.startsWith('http')) {
                  articleUrl = href;
                }
              }
              
              // Get image URL
              let imageUrl = '';
              if (imageElement) {
                imageUrl = imageElement.getAttribute('src') || imageElement.getAttribute('srcset') || '';
                
                // Clean up srcset if present
                if (imageUrl.includes(' ')) {
                  imageUrl = imageUrl.split(' ')[0]; // Get the first URL in srcset
                }
              }
              
              // Get published date
              let publishedAt = new Date();
              if (publishedElement) {
                const datetime = publishedElement.getAttribute('datetime');
                if (datetime) {
                  publishedAt = new Date(datetime);
                }
              }
              
              // Get description
              let description = '';
              if (descriptionElement) {
                description = descriptionElement.textContent.trim();
              }
              
              // Create a summary from description or title
              let summary = description || titleElement.textContent.trim();
              if (summary.length > 500) {
                summary = summary.substring(0, 497) + '...';
              }
              
              // Add to results
              newsItems.push({
                title: titleElement.textContent.trim(),
                link: articleUrl,
                imageUrl: imageUrl,
                source: publisher,
                publishedAt: publishedAt,
                summary: summary,
                content: description || ''
              });
            }
            
            return newsItems;
          }, limit);
          
          return results;
        }
      },
      {
        name: 'Bing News',
        url: `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&qft=interval%3d%227%22&form=PTFTNR`,
        articleSelector: '.news-card',
        process: async () => {
          const results = await page.evaluate((maxResults) => {
            const newsItems = [];
            const articles = document.querySelectorAll('.news-card');
            
            for (let i = 0; i < Math.min(articles.length, maxResults); i++) {
              const article = articles[i];
              
              // Extract article elements
              const titleElement = article.querySelector('a.title');
              const imageElement = article.querySelector('img');
              const sourceElement = article.querySelector('.source');
              const timeElement = article.querySelector('.source span:last-child');
              
              if (!titleElement) continue;
              
              const title = titleElement.textContent.trim();
              const link = titleElement.href;
              
              // Get image
              let imageUrl = '';
              if (imageElement && imageElement.src) {
                imageUrl = imageElement.src;
              }
              
              // Get source
              let source = 'Bing News';
              if (sourceElement) {
                source = sourceElement.textContent.split('·')[0].trim();
              }
              
              // Get published date
              let publishedAt = new Date();
              if (timeElement) {
                // Process relative time like "2h ago"
                const timeText = timeElement.textContent.trim();
                if (timeText.includes('h ago')) {
                  const hours = parseInt(timeText);
                  if (!isNaN(hours)) {
                    publishedAt = new Date();
                    publishedAt.setHours(publishedAt.getHours() - hours);
                  }
                } else if (timeText.includes('d ago')) {
                  const days = parseInt(timeText);
                  if (!isNaN(days)) {
                    publishedAt = new Date();
                    publishedAt.setDate(publishedAt.getDate() - days);
                  }
                }
              }
              
              // Add to results
              newsItems.push({
                title,
                link,
                imageUrl,
                source,
                publishedAt,
                summary: title,
                content: ''
              });
            }
            
            return newsItems;
          }, limit);
          
          return results;
        }
      }
    ];
    
    let newsItems = [];
    let currentSourceIndex = 0;
    
    console.log(`Trying to fetch news from ${sources[currentSourceIndex].name} for query: ${query}`);
    
    while (newsItems.length === 0 && currentSourceIndex < sources.length) {
      const source = sources[currentSourceIndex];
      try {
        await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`Loaded ${source.name} page. Page title: ${await page.title()}`);
        
        // Check if the selector exists
        const hasArticles = await page.$(source.articleSelector);
        if (hasArticles) {
          newsItems = await source.process();
          if (newsItems.length > 0) {
            console.log(`Successfully extracted ${newsItems.length} news items from ${source.name}`);
          } else {
            console.log(`No results found on ${source.name}`);
          }
        } else {
          console.log(`No article elements found on ${source.name} using selector ${source.articleSelector}`);
        }
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error.message);
      }
      
      currentSourceIndex++;
    }
    
    await browser.close();
    
    console.log(`Extracted ${newsItems.length} news items for query: ${query}`);
    
    // Process items to extract more detailed information
    let processedItems = [];
    
    for (const item of newsItems) {
      try {
        if (item.link) {
          console.log(`Extracting detailed content from: ${item.link}`);
          
          // Determine category hint from query
          let categoryHint = null;
          if (query.toLowerCase().includes('cricket')) categoryHint = 'Cricket';
          else if (query.toLowerCase().includes('football') || query.toLowerCase().includes('soccer')) categoryHint = 'Football';
          else if (query.toLowerCase().includes('basketball')) categoryHint = 'Basketball';
          else if (query.toLowerCase().includes('volleyball')) categoryHint = 'Volleyball';
          else if (query.toLowerCase().includes('tennis')) categoryHint = 'Tennis';
          
          // Enhance the article with proper metadata
          const enhancedItem = await enhanceNewsItem(item, query);
          
          // Apply category detection and enhancement
          const categorizedItem = enhanceArticleMetadata(enhancedItem, categoryHint);
          
          processedItems.push(categorizedItem);
        }
      } catch (error) {
        console.error(`Error extracting content from ${item.link}: ${error.message}`);
      }
    }
    
    // If we couldn't get enhanced content, just use the original items with category detection
    if (processedItems.length === 0 && newsItems.length > 0) {
      console.log('Using original items without full content enhancement');
      // Still apply category detection to original items
      processedItems = newsItems.map(item => {
        let categoryHint = null;
        if (query.toLowerCase().includes('cricket')) categoryHint = 'Cricket';
        else if (query.toLowerCase().includes('football') || query.toLowerCase().includes('soccer')) categoryHint = 'Football';
        else if (query.toLowerCase().includes('basketball')) categoryHint = 'Basketball';
        else if (query.toLowerCase().includes('volleyball')) categoryHint = 'Volleyball';
        
        return enhanceArticleMetadata(item, categoryHint);
      });
    }
    
    console.log(`Retrieved ${processedItems.length} processed items for query: ${query}`);
    return processedItems;
  } catch (error) {
    console.error(`Error in scrapeGoogleNews: ${error.message}`);
    return [];
  }
}

// Function to scrape and process news from ESPN
async function scrapeFromESPN(query, limit = 10) {
  try {
    console.log(`Scraping ESPN for query: ${query}`);
    
    const browser = await BrowserService.getBrowser();
    const page = await BrowserService.createStealthPage(browser);
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Navigate to ESPN search
    const url = `https://www.espn.com/search/_/q/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for search results to load
    await page.waitForSelector('.SearchResults', { timeout: 10000 }).catch(() => {
      console.log('No ESPN search results found');
    });
    
    // Extract articles
    const articles = await page.evaluate((maxResults) => {
      const results = [];
      const items = document.querySelectorAll('.SearchResults .SearchResult');
      
      for (let i = 0; i < Math.min(items.length, maxResults); i++) {
        const item = items[i];
        
        // Extract data
        const titleElement = item.querySelector('h2');
        const linkElement = item.querySelector('a');
        const imageElement = item.querySelector('img');
        const descriptionElement = item.querySelector('p');
        
        if (!titleElement || !linkElement) continue;
        
        const title = titleElement.textContent.trim();
        const link = linkElement.href;
        
        // Get image if available
        let imageUrl = '';
        if (imageElement) {
          imageUrl = imageElement.src || imageElement.getAttribute('data-src') || '';
        }
        
        // Get description if available
        let description = '';
        if (descriptionElement) {
          description = descriptionElement.textContent.trim();
        }
        
        // Create a summary from description or title
        let summary = description || title;
        if (summary.length > 500) {
          summary = summary.substring(0, 497) + '...';
        }
        
        results.push({
          title: title,
          link: link,
          imageUrl: imageUrl,
          source: 'ESPN',
          publishedAt: new Date(),
          summary: summary,
          content: description || ''
        });
      }
      
      return results;
    }, limit);
    
    // Process each article - directly visit the source page to extract detailed content
    const processedArticles = [];
    for (const item of articles) {
      // Only process items with a valid link
      if (item.link && item.link.startsWith('http')) {
        // Create a new article object with base info
        let newsItem = {
          title: item.title,
          summary: item.summary || '',
          content: item.content || '',
          source: 'ESPN',
          link: item.link,
          imageUrl: item.imageUrl || '',
          publishedAt: item.publishedAt || new Date(),
        };

        // Deep extract content directly from source article
        try {
          console.log(`Extracting detailed content from ESPN: ${item.link}`);
          newsItem = await enhanceNewsItem(newsItem, query);
        } catch (extractError) {
          console.error(`Error extracting content from ${item.link}: ${extractError.message}`);
        }

        // Only add sports-related articles
        if (isSportsRelated(newsItem)) {
          processedArticles.push(newsItem);
        } else {
          console.log(`Skipping non-sports ESPN article: ${newsItem.title}`);
        }
      }
    }
    
    await browser.close();
    console.log(`Retrieved ${processedArticles.length} items from ESPN for query: ${query}`);
    
    return processedArticles;
  } catch (error) {
    console.error(`Error scraping ESPN: ${error.message}`);
    return [];
  }
}

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
      summary: item.summary,
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
      {name: 'Cricket', query: 'nepal cricket news'},
      {name: 'Football', query: 'nepal football news soccer'},
      {name: 'Basketball', query: 'nepal basketball news'},
      {name: 'Volleyball', query: 'nepal volleyball news'},
      {name: 'Other', query: 'nepal sports news'}
    ];
    
    // Track how many articles we've added
    let addedCount = 0;
    
    // Scrape and add news for each category
    for (const cat of categories) {
      console.log(`Processing category: ${cat.name}`);
      
      try {
        // Get articles for each category using the updated scraper
        let newsItems = await scrapeGoogleNews(cat.query, 10);
        
        if (newsItems.length > 0) {
          console.log(`Background scraper: Found ${newsItems.length} articles for ${cat.name}`);
          
          // Filter to only include sports-related articles
          const sportsArticles = newsItems.filter(item => isSportsRelated(item))
            .map(item => ({
              title: item.title,
              content: item.content || item.summary || '',
              summary: item.summary || '',
              category: item.category || cat.name,
              source: item.source || 'Khelkud Nepal',
              url: item.link,
              imageUrl: item.imageUrl || getPlaceholderImageForCategory(item.category || cat.name),
              tags: item.tags || [cat.name.toLowerCase(), 'sports', 'nepal'],
              location: item.location || { country: 'Nepal' },
              author: item.source || 'Khelkud Nepal',
              publishedAt: item.publishedAt || new Date(),
              isFeatured: Math.random() < 0.2, // 20% chance to be featured
              viewCount: Math.floor(Math.random() * 500) + 50
            }));
          
          if (sportsArticles.length > 0) {
            await News.insertMany(sportsArticles);
            addedCount += sportsArticles.length;
            console.log(`Background scraper: Added ${sportsArticles.length} articles for category ${cat.name}`);
          } else {
            console.log(`Background scraper: No sports-related articles found for ${cat.name} after filtering`);
          }
        } else {
          console.log(`Background scraper: No articles found for ${cat.name}`);
        }
      } catch (error) {
        console.error(`Background scraper: Error scraping news for ${cat.name}:`, error);
      }
    }
    
    console.log(`Background scraper: Finished seeding database with ${addedCount} news articles.`);
    return { success: true, count: addedCount };
  } catch (error) {
    console.error('Error seeding real news data:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to get placeholder image for category
function getPlaceholderImageForCategory(category) {
  const placeholders = {
    'Cricket': '/img/placeholders/cricket.jpg',
    'Football': '/img/placeholders/football.jpg',
    'Basketball': '/img/placeholders/basketball.jpg',
    'Volleyball': '/img/placeholders/volleyball.jpg',
    'Tennis': '/img/placeholders/tennis.jpg',
    'Athletics': '/img/placeholders/athletics.jpg',
    'Olympics': '/img/placeholders/olympics.jpg',
    'Other': '/img/placeholders/sports.jpg'
  };
  
  return placeholders[category] || '/img/placeholders/sports.jpg';
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
        const articles = newsItems
          .map(item => ({
            title: item.title,
            content: item.content || item.summary,
            summary: item.summary,
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
          }))
          // Filter to only include sports-related articles
          .filter(item => isSportsRelated(item));
        
        // Only proceed if we have sports-related articles
        if (articles.length > 0) {
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
            message: `No sports-related articles found for ${category}`,
            count: 0
          });
        }
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
        {name: 'Football', query: 'nepal football news soccer'},
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
          let newsItems = await scrapeGoogleNews(cat.query, limit);
          
          // If no articles found for Football category, try international football news as fallback
          if (newsItems.length === 0 && cat.name === 'Football') {
            console.log(`No articles found for ${cat.name}, using international fallback query`);
            
            // Try international football news and specific leagues
            const fallbackQueries = [
              'football news premier league',
              'football news champions league',
              'world cup football news',
              'fifa football latest news',
              'football news nepal international'
            ];
            
            // Try each fallback query until we get results
            for (const fallbackQuery of fallbackQueries) {
              console.log(`Trying fallback query: ${fallbackQuery}`);
              newsItems = await scrapeGoogleNews(fallbackQuery, limit);
              
              if (newsItems.length > 0) {
                console.log(`Found ${newsItems.length} articles with fallback query: ${fallbackQuery}`);
                break;
              }
            }
          }
          
          if (newsItems.length > 0) {
            // Prepare articles for insertion
            const articles = newsItems
              .map(item => ({
                title: item.title,
                content: item.content || item.summary,
                summary: item.summary,
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
              }))
              // Filter to only include sports-related articles
              .filter(item => isSportsRelated(item));
            
            // Only proceed if we have sports-related articles
            if (articles.length > 0) {
              // Insert articles into database
              await News.insertMany(articles);
              addedCount += articles.length;
              console.log(`Added ${articles.length} sports-related articles for ${cat.name}`);
            } else {
              console.log(`No sports-related articles found for ${cat.name} after filtering`);
            }
          } else {
            console.log(`Background scraper: No articles found for ${cat.name}, using international fallback query`);
            
            // Try with a more international query
            const fallbackNewsItems = await scrapeGoogleNews(`international ${cat.name.toLowerCase()} news when:7d`, 6);
            
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
                  const potentialTags = [cat.name.toLowerCase(), 'international', 'sports'];
                  
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
                    if (item.summary && item.summary.trim().length > 20) {
                      content = item.summary;
                    } else {
                      content = `This article is about ${item.title}. For more details, please visit the original source.`;
                    }
                  }
                  
                  // Ensure summary is never empty
                  let summary = item.summary || '';
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
                    category: item.category || cat.name,
                    source: item.source || 'Khelkud Nepal',
                    url: item.link,
                    imageUrl: item.imageUrl || getPlaceholderImageForCategory(cat.name),
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
                // Filter to only include sports-related articles
                const sportsArticles = validArticles.filter(item => isSportsRelated(item));
                
                if (sportsArticles.length > 0) {
                  await News.insertMany(sportsArticles);
                  addedCount += sportsArticles.length;
                  console.log(`Background scraper: Added ${sportsArticles.length} international sports-related articles for category ${cat.name}`);
                } else {
                  console.log(`Background scraper: No sports-related international articles found for ${cat.name} after filtering`);
                }
              } else {
                console.log(`Background scraper: No valid international articles found for ${cat.name} after filtering`);
              }
            }
          }
        } catch (error) {
          console.error(`Background scraper: Error scraping news for ${cat.name}:`, error);
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
      {name: 'Cricket', query: 'nepal cricket news'},
      {name: 'Football', query: 'nepal football news soccer'},
      {name: 'Basketball', query: 'nepal basketball news'},
      {name: 'Volleyball', query: 'nepal volleyball news'},
      {name: 'Other', query: 'nepal sports news'}
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
              
              // Ensure content is never empty
              let content = item.content || '';
              if (!content || content.trim().length < 20) {
                if (item.summary && item.summary.trim().length > 20) {
                  content = item.summary;
                } else {
                  // Simple fallback content
                  content = `This article is about ${item.title}. For more details, please visit the original source.`;
                }
              }
              
              // Ensure summary is never empty
              let summary = item.summary || '';
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
                url: item.link,
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
            // Filter to only include sports-related articles
            const sportsArticles = validArticles.filter(item => isSportsRelated(item));
            
            if (sportsArticles.length > 0) {
              // Insert articles into database
              await News.insertMany(sportsArticles);
              addedCount += sportsArticles.length;
              console.log(`Background scraper: Added ${sportsArticles.length} sports-related articles for category ${category.name}`);
            } else {
              console.log(`Background scraper: No sports-related articles found for ${category.name} after filtering`);
            }
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
                  if (item.summary && item.summary.trim().length > 20) {
                    content = item.summary;
                  } else {
                    content = `This article is about ${item.title}. For more details, please visit the original source.`;
                  }
                }
                
                // Ensure summary is never empty
                let summary = item.summary || '';
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
                  url: item.link,
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
              // Filter to only include sports-related articles
              const sportsArticles = validArticles.filter(item => isSportsRelated(item));
              
              if (sportsArticles.length > 0) {
                await News.insertMany(sportsArticles);
                addedCount += sportsArticles.length;
                console.log(`Background scraper: Added ${sportsArticles.length} international sports-related articles for category ${category.name}`);
              } else {
                console.log(`Background scraper: No sports-related international articles found for ${category.name} after filtering`);
              }
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
      console.log('Background scraper: Failed to fetch real news. No articles added to database.');
      return { success: false, message: 'Failed to fetch news articles' };
    }
    
    console.log(`Background scraper: Finished seeding database with ${addedCount} news articles.`);
    return { success: true, count: addedCount };
  } catch (error) {
    console.error('Background scraper: Error seeding real news data:', error);
    return { success: false, error: error.message };
  }
}; 

// Get related images from Google News
exports.getRelatedImages = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const browser = await BrowserService.getBrowser();
    const page = await BrowserService.createStealthPage(browser);
    
    // Navigate to Google News
    await page.goto(`https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for images to load
    await page.waitForSelector('article img', { timeout: 10000 });

    // Extract images
    const images = await page.evaluate(() => {
      const articles = document.querySelectorAll('article');
      const imageData = [];
      
      articles.forEach(article => {
        const img = article.querySelector('img');
        if (img && img.src) {
          imageData.push({
            url: img.src,
            title: article.querySelector('h3')?.textContent || ''
          });
        }
      });

      return imageData.slice(0, 12); // Limit to 12 images
    });

    await browser.close();

    res.json({
      success: true,
      images
    });
  } catch (error) {
    console.error('Error fetching related images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching related images'
    });
  }
};

// Get related news by ID
exports.getRelatedNews = async (req, res) => {
  console.log(`[API] Fetching related news for ID: ${req.params.id}`);
  try {
    const newsId = req.params.id;
    
    // Find the original news article first to get its category
    const originalNews = await News.findById(newsId);
    
    if (!originalNews) {
      console.log(`[API] Original news not found for ID: ${newsId}`);
      return res.status(200).json({
        success: false,
        message: 'News article not found',
        data: []
      });
    }
    
    console.log(`[API] Found original article in category: ${originalNews.category}`);
    
    // Find related news with the same category, excluding the original article
    // Set a higher limit initially to ensure we have enough sports-related articles after filtering
    const relatedNews = await News.find({
      _id: { $ne: newsId },
      category: originalNews.category
    })
    .sort({ publishedAt: -1 })
    .limit(20); // Get more articles initially so we have enough after filtering
    
    console.log(`[API] Found ${relatedNews.length} related articles in same category`);
    
    // Filter to only include sports-related articles
    const sportsRelatedNews = relatedNews.filter(article => 
      isSportsRelated(article)
    ).slice(0, 5); // Limit to 5 articles
    
    console.log(`[API] Filtered to ${sportsRelatedNews.length} sports-related articles`);
    
    // If not enough related articles in same category, get some from other sports categories
    let finalRelatedNews = [...sportsRelatedNews];
    
    if (sportsRelatedNews.length < 3) {
      console.log(`[API] Not enough related articles, fetching from other sports categories`);
      
      // Get articles from other sports categories
      const otherSportsNews = await News.find({
        _id: { $ne: newsId },
        category: { $in: ['Football', 'Cricket', 'Basketball', 'Volleyball', 'Tennis', 'Other'] },
        category: { $ne: originalNews.category } // Exclude the original category
      })
      .sort({ publishedAt: -1 })
      .limit(10);
      
      // Filter to only include sports-related articles
      const otherSportsFiltered = otherSportsNews.filter(article => 
        isSportsRelated(article)
      );
      
      console.log(`[API] Found ${otherSportsFiltered.length} articles from other sports categories`);
      
      // Add other sports articles to fill up to 5 total
      const neededCount = 5 - finalRelatedNews.length;
      const additionalArticles = otherSportsFiltered.slice(0, neededCount);
      
      finalRelatedNews = [...finalRelatedNews, ...additionalArticles];
    }
    
    console.log(`[API] Returning ${finalRelatedNews.length} related articles`);
    
    // Return final list of related news
    return res.status(200).json({
      success: true,
      data: finalRelatedNews
    });
  } catch (error) {
    console.error(`[API] Error fetching related news for ID ${req.params.id}:`, error);
    return res.status(200).json({
      success: false,
      message: 'Error fetching related news',
      data: []
    });
  }
};

// Function to scrape summaries from web sources for related articles
async function scrapeWebSummariesForRelatedArticles(searchQuery, limit = 5) {
  try {
    console.log(`Scraping web summaries for: ${searchQuery}`);
    const browser = await BrowserService.getBrowser();
    const page = await BrowserService.createStealthPage(browser);
    
    // Set viewport for better rendering
    await page.setViewport({ width: 1280, height: 800 });
    
    // Try multiple sources for better coverage
    let summaries = [];
    
    // Try Google News first
    try {
      const googleNewsUrl = `https://news.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`;
      await page.goto(googleNewsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      // Wait for articles to load
      await page.waitForSelector('article', { timeout: 10000 }).catch(() => console.log('No article elements found'));
      
      // Extract summaries
      const googleSummaries = await page.evaluate((maxResults) => {
        const results = [];
        const articles = document.querySelectorAll('article');
        
        for (let i = 0; i < Math.min(articles.length, maxResults); i++) {
          const article = articles[i];
          
          // Extract article text
          const titleElement = article.querySelector('h3') || article.querySelector('h4');
          const descriptionElement = article.querySelector('.xBbh9') || article.querySelector('.zaJd6') || article.querySelector('p');
          
          if (!titleElement) continue;
          
          // Get the source/publisher name
          const sourceElement = article.querySelector('time')?.parentElement;
          const source = sourceElement ? sourceElement.textContent.split('·')[0].trim() : 'Google News';
          
          // Get the URL
          const linkElement = article.querySelector('a');
          const url = linkElement ? new URL(linkElement.href, 'https://news.google.com').href : '';
          
          // Get summary
          const title = titleElement.textContent.trim();
          const description = descriptionElement ? descriptionElement.textContent.trim() : '';
          
          // Create a full summary combining title and description
          let summary = '';
          if (title && description) {
            summary = `${title}. ${description}`;
          } else if (title) {
            summary = title;
          } else if (description) {
            summary = description;
          }
          
          if (summary) {
            results.push({
              summary,
              source,
              url
            });
          }
        }
        
        return results;
      }, limit);
      
      if (googleSummaries.length > 0) {
        summaries = googleSummaries;
      }
    } catch (googleError) {
      console.error('Error scraping from Google News:', googleError.message);
    }
    
    // If Google News didn't work, try ESPN
    if (summaries.length === 0) {
      try {
        const espnUrl = `https://www.espn.com/search/_/q/${encodeURIComponent(searchQuery)}`;
        await page.goto(espnUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Wait for results
        await page.waitForSelector('.SearchResults', { timeout: 10000 }).catch(() => console.log('No ESPN search results found'));
        
        const espnSummaries = await page.evaluate((maxResults) => {
          const results = [];
          const articles = Array.from(document.querySelectorAll('.SearchResult'));
          
          for (let i = 0; i < Math.min(articles.length, maxResults); i++) {
            const article = articles[i];
            
            const titleElement = article.querySelector('h2');
            const descriptionElement = article.querySelector('p');
            
            if (!titleElement) continue;
            
            const title = titleElement.textContent.trim();
            const description = descriptionElement ? descriptionElement.textContent.trim() : '';
            
            // Create summary
            let summary = '';
            if (title && description) {
              summary = `${title}. ${description}`;
            } else if (title) {
              summary = title;
            }
            
            if (summary) {
              results.push({
                summary,
                source: 'ESPN',
                url: article.querySelector('a')?.href || ''
              });
            }
          }
          
          return results;
        }, limit);
        
        if (espnSummaries.length > 0) {
          summaries = espnSummaries;
        }
      } catch (espnError) {
        console.error('Error scraping from ESPN:', espnError.message);
      }
    }
    
    await browser.close();
    return summaries;
  } catch (error) {
    console.error(`Error scraping web summaries: ${error.message}`);
    return [];
  }
}

// Function to check if an article is sports-related
function isSportsRelated(item) {
  // Quick check for sports categories
  const sportsCategories = ['football', 'cricket', 'basketball', 'volleyball', 'tennis', 
    'athletics', 'sports', 'rugby', 'golf', 'swimming', 'boxing'];
  
  if (sportsCategories.includes((item.category || '').toLowerCase())) {
    return true;
  }
  
  // List of sports terms to check against (expanded for better coverage)
  const sportTerms = [
    // General sports terms
    'cricket', 'football', 'soccer', 'basketball', 'volleyball', 'tennis', 
    'athletics', 'olympics', 'tournament', 'championship', 'match', 'player', 
    'team', 'league', 'cup', 'season', 'sports', 'game', 'athlete', 'coach',
    'stadium', 'score', 'win', 'lose', 'victory', 'defeat', 'medal', 'trophy',
    'fitness', 'race', 'competition', 'rugby', 'boxing', 'wrestling', 'golf',
    'marathon', 'swimming', 'track', 'field', 'esports', 'cycling', 'racing',
    
    // Professional leagues and tournaments
    'ipl', 'premier league', 'champions league', 'world cup', 'fifa', 'nba', 
    'nfl', 'mlb', 'nhl', 'afc', 'uefa', 'la liga', 'serie a', 'bundesliga',
    'grand slam', 'wimbledon', 'olympics', 'commonwealth games', 'asian games',
    
    // Nepal-specific sports terms
    'anfa', 'nsa', 'nepal cricket', 'nepal football', 'nepal basketball',
    'national team', 'all nepal', 'martyr cup', 'gold cup', 'nepali sportsperson',
    'nepal premier league', 'everest premier league', 'dashrath stadium'
  ];
  
  // List of non-sports terms that might indicate a political or general news article
  const nonSportsTerms = [
    'politics', 'election', 'government', 'minister', 'parliament', 'congress',
    'protest', 'demonstration', 'rally', 'bill', 'law', 'legislation', 'court',
    'tax', 'economy', 'business', 'stock market', 'inflation', 'gdp', 'investment',
    'terrorist', 'attack', 'bombing', 'shooting', 'murder', 'killed', 'accident',
    'disaster', 'earthquake', 'flood', 'hurricane', 'pandemic', 'covid', 'virus', 
    'disease', 'health', 'hospital', 'doctor', 'medicine', 'treatment', 
    'education', 'school', 'university', 'teacher', 'student', 'graduation',
    'entertainment', 'movie', 'film', 'actor', 'actress', 'director', 'music',
    'concert', 'album', 'celebrity', 'fashion', 'wedding', 'royal'
  ];
  
  // Convert all text to lowercase for case-insensitive checking
  const title = (item.title || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const source = (item.source || '').toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
  
  // Combine title and summary for preliminary checking
  const mainText = `${title} ${summary}`;
  
  // Check if the title or summary strongly indicates non-sports content
  const containsNonSportsTerm = nonSportsTerms.some(term => 
    mainText.includes(term) && 
    // Make sure it's not just a passing reference
    (mainText.split(term).length > 2 || 
     mainText.indexOf(term) < 50) // Term appears near the beginning
  );
  
  // If it strongly contains non-sports terms, do a more thorough check
  if (containsNonSportsTerm) {
    // Combine all text fields for checking sports relevance
    const allText = `${title} ${content} ${summary} ${source} ${tags}`;
    
    // Count occurrences of sports terms
    const sportTermMatches = sportTerms.filter(term => allText.includes(term)).length;
    
    // Count occurrences of non-sports terms
    const nonSportTermMatches = nonSportsTerms.filter(term => allText.includes(term)).length;
    
    // If we have significantly more non-sports terms than sports terms, reject the article
    if (nonSportTermMatches > sportTermMatches * 2) {
      return false;
    }
  }
  
  // Combine all text fields for comprehensive checking
  const allText = `${title} ${content} ${summary} ${source} ${tags}`;
  
  // Check if any sport term appears in the text
  return sportTerms.some(term => allText.includes(term));
}

// Function to determine the most appropriate category for an article
function determineCategory(item) {
  // Default category
  let bestCategory = 'Other';
  
  // Dictionary of categories and their identifying keywords
  const categoryKeywords = {
    'Cricket': ['cricket', 'ipl', 'icc', 'wicket', 'batting', 'bowling', 'odi', 't20', 'test match', 'bcci', 'cricketer'],
    'Football': ['football', 'soccer', 'fifa', 'uefa', 'premier league', 'la liga', 'serie a', 'bundesliga', 'world cup', 'goalkeeper', 'striker', 'midfielder', 'coach', 'manager', 'goal'],
    'Basketball': ['basketball', 'nba', 'fiba', 'dunk', 'three-pointer', 'court', 'basket', 'point guard', 'forward', 'center'],
    'Volleyball': ['volleyball', 'setter', 'spiker', 'libero', 'fivb', 'beach volleyball', 'indoor volleyball', 'spike', 'block', 'serve'],
    'Tennis': ['tennis', 'atp', 'wta', 'grand slam', 'wimbledon', 'us open', 'french open', 'australian open', 'racket', 'serve', 'ace', 'court'],
    'Athletics': ['athletics', 'track', 'field', 'marathon', 'sprint', 'race', 'jump', 'throw', 'olympics', 'medal', 'tournament', 'championship', 'record']
  };
  
  // If a category is already assigned and it's valid, use it
  if (item.category && categoryKeywords[item.category]) {
    return item.category;
  }
  
  // Convert all text to lowercase for matching
  const title = (item.title || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const allText = `${title} ${content} ${summary}`;
  
  // Count matches for each category
  let bestScore = 0;
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    
    // Check title first (higher weight)
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        score += 3; // Higher weight for title matches
      } else if (allText.includes(keyword)) {
        score += 1; // Lower weight for general content matches
      }
    }
    
    // If this category scores higher, make it the best match
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  
  return bestCategory;
}

// Function to enhance scraped articles with proper categories and tags
function enhanceArticleMetadata(article, suggestedCategory = null) {
  // Make a copy of the article to enhance
  const enhancedArticle = {...article};
  
  // Determine the most appropriate category
  const detectedCategory = determineCategory(article);
  
  // Use explicitly suggested category, detected category, or fall back to 'Other'
  enhancedArticle.category = suggestedCategory || detectedCategory;
  
  // Generate appropriate tags
  const tags = [enhancedArticle.category.toLowerCase(), 'sports'];
  
  // Add region tags
  if (enhancedArticle.location && enhancedArticle.location.country) {
    tags.push(enhancedArticle.location.country.toLowerCase());
    
    // Add Nepal-specific tags if applicable
    if (enhancedArticle.location.country.toLowerCase() === 'nepal') {
      tags.push('nepal');
    }
  }
  
  // Add more specific tags based on category
  switch(enhancedArticle.category) {
    case 'Cricket':
      if (article.title.toLowerCase().includes('ipl')) tags.push('ipl');
      if (article.title.toLowerCase().includes('world cup')) tags.push('world cup');
      if (article.title.toLowerCase().includes('test')) tags.push('test match');
      break;
    case 'Football':
      if (article.title.toLowerCase().includes('premier league')) tags.push('premier league');
      if (article.title.toLowerCase().includes('world cup')) tags.push('world cup');
      if (article.title.toLowerCase().includes('uefa')) tags.push('uefa');
      if (article.title.toLowerCase().includes('fifa')) tags.push('fifa');
      break;
    // Add more categories as needed
  }
  
  // Remove duplicate tags
  enhancedArticle.tags = [...new Set(tags)];
  
  return enhancedArticle;
}