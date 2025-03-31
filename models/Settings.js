const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  // General - Site Information
  site: {
    title: { type: String, default: 'KhelKud Nepal' },
    description: { type: String, default: 'Your source for Nepali sports news and updates' },
    logo: { type: String, default: '/img/logo.png' }
  },
  
  // Contact Information
  contact: {
    email: { type: String, default: 'info@khelkudnepal.com' },
    phone: { type: String, default: '+977 9800000000' },
    address: { type: String, default: 'Kathmandu, Nepal' }
  },
  
  // Social Media Links
  social: {
    facebook: { type: String, default: 'https://facebook.com/khelkudnepal' },
    twitter: { type: String, default: 'https://twitter.com/khelkudnepal' },
    instagram: { type: String, default: 'https://instagram.com/khelkudnepal' }
  },
  
  // News Settings
  news: {
    itemsPerPage: { type: Number, default: 10 },
    featuredCount: { type: Number, default: 5 },
    showRelatedNews: { type: Boolean, default: true },
    autoScrapeFrequency: { type: Number, default: 24 }, // hours
    scrapeSources: [{
      name: { type: String },
      url: { type: String },
      enabled: { type: Boolean, default: true }
    }]
  },
  
  // User Settings
  users: {
    allowRegistration: { type: Boolean, default: true },
    requireEmailVerification: { type: Boolean, default: false },
    defaultRole: { type: String, default: 'user' },
    sessionDuration: { type: Number, default: 24 } // hours
  },
  
  // Newsletter Settings
  newsletter: {
    fromEmail: { type: String, default: 'newsletter@khelkudnepal.com' },
    fromName: { type: String, default: 'KhelKud Nepal' },
    subject: { type: String, default: 'KhelKud Nepal News Update' },
    sendTime: { type: String, default: '08:00' },
    sendDays: {
      type: [String],
      default: ['Monday', 'Wednesday', 'Friday']
    },
    articlesPerNewsletter: { type: Number, default: 5 },
    includeFeatured: { type: Boolean, default: true },
    includeLatest: { type: Boolean, default: true }
  },
  
  // Advanced Settings
  advanced: {
    cacheDuration: { type: Number, default: 3600 }, // seconds
    debugMode: { type: Boolean, default: false },
    logLevel: { type: String, default: 'error', enum: ['error', 'warn', 'info', 'debug'] },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'We are currently performing maintenance. Please check back soon.' },
    enableAPI: { type: Boolean, default: true },
    apiRateLimit: { type: Number, default: 100 } // requests per hour
  },
  
  // System Metadata
  system: {
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: String, default: '1.0.0' }
  }
}, { timestamps: true });

// Update lastUpdated timestamp before saving
SettingsSchema.pre('save', function(next) {
  this.system.lastUpdated = Date.now();
  next();
});

// Method to get settings or create defaults if none exist
SettingsSchema.statics.getSettings = async function() {
  const settings = await this.findOne();
  if (settings) {
    return settings;
  }
  
  // Create default settings if none exist
  return await this.create({});
};

const Settings = mongoose.model('Settings', SettingsSchema);

module.exports = Settings; 