const Subscription = require('../models/Subscription');
const User = require('../models/User');
const News = require('../models/News');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

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
        
        // Generate new confirmation token
        const confirmationToken = crypto.randomBytes(20).toString('hex');
        subscription.unsubscribeToken = confirmationToken;
        await subscription.save();
        
        // Send confirmation email
        await emailService.sendSubscriptionConfirmation({
          to: email,
          token: confirmationToken
        });
        
        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated successfully. Please check your email to confirm.',
          data: subscription
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'Email already subscribed' 
      });
    }
    
    // Generate tokens
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
      unsubscribeToken,
      isActive: false // Set to false until confirmed
    });
    
    // If user is logged in, associate subscription with user
    if (req.user) {
      subscription.user = req.user.id;
      await subscription.save();
      
      // Update user's subscription status
      await User.findByIdAndUpdate(req.user.id, { isSubscribed: true });
    }
    
    // Send confirmation email
    await emailService.sendSubscriptionConfirmation({
      to: email,
      token: unsubscribeToken
    });
    
    res.status(201).json({
      success: true,
      message: 'Thank you for subscribing! Please check your email to confirm your subscription.',
      data: subscription
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Confirm subscription
exports.confirmSubscription = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find subscription by token
    const subscription = await Subscription.findOne({ unsubscribeToken: token });
    
    if (!subscription) {
      return res.status(404).render('subscription/error', { 
        message: 'Invalid confirmation token. Your subscription could not be confirmed.' 
      });
    }
    
    // Set subscription to active
    subscription.isActive = true;
    await subscription.save();
    
    // Render success page
    res.render('subscription/confirmed', {
      email: subscription.email,
      preferences: subscription.preferences
    });
  } catch (error) {
    console.error('Subscription confirmation error:', error);
    res.status(500).render('subscription/error', { 
      message: 'An error occurred while confirming your subscription.' 
    });
  }
};

// Unsubscribe from newsletter
exports.unsubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find subscription by token
    const subscription = await Subscription.findOne({ unsubscribeToken: token });
    
    if (!subscription) {
      return res.status(404).render('subscription/error', { 
        message: 'Invalid unsubscribe token. Your subscription could not be canceled.' 
      });
    }
    
    // Set subscription to inactive
    subscription.isActive = false;
    await subscription.save();
    
    // If subscription is associated with a user, update user's subscription status
    if (subscription.user) {
      await User.findByIdAndUpdate(subscription.user, { isSubscribed: false });
    }
    
    // Render unsubscribed page
    res.render('subscription/unsubscribed', { email: subscription.email });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).render('subscription/error', { 
      message: 'An error occurred while processing your unsubscribe request.' 
    });
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

// Send newsletter (admin only)
exports.sendNewsletter = async (req, res) => {
  try {
    const { subject, frequency, content, includeLatest } = req.body;
    
    // Validate input
    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'Subject and content are required'
      });
    }
    
    // Find subscribers based on frequency
    const filter = { isActive: true };
    if (frequency && frequency !== 'all') {
      filter['preferences.frequency'] = frequency;
    }
    
    const subscribers = await Subscription.find(filter);
    
    if (subscribers.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active subscribers found for ${frequency || 'any'} frequency`
      });
    }
    
    // Get latest news if requested
    let latestNewsHTML = '';
    if (includeLatest) {
      const latestNews = await News.find()
        .sort({ publishedAt: -1 })
        .limit(5);
      
      if (latestNews.length > 0) {
        latestNewsHTML = `
          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            <h3 style="color: #333;">Latest News</h3>
            <ul style="padding-left: 20px;">
              ${latestNews.map(news => `
                <li style="margin-bottom: 15px;">
                  <a href="${process.env.BASE_URL || 'http://localhost:3000'}/news/${news._id}" style="color: #007bff; text-decoration: none; font-weight: bold;">
                    ${news.title}
                  </a>
                  <p style="margin: 5px 0; color: #666;">${news.summary.slice(0, 100)}...</p>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
    }
    
    // Track successful and failed emails
    const results = {
      total: subscribers.length,
      sent: 0,
      failed: 0,
      errors: []
    };
    
    // Send email to each subscriber
    for (const subscriber of subscribers) {
      try {
        // Prepare email content with subscriber-specific data
        const finalContent = `
          <div>
            <h2 style="color: #333;">Hello ${subscriber.email.split('@')[0]}!</h2>
            ${content}
            ${latestNewsHTML}
          </div>
        `;
        
        // Send the newsletter
        const emailResult = await emailService.sendNewsletter({
          to: subscriber.email,
          subject,
          content: finalContent,
          token: subscriber.unsubscribeToken
        });
        
        if (emailResult.success) {
          results.sent++;
          // Update last sent timestamp
          subscriber.lastSentAt = Date.now();
          await subscriber.save();
        } else {
          results.failed++;
          results.errors.push({
            email: subscriber.email,
            error: emailResult.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: subscriber.email,
          error: error.message
        });
      }
    }
    
    // Return results
    res.status(200).json({
      success: true,
      message: `Newsletter sent to ${results.sent} out of ${results.total} subscribers`,
      data: results
    });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}; 