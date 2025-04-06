const User = require('../models/User');
const userCache = require('../utils/userCache');
const logger = require('../utils/logger');

/**
 * Get all users (admin only)
 */
exports.getAllUsers = async (req, res) => {
  try {
    // Get from cache if available
    const users = await userCache.getAllUsers();
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get single user by ID
 */
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get from cache if available
    const user = await userCache.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create new user (admin only)
 */
exports.createUser = async (req, res) => {
  try {
    // Extract user data
    const { name, email, username, password, role, status } = req.body;
    
    // Check if required fields are provided
    if (!name || !email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, username and password'
      });
    }
    
    // Check if email or username already exists
    const existingEmail = await userCache.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Create user in database
    const user = await User.create({
      name,
      email,
      username,
      password,
      role: role || 'user',
      status: status || 'active'
    });
    
    // Invalidate cache
    await userCache.invalidateUserCache(user._id, user.email);
    
    // Return new user with password removed
    const newUser = await User.findById(user._id).select('-password');
    
    res.status(201).json({
      success: true,
      data: newUser
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update user (admin or owner)
 */
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get existing user
    const existingUser = await userCache.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check authorization: only allow admins or the user themselves
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user'
      });
    }
    
    // Extract update fields
    const { name, email, username, password, role, status } = req.body;
    
    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (password) {
      // For security, create a new user instance to hash the password
      const tempUser = new User({ password });
      await tempUser.hashPassword();
      updateData.password = tempUser.password;
    }
    
    // Only admins can change roles and status
    if (req.user.role === 'admin') {
      if (role) updateData.role = role;
      if (status) updateData.status = status;
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    // Invalidate cache
    await userCache.invalidateUserCache(userId, updatedUser.email);
    
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error updating user ${req.params.id}:`, error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete user (admin only)
 */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const user = await userCache.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete user
    await User.findByIdAndDelete(userId);
    
    // Invalidate cache
    await userCache.invalidateUserCache(userId, user.email);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting user ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 