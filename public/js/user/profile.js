document.addEventListener('DOMContentLoaded', function() {
  // Initialize the profile page
  loadUserProfile();
  setupFormListeners();
});

/**
 * Load user profile data from API
 */
async function loadUserProfile() {
  try {
    showLoader();
    
    const response = await fetch('/api/users/profile');
    
    if (!response.ok) {
      throw new Error('Failed to load profile');
    }
    
    const { success, data } = await response.json();
    
    if (success) {
      populateFormFields(data);
    } else {
      showNotification('Error loading profile data', 'danger');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showNotification('Error loading profile: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Populate form fields with user data
 */
function populateFormFields(userData) {
  // Personal information
  document.getElementById('username').value = userData.username || '';
  document.getElementById('name').value = userData.name || '';
  document.getElementById('email').value = userData.email || '';
  
  // Subscription status
  if (document.getElementById('newsletter-subscription')) {
    document.getElementById('newsletter-subscription').checked = userData.isSubscribed || false;
  }
  
  // Sport preferences
  if (userData.preferences && userData.preferences.sports) {
    userData.preferences.sports.forEach(sport => {
      const sportCheckbox = document.getElementById(`sport-${sport.toLowerCase()}`);
      if (sportCheckbox) {
        sportCheckbox.checked = true;
      }
    });
  }
  
  // Teams
  if (userData.preferences && userData.preferences.teams) {
    document.getElementById('teams').value = Array.isArray(userData.preferences.teams) 
      ? userData.preferences.teams.join(', ') 
      : userData.preferences.teams;
  }
  
  // Leagues
  if (userData.preferences && userData.preferences.leagues) {
    document.getElementById('leagues').value = Array.isArray(userData.preferences.leagues) 
      ? userData.preferences.leagues.join(', ') 
      : userData.preferences.leagues;
  }
  
  // Location
  if (userData.location) {
    if (userData.location.country) document.getElementById('country').value = userData.location.country;
    if (userData.location.city) document.getElementById('city').value = userData.location.city;
  }
}

/**
 * Set up event listeners for form submission
 */
function setupFormListeners() {
  // Personal information form
  const personalInfoForm = document.getElementById('personal-info-form');
  if (personalInfoForm) {
    personalInfoForm.addEventListener('submit', handlePersonalInfoSubmit);
  }
  
  // Preferences form
  const preferencesForm = document.getElementById('preferences-form');
  if (preferencesForm) {
    preferencesForm.addEventListener('submit', handlePreferencesSubmit);
  }
  
  // Password change form
  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordSubmit);
  }
  
  // Location form
  const locationForm = document.getElementById('location-form');
  if (locationForm) {
    locationForm.addEventListener('submit', handleLocationSubmit);
  }
  
  // Location detection button
  const detectLocationBtn = document.getElementById('detect-location');
  if (detectLocationBtn) {
    detectLocationBtn.addEventListener('click', handleLocationDetection);
  }
  
  // Subscription form
  const subscriptionForm = document.getElementById('subscription-form');
  if (subscriptionForm) {
    subscriptionForm.addEventListener('submit', handleSubscriptionSubmit);
  }
}

/**
 * Handle personal information form submission
 */
async function handlePersonalInfoSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    const formData = new FormData(e.target);
    const updateData = {
      name: formData.get('name'),
      email: formData.get('email')
    };
    
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Personal information updated successfully', 'success');
    } else {
      throw new Error(responseData.message || 'Failed to update personal information');
    }
  } catch (error) {
    console.error('Error updating personal information:', error);
    showNotification('Error: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle preferences form submission
 */
async function handlePreferencesSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    const formData = new FormData(e.target);
    
    // Get checked sports
    const sports = formData.getAll('preferences[sports][]');
    
    // Parse teams and leagues from comma-separated list to array
    const teams = formData.get('preferences[teams]')
      ? formData.get('preferences[teams]').split(',').map(team => team.trim())
      : [];
      
    const leagues = formData.get('preferences[leagues]')
      ? formData.get('preferences[leagues]').split(',').map(league => league.trim())
      : [];
    
    const updateData = {
      preferences: {
        sports,
        teams,
        leagues
      }
    };
    
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Preferences updated successfully', 'success');
    } else {
      throw new Error(responseData.message || 'Failed to update preferences');
    }
  } catch (error) {
    console.error('Error updating preferences:', error);
    showNotification('Error: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle password form submission
 */
async function handlePasswordSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    const formData = new FormData(e.target);
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match');
    }
    
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    const updateData = {
      currentPassword,
      newPassword
    };
    
    const response = await fetch('/api/users/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Password updated successfully', 'success');
      // Clear the form
      e.target.reset();
    } else {
      throw new Error(responseData.message || 'Failed to update password');
    }
  } catch (error) {
    console.error('Error updating password:', error);
    showNotification('Error: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle location form submission
 */
async function handleLocationSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    const formData = new FormData(e.target);
    const country = formData.get('location[country]');
    const city = formData.get('location[city]');
    
    const updateData = {
      location: {
        country,
        city
      }
    };
    
    const response = await fetch('/api/users/location', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Location updated successfully', 'success');
    } else {
      throw new Error(responseData.message || 'Failed to update location');
    }
  } catch (error) {
    console.error('Error updating location:', error);
    showNotification('Error: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle location detection
 */
async function handleLocationDetection() {
  try {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser');
    }
    
    showLoader();
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        
        // Use a reverse geocoding service to get location details
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
        const data = await response.json();
        
        if (data.address) {
          document.getElementById('country').value = data.address.country || '';
          document.getElementById('city').value = data.address.city || data.address.town || data.address.village || '';
          
          // Save coordinates for future use
          const updateData = {
            location: {
              country: data.address.country || '',
              city: data.address.city || data.address.town || data.address.village || '',
              coordinates: {
                lat: latitude,
                lng: longitude
              }
            }
          };
          
          // Update the server (optional, can be removed if we only want to update on form submit)
          await fetch('/api/users/location', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          });
          
          showNotification('Location detected and set', 'success');
        } else {
          throw new Error('Could not determine your location details');
        }
      } catch (error) {
        console.error('Error processing location:', error);
        showNotification('Error: ' + error.message, 'danger');
      } finally {
        hideLoader();
      }
    }, (error) => {
      console.error('Geolocation error:', error);
      hideLoader();
      
      let errorMessage = 'Failed to detect location';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'You denied the request for geolocation';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'The request to get user location timed out';
          break;
      }
      
      showNotification('Error: ' + errorMessage, 'danger');
    });
  } catch (error) {
    console.error('Error detecting location:', error);
    showNotification('Error: ' + error.message, 'danger');
    hideLoader();
  }
}

/**
 * Handle subscription form submission
 */
async function handleSubscriptionSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    const formData = new FormData(e.target);
    const isSubscribed = formData.get('isSubscribed') === 'on';
    
    // Get additional subscription preferences
    const dailyUpdate = formData.get('subscriptionPreferences[dailyUpdate]') === 'on';
    const breakingNews = formData.get('subscriptionPreferences[breakingNews]') === 'on';
    const favoriteSports = formData.get('subscriptionPreferences[favoriteSports]') === 'on';
    const localEvents = formData.get('subscriptionPreferences[localEvents]') === 'on';
    
    const updateData = {
      isSubscribed,
      subscriptionPreferences: {
        dailyUpdate,
        breakingNews,
        favoriteSports,
        localEvents
      }
    };
    
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Subscription preferences updated successfully', 'success');
    } else {
      throw new Error(responseData.message || 'Failed to update subscription preferences');
    }
  } catch (error) {
    console.error('Error updating subscription preferences:', error);
    showNotification('Error: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Show loader
 */
function showLoader() {
  // Add a loader to the page if it doesn't exist
  if (!document.getElementById('profile-loader')) {
    const loader = document.createElement('div');
    loader.id = 'profile-loader';
    loader.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75';
    loader.style.zIndex = '9999';
    loader.innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    `;
    document.body.appendChild(loader);
  } else {
    document.getElementById('profile-loader').style.display = 'flex';
  }
}

/**
 * Hide loader
 */
function hideLoader() {
  const loader = document.getElementById('profile-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;
  
  const alertBox = document.createElement('div');
  alertBox.className = `alert alert-${type} alert-dismissible fade show`;
  alertBox.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertBox);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertBox.classList.remove('show');
    setTimeout(() => {
      if (alertContainer.contains(alertBox)) {
        alertContainer.removeChild(alertBox);
      }
    }, 150);
  }, 5000);
} 