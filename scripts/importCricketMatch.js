// Script to import a specific cricket match with detailed stats
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for cricket match import'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Get the Match model
const Match = require('../models/Match');

// Sample cricket match data
const cricketMatchData = {
  "homeTeam": {
    "name": "Result",
    "logo": "https://encrypted-tbn3.gstatic.com/faviconV2?url=https://www.cricbuzz.com&client=NEWS_360&size=96&type=FAVICON&fallback_opts=TYPE,SIZE,URL"
  },
  "awayTeam": {
    "name": "Bangladesh U",
    "logo": "https://encrypted-tbn3.gstatic.com/faviconV2?url=https://www.cricbuzz.com&client=NEWS_360&size=96&type=FAVICON&fallback_opts=TYPE,SIZE,URL"
  },
  "startTime": new Date("2025-04-14T12:58:51.768Z"),
  "venue": {
    "name": "Dasharath Stadium",
    "location": "Kathmandu, Nepal"
  },
  "tournament": "Nepal Cricket League",
  "round": "Regular Season",
  "category": "Cricket",
  "status": "completed",
  "homeScore": 0,
  "awayScore": 1,
  "score": {
    "home": 0,
    "away": 1,
    "home_detail": "0/8",
    "away_detail": "1/9",
    "home_overs": "39.4",
    "away_overs": "5.5"
  },
  "format": "ODI",
  "overs": 50,
  "stats": {
    "home": {
      "runs": 0,
      "wickets": 8,
      "overs": "39.4",
      "runRate": 0.0,
      "extras": 20,
      "fours": 0,
      "sixes": 0
    },
    "away": {
      "runs": 1,
      "wickets": 9,
      "overs": "5.5",
      "runRate": 0.17,
      "extras": 9,
      "fours": 0,
      "sixes": 0
    }
  }
};

async function importCricketMatch() {
  try {
    console.log('Importing cricket match data...');
    
    // Check if this match already exists (using tournament and team names)
    const existingMatch = await Match.findOne({
      'tournament': cricketMatchData.tournament,
      'homeTeam.name': cricketMatchData.homeTeam.name,
      'awayTeam.name': cricketMatchData.awayTeam.name
    });
    
    if (existingMatch) {
      console.log('Match already exists, updating...');
      await Match.updateOne(
        { _id: existingMatch._id },
        { $set: cricketMatchData }
      );
      console.log(`Updated cricket match with ID: ${existingMatch._id}`);
    } else {
      console.log('Creating new cricket match...');
      const newMatch = new Match(cricketMatchData);
      await newMatch.save();
      console.log(`Created new cricket match with ID: ${newMatch._id}`);
    }
    
    console.log('Cricket match import complete');
    
  } catch (error) {
    console.error('Error importing cricket match:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the import function
importCricketMatch(); 