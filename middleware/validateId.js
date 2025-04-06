const mongoose = require('mongoose');

// Middleware to validate MongoDB ObjectID
exports.validateObjectId = (req, res, next) => {
  const idParam = req.params.id;
  
  if (!idParam) {
    return res.status(400).json({
      success: false,
      message: 'No ID parameter provided'
    });
  }
  
  // Check if the provided ID is a valid MongoDB ObjectID
  if (!mongoose.Types.ObjectId.isValid(idParam)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  next();
}; 