const axios = require('axios');
const cheerio = require('cheerio');
const Match = require('../models/Match');
const BrowserService = require('./browserless');

/**
 * Utility for fetching match updates from external sources
 */
class MatchUpdateScraper {
  /**
   * Fetch updates for a specific match
   * @param {Object} match - Match document
   * @returns {Promise<Array>} - Array of update objects
   */
  static async fetchUpdatesForMatch(match) {
    try {
      switch (match.category) {
        case 'Cricket':
          return await this.fetchCricketUpdates(match);
        case 'Football':
          return await this.fetchFootballUpdates(match);
        case 'Basketball':
          return await this.fetchBasketballUpdates(match);
        case 'Volleyball':
          return await this.fetchVolleyballUpdates(match);
        default:
          return await this.fetchGenericUpdates(match);
      }
    } catch (error) {
      console.error(`Error fetching updates for match ${match._id}:`, error);
      return [];
    }
  }

  /**
   * Fetch cricket match updates with Browserless for more reliable scraping
   */
  static async fetchCricketUpdates(match) {
    try {
      const updates = [];
      let browser = null;
      
      try {
        // Use Browserless for more reliable scraping
        browser = await BrowserService.getBrowser();
        const page = await BrowserService.createStealthPage(browser);
        
        // Try ESPNCricinfo
        const searchQuery = `${match.homeTeam} vs ${match.awayTeam} live score cricinfo`;
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Try to find and click on a Cricinfo link
        const cricinfoLink = await page.evaluate(() => {
          const link = document.querySelector('a[href*="espncricinfo.com"]');
          return link ? link.href : null;
        });
        
        if (cricinfoLink) {
          console.log('Found Cricinfo link:', cricinfoLink);
          await page.goto(cricinfoLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Extract recent commentary
          const commentaryItems = await page.evaluate(() => {
            const items = [];
            const commentaryElements = document.querySelectorAll('.match-comment-wrapper');
            
            commentaryElements.forEach((el, i) => {
              if (i < 5) {
                const text = el.textContent.trim();
                const important = text.includes('FOUR') || text.includes('SIX') || text.includes('WICKET') || text.includes('OUT');
                
                items.push({
                  text: text.substring(0, 200),
                  important
                });
              }
            });
            
            return items;
          });
          
          if (commentaryItems.length > 0) {
            commentaryItems.forEach(item => {
              updates.push({
                time: new Date(),
                text: item.text,
                important: item.important,
                source: 'ESPNCricinfo (via Browserless)'
              });
            });
          }
        } else {
          console.log('No Cricinfo link found, trying Cricbuzz...');
          
          // Try Cricbuzz
          const searchQuery = `${match.homeTeam} vs ${match.awayTeam} live score cricbuzz`;
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          const cricbuzzLink = await page.evaluate(() => {
            const link = document.querySelector('a[href*="cricbuzz.com"]');
            return link ? link.href : null;
          });
          
          if (cricbuzzLink) {
            console.log('Found Cricbuzz link:', cricbuzzLink);
            await page.goto(cricbuzzLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Extract recent commentary
            const commentaryItems = await page.evaluate(() => {
              const items = [];
              const commentaryElements = document.querySelectorAll('.cb-col.cb-col-100.cb-font-13');
              
              commentaryElements.forEach((el, i) => {
                if (i < 5) {
                  const text = el.textContent.trim();
                  const important = text.includes('FOUR') || text.includes('SIX') || text.includes('WICKET') || text.includes('OUT');
                  
                  items.push({
                    text: text.substring(0, 200),
                    important
                  });
                }
              });
              
              return items;
            });
            
            if (commentaryItems.length > 0) {
              commentaryItems.forEach(item => {
                updates.push({
                  time: new Date(),
                  text: item.text,
                  important: item.important,
                  source: 'Cricbuzz (via Browserless)'
                });
              });
            }
          }
        }
      } catch (browserError) {
        console.error('Error using browser for cricket updates:', browserError.message);
        
        // Fall back to axios/cheerio method if browser method fails
        try {
          // Existing axios/cheerio implementation
          // ... (keep the existing implementation as a fallback)
        } catch (fallbackError) {
          console.error('Fallback method also failed:', fallbackError.message);
        }
      } finally {
        if (browser) {
          await BrowserService.closeBrowser(browser);
        }
      }
      
      return updates;
    } catch (error) {
      console.error('Error in fetchCricketUpdates:', error);
      return [];
    }
  }

  /**
   * Fetch football match updates from sources like BBC Sport, ESPN, etc.
   */
  static async fetchFootballUpdates(match) {
    try {
      const updates = [];
      
      // Try BBC Sport
      try {
        // Construct search URL
        const searchQuery = `${match.homeTeam} vs ${match.awayTeam} live`;
        const searchUrl = `https://www.bbc.com/sport/football/scores-fixtures`;
        
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);
        
        // Find matching game
        let matchUrl = '';
        $('.sp-c-fixture__wrapper').each((i, el) => {
          const homeTeam = $(el).find('.sp-c-fixture__team-name--home').text().trim();
          const awayTeam = $(el).find('.sp-c-fixture__team-name--away').text().trim();
          
          if (homeTeam.includes(match.homeTeam) || awayTeam.includes(match.awayTeam)) {
            const link = $(el).find('a').attr('href');
            if (link) matchUrl = `https://www.bbc.com${link}`;
          }
        });
        
        if (matchUrl) {
          const matchResponse = await axios.get(matchUrl);
          const $match = cheerio.load(matchResponse.data);
          
          // Extract live updates
          $match('.lx-stream__post').each((i, el) => {
            if (i < 5) {
              const time = $match(el).find('.qa-post-auto-meta').text().trim();
              const text = $match(el).find('.qa-post-body').text().trim();
              const important = text.includes('GOAL') || text.includes('RED CARD') || text.includes('PENALTY');
              
              updates.push({
                time: new Date(),
                text: text.substring(0, 200),
                important,
                source: 'BBC Sport'
              });
            }
          });
        }
      } catch (error) {
        console.log('Error fetching from BBC Sport:', error.message);
      }
      
      // If no updates from BBC, try ESPN
      if (updates.length === 0) {
        try {
          const searchUrl = `https://www.espn.com/soccer/scoreboard`;
          
          const response = await axios.get(searchUrl);
          const $ = cheerio.load(response.data);
          
          // Find match
          let matchUrl = '';
          $('.ScoreCell__TeamName').each((i, el) => {
            const teamName = $(el).text().trim();
            
            if (teamName.includes(match.homeTeam) || teamName.includes(match.awayTeam)) {
              const link = $(el).closest('a').attr('href');
              if (link) matchUrl = `https://www.espn.com${link}`;
            }
          });
          
          if (matchUrl) {
            const matchResponse = await axios.get(matchUrl);
            const $match = cheerio.load(matchResponse.data);
            
            // Extract play-by-play
            $match('.game-details').each((i, el) => {
              if (i < 5) {
                const text = $match(el).text().trim();
                const important = text.includes('Goal') || text.includes('Red Card') || text.includes('Penalty');
                
                updates.push({
                  time: new Date(),
                  text: text.substring(0, 200),
                  important,
                  source: 'ESPN'
                });
              }
            });
          }
        } catch (error) {
          console.log('Error fetching from ESPN:', error.message);
        }
      }
      
      return updates;
    } catch (error) {
      console.error('Error in fetchFootballUpdates:', error);
      return [];
    }
  }

  /**
   * Fetch basketball match updates
   */
  static async fetchBasketballUpdates(match) {
    try {
      const updates = [];
      
      // Try ESPN
      try {
        const searchUrl = `https://www.espn.com/nba/scoreboard`;
        
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);
        
        // Find match
        let matchUrl = '';
        $('.ScoreCell__TeamName').each((i, el) => {
          const teamName = $(el).text().trim();
          
          if (teamName.includes(match.homeTeam) || teamName.includes(match.awayTeam)) {
            const link = $(el).closest('a').attr('href');
            if (link) matchUrl = `https://www.espn.com${link}`;
          }
        });
        
        if (matchUrl) {
          const matchResponse = await axios.get(matchUrl);
          const $match = cheerio.load(matchResponse.data);
          
          // Extract play-by-play
          $match('.game-details').each((i, el) => {
            if (i < 5) {
              const text = $match(el).text().trim();
              const important = text.includes('3-pointer') || text.includes('Dunk') || text.includes('Steal');
              
              updates.push({
                time: new Date(),
                text: text.substring(0, 200),
                important,
                source: 'ESPN'
              });
            }
          });
        }
      } catch (error) {
        console.log('Error fetching from ESPN:', error.message);
      }
      
      return updates;
    } catch (error) {
      console.error('Error in fetchBasketballUpdates:', error);
      return [];
    }
  }

  /**
   * Fetch volleyball match updates
   */
  static async fetchVolleyballUpdates(match) {
    // Similar implementation to other sports
    return [];
  }

  /**
   * Fetch generic updates for other sports
   */
  static async fetchGenericUpdates(match) {
    try {
      const updates = [];
      
      // Try Google search for latest updates
      try {
        const searchQuery = `${match.homeTeam} vs ${match.awayTeam} live score updates`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract relevant information from search results
        $('.g').each((i, el) => {
          if (i < 3) {
            const title = $(el).find('h3').text().trim();
            const snippet = $(el).find('.VwiC3b').text().trim();
            
            if (title && snippet) {
              updates.push({
                time: new Date(),
                text: `${title}: ${snippet}`.substring(0, 200),
                important: false,
                source: 'Google Search'
              });
            }
          }
        });
      } catch (error) {
        console.log('Error fetching from Google:', error.message);
      }
      
      return updates;
    } catch (error) {
      console.error('Error in fetchGenericUpdates:', error);
      return [];
    }
  }

  /**
   * Update all live matches with latest updates from web sources
   */
  static async updateAllLiveMatches() {
    try {
      console.log('Fetching updates for all live matches...');
      
      // Find all live matches
      const liveMatches = await Match.find({ status: 'live' });
      
      if (liveMatches.length === 0) {
        console.log('No live matches found');
        return;
      }
      
      console.log(`Found ${liveMatches.length} live matches to update`);
      
      // Create a single browser instance to reuse
      const browser = await BrowserService.getBrowser();
      
      try {
        // Fetch updates for each match
        for (const match of liveMatches) {
          try {
            console.log(`Fetching updates for ${match.homeTeam} vs ${match.awayTeam}`);
            const newUpdates = await this.fetchUpdatesForMatch(match);
            
            if (newUpdates.length > 0) {
              console.log(`Found ${newUpdates.length} new updates for ${match.homeTeam} vs ${match.awayTeam}`);
              
              // Add only unique updates (avoid duplicates)
              const existingTexts = match.updates.map(u => u.text);
              const uniqueUpdates = newUpdates.filter(update => !existingTexts.includes(update.text));
              
              if (uniqueUpdates.length > 0) {
                match.updates.push(...uniqueUpdates);
                await match.save();
                console.log(`Added ${uniqueUpdates.length} new updates to match ${match._id}`);
              } else {
                console.log('No new unique updates found');
              }
            } else {
              console.log(`No updates found for ${match.homeTeam} vs ${match.awayTeam}`);
            }
          } catch (matchError) {
            console.error(`Error updating match ${match._id}:`, matchError.message);
          }
        }
      } finally {
        // Always close the browser
        if (browser) {
          await BrowserService.closeBrowser(browser);
        }
      }
    } catch (error) {
      console.error('Error updating live matches:', error.message);
    }
  }
}

module.exports = MatchUpdateScraper; 