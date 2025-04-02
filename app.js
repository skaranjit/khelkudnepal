const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Database connection
const username = encodeURIComponent(process.env.MONGO_USERNAME || "screamindeath");
const password = encodeURIComponent(process.env.MONGO_PASSWORD || "Asdlkj12!@");
const cluster = process.env.MONGO_CLUSTER || "khelkudnepal.avsi6dg.mongodb.net";
const dbName = "khelkud_nepal";

// Build MongoDB Atlas connection string
const uri = `mongodb+srv://${username}:${password}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=khelkudNepal`;
const localUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/khelkud_nepal';

// Set up session with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || 'khelkud-nepal-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 86400000, // 24 hours by default
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // use secure cookies in production
    sameSite: 'lax' // helps prevent CSRF attacks
  },
  store: MongoStore.create({
    mongoUrl: uri,
    collectionName: 'sessions',
    ttl: 86400, // 1 day in seconds (default)
    autoRemove: 'native',
    crypto: {
      secret: process.env.SESSION_SECRET || 'khelkud-nepal-secret'
    },
    touchAfter: 24 * 3600 // time period in seconds between session updates
  })
}));

// Global middleware to make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Global middleware to load settings and make them available to all views
app.use(async (req, res, next) => {
  try {
    const Settings = require('./models/Settings');
    const settings = await Settings.getSettings();
    res.locals.settings = settings;
    next();
  } catch (error) {
    console.error('Error loading settings:', error);
    res.locals.settings = null;
    next();
  }
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const newsRoutes = require('./routes/news');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const userRoutes = require('./routes/user');
const viewRoutes = require('./routes/viewRoutes');
const commentRoutes = require('./routes/commentRoutes');
const settingsRoutes = require('./routes/settings');
const matchesRoutes = require('./routes/matches');
const leaguesRoutes = require('./routes/leagues');

app.use('/api/news', newsRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);

// Log all requests to help with debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/', viewRoutes); // Main view routes
app.use('/api/comments', commentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/leagues', leaguesRoutes);

// Image proxy route for handling external images (especially Google News API)
app.get('/api/image-proxy', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send('Image URL is required');
    }
    
    console.log('Proxying image:', imageUrl);
    
    // Forward the request to the actual image URL
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });
    
    // Set appropriate content type
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', contentType);
    
    // Send the image data
    return res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error.message);
    return res.status(500).sendFile(path.join(__dirname, 'public', 'images', 'placeholder.jpg'));
  }
});

// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Auth routes
app.get('/login', (req, res) => {
  res.render('user/login', { title: 'Login' });
});

app.get('/register', (req, res) => {
  res.render('user/register', { title: 'Register' });
});

// Category pages
app.get('/category/:category', (req, res) => {
  const category = req.params.category;
  res.render('category', { 
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} News`,
    category: category
  });
});

// Latest and trending pages
app.get('/latest', (req, res) => {
  res.render('latest', { title: 'Latest News' });
});

app.get('/trending', (req, res) => {
  res.render('trending', { title: 'Trending News' });
});

// Search page
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  res.render('search', { 
    title: `Search Results: ${query}`,
    query: query
  });
});

// Set up routes
app.get('/subscribe', (req, res) => {
  res.render('subscription/form', {
    user: req.session.user || null
  });
});

// MongoDB connection options
const clientOptions = { 
  serverApi: { 
    version: '1', 
    strict: true, 
    deprecationErrors: true 
  }
};

// Connect to MongoDB
async function connectToDatabase() {
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(uri, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB Atlas!");
    
    // Initialize database with sample data if empty
    const newsController = require('./controllers/newsController');
    await newsController.checkAndPopulateNews();
    
    return true;
  } catch (atlasError) {
    console.error('MongoDB Atlas connection error:', atlasError.message);
    
    try {
      console.log('Attempting to connect to local MongoDB...');
      await mongoose.connect(localUri);
      console.log('Connected to local MongoDB successfully');
      
      // Initialize database with sample data if empty
      const newsController = require('./controllers/newsController');
      await newsController.checkAndPopulateNews();
      
      return true;
    } catch (localError) {
      console.error('Local MongoDB connection error:', localError.message);
      console.warn('WARNING: Application running without database - functionality will be limited');
      return false;
    }
  }
}

// Connect to database before starting server
connectToDatabase().then(async (connected) => {
  // Start server first so users can access the site immediately
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}${connected ? ' with database connection' : ' (without database connection)'}`);
  });
  
}).catch(err => {
  console.error('Failed to initialize database connection:', err);
  console.log('Starting server without database connection...');
  
  // Start server even if database connection fails
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (without database connection)`);
  });
});

module.exports = app; 