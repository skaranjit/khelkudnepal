document.addEventListener('DOMContentLoaded', function() {
  // Load dashboard stats
  loadDashboardStats();
  
  // Load recent articles
  loadRecentArticles();
  
  // Load recent subscribers
  loadRecentSubscribers();
  
  // Setup event listeners
  setupEventListeners();
});

// Load dashboard stats
function loadDashboardStats() {
  // Articles count
  fetch('/api/news?limit=0')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('total-articles').textContent = data.total || 0;
      }
    })
    .catch(error => {
      console.error('Error loading article stats:', error);
      document.getElementById('total-articles').textContent = '?';
    });
  
  // Users count
  fetch('/api/users?limit=0')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('total-users').textContent = data.total || 0;
      }
    })
    .catch(error => {
      console.error('Error loading user stats:', error);
      document.getElementById('total-users').textContent = '?';
    });
  
  // Subscribers count
  fetch('/api/subscriptions?limit=0')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('total-subscribers').textContent = data.total || 0;
      }
    })
    .catch(error => {
      console.error('Error loading subscription stats:', error);
      document.getElementById('total-subscribers').textContent = '?';
    });
  
  // Page views
  fetch('/api/news/stats/views')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('total-views').textContent = data.totalViews || 0;
      }
    })
    .catch(error => {
      console.error('Error loading view stats:', error);
      document.getElementById('total-views').textContent = '?';
    });
}

// Load recent articles
function loadRecentArticles() {
  fetch('/api/news?limit=5&sort=-publishedAt')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.data.length > 0) {
        const tableBody = document.getElementById('recent-articles');
        tableBody.innerHTML = '';
        
        data.data.forEach(article => {
          const row = document.createElement('tr');
          const date = new Date(article.publishedAt).toLocaleDateString();
          
          row.innerHTML = `
            <td><a href="/news/${article._id}" target="_blank">${article.title.substring(0, 30)}${article.title.length > 30 ? '...' : ''}</a></td>
            <td>${article.category}</td>
            <td>${date}</td>
            <td>${article.viewCount || 0}</td>
          `;
          tableBody.appendChild(row);
        });
      }
    })
    .catch(error => {
      console.error('Error loading recent articles:', error);
      document.getElementById('recent-articles').innerHTML = '<tr><td colspan="4" class="text-center">Error loading recent articles</td></tr>';
    });
}

// Load recent subscribers
function loadRecentSubscribers() {
  fetch('/api/subscriptions?limit=5&sort=-createdAt')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.data.length > 0) {
        const tableBody = document.getElementById('recent-subscribers');
        tableBody.innerHTML = '';
        
        data.data.forEach(subscription => {
          const row = document.createElement('tr');
          const date = new Date(subscription.createdAt).toLocaleDateString();
          
          row.innerHTML = `
            <td>${subscription.email}</td>
            <td>${subscription.preferences?.frequency || 'weekly'}</td>
            <td>${date}</td>
          `;
          tableBody.appendChild(row);
        });
      }
    })
    .catch(error => {
      console.error('Error loading recent subscribers:', error);
      document.getElementById('recent-subscribers').innerHTML = '<tr><td colspan="3" class="text-center">Error loading recent subscribers</td></tr>';
    });
}

// Setup event listeners
function setupEventListeners() {
  // Refresh stats button
  const refreshBtn = document.getElementById('refresh-stats');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      loadDashboardStats();
      loadRecentArticles();
      loadRecentSubscribers();
    });
  }
  
  // Export stats button
  const exportBtn = document.getElementById('export-stats');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      alert('Export functionality will be implemented soon.');
    });
  }
  
  // Fetch news button
  const fetchNewsBtn = document.getElementById('fetch-news');
  if (fetchNewsBtn) {
    fetchNewsBtn.addEventListener('click', function() {
      // Show loading state
      this.innerHTML = '<i class="bi bi-cloud-download"></i> Fetching...';
      this.disabled = true;
      
      // Fetch news from API
      fetch('/api/news/scrape?query=sports nepal&limit=10', {
        method: 'GET'
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Import fetched news
            importScrapedNews(data.data);
          } else {
            console.error('Error scraping news:', data.message);
            alert('Error fetching news: ' + (data.message || 'Unknown error'));
            
            // Reset button
            this.innerHTML = '<i class="bi bi-cloud-download"></i> Fetch News';
            this.disabled = false;
          }
        })
        .catch(error => {
          console.error('Error fetching news:', error);
          alert('Error fetching news. Please try again.');
          
          // Reset button
          this.innerHTML = '<i class="bi bi-cloud-download"></i> Fetch News';
          this.disabled = false;
        });
    });
  }
}

// Import scraped news
function importScrapedNews(articles) {
  if (!articles || articles.length === 0) {
    alert('No news articles found to import.');
    
    // Reset button
    const fetchNewsBtn = document.getElementById('fetch-news');
    if (fetchNewsBtn) {
      fetchNewsBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Fetch News';
      fetchNewsBtn.disabled = false;
    }
    
    return;
  }
  
  // Send articles to import endpoint
  fetch('/api/news/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ articles })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert(`Successfully imported ${data.imported} news articles.`);
        
        // Reload stats
        loadDashboardStats();
        loadRecentArticles();
      } else {
        console.error('Error importing news:', data.message);
        alert('Error importing news: ' + (data.message || 'Unknown error'));
      }
      
      // Reset button
      const fetchNewsBtn = document.getElementById('fetch-news');
      if (fetchNewsBtn) {
        fetchNewsBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Fetch News';
        fetchNewsBtn.disabled = false;
      }
    })
    .catch(error => {
      console.error('Error importing news:', error);
      alert('Error importing news. Please try again.');
      
      // Reset button
      const fetchNewsBtn = document.getElementById('fetch-news');
      if (fetchNewsBtn) {
        fetchNewsBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Fetch News';
        fetchNewsBtn.disabled = false;
      }
    });
} 