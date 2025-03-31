const Settings = require('../models/Settings');
const path = require('path');
const fs = require('fs');

// Get all settings or create defaults if none exist
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const { site, contact, social, news, users, newsletter, advanced } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    
    // Update each section if provided
    if (site) settings.site = { ...settings.site.toObject(), ...site };
    if (contact) settings.contact = { ...settings.contact.toObject(), ...contact };
    if (social) settings.social = { ...settings.social.toObject(), ...social };
    if (news) settings.news = { ...settings.news.toObject(), ...news };
    if (users) settings.users = { ...settings.users.toObject(), ...users };
    if (newsletter) settings.newsletter = { ...settings.newsletter.toObject(), ...newsletter };
    if (advanced) settings.advanced = { ...settings.advanced.toObject(), ...advanced };
    
    // Update system metadata
    settings.system.lastUpdated = Date.now();
    settings.system.updatedBy = req.user._id;
    
    await settings.save();
    
    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};

// Get settings by section
exports.getSettingsBySection = async (req, res) => {
  try {
    const { section } = req.params;
    const validSections = ['site', 'contact', 'social', 'news', 'users', 'newsletter', 'advanced', 'system'];
    
    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section: ${section}. Valid sections are: ${validSections.join(', ')}`
      });
    }
    
    const settings = await Settings.getSettings();
    
    return res.status(200).json({
      success: true,
      data: settings[section]
    });
  } catch (error) {
    console.error(`Error fetching ${req.params.section} settings:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to fetch ${req.params.section} settings`,
      error: error.message
    });
  }
};

// Update settings by section
exports.updateSettingsBySection = async (req, res) => {
  try {
    const { section } = req.params;
    const validSections = ['site', 'contact', 'social', 'news', 'users', 'newsletter', 'advanced'];
    
    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section: ${section}. Valid sections are: ${validSections.join(', ')}`
      });
    }
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    
    // Update the specified section
    settings[section] = { ...settings[section].toObject(), ...req.body };
    
    // Update system metadata
    settings.system.lastUpdated = Date.now();
    settings.system.updatedBy = req.user._id;
    
    await settings.save();
    
    return res.status(200).json({
      success: true,
      message: `${section} settings updated successfully`,
      data: settings[section]
    });
  } catch (error) {
    console.error(`Error updating ${req.params.section} settings:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to update ${req.params.section} settings`,
      error: error.message
    });
  }
};

// Reset settings to defaults
exports.resetSettings = async (req, res) => {
  try {
    // Delete all existing settings
    await Settings.deleteMany({});
    
    // Create new default settings
    const settings = await Settings.create({
      system: {
        updatedBy: req.user._id
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Settings reset to defaults successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset settings',
      error: error.message
    });
  }
};

// Upload logo
exports.uploadLogo = async (req, res) => {
  try {
    // Check if file is uploaded
    if (!req.files || !req.files.logo) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const logo = req.files.logo;
    
    // Validate file type
    if (!logo.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }
    
    // Validate file size (max 2MB)
    if (logo.size > 2 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Image size should be less than 2MB'
      });
    }
    
    // Create upload directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `logo-${Date.now()}${path.extname(logo.name)}`;
    const filepath = path.join(uploadDir, filename);
    
    // Move file to upload directory
    await logo.mv(filepath);
    
    // Return success with logo path
    const logoPath = `/uploads/${filename}`;
    
    return res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      logoPath
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload logo',
      error: error.message
    });
  }
}; 