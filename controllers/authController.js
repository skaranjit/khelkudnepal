const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userCache = require('../utils/userCache');
const logger = require('../utils/logger');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Register user
exports.register = async (req, res) => {
  try {
    const { username, name, email, password, location } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username, email, and password' });
    }
    
    // Check if email already exists
    const existingEmail = await userCache.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    // Check if username already exists - we need to check in the database directly since our cache doesn't support username lookups
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }
    
    // Create new user
    const user = await User.create({
      username,
      name: name || username, // Use name if provided, otherwise use username
      email,
      password,
      location: location || {}
    });
    
    // Invalidate user cache after creating a new user
    await userCache.invalidateUserCache(user._id, user.email);
    
    // Generate token
    const token = generateToken(user._id);
    
    // Set token in session
    req.session.token = token;
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    // Provide more specific error messages based on error type
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }
    
    if (error.code === 11000) {
      // MongoDB duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false, 
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists. Please choose another.`
      });
    }
    
    res.status(500).json({ success: false, message: 'Error registering user. Please try again later.' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;
    
    logger.debug('Login attempt:', { identifier, rememberMe });
    
    // Check if identifier and password exist
    if (!identifier || !password) {
      logger.debug('Login failed: Missing identifier or password');
      return res.status(400).json({ success: false, message: 'Please provide username/email and password' });
    }
    
    // Check if user exists - look up by either username or email
    let user;
    
    if (identifier.includes('@')) {
      // If it looks like an email, try to get from cache
      user = await userCache.getUserByEmail(identifier.toLowerCase());
    } else {
      // If it looks like a username, we need to query the database directly
      // Our redis cache only supports email and id lookups
      user = await User.findOne({ username: identifier });
    }
    
    // If not found in cache or by specific lookup, try database lookup with $or query
    if (!user) {
      user = await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ]
      });
    }
    
    if (!user) {
      logger.debug('Login failed: User not found');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if password is correct - need to get non-lean document for methods
    let fullUser;
    if (!user.comparePassword) {
      // If we got a lean object from cache, we need to get the full document for password comparison
      fullUser = await User.findById(user._id);
      if (!fullUser) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      fullUser = user;
    }
    
    const isMatch = await fullUser.comparePassword(password);
    if (!isMatch) {
      logger.debug('Login failed: Incorrect password');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token with longer expiration if rememberMe is true
    const tokenExpiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '1d';
    const token = jwt.sign({ id: fullUser._id }, process.env.JWT_SECRET, {
      expiresIn: tokenExpiresIn
    });
    
    // Clear any existing session data
    if (req.session) {
      req.session.regenerate(function(err) {
        if (err) {
          logger.error('Error regenerating session:', err);
          return res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
        }
        
        // Set token in fresh session
        req.session.token = token;
        req.session.user = {
          id: fullUser._id,
          username: fullUser.username,
          email: fullUser.email,
          role: fullUser.role
        };
        
        // If rememberMe is true, set a longer cookie maxAge
        if (rememberMe) {
          // 30 days in milliseconds
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
          logger.debug('Remember Me enabled - Session extended to 30 days');
        }
        
        // Save the session
        req.session.save(function(err) {
          if (err) {
            logger.error('Error saving session:', err);
            return res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
          }
          
          logger.debug('Login successful:', { username: fullUser.username, role: fullUser.role });
          
          res.status(200).json({
            success: true,
            token,
            user: {
              id: fullUser._id,
              username: fullUser.username,
              email: fullUser.email,
              role: fullUser.role
            }
          });
        });
      });
    } else {
      logger.error('Login failed: No session object');
      return res.status(500).json({ success: false, message: 'Session handling error. Please try again later.' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
  }
};

// Admin login
exports.adminLogin = async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;
    
    // Check if identifier and password exist
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username/email and password' });
    }
    
    // Find user - first check if it's an email
    let user;
    
    if (identifier.includes('@')) {
      // If it looks like an email, try to get from cache
      user = await userCache.getUserByEmail(identifier.toLowerCase());
    } else {
      // If it looks like a username, we need to query the database directly
      user = await User.findOne({ username: identifier });
    }
    
    // If not found by direct lookup, try a general search
    if (!user) {
      user = await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ]
      });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if user is an admin
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to access admin area' });
    }
    
    // Check if password is correct - need to get non-lean document for methods
    let fullUser;
    if (!user.comparePassword) {
      // If we got a lean object from cache, we need to get the full document for password comparison
      fullUser = await User.findById(user._id);
      if (!fullUser) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      fullUser = user;
    }
    
    const isMatch = await fullUser.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(fullUser._id);
    
    // Set admin token in session
    req.session.adminToken = token;
    req.session.user = {
      id: fullUser._id,
      username: fullUser.username,
      email: fullUser.email,
      role: fullUser.role,
      isAdmin: true
    };
    
    // If rememberMe is true, set a longer cookie maxAge
    if (rememberMe) {
      // 7 days in milliseconds for admin sessions
      req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
    }
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: fullUser._id,
        username: fullUser.username,
        email: fullUser.email,
        role: fullUser.role
      }
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Error during admin login' });
  }
};

// Logout user
exports.logout = (req, res) => {
  // Clear session
  req.session.destroy();
  
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await userCache.getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Error getting current user:', error);
    console.error('Error getting current user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}; 