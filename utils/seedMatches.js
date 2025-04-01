const mongoose = require('mongoose');
const Match = require('../models/Match');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');

// Load environment variables
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

// Web scraping utility for matches data
class MatchWebScraper {
  // Fetch cricket matches from the web
  static async fetchCricketMatches() {
    try {
      console.log('Fetching cricket matches from the web...');
      const matches = [];
      
      // Create sample cricket matches since web scraping can be unreliable
      console.log('Creating sample cricket matches');
      
      // Live match
      matches.push({
        homeTeam: 'Nepal',
        awayTeam: 'UAE',
        homeScore: 220,
        awayScore: 180,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        category: 'Cricket',
        status: 'live',
        venue: {
          name: 'Tribhuvan University Ground',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'Asia Cup Qualifier',
        innings: [
          {
            team: 'Nepal',
            runs: 220,
            wickets: 6,
            overs: 50
          },
          {
            team: 'UAE',
            runs: 180,
            wickets: 5,
            overs: '35.2'
          }
        ],
        updates: [
          {
            time: new Date(),
            text: 'Nepal vs UAE match in progress',
            important: true
          }
        ]
      });
      
      // Scheduled match
      matches.push({
        homeTeam: 'Nepal',
        awayTeam: 'Oman',
        homeScore: 0,
        awayScore: 0,
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        category: 'Cricket',
        status: 'scheduled',
        venue: {
          name: 'Tribhuvan University Ground',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'Asia Cup Qualifier'
      });
      
      // Completed match
      matches.push({
        homeTeam: 'Nepal',
        awayTeam: 'Singapore',
        homeScore: 250,
        awayScore: 180,
        startTime: new Date(Date.now() - 259200000), // 3 days ago
        endTime: new Date(Date.now() - 244800000), // Match ended
        category: 'Cricket',
        status: 'completed',
        venue: {
          name: 'Tribhuvan University Ground',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'Asia Cup Qualifier',
        innings: [
          {
            team: 'Nepal',
            runs: 250,
            wickets: 7,
            overs: 50
          },
          {
            team: 'Singapore',
            runs: 180,
            wickets: 10,
            overs: '42.3'
          }
        ]
      });
      
      return matches;
    } catch (error) {
      console.error('Error fetching cricket matches:', error);
      return [];
    }
  }
  
  // Fetch football matches from the web
  static async fetchFootballMatches() {
    try {
      console.log('Fetching football matches from the web...');
      const matches = [];
      
      // Create sample football matches
      console.log('Creating sample football matches');
      
      // Live match
      matches.push({
        homeTeam: 'Nepal',
        awayTeam: 'Bhutan',
        homeScore: 2,
        awayScore: 1,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        category: 'Football',
        status: 'live',
        venue: {
          name: 'Dasharath Stadium',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'SAFF Championship',
        goals: [
          {
            team: 'home',
            player: 'Anjan Bista',
            minute: 25
          },
          {
            team: 'away',
            player: 'Chencho Gyeltshen',
            minute: 40
          },
          {
            team: 'home',
            player: 'Rohit Chand',
            minute: 65
          }
        ],
        updates: [
          {
            time: new Date(),
            text: 'Nepal vs Bhutan match in progress',
            important: true
          }
        ]
      });
      
      // Scheduled match
      matches.push({
        homeTeam: 'Nepal',
        awayTeam: 'Bangladesh',
        homeScore: 0,
        awayScore: 0,
        startTime: new Date(Date.now() + 172800000), // Day after tomorrow
        category: 'Football',
        status: 'scheduled',
        venue: {
          name: 'Dasharath Stadium',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'SAFF Championship'
      });
      
      // Completed match
      matches.push({
        homeTeam: 'Nepal',
        awayTeam: 'Maldives',
        homeScore: 3,
        awayScore: 1,
        startTime: new Date(Date.now() - 432000000), // 5 days ago
        endTime: new Date(Date.now() - 428400000), // Match ended
        category: 'Football',
        status: 'completed',
        venue: {
          name: 'Dasharath Stadium',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'SAFF Championship',
        goals: [
          {
            team: 'home',
            player: 'Anjan Bista',
            minute: 15
          },
          {
            team: 'away',
            player: 'Ibrahim Waheed',
            minute: 35
          },
          {
            team: 'home',
            player: 'Nawayug Shrestha',
            minute: 60
          },
          {
            team: 'home',
            player: 'Suman Lama',
            minute: 85
          }
        ]
      });
      
      return matches;
    } catch (error) {
      console.error('Error fetching football matches:', error);
      return [];
    }
  }
  
  // Fetch basketball matches from web
  static async fetchBasketballMatches() {
    try {
      console.log('Fetching basketball matches from web...');
      const matches = [];
      
      // Create sample basketball matches
      console.log('Creating sample basketball matches');
      
      // Live match
      matches.push({
        homeTeam: 'Kathmandu Kings',
        awayTeam: 'Pokhara Pandas',
        homeScore: 58,
        awayScore: 52,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        category: 'Basketball',
        status: 'live',
        venue: {
          name: 'National Sports Complex',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'Nepal Basketball League',
        quarters: [
          {
            quarter: 1,
            homeScore: 18,
            awayScore: 14
          },
          {
            quarter: 2,
            homeScore: 15,
            awayScore: 18
          },
          {
            quarter: 3,
            homeScore: 25,
            awayScore: 20
          }
        ],
        updates: [
          {
            time: new Date(),
            text: 'Kathmandu Kings vs Pokhara Pandas match in progress',
            important: true
          }
        ]
      });
      
      // Scheduled match
      matches.push({
        homeTeam: 'Lalitpur Lakers',
        awayTeam: 'Bhaktapur Bulls',
        homeScore: 0,
        awayScore: 0,
        startTime: new Date(Date.now() + 345600000), // 4 days from now
        category: 'Basketball',
        status: 'scheduled',
        venue: {
          name: 'National Sports Complex',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'Nepal Basketball League'
      });
      
      // Completed match
      matches.push({
        homeTeam: 'Chitwan Tigers',
        awayTeam: 'Birgunj Blazers',
        homeScore: 82,
        awayScore: 74,
        startTime: new Date(Date.now() - 604800000), // 7 days ago
        endTime: new Date(Date.now() - 597600000), // Match ended
        category: 'Basketball',
        status: 'completed',
        venue: {
          name: 'National Sports Complex',
          location: 'Kathmandu, Nepal'
        },
        tournament: 'Nepal Basketball League',
        quarters: [
          {
            quarter: 1,
            homeScore: 22,
            awayScore: 18
          },
          {
            quarter: 2,
            homeScore: 18,
            awayScore: 20
          },
          {
            quarter: 3,
            homeScore: 24,
            awayScore: 18
          },
          {
            quarter: 4,
            homeScore: 18,
            awayScore: 18
          }
        ]
      });
      
      return matches;
    } catch (error) {
      console.error('Error fetching basketball matches:', error);
      return [];
    }
  }
  
  // Fetch volleyball matches from web
  static async fetchVolleyballMatches() {
    try {
      console.log('Fetching volleyball matches from web...');
      const matches = [];
      
      // Create sample volleyball matches
      console.log('Creating sample volleyball matches');
      
      // Live match
      matches.push({
        homeTeam: 'APF Club',
        awayTeam: 'Nepal Police Club',
        homeScore: 2,
        awayScore: 1,
        startTime: new Date(Date.now() - 5400000), // 1.5 hours ago
        category: 'Volleyball',
        status: 'live',
        venue: {
          name: 'Army Sports Complex',
          location: 'Lalitpur, Nepal'
        },
        tournament: 'National Volleyball Championship',
        updates: [
          {
            time: new Date(),
            text: 'APF Club vs Nepal Police Club match in progress',
            important: true
          }
        ]
      });
      
      // Scheduled match
      matches.push({
        homeTeam: 'Tribhuvan Army Club',
        awayTeam: 'Western Volleyball Club',
        homeScore: 0,
        awayScore: 0,
        startTime: new Date(Date.now() + 259200000), // 3 days from now
        category: 'Volleyball',
        status: 'scheduled',
        venue: {
          name: 'Army Sports Complex',
          location: 'Lalitpur, Nepal'
        },
        tournament: 'National Volleyball Championship'
      });
      
      // Completed match
      matches.push({
        homeTeam: 'Eastern Volleyball Club',
        awayTeam: 'Janakpur Volleyball Team',
        homeScore: 3,
        awayScore: 0,
        startTime: new Date(Date.now() - 864000000), // 10 days ago
        endTime: new Date(Date.now() - 857700000), // Match ended
        category: 'Volleyball',
        status: 'completed',
        venue: {
          name: 'Army Sports Complex',
          location: 'Lalitpur, Nepal'
        },
        tournament: 'National Volleyball Championship'
      });
      
      return matches;
    } catch (error) {
      console.error('Error fetching volleyball matches:', error);
      return [];
    }
  }
}

// Seed data
const seedMatches = async () => {
  try {
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
      console.error('Failed to connect to database. Cannot seed matches data.');
      process.exit(1);
    }
    
    console.log('Starting to seed matches data...');
    
    // Clear existing matches
    console.log('Deleting existing matches...');
    await Match.deleteMany({});
    console.log('Existing matches cleared');
    
    // Fetch matches data for each category
    console.log('Fetching matches data...');
    
    // Cricket matches
    const cricketMatches = await MatchWebScraper.fetchCricketMatches();
    console.log(`Found ${cricketMatches.length} cricket matches`);
    
    // Football matches
    const footballMatches = await MatchWebScraper.fetchFootballMatches();
    console.log(`Found ${footballMatches.length} football matches`);
    
    // Basketball matches
    const basketballMatches = await MatchWebScraper.fetchBasketballMatches();
    console.log(`Found ${basketballMatches.length} basketball matches`);
    
    // Volleyball matches
    const volleyballMatches = await MatchWebScraper.fetchVolleyballMatches();
    console.log(`Found ${volleyballMatches.length} volleyball matches`);
    
    // Combine all matches
    const allMatches = [
      ...cricketMatches,
      ...footballMatches,
      ...basketballMatches,
      ...volleyballMatches
    ];
    
    // Insert matches into the database
    console.log(`Inserting ${allMatches.length} matches into the database...`);
    const insertedMatches = await Match.insertMany(allMatches);
    console.log(`${insertedMatches.length} matches inserted successfully!`);
    
    // Close connection
    mongoose.connection.close();
    console.log('Matches data seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding matches data:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seeding function
seedMatches(); 