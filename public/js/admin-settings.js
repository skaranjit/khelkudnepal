document.addEventListener('DOMContentLoaded', function() {
  // Load settings
  loadSettings();
  
  // Setup event listeners
  setupEventListeners();
});

// Load settings
function loadSettings() {
  // Fetch site settings
  fetch('/api/settings')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Populate form fields with retrieved settings
        populateSettings(data.data);
      } else {
        console.error('Error loading settings:', data.message);
        alert('Error loading settings. Some fields may not be populated correctly.');
      }
    })
    .catch(error => {
      console.error('Error loading settings:', error);
      alert('Could not load settings. Using default values.');
    });
}

// Populate form fields with settings data
function populateSettings(settings) {
  // General settings
  if (settings.general) {
    const general = settings.general;
    if (general.siteTitle) document.getElementById('site-title').value = general.siteTitle;
    if (general.siteDescription) document.getElementById('site-description').value = general.siteDescription;
    if (general.contactEmail) document.getElementById('contact-email').value = general.contactEmail;
    if (general.contactPhone) document.getElementById('contact-phone').value = general.contactPhone;
    if (general.contactAddress) document.getElementById('contact-address').value = general.contactAddress;
    if (general.socialFacebook) document.getElementById('social-facebook').value = general.socialFacebook;
    if (general.socialTwitter) document.getElementById('social-twitter').value = general.socialTwitter;
    if (general.socialInstagram) document.getElementById('social-instagram').value = general.socialInstagram;
  }
  
  // News settings
  if (settings.news) {
    const news = settings.news;
    if (news.newsPerPage) document.getElementById('news-per-page').value = news.newsPerPage;
    if (news.featuredNewsCount) document.getElementById('featured-news-count').value = news.featuredNewsCount;
    if (news.showRelatedNews !== undefined) document.getElementById('show-related-news').checked = news.showRelatedNews;
    if (news.autoScrapeFrequency) document.getElementById('auto-scrape').value = news.autoScrapeFrequency;
    if (news.scrapeSources) document.getElementById('scrape-sources').value = news.scrapeSources;
    
    // Populate categories
    if (news.categories && Array.isArray(news.categories)) {
      const categoriesTable = document.getElementById('categories-table');
      if (categoriesTable) {
        categoriesTable.innerHTML = '';
        
        news.categories.forEach(category => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${category.name}</td>
            <td>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" ${category.displayInMenu ? 'checked' : ''}>
              </div>
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-primary">Edit</button>
            </td>
          `;
          categoriesTable.appendChild(row);
        });
      }
    }
  }
  
  // User settings
  if (settings.users) {
    const users = settings.users;
    if (users.allowRegistration !== undefined) document.getElementById('allow-registration').checked = users.allowRegistration;
    if (users.emailVerification !== undefined) document.getElementById('email-verification').checked = users.emailVerification;
    if (users.defaultRole) document.getElementById('default-role').value = users.defaultRole;
    if (users.sessionDuration) document.getElementById('session-duration').value = users.sessionDuration;
    if (users.rememberMeOption !== undefined) document.getElementById('remember-me-option').checked = users.rememberMeOption;
    if (users.autoLogout !== undefined) document.getElementById('auto-logout').checked = users.autoLogout;
  }
  
  // Newsletter settings
  if (settings.newsletter) {
    const newsletter = settings.newsletter;
    if (newsletter.fromEmail) document.getElementById('newsletter-from').value = newsletter.fromEmail;
    if (newsletter.fromName) document.getElementById('newsletter-name').value = newsletter.fromName;
    if (newsletter.defaultSubject) document.getElementById('newsletter-subject').value = newsletter.defaultSubject;
    if (newsletter.dailySendTime) document.getElementById('daily-send-time').value = newsletter.dailySendTime;
    if (newsletter.weeklySendDay) document.getElementById('weekly-send-day').value = newsletter.weeklySendDay;
    if (newsletter.weeklySendTime) document.getElementById('weekly-send-time').value = newsletter.weeklySendTime;
    if (newsletter.articlesPerNewsletter) document.getElementById('articles-per-newsletter').value = newsletter.articlesPerNewsletter;
    if (newsletter.includeImages !== undefined) document.getElementById('include-images').checked = newsletter.includeImages;
    if (newsletter.includeFullContent !== undefined) document.getElementById('include-full-content').checked = newsletter.includeFullContent;
  }
  
  // Advanced settings
  if (settings.advanced) {
    const advanced = settings.advanced;
    if (advanced.cacheDuration) document.getElementById('cache-duration').value = advanced.cacheDuration;
    if (advanced.debugMode !== undefined) document.getElementById('debug-mode').checked = advanced.debugMode;
    if (advanced.logLevel) document.getElementById('log-level').value = advanced.logLevel;
    if (advanced.maintenanceMode !== undefined) document.getElementById('maintenance-mode').checked = advanced.maintenanceMode;
    if (advanced.maintenanceMessage) document.getElementById('maintenance-message').value = advanced.maintenanceMessage;
    if (advanced.enableApi !== undefined) document.getElementById('enable-api').checked = advanced.enableApi;
    if (advanced.apiRateLimit) document.getElementById('api-rate-limit').value = advanced.apiRateLimit;
    
    // Populate API keys
    if (advanced.apiKeys && Array.isArray(advanced.apiKeys)) {
      const apiKeysTable = document.getElementById('api-keys-table');
      if (apiKeysTable) {
        apiKeysTable.innerHTML = '';
        
        advanced.apiKeys.forEach(key => {
          const row = document.createElement('tr');
          const createdDate = new Date(key.createdAt).toLocaleDateString();
          
          row.innerHTML = `
            <td>${key.name}</td>
            <td>${key.key ? '****************************************' : 'No key available'}</td>
            <td>${createdDate}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-secondary view-key-btn" data-id="${key.id}">View</button>
              <button type="button" class="btn btn-sm btn-outline-danger revoke-key-btn" data-id="${key.id}">Revoke</button>
            </td>
          `;
          apiKeysTable.appendChild(row);
        });
      }
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  // Refresh settings button
  const refreshBtn = document.getElementById('refresh-settings');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      loadSettings();
    });
  }
  
  // Logo upload functionality
  const uploadLogoBtn = document.getElementById('upload-logo');
  if (uploadLogoBtn) {
    uploadLogoBtn.addEventListener('click', function() {
      const fileInput = document.getElementById('site-logo');
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a file to upload.');
        return;
      }
      
      const file = fileInput.files[0];
      
      // Check file type
      if (!file.type.match('image.*')) {
        alert('Please select an image file (jpg, png, gif, etc.)');
        return;
      }
      
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size should be less than 2MB.');
        return;
      }
      
      // Create FormData and append file
      const formData = new FormData();
      formData.append('logo', file);
      
      // Show loading indicator
      uploadLogoBtn.textContent = 'Uploading...';
      uploadLogoBtn.disabled = true;
      
      // Upload file
      fetch('/api/settings/upload-logo', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert('Logo uploaded successfully!');
          
          // Update settings with new logo path
          const settings = {
            site: {
              logo: data.logoPath
            }
          };
          
          // Save settings
          return fetch('/api/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
          });
        } else {
          throw new Error(data.message || 'Error uploading logo');
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Reset file input
          fileInput.value = '';
          
          // Force refresh page to show new logo
          window.location.reload();
        }
      })
      .catch(error => {
        console.error('Error uploading logo:', error);
        alert('Error uploading logo: ' + error.message);
      })
      .finally(() => {
        // Reset button
        uploadLogoBtn.textContent = 'Upload';
        uploadLogoBtn.disabled = false;
      });
    });
  }
  
  // General settings form
  const generalForm = document.getElementById('general-settings-form');
  if (generalForm) {
    generalForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const settings = {
        general: {
          siteTitle: document.getElementById('site-title').value,
          siteDescription: document.getElementById('site-description').value,
          contactEmail: document.getElementById('contact-email').value,
          contactPhone: document.getElementById('contact-phone').value,
          contactAddress: document.getElementById('contact-address').value,
          socialFacebook: document.getElementById('social-facebook').value,
          socialTwitter: document.getElementById('social-twitter').value,
          socialInstagram: document.getElementById('social-instagram').value
        }
      };
      
      saveSettings('general', settings);
    });
  }
  
  // News settings form
  const newsForm = document.getElementById('news-settings-form');
  if (newsForm) {
    newsForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const settings = {
        news: {
          newsPerPage: parseInt(document.getElementById('news-per-page').value),
          featuredNewsCount: parseInt(document.getElementById('featured-news-count').value),
          showRelatedNews: document.getElementById('show-related-news').checked,
          autoScrapeFrequency: document.getElementById('auto-scrape').value,
          scrapeSources: document.getElementById('scrape-sources').value
        }
      };
      
      saveSettings('news', settings);
    });
  }
  
  // User settings form
  const userForm = document.getElementById('user-settings-form');
  if (userForm) {
    userForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const settings = {
        users: {
          allowRegistration: document.getElementById('allow-registration').checked,
          emailVerification: document.getElementById('email-verification').checked,
          defaultRole: document.getElementById('default-role').value,
          sessionDuration: parseInt(document.getElementById('session-duration').value),
          rememberMeOption: document.getElementById('remember-me-option').checked,
          autoLogout: document.getElementById('auto-logout').checked
        }
      };
      
      saveSettings('users', settings);
    });
  }
  
  // Newsletter settings form
  const newsletterForm = document.getElementById('newsletter-settings-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const settings = {
        newsletter: {
          fromEmail: document.getElementById('newsletter-from').value,
          fromName: document.getElementById('newsletter-name').value,
          defaultSubject: document.getElementById('newsletter-subject').value,
          dailySendTime: document.getElementById('daily-send-time').value,
          weeklySendDay: document.getElementById('weekly-send-day').value,
          weeklySendTime: document.getElementById('weekly-send-time').value,
          articlesPerNewsletter: parseInt(document.getElementById('articles-per-newsletter').value),
          includeImages: document.getElementById('include-images').checked,
          includeFullContent: document.getElementById('include-full-content').checked
        }
      };
      
      saveSettings('newsletter', settings);
    });
  }
  
  // Advanced settings form
  const advancedForm = document.getElementById('advanced-settings-form');
  if (advancedForm) {
    advancedForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const settings = {
        advanced: {
          cacheDuration: parseInt(document.getElementById('cache-duration').value),
          debugMode: document.getElementById('debug-mode').checked,
          logLevel: document.getElementById('log-level').value,
          maintenanceMode: document.getElementById('maintenance-mode').checked,
          maintenanceMessage: document.getElementById('maintenance-message').value,
          enableApi: document.getElementById('enable-api').checked,
          apiRateLimit: parseInt(document.getElementById('api-rate-limit').value)
        }
      };
      
      saveSettings('advanced', settings);
    });
  }
  
  // Clear cache button
  const clearCacheBtn = document.querySelector('.btn-warning');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to clear the cache?')) {
        fetch('/api/settings/clear-cache', {
          method: 'POST'
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              alert('Cache cleared successfully');
            } else {
              alert(data.message || 'Error clearing cache');
            }
          })
          .catch(error => {
            console.error('Error clearing cache:', error);
            alert('Error clearing cache. Please try again.');
          });
      }
    });
  }
  
  // Reset system button
  const resetSystemBtn = document.querySelector('.btn-danger');
  if (resetSystemBtn) {
    resetSystemBtn.addEventListener('click', function() {
      if (confirm('WARNING: This will reset the entire system to its default state. This action cannot be undone. Are you absolutely sure?')) {
        fetch('/api/settings/reset-system', {
          method: 'POST'
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              alert('System reset successfully. The page will reload.');
              window.location.reload();
            } else {
              alert(data.message || 'Error resetting system');
            }
          })
          .catch(error => {
            console.error('Error resetting system:', error);
            alert('Error resetting system. Please try again.');
          });
      }
    });
  }
  
  // Generate new API key button
  const generateKeyBtn = document.querySelector('.btn-sm.btn-primary.mt-2');
  if (generateKeyBtn) {
    generateKeyBtn.addEventListener('click', function() {
      const keyName = prompt('Enter a name for the new API key:');
      if (keyName) {
        fetch('/api/settings/api-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: keyName
          })
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              alert(`New API key generated successfully: ${data.data.key}\n\nPlease copy this key now as it won't be displayed again in full.`);
              loadSettings(); // Reload settings to update the API keys table
            } else {
              alert(data.message || 'Error generating API key');
            }
          })
          .catch(error => {
            console.error('Error generating API key:', error);
            alert('Error generating API key. Please try again.');
          });
      }
    });
  }
  
  // Send test newsletter button
  const testNewsletterBtn = document.querySelector('#newsletter .btn-secondary');
  if (testNewsletterBtn) {
    testNewsletterBtn.addEventListener('click', function() {
      const email = prompt('Enter email address to send test newsletter:');
      if (email) {
        fetch('/api/subscriptions/send-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email
          })
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              alert('Test newsletter sent successfully');
            } else {
              alert(data.message || 'Error sending test newsletter');
            }
          })
          .catch(error => {
            console.error('Error sending test newsletter:', error);
            alert('Error sending test newsletter. Please try again.');
          });
      }
    });
  }
}

// Save settings
function saveSettings(section, settings) {
  fetch('/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('Settings saved successfully');
      } else {
        alert(data.message || 'Error saving settings');
      }
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    });
} 