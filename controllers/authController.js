const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    // Check if username already exists
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
    console.error('Registration error:', error);
    
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
    const { identifier, password } = req.body;
    
    console.log('Login attempt:', { identifier });
    
    // Check if identifier and password exist
    if (!identifier || !password) {
      console.log('Login failed: Missing identifier or password');
      return res.status(400).json({ success: false, message: 'Please provide username/email and password' });
    }
    
    // Check if user exists - look up by either username or email
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });
    
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Login failed: Incorrect password');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Clear any existing session data
    if (req.session) {
      req.session.regenerate(function(err) {
        if (err) {
          console.error('Error regenerating session:', err);
          return res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
        }
        
        // Set token in fresh session
        req.session.token = token;
        req.session.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        // Save the session
        req.session.save(function(err) {
          if (err) {
            console.error('Error saving session:', err);
            return res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
          }
          
          console.log('Login successful:', { username: user.username, role: user.role });
          
          res.status(200).json({
            success: true,
            token,
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          });
        });
      });
    } else {
      console.error('Login failed: No session object');
      return res.status(500).json({ success: false, message: 'Session handling error. Please try again later.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
  }
};

// Admin login
exports.adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    console.log('Admin login attempt:', { identifier });
    
    // Check if identifier and password exist
    if (!identifier || !password) {
      console.log('Admin login failed: Missing identifier or password');
      return res.status(400).json({ success: false, message: 'Please provide username/email and password' });
    }
    
    // Check if user exists and is admin
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase(), role: 'admin' },
        { username: identifier, role: 'admin' }
      ]
    });
    
    if (!user) {
      console.log('Admin login failed: User not found or not an admin');
      return res.status(401).json({ success: false, message: 'Invalid credentials or not an admin' });
    }
    
    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Admin login failed: Incorrect password');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Clear any existing session data
    if (req.session) {
      req.session.regenerate(function(err) {
        if (err) {
          console.error('Error regenerating session:', err);
          return res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
        }
        
        // Set token in fresh session
        req.session.token = token;
        req.session.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        // Save the session
        req.session.save(function(err) {
          if (err) {
            console.error('Error saving session:', err);
            return res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
          }
          
          console.log('Admin login successful:', { username: user.username, role: user.role });
          
          res.status(200).json({
            success: true,
            token,
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          });
        });
      });
    } else {
      console.error('Admin login failed: No session object');
      return res.status(500).json({ success: false, message: 'Session handling error. Please try again later.' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Error during login. Please try again later.' });
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
    const user = await User.findById(req.user.id).select('-password');
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}; 