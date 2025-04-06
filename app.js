const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const redisClient = require('./utils/redisClient');
const flash = require('connect-flash');
const newsCache = require('./utils/newsCache');
const leagueCache = require('./utils/leagueCache');
const userCache = require('./utils/userCache');
const matchCache = require('./utils/matchCache');

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

// Flash messages middleware
app.use(flash());

// Global middleware to make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
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
app.use('/leagues', leaguesRoutes); // Public leagues route

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
app.get('/', async (req, res) => {
  try {
    // Get news counts by category
    const News = require('./models/News');
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other_sports'];
    const categoryCounts = {};
    
    for (const category of categories) {
      // Use case-insensitive regex to match both capitalized and lowercase categories
      const regex = new RegExp(`^${category}$`, 'i');
      categoryCounts[category] = await News.countDocuments({ category: regex });
    }
    
    res.render('index', { categoryCounts });
  } catch (error) {
    console.error('Error fetching category counts for homepage:', error);
    res.render('index', { categoryCounts: {} });
  }
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

// Set up routes
// API Routes
app.use('/api/news', require('./routes/news'));
app.use('/api/leagues', require('./routes/leagues'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/admin/cache', require('./routes/admin/cacheRoutes'));
app.use('/api/users', require('./routes/api/users'));

// View Routes
app.use('/', require('./routes/viewRoutes'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/user', require('./routes/user'));

// Redis Connection
const initializeRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Redis Connected');
    
    // Initialize caches
    await newsCache.initializeCache();
    await leagueCache.initializeCache();
    await userCache.initializeCache();
    await matchCache.initializeCache();
    
    // Setup background jobs
    setupCronJobs();
  } catch (err) {
    console.error('Redis Connection Error:', err);
  }
};

// MongoDB connection function
async function connectToDatabase() {
  try {
    // Connect to Redis first
    const redisConnected = await redisClient.connect().catch(err => {
      console.warn('Failed to connect to Redis. Running without cache:', err.message);
      return false;
    });
    
    if (redisConnected) {
      console.log('Redis cache enabled');
    } else {
      console.log('Redis cache disabled, falling back to database queries');
    }
    
    // Check if MongoDB URI is defined
    if (!uri) {
      console.error('MongoDB URI is not defined in environment variables.');
      return false;
    }

    // Connect to MongoDB
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB Atlas');
    
    try {
      // Initialize models and data
      const Comment = require('./models/Comment');
      console.log('Comment model initialized.');
      
      // Initialize News model
      const News = require('./models/News');
      const League = require('./models/League');
      
      // Check if database is empty and populate with data if needed
      const newsController = require('./controllers/newsController');
      const newsCount = await News.countDocuments();
      console.log(`Database has ${newsCount} articles`);
      
      if (newsCount === 0) {
        console.log('News collection is empty, populating with initial data...');
        await newsController.checkAndPopulateNews();
      }
      
      // Initialize leagues data if empty
      const leagueController = require('./controllers/leagueController');
      const leaguesCount = await League.countDocuments();
      console.log(`Database has ${leaguesCount} leagues`);
      
      if (leaguesCount === 0) {
        console.log('Leagues collection is empty, populating with initial data...');
        await leagueController.checkAndPopulateLeagues();
      }
      
      // Initialize Redis caches
      const leagueCache = require('./utils/leagueCache');
      const newsCache = require('./utils/newsCache');
      const userCache = require('./utils/userCache');
      const matchCache = require('./utils/matchCache');
      
      try {
        // Initialize league cache
        await leagueCache.initializeCache();
        
        // Initialize news cache
        await newsCache.initializeCache();
        
        // Initialize user cache
        await userCache.initializeCache();
        
        // Initialize match cache
        await matchCache.initializeCache();
      } catch (cacheError) {
        console.error('Error initializing Redis cache:', cacheError);
        console.warn('WARNING: Redis caching may be limited or unavailable');
      }
      
      return true;
    } catch (localError) {
      console.error('Error initializing data:', localError.message);
      console.warn('WARNING: Application running with limited functionality');
      return false;
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    return false;
  }
}

// Connect to database before starting server
connectToDatabase().then(async (connected) => {
  try {
    // Start server first so users can access the site immediately
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}${connected ? ' with database connection' : ' (without database connection)'}`);
    });
  } catch (err) {
    console.error('Error during server startup:', err);
  }
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