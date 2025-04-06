// Script to update Match schema in MongoDB to support cricket format
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for schema update'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Get the Match model
const Match = require('../models/Match');

async function updateMatches() {
  try {
    console.log('Starting match schema update...');
    
    // Find all matches to update
    const matches = await Match.find({});
    console.log(`Found ${matches.length} matches to process`);
    
    let updatedCount = 0;
    let cricketCount = 0;
    
    for (const match of matches) {
      let needsUpdate = false;
      const updates = {};
      
      // Check if homeTeam is a string and convert to object
      if (typeof match.homeTeam === 'string') {
        updates.homeTeam = {
          name: match.homeTeam,
          logo: ''
        };
        needsUpdate = true;
      }
      
      // Check if awayTeam is a string and convert to object
      if (typeof match.awayTeam === 'string') {
        updates.awayTeam = {
          name: match.awayTeam,
          logo: ''
        };
        needsUpdate = true;
      }
      
      // Add cricket specific fields for cricket matches
      if (match.category && match.category.toLowerCase() === 'cricket' && !match.score) {
        cricketCount++;
        
        // Create score object if it doesn't exist
        updates.score = {
          home: match.homeScore || 0,
          away: match.awayScore || 0,
          home_detail: `${match.homeScore || 0}/0`,
          away_detail: `${match.awayScore || 0}/0`,
          home_overs: '0.0',
          away_overs: '0.0'
        };
        
        // Create stats object if it doesn't exist
        updates.stats = {
          home: {
            runs: match.homeScore || 0,
            wickets: 0,
            overs: '0.0',
            runRate: 0,
            extras: 0,
            fours: 0,
            sixes: 0
          },
          away: {
            runs: match.awayScore || 0,
            wickets: 0,
            overs: '0.0',
            runRate: 0,
            extras: 0,
            fours: 0,
            sixes: 0
          }
        };
        
        // Set format and overs for cricket matches
        updates.format = 'ODI';
        updates.overs = 50;
        
        needsUpdate = true;
      }
      
      // Update the match if needed
      if (needsUpdate) {
        await Match.updateOne({ _id: match._id }, { $set: updates });
        updatedCount++;
        console.log(`Updated match: ${match._id}`);
      }
    }
    
    console.log(`Schema update complete. Updated ${updatedCount} matches (${cricketCount} cricket matches)`);
    
  } catch (error) {
    console.error('Error updating matches:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update function
updateMatches();
