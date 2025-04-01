const axios = require('axios');
const cheerio = require('cheerio');
const BrowserService = require('./browserless');

/**
 * Utility for fetching league updates from external sources
 */
class LeagueUpdateScraper {
  /**
   * Fetch standings for a specific league
   * @param {Object} league - League document
   * @returns {Promise<Array>} - Array of team standing objects
   */
  static async fetchStandingsForLeague(league) {
    try {
      switch (league.category) {
        case 'Cricket':
          return await this.fetchCricketStandings(league);
        case 'Football':
          return await this.fetchFootballStandings(league);
        case 'Basketball':
          return await this.fetchBasketballStandings(league);
        case 'Volleyball':
          return await this.fetchVolleyballStandings(league);
        default:
          return await this.fetchGenericStandings(league);
      }
    } catch (error) {
      console.error(`Error fetching standings for league ${league._id}:`, error);
      return [];
    }
  }

  /**
   * Fetch updates for a specific league
   * @param {Object} league - League document
   * @returns {Promise<Array>} - Array of update objects
   */
  static async fetchUpdatesForLeague(league) {
    try {
      switch (league.category) {
        case 'Cricket':
          return await this.fetchCricketLeagueUpdates(league);
        case 'Football':
          return await this.fetchFootballLeagueUpdates(league);
        case 'Basketball':
          return await this.fetchBasketballLeagueUpdates(league);
        case 'Volleyball':
          return await this.fetchVolleyballLeagueUpdates(league);
        default:
          return await this.fetchGenericLeagueUpdates(league);
      }
    } catch (error) {
      console.error(`Error fetching updates for league ${league._id}:`, error);
      return [];
    }
  }

  /**
   * Fetch news for a specific team
   * @param {Object} team - Team object
   * @param {Object} league - League document
   * @returns {Promise<Array>} - Array of news objects
   */
  static async fetchTeamNews(team, league) {
    try {
      const newsItems = [];
      
      // Use team name and league category to search for news
      const searchQuery = `${team.name} ${league.name} ${league.category} news`;
      console.log(`Searching for news about: ${searchQuery}`);
      
      // Try to use Browserless for better scraping results
      let browser = null;
      try {
        browser = await BrowserService.getBrowser();
        const page = await BrowserService.createStealthPage(browser);
        
        // Try Google News
        await page.goto(`https://news.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=en-US`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Wait for news items to load
        await page.waitForSelector('article', { timeout: 5000 }).catch(() => console.log('No articles found on Google News'));
        
        // Extract news items
        const articles = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('article').forEach((article, index) => {
            if (index < 10) {  // Limit to 10 articles
              const titleEl = article.querySelector('h3 a, h4 a');
              const title = titleEl ? titleEl.textContent : '';
              
              const linkEl = article.querySelector('a');
              const link = linkEl ? linkEl.href : '';
              
              const timeEl = article.querySelector('time');
              const publishedAt = timeEl ? timeEl.getAttribute('datetime') : new Date().toISOString();
              
              const sourceEl = article.querySelector('div[data-n-tid="9"]');
              const source = sourceEl ? sourceEl.textContent : '';
              
              if (title && link) {
                items.push({
                  title,
                  link,
                  publishedAt,
                  source
                });
              }
            }
          });
          return items;
        });
        
        // Process each article to extract more details
        for (const article of articles) {
          try {
            await page.goto(article.link, {
              waitUntil: 'domcontentloaded',
              timeout: 20000
            });
            
            // Extract content
            const content = await page.evaluate(() => {
              const paragraphs = Array.from(document.querySelectorAll('p')).slice(0, 5);
              return paragraphs.map(p => p.textContent).join(' ');
            });
            
            // Extract image
            const imageUrl = await page.evaluate(() => {
              const img = document.querySelector('article img, .article-body img, .main-content img');
              return img ? img.src : null;
            });
            
            newsItems.push({
              title: article.title,
              content: content || 'No content available',
              source: article.source || 'News Source',
              url: article.link,
              publishedAt: article.publishedAt || new Date().toISOString(),
              imageUrl: imageUrl,
              category: league.category,
              tags: [team.name, league.name]
            });
          } catch (error) {
            console.log(`Error extracting details for article: ${article.title}`, error.message);
          }
        }
      } catch (browserError) {
        console.error('Error with Browserless:', browserError.message);
        
        // Fallback to axios + cheerio if Browserless fails
        try {
          const response = await axios.get(`https://www.bing.com/news/search?q=${encodeURIComponent(searchQuery)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          const $ = cheerio.load(response.data);
          
          $('.news-card').each((i, el) => {
            if (i < 5) {  // Limit to 5 articles when using fallback
              const title = $(el).find('.title').text().trim();
              const source = $(el).find('.source').text().trim();
              const snippet = $(el).find('.snippet').text().trim();
              const link = $(el).find('a.title').attr('href');
              
              if (title && link) {
                newsItems.push({
                  title,
                  content: snippet || 'No content available',
                  source: source || 'News Source',
                  url: link,
                  publishedAt: new Date().toISOString(),
                  category: league.category,
                  tags: [team.name, league.name]
                });
              }
            }
          });
        } catch (axiosError) {
          console.error('Fallback news scraping failed:', axiosError.message);
        }
      } finally {
        if (browser) {
          await browser.close().catch(console.error);
        }
      }
      
      return newsItems;
    } catch (error) {
      console.error(`Error fetching news for team ${team.name}:`, error);
      return [];
    }
  }

  /**
   * Fetch cricket standings (T20, Test, ODI)
   */
  static async fetchCricketStandings(league) {
    try {
      const standings = [];
      
      // Try to use Browserless for better scraping results
      let browser = null;
      try {
        browser = await BrowserService.getBrowser();
        const page = await BrowserService.createStealthPage(browser);
        
        // Search for league standings
        const searchQuery = `${league.name} cricket points table standings ${league.season}`;
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Try to find and click on a table link (ESPNCricinfo or similar)
        const tableLink = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            if (link.textContent && (
              link.textContent.includes('Points Table') || 
              link.textContent.includes('Standings') || 
              link.textContent.includes('Table')
            )) {
              return link.href;
            }
          }
          return null;
        });
        
        if (tableLink) {
          await page.goto(tableLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Extract standings table
          const teamRows = await page.evaluate(() => {
            const rows = [];
            
            // Look for table rows that might contain team data
            document.querySelectorAll('table tr').forEach((row) => {
              // Check if row has enough cells and likely contains team data
              const cells = row.querySelectorAll('td');
              if (cells.length >= 4) {
                const teamNameCell = cells[0] || cells[1]; // Team name is usually in first or second cell
                
                if (teamNameCell) {
                  const teamName = teamNameCell.textContent.trim();
                  
                  // Basic validation that this is indeed a team row (not header, footer, etc.)
                  if (teamName && teamName.length > 1 && !teamName.includes('Team')) {
                    // Extract statistics
                    const played = parseInt(cells[1]?.textContent || cells[2]?.textContent || '0');
                    const won = parseInt(cells[2]?.textContent || cells[3]?.textContent || '0');
                    const lost = parseInt(cells[3]?.textContent || cells[4]?.textContent || '0');
                    const drawn = parseInt(cells[4]?.textContent || cells[5]?.textContent || '0');
                    const points = parseInt(cells[cells.length - 1]?.textContent || cells[cells.length - 2]?.textContent || '0');
                    
                    rows.push({
                      name: teamName,
                      played,
                      won,
                      lost, 
                      drawn,
                      points
                    });
                  }
                }
              }
            });
            
            return rows;
          });
          
          if (teamRows.length > 0) {
            // Process and return the standings
            return teamRows.map(team => ({
              name: team.name,
              played: team.played || 0,
              won: team.won || 0,
              lost: team.lost || 0, 
              drawn: team.drawn || 0,
              goalsFor: 0, // Not relevant for cricket, but need to maintain schema
              goalsAgainst: 0,
              points: team.points || 0
            }));
          }
        }
      } catch (error) {
        console.error('Error with Browserless for cricket standings:', error);
      } finally {
        if (browser) {
          await browser.close().catch(console.error);
        }
      }
      
      // Return empty standings if nothing was found
      return standings;
    } catch (error) {
      console.error('Error in fetchCricketStandings:', error);
      return [];
    }
  }

  /**
   * Fetch football standings
   */
  static async fetchFootballStandings(league) {
    try {
      const standings = [];
      
      // Try major football sites like BBC, ESPN, or FlashScore
      try {
        // For Nepali leagues, try GoalNepal or similar local sites
        let searchUrl = '';
        if (league.name.toLowerCase().includes('nepal')) {
          searchUrl = `https://www.goalnepal.com/football`;
        } else {
          searchUrl = `https://www.espn.com/soccer/standings`;
        }
        
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);
        
        // Look for standings tables
        const tableSelector = '.standings-table, .table-standings, .league-table';
        $(tableSelector).each((i, table) => {
          // Check if this is the table for the league we're looking for
          const tableTitle = $(table).find('caption, .table-caption, h2, h3').text();
          
          if (tableTitle.toLowerCase().includes(league.name.toLowerCase()) || i === 0) {
            // Extract team data
            $(table).find('tbody tr').each((j, row) => {
              const name = $(row).find('td:nth-child(2), td:nth-child(3)').text().trim();
              const played = parseInt($(row).find('td:nth-child(3), td:nth-child(4)').text()) || 0;
              const won = parseInt($(row).find('td:nth-child(4), td:nth-child(5)').text()) || 0;
              const drawn = parseInt($(row).find('td:nth-child(5), td:nth-child(6)').text()) || 0;
              const lost = parseInt($(row).find('td:nth-child(6), td:nth-child(7)').text()) || 0;
              const goalsFor = parseInt($(row).find('td:nth-child(7), td:nth-child(8)').text()) || 0;
              const goalsAgainst = parseInt($(row).find('td:nth-child(8), td:nth-child(9)').text()) || 0;
              const points = parseInt($(row).find('td:last-child, td:nth-last-child(1)').text()) || 0;
              
              if (name) {
                standings.push({
                  name,
                  played,
                  won,
                  drawn,
                  lost,
                  goalsFor,
                  goalsAgainst,
                  points
                });
              }
            });
          }
        });
      } catch (error) {
        console.log('Error fetching from primary source:', error.message);
      }
      
      // If no standings found, try with Browserless
      if (standings.length === 0) {
        let browser = null;
        try {
          browser = await BrowserService.getBrowser();
          const page = await BrowserService.createStealthPage(browser);
          
          // Search for league standings
          const searchQuery = `${league.name} football league table standings ${league.season}`;
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Check if Google shows a standings table directly
          const tableExists = await page.evaluate(() => {
            return !!document.querySelector('.imso-ani');
          });
          
          if (tableExists) {
            // Extract data from Google's direct standings display
            const extractedStandings = await page.evaluate(() => {
              const rows = [];
              document.querySelectorAll('.imso-ani tr').forEach((row, index) => {
                if (index > 0) { // Skip header row
                  const cells = row.querySelectorAll('td');
                  if (cells.length >= 7) {
                    const name = cells[1].textContent.trim();
                    const played = parseInt(cells[2].textContent) || 0;
                    const won = parseInt(cells[3].textContent) || 0;
                    const drawn = parseInt(cells[4].textContent) || 0;
                    const lost = parseInt(cells[5].textContent) || 0;
                    const goalsFor = parseInt(cells[6].textContent.split(':')[0]) || 0;
                    const goalsAgainst = parseInt(cells[6].textContent.split(':')[1]) || 0;
                    const points = parseInt(cells[cells.length - 1].textContent) || 0;
                    
                    rows.push({
                      name,
                      played,
                      won,
                      drawn,
                      lost,
                      goalsFor,
                      goalsAgainst,
                      points
                    });
                  }
                }
              });
              return rows;
            });
            
            if (extractedStandings.length > 0) {
              return extractedStandings;
            }
          }
          
          // If Google doesn't show standings directly, try to find and navigate to a site with standings
          const tableLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            for (const link of links) {
              if (link.textContent && (
                link.textContent.includes('Table') || 
                link.textContent.includes('Standings') || 
                link.textContent.includes('League Table')
              )) {
                return link.href;
              }
            }
            return null;
          });
          
          if (tableLink) {
            await page.goto(tableLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Extract standings from the table on the target site
            const extractedStandings = await page.evaluate(() => {
              const rows = [];
              
              // Look for common table selectors
              const tableSelectors = [
                'table.standings', 
                'table.league-table',
                'table.standing-table',
                'div.table-responsive table',
                'table'
              ];
              
              let table = null;
              for (const selector of tableSelectors) {
                const tables = document.querySelectorAll(selector);
                if (tables.length > 0) {
                  // Choose the table with the most rows, which is likely to be the standings table
                  let maxRows = 0;
                  tables.forEach(t => {
                    const rowCount = t.querySelectorAll('tr').length;
                    if (rowCount > maxRows) {
                      maxRows = rowCount;
                      table = t;
                    }
                  });
                  if (table) break;
                }
              }
              
              if (table) {
                table.querySelectorAll('tr').forEach((row, index) => {
                  if (index > 0) { // Skip header row
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 5) {
                      // Try to identify the team name column
                      let nameCell = null;
                      let nameIndex = -1;
                      
                      cells.forEach((cell, idx) => {
                        // Look for cells that might contain team names
                        const text = cell.textContent.trim();
                        if (text.length > 3 && !(/^\d+$/.test(text)) && nameCell === null) {
                          nameCell = cell;
                          nameIndex = idx;
                        }
                      });
                      
                      if (nameCell) {
                        const name = nameCell.textContent.trim();
                        
                        // After finding the name, try to extract other stats
                        // Assumption: most tables have PLD, W, D, L, GF, GA, PTS
                        const stats = [];
                        cells.forEach((cell, idx) => {
                          if (idx !== nameIndex) {
                            const value = parseInt(cell.textContent.trim()) || 0;
                            stats.push(value);
                          }
                        });
                        
                        // Attempt to determine which columns are which
                        // This is a best effort based on common table layouts
                        const played = stats[0] || 0;
                        const won = stats[1] || 0;
                        const drawn = stats[2] || 0;
                        const lost = stats[3] || 0;
                        const goalsFor = stats[4] || 0;
                        const goalsAgainst = stats[5] || 0;
                        const points = stats[stats.length - 1] || 0;
                        
                        rows.push({
                          name,
                          played,
                          won,
                          drawn,
                          lost,
                          goalsFor,
                          goalsAgainst,
                          points
                        });
                      }
                    }
                  }
                });
              }
              
              return rows;
            });
            
            if (extractedStandings.length > 0) {
              return extractedStandings;
            }
          }
        } catch (browserError) {
          console.error('Error with Browserless for football standings:', browserError);
        } finally {
          if (browser) {
            await browser.close().catch(console.error);
          }
        }
      }
      
      return standings;
    } catch (error) {
      console.error('Error in fetchFootballStandings:', error);
      return [];
    }
  }

  /**
   * Fetch basketball standings
   */
  static async fetchBasketballStandings(league) {
    // Similar implementation to fetchFootballStandings but for basketball
    // For basketball, we might look at ESPN, NBA.com, or FoxSports
    return [];
  }

  /**
   * Fetch volleyball standings
   */
  static async fetchVolleyballStandings(league) {
    // Similar implementation for volleyball
    return [];
  }

  /**
   * Fetch generic standings for other sports
   */
  static async fetchGenericStandings(league) {
    // Generic implementation that can work for any sport
    return [];
  }

  /**
   * Fetch football league updates (news, transfers, etc.)
   */
  static async fetchFootballLeagueUpdates(league) {
    try {
      const updates = [];
      
      // Try to find league news
      const searchQuery = `${league.name} football latest news updates`;
      
      try {
        const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=nws`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        $('.g').each((i, el) => {
          if (i < 5) {
            const title = $(el).find('h3').text().trim();
            const snippet = $(el).find('.st').text().trim();
            const source = $(el).find('.UPmit').text().trim();
            
            if (title) {
              updates.push({
                title: title,
                text: snippet || title,
                time: new Date(),
                source: source || 'Google News',
                important: title.includes('BREAKING') || title.includes('Official') || title.includes('announced')
              });
            }
          }
        });
      } catch (error) {
        console.log('Error fetching from Google News:', error.message);
      }
      
      // If no updates from Google, try with Browserless
      if (updates.length === 0) {
        let browser = null;
        try {
          browser = await BrowserService.getBrowser();
          const page = await BrowserService.createStealthPage(browser);
          
          await page.goto(`https://news.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=en-US`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Wait for news items to load
          await page.waitForSelector('article', { timeout: 5000 }).catch(() => console.log('No articles found on Google News'));
          
          // Extract news items
          const articles = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('article').forEach((article, index) => {
              if (index < 5) {
                const titleEl = article.querySelector('h3, h4');
                const title = titleEl ? titleEl.textContent.trim() : '';
                
                const timeEl = article.querySelector('time');
                const time = timeEl ? timeEl.getAttribute('datetime') : '';
                
                const sourceEl = article.querySelector('[data-n-tid="9"]');
                const source = sourceEl ? sourceEl.textContent.trim() : '';
                
                if (title) {
                  items.push({
                    title,
                    time,
                    source
                  });
                }
              }
            });
            return items;
          });
          
          articles.forEach(article => {
            updates.push({
              title: article.title,
              text: article.title,
              time: new Date(article.time || new Date()),
              source: article.source || 'Google News',
              important: article.title.includes('BREAKING') || article.title.includes('Official') || article.title.includes('announced')
            });
          });
        } catch (browserError) {
          console.error('Error with Browserless for league updates:', browserError);
        } finally {
          if (browser) {
            await browser.close().catch(console.error);
          }
        }
      }
      
      return updates;
    } catch (error) {
      console.error('Error in fetchFootballLeagueUpdates:', error);
      return [];
    }
  }

  /**
   * Fetch cricket league updates
   */
  static async fetchCricketLeagueUpdates(league) {
    // Similar implementation to fetchFootballLeagueUpdates but for cricket
    return [];
  }

  /**
   * Fetch basketball league updates
   */
  static async fetchBasketballLeagueUpdates(league) {
    // Similar implementation to fetchFootballLeagueUpdates but for basketball
    return [];
  }

  /**
   * Fetch volleyball league updates
   */
  static async fetchVolleyballLeagueUpdates(league) {
    // Similar implementation for volleyball
    return [];
  }

  /**
   * Fetch generic league updates for other sports
   */
  static async fetchGenericLeagueUpdates(league) {
    // Generic implementation that can work for any sport
    return [];
  }
}

module.exports = LeagueUpdateScraper; 