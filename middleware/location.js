// Middleware to detect and handle user location
module.exports = (req, res, next) => {
  // Check if user location is already in session
  if (req.session && req.session.userLocation) {
    req.userLocation = req.session.userLocation;
    return next();
  }
  
  // Try to get location from request headers
  const ipAddress = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress ||
                   req.socket.remoteAddress ||
                   req.connection.socket.remoteAddress;
                   
  // For demonstration purposes, we'll set a default location
  // In a production app, you would use a geolocation API service to get the actual location
  const defaultLocation = {
    country: 'United States',
    city: 'New York',
    coordinates: {
      lat: 40.7128,
      lng: -74.0060
    }
  };
  
  // Simulate geolocation API call
  // In a real app, you would make an API call to a service like ipstack, maxmind, etc.
  const getUserLocation = () => {
    // Simulating an API response
    return defaultLocation;
  };
  
  // Get user location
  const userLocation = getUserLocation();
  
  // Store in session and request
  req.session.userLocation = userLocation;
  req.userLocation = userLocation;
  
  next();
}; 