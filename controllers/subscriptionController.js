const Subscription = require('../models/Subscription');
const User = require('../models/User');
const crypto = require('crypto');

// Subscribe to newsletter
exports.subscribe = async (req, res) => {
  try {
    const { email, preferences } = req.body;
    
    // Check if subscription already exists
    let subscription = await Subscription.findOne({ email });
    
    if (subscription) {
      // Update preferences if subscription exists but is not active
      if (!subscription.isActive) {
        subscription.isActive = true;
        subscription.preferences = preferences || subscription.preferences;
        await subscription.save();
        
        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated successfully',
          data: subscription
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'Email already subscribed' 
      });
    }
    
    // Generate unsubscribe token
    const unsubscribeToken = crypto.randomBytes(20).toString('hex');
    
    // Create new subscription
    subscription = await Subscription.create({
      email,
      preferences: preferences || {
        frequency: 'weekly',
        categories: ['Sports'],
        teams: [],
        leagues: []
      },
      unsubscribeToken
    });
    
    // If user is logged in, associate subscription with user
    if (req.user) {
      subscription.user = req.user.id;
      await subscription.save();
      
      // Update user's subscription status
      await User.findByIdAndUpdate(req.user.id, { isSubscribed: true });
    }
    
    res.status(201).json({
      success: true,
      message: 'Subscribed successfully',
      data: subscription
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Unsubscribe from newsletter
exports.unsubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find subscription by token
    const subscription = await Subscription.findOne({ unsubscribeToken: token });
    
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Invalid unsubscribe token' });
    }
    
    // Set subscription to inactive
    subscription.isActive = false;
    await subscription.save();
    
    // If subscription is associated with a user, update user's subscription status
    if (subscription.user) {
      await User.findByIdAndUpdate(subscription.user, { isSubscribed: false });
    }
    
    res.status(200).json({
      success: true,
      message: 'Unsubscribed successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update subscription preferences
exports.updatePreferences = async (req, res) => {
  try {
    const { email } = req.params;
    const { preferences } = req.body;
    
    // Find subscription by email
    const subscription = await Subscription.findOne({ email });
    
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    
    // Check if user is authorized to update this subscription
    if (req.user && subscription.user && req.user.id !== subscription.user.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this subscription' });
    }
    
    // Update preferences
    subscription.preferences = {
      ...subscription.preferences,
      ...preferences
    };
    
    await subscription.save();
    
    res.status(200).json({
      success: true,
      message: 'Subscription preferences updated successfully',
      data: subscription
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all subscriptions (admin only)
exports.getAllSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Count total documents for pagination
    const total = await Subscription.countDocuments();
    
    // Get subscriptions with pagination
    const subscriptions = await Subscription.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: subscriptions.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: subscriptions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's subscription
exports.getUserSubscription = async (req, res) => {
  try {
    // Find subscription by user ID
    const subscription = await Subscription.findOne({ user: req.user.id });
    
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'You are not subscribed' });
    }
    
    res.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}; 