const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import News model
const News = require('../models/News');

// Connect to MongoDB
async function connectToMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI is not defined in environment variables');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    return false;
  }
}

// Fix news categories
async function fixNewsCategories() {
  try {
    // Find all news articles with the invalid category
    const invalidNews = await News.find({ category: 'Other_sports' });
    console.log(`Found ${invalidNews.length} news articles with invalid 'Other_sports' category`);
    
    if (invalidNews.length === 0) {
      console.log('No invalid categories found');
      return;
    }
    
    // Update all invalid news categories to 'Other'
    const result = await News.updateMany(
      { category: 'Other_sports' },
      { $set: { category: 'Other' } }
    );
    
    console.log(`Successfully updated ${result.modifiedCount} news articles from 'Other_sports' to 'Other'`);
  } catch (error) {
    console.error('Error fixing news categories:', error);
  }
}

// Run the script
(async () => {
  const connected = await connectToMongoDB();
  if (!connected) {
    process.exit(1);
  }
  
  await fixNewsCategories();
  
  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
  
  process.exit(0);
})(); 