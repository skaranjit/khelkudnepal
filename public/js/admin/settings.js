document.addEventListener('DOMContentLoaded', function() {
  // Initialize UI and load settings
  initSettingsUI();
  loadSettings();
  
  // Setup event listeners for form submission
  setupFormListeners();
});

/**
 * Initialize tabbed interface and form controls
 */
function initSettingsUI() {
  // Handle tab navigation
  const tabLinks = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-pane');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all tabs
      tabLinks.forEach(tab => tab.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active', 'show'));
      
      // Add active class to current tab
      link.classList.add('active');
      const targetId = link.getAttribute('href').substring(1);
      document.getElementById(targetId).classList.add('active', 'show');
      
      // Update URL hash for bookmarking
      window.location.hash = targetId;
    });
  });
  
  // Activate tab from URL hash if present
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const activeTab = document.querySelector(`.nav-link[href="#${hash}"]`);
    if (activeTab) {
      activeTab.click();
    }
  }
}

/**
 * Load settings from API
 */
async function loadSettings() {
  try {
    showLoader();
    
    const response = await fetch('/api/settings');
    
    if (!response.ok) {
      throw new Error('Failed to load settings');
    }
    
    const { success, data } = await response.json();
    
    if (success) {
      populateFormFields(data);
    } else {
      showNotification('Error loading settings', 'danger');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showNotification('Error loading settings: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Populate form fields with settings data
 */
function populateFormFields(settings) {
  // Loop through each section
  ['site', 'contact', 'social', 'news', 'users', 'newsletter', 'advanced'].forEach(section => {
    const sectionData = settings[section];
    
    // Skip if section doesn't exist
    if (!sectionData) return;
    
    // For each property in section
    for (const [key, value] of Object.entries(sectionData)) {
      // Handle nested arrays or objects differently
      if (Array.isArray(value)) {
        handleArrayValues(section, key, value);
      } else if (typeof value === 'object' && value !== null) {
        // For nested objects (e.g., social.facebook)
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          const fieldId = `${section}-${key}-${nestedKey}`;
          setFieldValue(fieldId, nestedValue);
        }
      } else {
        // Simple fields
        const fieldId = `${section}-${key}`;
        setFieldValue(fieldId, value);
      }
    }
  });
  
  // Show last updated info in the UI
  if (settings.system && settings.system.lastUpdated) {
    const lastUpdated = new Date(settings.system.lastUpdated);
    document.getElementById('lastUpdatedInfo').textContent = `Last updated: ${lastUpdated.toLocaleString()}`;
  }
}

/**
 * Handle populating array values in the form
 */
function handleArrayValues(section, key, array) {
  // Handle special cases based on section/key
  if (section === 'newsletter' && key === 'sendDays') {
    // For newsletter send days checkboxes
    array.forEach(day => {
      const checkbox = document.getElementById(`newsletter-sendDays-${day.toLowerCase()}`);
      if (checkbox) checkbox.checked = true;
    });
  } else if (section === 'news' && key === 'scrapeSources') {
    // For scrape sources (might need custom handling)
    const container = document.getElementById('news-scrapeSources-container');
    if (container) {
      // Clear existing items
      container.innerHTML = '';
      
      // Add each source
      array.forEach((source, index) => {
        addScrapeSourceRow(container, source, index);
      });
    }
  }
}

/**
 * Add a row for scrape source in the UI
 */
function addScrapeSourceRow(container, source = {}, index) {
  const row = document.createElement('div');
  row.className = 'scrape-source-row mb-3 border-bottom pb-2';
  row.innerHTML = `
    <div class="row">
      <div class="col-md-5">
        <input type="text" class="form-control" name="news-scrapeSources[${index}][name]" 
          placeholder="Source Name" value="${source.name || ''}">
      </div>
      <div class="col-md-5">
        <input type="text" class="form-control" name="news-scrapeSources[${index}][url]" 
          placeholder="Source URL" value="${source.url || ''}">
      </div>
      <div class="col-md-1">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" name="news-scrapeSources[${index}][enabled]" 
            ${source.enabled ? 'checked' : ''}>
        </div>
      </div>
      <div class="col-md-1">
        <button type="button" class="btn btn-sm btn-danger remove-source">×</button>
      </div>
    </div>
  `;
  
  // Add event listener for remove button
  const removeBtn = row.querySelector('.remove-source');
  removeBtn.addEventListener('click', () => {
    container.removeChild(row);
    reindexSources();
  });
  
  container.appendChild(row);
}

/**
 * Reindex sources after removal to maintain correct indexes
 */
function reindexSources() {
  const container = document.getElementById('news-scrapeSources-container');
  const rows = container.querySelectorAll('.scrape-source-row');
  
  rows.forEach((row, index) => {
    const nameInput = row.querySelector('input[name^="news-scrapeSources"][name$="[name]"]');
    const urlInput = row.querySelector('input[name^="news-scrapeSources"][name$="[url]"]');
    const enabledInput = row.querySelector('input[name^="news-scrapeSources"][name$="[enabled]"]');
    
    nameInput.name = `news-scrapeSources[${index}][name]`;
    urlInput.name = `news-scrapeSources[${index}][url]`;
    enabledInput.name = `news-scrapeSources[${index}][enabled]`;
  });
}

/**
 * Set field value based on field type
 */
function setFieldValue(fieldId, value) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  if (field.type === 'checkbox') {
    field.checked = value;
  } else if (field.tagName === 'SELECT') {
    field.value = value;
  } else {
    field.value = value;
  }
}

/**
 * Setup event listeners for form submission
 */
function setupFormListeners() {
  // Main settings form
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSettingsSubmit);
  }
  
  // Individual section forms
  document.querySelectorAll('.section-form').forEach(form => {
    form.addEventListener('submit', handleSectionSubmit);
  });
  
  // Reset button
  const resetBtn = document.getElementById('resetSettingsBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleSettingsReset);
  }
  
  // Add new scrape source button
  const addSourceBtn = document.getElementById('add-scrape-source');
  if (addSourceBtn) {
    addSourceBtn.addEventListener('click', () => {
      const container = document.getElementById('news-scrapeSources-container');
      const sourceCount = container.querySelectorAll('.scrape-source-row').length;
      addScrapeSourceRow(container, {}, sourceCount);
    });
  }
  
  // Generate API Key button
  const generateApiKeyBtn = document.getElementById('generateApiKey');
  if (generateApiKeyBtn) {
    generateApiKeyBtn.addEventListener('click', handleGenerateApiKey);
  }
}

/**
 * Handle main settings form submission
 */
async function handleSettingsSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    // Build settings object from form data
    const formData = new FormData(e.target);
    const settings = {};
    
    // Process form data into structured settings object
    for (const [name, value] of formData.entries()) {
      processFormField(settings, name, value);
    }
    
    // Process arrays separately (like scrapeSources)
    processArrayFields(settings);
    
    // Send to API
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Settings saved successfully', 'success');
    } else {
      throw new Error(responseData.message || 'Failed to save settings');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Error saving settings: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle section form submission
 */
async function handleSectionSubmit(e) {
  e.preventDefault();
  
  try {
    showLoader();
    
    // Get section name from form id
    const sectionName = e.target.id.replace('-form', '');
    
    // Build section data from form
    const formData = new FormData(e.target);
    const sectionData = {};
    
    // Process form data
    for (const [name, value] of formData.entries()) {
      // Remove section prefix from field name (e.g., "site-title" -> "title")
      const fieldName = name.replace(`${sectionName}-`, '');
      
      // Handle nested fields and arrays
      processFormField(sectionData, fieldName, value);
    }
    
    // Process arrays for this section
    if (sectionName === 'news') {
      processScrapeSourcesArray(sectionData);
    } else if (sectionName === 'newsletter') {
      processNewsletterDays(sectionData);
    }
    
    // Send to API
    const response = await fetch(`/api/settings/${sectionName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sectionData)
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification(`${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} settings saved successfully`, 'success');
    } else {
      throw new Error(responseData.message || `Failed to save ${sectionName} settings`);
    }
  } catch (error) {
    console.error('Error saving section settings:', error);
    showNotification('Error saving settings: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle settings reset
 */
async function handleSettingsReset(e) {
  e.preventDefault();
  
  if (!confirm('Are you sure you want to reset all settings to default values? This cannot be undone.')) {
    return;
  }
  
  try {
    showLoader();
    
    const response = await fetch('/api/settings/reset', {
      method: 'POST'
    });
    
    const responseData = await response.json();
    
    if (responseData.success) {
      showNotification('Settings reset to defaults successfully', 'success');
      // Reload settings to update the form
      loadSettings();
    } else {
      throw new Error(responseData.message || 'Failed to reset settings');
    }
  } catch (error) {
    console.error('Error resetting settings:', error);
    showNotification('Error resetting settings: ' + error.message, 'danger');
  } finally {
    hideLoader();
  }
}

/**
 * Handle generating an API key
 */
async function handleGenerateApiKey() {
  // This would be implemented based on your API key management system
  alert('API key generation functionality to be implemented');
}

/**
 * Process a form field and add it to the settings object
 */
function processFormField(settings, name, value) {
  // Handle checkbox values (convert to boolean)
  if (name.includes('[]')) {
    // Handle array fields
    const arrayName = name.replace('[]', '');
    if (!settings[arrayName]) {
      settings[arrayName] = [];
    }
    settings[arrayName].push(value);
  } else if (name.includes('-')) {
    // Handle nested fields (e.g., site-title)
    const [section, ...parts] = name.split('-');
    const key = parts.join('-');
    
    if (!settings[section]) {
      settings[section] = {};
    }
    
    if (document.getElementById(name)?.type === 'checkbox') {
      settings[section][key] = document.getElementById(name).checked;
    } else if (document.getElementById(name)?.type === 'number') {
      settings[section][key] = parseFloat(value);
    } else {
      settings[section][key] = value;
    }
  } else {
    // Handle simple fields
    if (document.getElementById(name)?.type === 'checkbox') {
      settings[name] = document.getElementById(name).checked;
    } else if (document.getElementById(name)?.type === 'number') {
      settings[name] = parseFloat(value);
    } else {
      settings[name] = value;
    }
  }
  
  return settings;
}

/**
 * Process array fields in the settings object
 */
function processArrayFields(settings) {
  // Process scrape sources if news section exists
  if (settings.news) {
    processScrapeSourcesArray(settings.news);
  }
  
  // Process newsletter days if newsletter section exists
  if (settings.newsletter) {
    processNewsletterDays(settings.newsletter);
  }
}

/**
 * Process scrape sources array
 */
function processScrapeSourcesArray(newsSettings) {
  // Get all scrape source rows
  const container = document.getElementById('news-scrapeSources-container');
  if (!container) return;
  
  const rows = container.querySelectorAll('.scrape-source-row');
  const sourcesList = [];
  
  rows.forEach(row => {
    const nameInput = row.querySelector('input[name^="news-scrapeSources"][name$="[name]"]');
    const urlInput = row.querySelector('input[name^="news-scrapeSources"][name$="[url]"]');
    const enabledInput = row.querySelector('input[name^="news-scrapeSources"][name$="[enabled]"]');
    
    if (nameInput && urlInput) {
      sourcesList.push({
        name: nameInput.value,
        url: urlInput.value,
        enabled: enabledInput ? enabledInput.checked : true
      });
    }
  });
  
  newsSettings.scrapeSources = sourcesList;
}

/**
 * Process newsletter days checkboxes
 */
function processNewsletterDays(newsletterSettings) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const selectedDays = [];
  
  days.forEach(day => {
    const checkbox = document.getElementById(`newsletter-sendDays-${day.toLowerCase()}`);
    if (checkbox && checkbox.checked) {
      selectedDays.push(day);
    }
  });
  
  newsletterSettings.sendDays = selectedDays;
}

/**
 * Show loader
 */
function showLoader() {
  const loader = document.getElementById('settingsLoader');
  if (loader) {
    loader.style.display = 'flex';
  }
}

/**
 * Hide loader
 */
function hideLoader() {
  const loader = document.getElementById('settingsLoader');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  const alertBox = document.createElement('div');
  alertBox.className = `alert alert-${type} alert-dismissible fade show`;
  alertBox.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  const alertContainer = document.getElementById('alertContainer');
  if (alertContainer) {
    alertContainer.appendChild(alertBox);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      alertBox.classList.remove('show');
      setTimeout(() => alertContainer.removeChild(alertBox), 150);
    }, 5000);
  }
} 