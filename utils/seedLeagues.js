const mongoose = require('mongoose');
const League = require('../models/League');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const BrowserService = require('./browserless');

// Load env vars
dotenv.config();

// MongoDB connection options
const clientOptions = { 
  serverApi: { 
    version: '1', 
    strict: true, 
    deprecationErrors: true 
  }
};

// Define URIs
// Database connection
const username = encodeURIComponent(process.env.MONGO_USERNAME || "screamindeath");
const password = encodeURIComponent(process.env.MONGO_PASSWORD || "Asdlkj12!@");
const cluster = process.env.MONGO_CLUSTER || "khelkudnepal.avsi6dg.mongodb.net";
const dbName = "khelkud_nepal";

// Build MongoDB Atlas connection string
const uri = `mongodb+srv://${username}:${password}@${cluster}/?retryWrites=true&w=majority&appName=khelkudNepal`;
const localUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/khelkud_nepal';

// Connect to database - try Atlas first, then local
async function connectToDatabase() {
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(uri, clientOptions);
    console.log('Successfully connected to MongoDB Atlas');
    return true;
  } catch (atlasError) {
    console.error('MongoDB Atlas connection error:', atlasError.message);
    
    try {
      console.log('Attempting to connect to local MongoDB...');
      await mongoose.connect(localUri);
      console.log('Connected to local MongoDB successfully');
      return true;
    } catch (localError) {
      console.error('Local MongoDB connection error:', localError.message);
      return false;
    }
  }
}

// Web scraping utilities for leagues data
class LeagueWebScraper {
  // Fetch cricket leagues from web
  static async fetchCricketLeagues() {
    try {
      console.log('Fetching cricket leagues from the web...');
      const leagues = [];
      
      // Try to use Browserless for better scraping results
      let browser = null;
      try {
        browser = await BrowserService.getBrowser();
        const page = await BrowserService.createStealthPage(browser);
        
        // Try to find Nepali cricket leagues
        await page.goto('https://www.google.com/search?q=nepal+cricket+leagues+standings', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Extract league info if available
        const leagueInfo = await page.evaluate(() => {
          const leagueData = [];
          
          // Check for Google's direct sports info boxes
          const leagueElements = document.querySelectorAll('.imspo_mt__lg-st-co');
          
          if (leagueElements.length > 0) {
            leagueElements.forEach(leagueElement => {
              const leagueName = leagueElement.querySelector('.imspo_mt__lg-st-co')?.textContent.trim();
              const teams = [];
              
              // Extract teams in the league
              const teamElements = leagueElement.querySelectorAll('.imspo_mt__tm');
              
              teamElements.forEach(teamElement => {
                const teamName = teamElement.querySelector('.imspo_mt__tt-w')?.textContent.trim();
                
                if (teamName) {
                  teams.push({
                    name: teamName,
                    logo: '/images/default-team-logo.png', // Default logo
                    location: 'Nepal', // Default location
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                  });
                }
              });
              
              if (leagueName && teams.length > 0) {
                leagueData.push({
                  name: leagueName,
                  teams: teams
                });
              }
            });
          }
          
          return leagueData;
        });
        
        if (leagueInfo && leagueInfo.length > 0) {
          for (const league of leagueInfo) {
            leagues.push({
              name: league.name,
              category: 'Cricket',
              season: new Date().getFullYear().toString(),
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
              status: 'ongoing',
              featured: true,
              description: `Cricket league in Nepal: ${league.name}`,
              teams: league.teams
            });
          }
        }
        
        // If no leagues found via Google's info boxes, try ESPNCricinfo
        if (leagues.length === 0) {
          await page.goto('https://www.espncricinfo.com/search?query=nepal%20league', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Extract leagues from search results
          const searchResults = await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('.ds-border-b.ds-border-line');
            
            items.forEach(item => {
              const title = item.querySelector('.ds-text-title-s')?.textContent.trim();
              
              if (title && title.toLowerCase().includes('league') && title.toLowerCase().includes('nepal')) {
                results.push({
                  name: title
                });
              }
            });
            
            return results;
          });
          
          if (searchResults && searchResults.length > 0) {
            // Add these leagues with minimal placeholder data
            for (const result of searchResults) {
              leagues.push({
                name: result.name,
                category: 'Cricket',
                season: new Date().getFullYear().toString(),
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
                status: 'ongoing',
                featured: true,
                description: `Cricket league in Nepal: ${result.name}`,
                teams: [
                  {
                    name: 'Kathmandu Kings',
                    logo: '/images/teams/kathmandu-kings.png',
                    location: 'Kathmandu',
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                  },
                  {
                    name: 'Pokhara Rhinos',
                    logo: '/images/teams/pokhara-rhinos.png',
                    location: 'Pokhara',
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                  }
                ]
              });
            }
          }
        }
      } catch (error) {
        console.error('Error with Browserless in cricket leagues scraping:', error);
      } finally {
        if (browser) {
          await browser.close().catch(console.error);
        }
      }
      
      // Return found leagues or fallback to sample leagues
      if (leagues.length > 0) {
        return leagues;
      } else {
        console.log('No cricket leagues found from web.');
        return [];
      }
    } catch (error) {
      console.error('Error fetching cricket leagues:', error);
      return [];
    }
  }
  
  // Fetch football leagues from web
  static async fetchFootballLeagues() {
    try {
      console.log('Fetching football leagues from the web...');
      const leagues = [];
      
      // Try to fetch from reliable football data sources
      try {
        const response = await axios.get('https://www.google.com/search?q=nepal+football+league+standings', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Try to extract league data from Google's sports data
        const leagueTitle = $('.imspo_mt__cm-s').first().text().trim();
        const teamRows = $('.imspo_mt__tr');
        
        if (leagueTitle && teamRows.length > 0) {
          const teams = [];
          
          teamRows.each((i, el) => {
            if (i > 0) { // Skip header row
              const teamName = $(el).find('.imspo_mt__tt-w').text().trim();
              const played = parseInt($(el).find('td').eq(2).text()) || 0;
              const won = parseInt($(el).find('td').eq(3).text()) || 0;
              const drawn = parseInt($(el).find('td').eq(4).text()) || 0;
              const lost = parseInt($(el).find('td').eq(5).text()) || 0;
              const goalsFor = parseInt($(el).find('td').eq(6).text().split(':')[0]) || 0;
              const goalsAgainst = parseInt($(el).find('td').eq(6).text().split(':')[1]) || 0;
              const points = parseInt($(el).find('td').eq(8).text()) || 0;
              
              if (teamName) {
                teams.push({
                  name: teamName,
                  logo: '/images/default-team-logo.png', // Default logo
                  location: 'Nepal', // Default location
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
          
          if (teams.length > 0) {
            leagues.push({
              name: leagueTitle || 'Nepal Football League',
              category: 'Football',
              season: new Date().getFullYear().toString(),
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
              status: 'ongoing',
              featured: true,
              description: `Top football league in Nepal: ${leagueTitle}`,
              teams: teams
            });
          }
        }
      } catch (error) {
        console.error('Error fetching from Google:', error.message);
      }
      
      // If no leagues found, try Browserless
      if (leagues.length === 0) {
        let browser = null;
        try {
          browser = await BrowserService.getBrowser();
          const page = await BrowserService.createStealthPage(browser);
          
          await page.goto('https://www.google.com/search?q=martyr%27s+memorial+a+division+league+standings', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Extract leagues from search results
          const leagueData = await page.evaluate(() => {
            const teams = [];
            const tableRows = document.querySelectorAll('.imspo_mt__tr');
            
            if (tableRows.length > 1) {
              tableRows.forEach((row, index) => {
                if (index > 0) { // Skip header row
                  const columns = row.querySelectorAll('td');
                  
                  if (columns.length >= 9) {
                    const teamName = row.querySelector('.imspo_mt__tt-w')?.textContent.trim();
                    const played = parseInt(columns[2]?.textContent) || 0;
                    const won = parseInt(columns[3]?.textContent) || 0;
                    const drawn = parseInt(columns[4]?.textContent) || 0;
                    const lost = parseInt(columns[5]?.textContent) || 0;
                    const goals = columns[6]?.textContent.split(':') || [0, 0];
                    const goalsFor = parseInt(goals[0]) || 0;
                    const goalsAgainst = parseInt(goals[1]) || 0;
                    const points = parseInt(columns[columns.length - 1]?.textContent) || 0;
                    
                    if (teamName) {
                      teams.push({
                        name: teamName,
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
            
            return {
              teams,
              leagueName: document.querySelector('.imspo_mt__cm-s')?.textContent.trim() || 'Nepal Football League'
            };
          });
          
          if (leagueData && leagueData.teams && leagueData.teams.length > 0) {
            leagues.push({
              name: leagueData.leagueName,
              category: 'Football',
              season: new Date().getFullYear().toString(),
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
              status: 'ongoing',
              featured: true,
              description: `Top football league in Nepal: ${leagueData.leagueName}`,
              teams: leagueData.teams.map(team => ({
                ...team,
                logo: '/images/default-team-logo.png',
                location: 'Nepal'
              }))
            });
          }
        } catch (error) {
          console.error('Error with Browserless in football leagues scraping:', error);
        } finally {
          if (browser) {
            await browser.close().catch(console.error);
          }
        }
      }
      
      // Return found leagues or fallback to sample leagues
      if (leagues.length > 0) {
        return leagues;
      } else {
        console.log('No football leagues found from web.');
        return [];
      }
    } catch (error) {
      console.error('Error fetching football leagues:', error);
      return [];
    }
  }
  
  // Fetch basketball leagues from web - placeholder implementation
  static async fetchBasketballLeagues() {
    try {
      console.log('Fetching basketball leagues from the web...');
      const leagues = [];
      
      // Try to use Browserless for better scraping results
      let browser = null;
      try {
        browser = await BrowserService.getBrowser();
        const page = await BrowserService.createStealthPage(browser);
        
        // Try to find Nepali basketball leagues
        await page.goto('https://www.google.com/search?q=nepal+basketball+league+standings', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Extract league info if available
        const leagueInfo = await page.evaluate(() => {
          const leagueData = [];
          
          // Check for Google's direct sports info boxes
          const leagueElements = document.querySelectorAll('.imspo_mt__lg-st-co');
          
          if (leagueElements.length > 0) {
            leagueElements.forEach(leagueElement => {
              const leagueName = leagueElement.querySelector('.imspo_mt__lg-st-co')?.textContent.trim();
              const teams = [];
              
              // Extract teams in the league
              const teamElements = leagueElement.querySelectorAll('.imspo_mt__tm');
              
              teamElements.forEach(teamElement => {
                const teamName = teamElement.querySelector('.imspo_mt__tt-w')?.textContent.trim();
                
                if (teamName) {
                  teams.push({
                    name: teamName,
                    logo: '/images/default-team-logo.png', // Default logo
                    location: 'Nepal', // Default location
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    points: 0
                  });
                }
              });
              
              if (leagueName && teams.length > 0) {
                leagueData.push({
                  name: leagueName,
                  teams: teams
                });
              }
            });
          }
          
          return leagueData;
        });
        
        if (leagueInfo && leagueInfo.length > 0) {
          for (const league of leagueInfo) {
            leagues.push({
              name: league.name,
              category: 'Basketball',
              season: new Date().getFullYear().toString(),
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
              status: 'ongoing',
              featured: true,
              description: `Basketball league in Nepal: ${league.name}`,
              teams: league.teams
            });
          }
        }
        
        // Try another source if no leagues found
        if (leagues.length === 0) {
          // Try searching for Nepali basketball teams info
          await page.goto('https://www.google.com/search?q=nepal+basketball+federation+teams', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          const teamNames = await page.evaluate(() => {
            const names = [];
            const elements = document.querySelectorAll('div.g');
            
            elements.forEach(element => {
              const title = element.querySelector('h3')?.textContent.trim();
              
              if (title && (title.toLowerCase().includes('basketball') || title.toLowerCase().includes('team'))) {
                // Extract team names from search results
                const text = element.textContent;
                const lines = text.split('\n');
                
                lines.forEach(line => {
                  if (line.includes('Club') || line.includes('Team') || line.includes('Basketball')) {
                    // Clean up team name
                    const teamName = line.replace(/[^\w\s]/gi, '').trim();
                    if (teamName && teamName.length > 3 && teamName.length < 40) {
                      names.push(teamName);
                    }
                  }
                });
              }
            });
            
            return [...new Set(names)]; // Remove duplicates
          });
          
          if (teamNames && teamNames.length > 2) {
            // Create a basic league with teams found
            leagues.push({
              name: 'Nepal Basketball League',
              category: 'Basketball',
              season: new Date().getFullYear().toString(),
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
              status: 'ongoing',
              featured: true,
              description: 'Basketball league competition featuring teams from across Nepal.',
              teams: teamNames.slice(0, 8).map(name => ({
                name: name,
                logo: '/images/default-team-logo.png',
                location: 'Nepal',
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0
              }))
            });
          }
        }
      } catch (error) {
        console.error('Error with Browserless in basketball leagues scraping:', error);
      } finally {
        if (browser) {
          await browser.close().catch(console.error);
        }
      }
      
      return leagues;
    } catch (error) {
      console.error('Error fetching basketball leagues:', error);
      return [];
    }
  }
  
  // Fetch volleyball leagues from web - placeholder implementation
  static async fetchVolleyballLeagues() {
    try {
      console.log('Fetching volleyball leagues from the web...');
      const leagues = [];
      
      // Try to fetch data using HTTP request and Cheerio
      try {
        const response = await axios.get('https://www.google.com/search?q=nepal+volleyball+league+teams', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        const teams = [];
        
        // Try to extract team names from search results
        $('div.g').each((i, element) => {
          const text = $(element).text();
          if (text.toLowerCase().includes('volleyball') && text.toLowerCase().includes('team')) {
            const lines = text.split('\n');
            
            lines.forEach(line => {
              if ((line.includes('Club') || line.includes('Team') || line.includes('Volleyball')) && 
                  !line.includes('http') && !line.includes('www')) {
                // Extract potential team name
                let teamName = line.replace(/[^\w\s]/gi, '').trim();
                
                // Clean up team name
                if (teamName && teamName.length > 3 && teamName.length < 40) {
                  teams.push(teamName);
                }
              }
            });
          }
        });
        
        // Remove duplicates
        const uniqueTeams = [...new Set(teams)];
        
        if (uniqueTeams.length > 2) {
          leagues.push({
            name: 'Nepal Volleyball Championship',
            category: 'Volleyball',
            season: new Date().getFullYear().toString(),
            startDate: new Date(),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
            status: 'ongoing',
            featured: true,
            description: 'Volleyball competition featuring top teams from across Nepal.',
            teams: uniqueTeams.slice(0, 8).map(name => ({
              name: name,
              logo: '/images/default-team-logo.png',
              location: 'Nepal',
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 0
            }))
          });
        }
      } catch (error) {
        console.error('Error fetching volleyball data with Axios:', error.message);
      }
      
      // If no leagues found, try with Browserless
      if (leagues.length === 0) {
        let browser = null;
        try {
          browser = await BrowserService.getBrowser();
          const page = await BrowserService.createStealthPage(browser);
          
          // Try to find volleyball clubs/teams in Nepal
          await page.goto('https://www.google.com/search?q=nepal+volleyball+teams+clubs', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          const teamData = await page.evaluate(() => {
            const teams = [];
            const elements = document.querySelectorAll('div.g');
            
            elements.forEach(element => {
              const text = element.textContent;
              
              if (text.toLowerCase().includes('volleyball') && 
                  (text.toLowerCase().includes('club') || text.toLowerCase().includes('team'))) {
                
                // Extract potential team names
                const lines = text.split('\n');
                
                lines.forEach(line => {
                  if ((line.includes('Club') || line.includes('Team') || 
                       line.includes('Volleyball') || line.includes('Association')) && 
                      !line.includes('http') && !line.includes('www')) {
                    
                    // Clean up potential team name
                    const teamName = line.replace(/[^\w\s]/gi, '').trim();
                    
                    if (teamName && teamName.length > 3 && teamName.length < 40) {
                      teams.push(teamName);
                    }
                  }
                });
              }
            });
            
            return [...new Set(teams)]; // Remove duplicates
          });
          
          if (teamData && teamData.length > 2) {
            // Create a league with found teams
            leagues.push({
              name: 'Nepal National Volleyball League',
              category: 'Volleyball',
              season: new Date().getFullYear().toString(),
              startDate: new Date(),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
              status: 'ongoing',
              featured: true,
              description: 'The premier volleyball competition featuring clubs from across Nepal.',
              teams: teamData.slice(0, 8).map(name => ({
                name: name,
                logo: '/images/default-team-logo.png',
                location: 'Nepal',
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0
              }))
            });
          }
        } catch (error) {
          console.error('Error with Browserless in volleyball leagues scraping:', error);
        } finally {
          if (browser) {
            await browser.close().catch(console.error);
          }
        }
      }
      
      return leagues;
    } catch (error) {
      console.error('Error fetching volleyball leagues:', error);
      return [];
    }
  }
}

// Seed data function
const seedData = async () => {
  try {
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
      console.error('Failed to connect to database. Cannot seed leagues data.');
      process.exit(1);
    }

    console.log('Starting to seed leagues data...');
    
    // Delete existing data
    console.log('Deleting existing leagues data...');
    await League.deleteMany();
    console.log('Existing leagues data deleted successfully');

    // Fetch leagues data from web for each category
    console.log('Fetching leagues data from web sources...');
    
    // Cricket leagues
    const cricketLeagues = await LeagueWebScraper.fetchCricketLeagues();
    console.log(`Found ${cricketLeagues.length} cricket leagues`);
    
    // Football leagues
    const footballLeagues = await LeagueWebScraper.fetchFootballLeagues();
    console.log(`Found ${footballLeagues.length} football leagues`);
    
    // Basketball leagues
    const basketballLeagues = await LeagueWebScraper.fetchBasketballLeagues();
    console.log(`Found ${basketballLeagues.length} basketball leagues`);
    
    // Volleyball leagues
    const volleyballLeagues = await LeagueWebScraper.fetchVolleyballLeagues();
    console.log(`Found ${volleyballLeagues.length} volleyball leagues`);
    
    // Combine all leagues
    const allLeagues = [
      ...cricketLeagues,
      ...footballLeagues,
      ...basketballLeagues,
      ...volleyballLeagues
    ];
    
    if (allLeagues.length === 0) {
      console.log('No leagues found from web sources. Database will be empty.');
      process.exit(0);
    }

    // Insert leagues into the database
    console.log(`Inserting ${allLeagues.length} leagues into the database...`);
    const leagues = await League.insertMany(allLeagues);
    console.log(`${leagues.length} leagues inserted successfully!`);

    // Exit process
    console.log('Leagues data seeding completed');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding leagues data:', err);
    process.exit(1);
  }
};

// Call the function
seedData(); 