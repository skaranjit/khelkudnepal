document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - main.js');
  
  // Preload placeholder image
  preloadImage('/images/placeholder.jpg');
  
  // Load featured news
  loadFeaturedNews();
  
  // Load latest news
  loadLatestNews();
  
  // Load local news
  loadLocalNews();
  
  // Setup event listeners
  setupEventListeners();
});

// Track loaded images to avoid duplicate loading
const loadedImages = new Set();

// Image preloading function
function preloadImage(src) {
  if (!src || loadedImages.has(src)) return;
  
  const img = new Image();
  img.onload = () => {
    loadedImages.add(src);
  };
  img.onerror = () => {
    console.warn(`Failed to preload image: ${src}`);
  };
  img.src = src;
}

// Handle image errors
function handleImageError(img) {
  img.onerror = null;
  img.src = '/images/placeholder.jpg';
  img.classList.add('fallback-image');
  img.classList.remove('loading');
}

// Fix image URL if needed
function fixImageUrl(url) {
  if (!url) return '/images/placeholder.jpg';
  
  // Replace placeholder.svg with placeholder.jpg if needed
  if (url === '/images/placeholder.svg') {
    return '/images/placeholder.jpg';
  }
  return url;
}

// Load featured news
function loadFeaturedNews() {
  fetch('/api/news/featured')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.data.length > 0) {
        // Update the featured news carousel
        const carouselInner = document.getElementById('featured-news-container');
        carouselInner.innerHTML = '';

        data.data.forEach((news, index) => {
          const imageUrl = news.imageUrl || '/images/placeholder.jpg';
          
          // Format date
          const publishedDate = news.publishedAt ? new Date(news.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }) : '';
          
          // Prepare shortened and full content
          const shortSummary = news.summary ? news.summary.substring(0, 150) + '...' : '';
          const fullContent = news.content || news.summary || '';
          
          // Create carousel item
          const carouselItem = document.createElement('div');
          carouselItem.className = `carousel-item ${index === 0 ? 'active' : ''}`;
          
          carouselItem.innerHTML = `
            <div class="card">
              <div class="row g-0">
                <div class="col-md-6">
                  <img src="${imageUrl}" class="img-fluid rounded-start" alt="${news.title}" 
                       style="height: 100%; object-fit: cover;" 
                       onerror="this.onerror=null; this.src='/images/placeholder.jpg';">
                </div>
                <div class="col-md-6">
                  <div class="card-body d-flex flex-column h-100">
                    <div>
                      <h5 class="card-title">${news.title}</h5>
                      <p class="card-text">
                        <small class="text-muted">
                          <i class="bi bi-calendar"></i> ${publishedDate}
                          ${news.author ? `<span class="ms-2"><i class="bi bi-person"></i> ${news.author}</span>` : ''}
                        </small>
                      </p>
                      <div class="card-text-container">
                        <p class="card-text short-text">${shortSummary}</p>
                        <div class="full-content" style="display:none;">
                          ${fullContent.split('\n').map(para => `<p>${para}</p>`).join('')}
                          <p class="mt-3">
                            <a href="/news/${news._id}" class="btn btn-sm btn-primary">View Full Article</a>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div class="mt-auto">
                      <button class="btn btn-primary read-more-toggle" data-news-id="${news._id}">Read More</button>
                      <span class="badge bg-secondary ms-2">${news.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          carouselInner.appendChild(carouselItem);
        });
        
        // Initialize carousel
        var carousel = new bootstrap.Carousel(document.getElementById('featured-carousel'), {
          interval: 5000
        });
      } else {
        // Show message if no featured news
        document.getElementById('featured-news-container').innerHTML = `
          <div class="carousel-item active">
            <div class="card">
              <div class="card-body text-center py-5">
                <h5>No featured news available</h5>
                <p>Check back later for updates</p>
              </div>
            </div>
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('Error loading featured news:', error);
      document.getElementById('featured-news-container').innerHTML = `
        <div class="carousel-item active">
          <div class="card">
            <div class="card-body text-center py-5">
              <h5>Error loading featured news</h5>
              <p>Please refresh the page or try again later</p>
            </div>
          </div>
        </div>
      `;
    });
}

// Load latest news
function loadLatestNews(page = 1, limit = 6) {
  console.log(`Loading latest news page ${page} with limit ${limit}`);
  const newsContainer = document.getElementById('latest-news-container');
  
  if (!newsContainer) return;
  
  // Only show loading indicator on first page
  if (page === 1) {
    newsContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-3">Loading latest news...</p></div>';
  }
  
  fetch(`/api/news/latest?page=${page}&limit=${limit}`)
    .then(response => response.json())
    .then(data => {
      const newsContainer = document.getElementById('latest-news-container');
      const loadMoreBtn = document.getElementById('load-more-btn');
      
      if (data.success && data.data.length > 0) {
        if (page === 1) {
          newsContainer.innerHTML = '';
        }
        
        // Add each news item to the container
        data.data.forEach(news => {
          const newsCard = createNewsCard(news);
          newsContainer.insertAdjacentHTML('beforeend', newsCard);
        });
        
        // Update load more button
        if (loadMoreBtn) {
          if (data.hasMore) {
            loadMoreBtn.style.display = 'inline-block';
            loadMoreBtn.setAttribute('data-page', page + 1);
          } else {
            loadMoreBtn.style.display = 'none';
          }
        }
      } else {
        if (page === 1) {
          newsContainer.innerHTML = '<div class="col-12 text-center py-5"><p>No news articles available.</p></div>';
        }
        if (loadMoreBtn) {
          loadMoreBtn.style.display = 'none';
        }
      }
    })
    .catch(error => {
      console.error('Error loading latest news:', error);
      document.getElementById('latest-news-container').innerHTML = '<div class="col-12 text-center py-5"><p>Error loading news. Please try again later.</p></div>';
    });
}

// Load local news
function loadLocalNews() {
  const localNewsContainer = document.getElementById('local-news-container');
  
  if (!localNewsContainer) return;
  
  localNewsContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
  
  fetch('/api/news/local')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.data.length > 0) {
        localNewsContainer.innerHTML = '';
        
        data.data.forEach(news => {
          const html = `
            <div class="mb-3">
              <div class="row g-0">
                <div class="col-4">
                  <img src="${news.imageUrl || '/images/placeholder.jpg'}" class="img-fluid rounded" alt="${news.title}" onerror="this.src='/images/placeholder.jpg'">
                </div>
                <div class="col-8 ps-3">
                  <h6 class="mb-1">${news.title}</h6>
                  <a href="/news/${news._id}" class="text-decoration-none read-more">Read More</a>
                </div>
              </div>
            </div>
          `;
          
          localNewsContainer.innerHTML += html;
        });
      } else {
        localNewsContainer.innerHTML = '<p class="text-center">No local news available.</p>';
      }
    })
    .catch(error => {
      console.error('Error loading local news:', error);
      localNewsContainer.innerHTML = '<p class="text-center text-danger">Error loading local news.</p>';
    });
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Setup event listeners
function setupEventListeners() {
  // Load more news
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    console.log('Found load more button, adding event listener');
    loadMoreBtn.addEventListener('click', function() {
      console.log('Load more button clicked');
      const nextPage = parseInt(this.getAttribute('data-page'));
      console.log(`Loading page ${nextPage}`);
      loadLatestNews(nextPage);
    });
  }
  
  // Category filter - handle both index page buttons and navbar dropdown
  const categoryLinks = document.querySelectorAll('.category-link');
  console.log('Found category links:', categoryLinks.length);
  
  if (categoryLinks.length > 0) {
    categoryLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Category link clicked:', this.dataset.category);
        
        // Update active category
        categoryLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        const category = this.dataset.category;
        const newsContainer = document.getElementById('latest-news-container');
        
        if (newsContainer) {
          newsContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-3">Loading articles for ' + category + '...</p></div>';
          
          // Load news by category
          if (category === 'all') {
            loadLatestNews();
          } else {
            console.log(`Loading category: ${category}`);
            
            // Make sure category is properly formatted for API call
            const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
            console.log('Formatted category:', formattedCategory);
            
            // Directly use the URL path that matches the backend route structure
            fetch(`/api/news/category/${formattedCategory}`)
              .then(response => {
                console.log('Category response status:', response.status);
                
                if (!response.ok) {
                  throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                
                return response.json();
              })
              .then(data => {
                console.log('Category data received:', data);
                newsContainer.innerHTML = '';
                
                if (data.success && data.data && data.data.length > 0) {
                  console.log(`Rendering ${data.data.length} articles for category ${formattedCategory}`);
                  
                  data.data.forEach(news => {
                    try {
                      newsContainer.innerHTML += createNewsCard(news);
                    } catch (renderError) {
                      console.error('Error rendering news card:', renderError, news);
                    }
                  });
                  
                  // Hide load more button when filtering by category
                  const loadMoreBtn = document.getElementById('load-more-btn');
                  if (loadMoreBtn) {
                    loadMoreBtn.classList.add('d-none');
                  }
                } else {
                  newsContainer.innerHTML = `
                    <div class="col-12 text-center py-5">
                      <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        No news articles found in the "${formattedCategory}" category.
                      </div>
                    </div>`;
                }
              })
              .catch(error => {
                console.error('Error loading category news:', error);
                newsContainer.innerHTML = `
                  <div class="col-12 text-center py-5">
                    <div class="alert alert-danger">
                      <i class="bi bi-exclamation-triangle me-2"></i>
                      Error loading news: ${error.message}
                    </div>
                    <button class="btn btn-outline-primary mt-3" onclick="window.location.reload()">
                      <i class="bi bi-arrow-clockwise me-2"></i>Refresh Page
                    </button>
                  </div>`;
              });
          }
        } else {
          console.log('News container not found, navigating to home page');
          // If we're not on the home page, redirect to home with category parameter
          window.location.href = `/?category=${category}`;
        }
      });
    });
  }
  
  // Handle URL parameters for categories when page loads
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category');
  if (categoryParam) {
    console.log('Found category in URL params:', categoryParam);
    // Find the matching category link and trigger a click
    const matchingCategoryLink = document.querySelector(`.category-link[data-category="${categoryParam}"]`);
    if (matchingCategoryLink) {
      matchingCategoryLink.click();
    }
  }
  
  // Search form
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const query = document.getElementById('search-input').value.trim();
      
      if (query) {
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
      }
    });
  }
  
  // Subscription form
  const subscriptionForm = document.getElementById('subscription-form');
  if (subscriptionForm) {
    subscriptionForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const email = document.getElementById('subscription-email').value.trim();
      
      if (!email) {
        alert('Please enter your email address.');
        return;
      }
      
      fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('Thank you for subscribing!');
            document.getElementById('subscription-email').value = '';
          } else {
            alert(data.message || 'Error subscribing. Please try again.');
          }
        })
        .catch(error => {
          console.error('Error subscribing:', error);
          alert('Error subscribing. Please try again later.');
        });
    });
  }
  
  // Add global delegate event listener for read more links to handle dynamically loaded content
  document.addEventListener('click', function(e) {
    // Check if the clicked element is a read more link
    if (e.target.matches('a.btn-primary, a.btn-outline-primary, a.btn-sm.btn-outline-primary')) {
      const href = e.target.getAttribute('href');
      
      // Check if it's a news article link
      if (href && href.startsWith('/news/')) {
        // No need to prevent default - let the browser handle the navigation
        console.log('Navigating to article:', href);
      }
    }
  });
  
  // Read more toggle
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('read-more-toggle')) {
      const newsId = e.target.getAttribute('data-news-id');
      const cardTextContainer = e.target.closest('.card').querySelector('.card-text-container');
      
      if (cardTextContainer) {
        const shortText = cardTextContainer.querySelector('.short-text');
        const fullContent = cardTextContainer.querySelector('.full-content');
        
        if (shortText && fullContent) {
          if (fullContent.style.display === 'none') {
            shortText.style.display = 'none';
            fullContent.style.display = 'block';
            e.target.textContent = 'Show Less';
          } else {
            shortText.style.display = 'block';
            fullContent.style.display = 'none';
            e.target.textContent = 'Read More';
          }
        }
      }
    }
  });
  
  // Category filter dropdown
  const categoryLinksDropdown = document.querySelectorAll('.dropdown-item[data-category]');
  categoryLinksDropdown.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const category = this.getAttribute('data-category');
      const container = document.getElementById('category-news-container');
      
      if (container) {
        container.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Loading news...</p></div>';
        loadCategoryNews(category);
      }
    });
  });
  
  // Logout functionality
  const logoutLinks = document.querySelectorAll('.logout-link');
  logoutLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Redirect to home page after logout
          window.location.href = '/';
        } else {
          console.error('Logout failed:', data.message);
        }
      })
      .catch(error => {
        console.error('Error during logout:', error);
      });
    });
  });
}

// Load category news
function loadCategoryNews(category, page = 1) {
  fetch(`/api/news?category=${category}&page=${page}&limit=6`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success && data.data.length > 0) {
        const newsContainer = document.getElementById('news-container');
        
        if (page === 1) {
          newsContainer.innerHTML = '';
        }
        
        data.data.forEach(article => {
          const imageUrl = fixImageUrl(article.imageUrl);
          
          // Preload image
          preloadImage(imageUrl);
          
          const html = `
            <div class="col-md-6 mb-4">
              <div class="card h-100">
                <div class="image-container">
                  <img src="${imageUrl}" 
                       class="card-img-top loading" 
                       alt="${article.title}" 
                       onerror="this.onerror=null; this.src='/images/placeholder.jpg'; this.classList.add('fallback-image');"
                       onload="this.classList.remove('loading')">
                </div>
                <div class="card-body">
                  <span class="badge bg-primary mb-2">${article.category}</span>
                  <h5 class="card-title">${article.title}</h5>
                  <p class="card-text">${article.summary.substring(0, 100)}...</p>
                </div>
                <div class="card-footer bg-white border-0">
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${formatDate(article.publishedAt)}</small>
                    <a href="/news/${article._id}" class="btn btn-sm btn-outline-primary">Read More</a>
                  </div>
                </div>
              </div>
            </div>
          `;
          newsContainer.innerHTML += html;
        });
        
        // Update load more button
        const loadMoreBtn = document.getElementById('load-more');
        if (loadMoreBtn) {
          if (data.pagination.page >= data.pagination.pages) {
            loadMoreBtn.style.display = 'none';
          } else {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.dataset.nextPage = page + 1;
          }
        }
      } else {
        console.error('No news items returned or success is false');
        if (page === 1) {
          document.getElementById('news-container').innerHTML = `<div class="col-12 text-center py-5"><p>No news articles found for "${category}". Please try another category.</p></div>`;
        }
      }
    })
    .catch(error => {
      console.error('Error loading category news:', error);
      if (page === 1) {
        document.getElementById('news-container').innerHTML = '<div class="col-12 text-center py-5"><p>Error loading news articles. Please try again later.</p></div>';
      }
    });
}

// Create news card function
function createNewsCard(news) {
  console.log('Creating news card for:', news.title);
  
  // Format date 
  const publishedDate = news.publishedAt ? new Date(news.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : 'No date';
  
  // Default image if none available
  const imageUrl = news.imageUrl || '/images/placeholder.jpg';
  
  // Handle multiple images
  const hasMultipleImages = news.images && news.images.length > 1;
  
  // Prepare more detailed summary
  const shortSummary = news.summary ? (news.summary.length > 150 ? news.summary.substring(0, 150) + '...' : news.summary) : '';
  const fullContent = news.content || news.summary || '';
  
  // Extract key points from content for enhanced summary display
  const keyPoints = extractKeyPoints(fullContent);
  
  // Create the card HTML with enhanced summary and multiple image support
  return `
    <div class="col-md-6 mb-4">
      <div class="card h-100 news-card">
        ${hasMultipleImages ? `
          <!-- Multiple image carousel -->
          <div id="carousel-${news._id}" class="carousel slide card-img-container" data-bs-ride="carousel">
            <div class="carousel-inner">
              ${news.images.slice(0, 3).map((img, index) => `
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                  <img src="${img}" class="card-img-top news-image" alt="${news.title} image ${index+1}" 
                      onerror="this.onerror=null; this.src='/images/placeholder.jpg';">
                </div>
              `).join('')}
            </div>
            ${news.images.length > 1 ? `
              <button class="carousel-control-prev" type="button" data-bs-target="#carousel-${news._id}" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#carousel-${news._id}" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
              </button>
            ` : ''}
          </div>
        ` : `
          <!-- Single image display -->
          <div class="card-img-container">
            <img src="${imageUrl}" class="card-img-top news-image" alt="${news.title}" 
                onerror="this.onerror=null; this.src='/images/placeholder.jpg';">
          </div>
        `}
        
        <div class="card-body">
          <div class="d-flex justify-content-between mb-2">
            <span class="badge bg-secondary">${news.category || 'General'}</span>
            <small class="text-muted"><i class="bi bi-calendar"></i> ${publishedDate}</small>
          </div>
          
          <h5 class="card-title">${news.title}</h5>
          
          <div class="card-meta mb-2">
            <small class="text-muted">
              ${news.author ? `<i class="bi bi-person"></i> ${news.author}` : ''}
              ${news.source ? `<span class="ms-2"><i class="bi bi-newspaper"></i> ${news.source}</span>` : ''}
            </small>
          </div>
          
          <div class="card-text-container">
            <!-- Enhanced Summary Display -->
            <div class="short-text">
              <p class="card-text">${shortSummary}</p>
              
              ${keyPoints.length > 0 ? `
                <div class="key-points mt-2">
                  <small class="text-muted"><strong>Key points:</strong></small>
                  <ul class="small mt-1 ps-3">
                    ${keyPoints.slice(0, 2).map(point => `<li>${point}</li>`).join('')}
                    ${keyPoints.length > 2 ? `<li>and more...</li>` : ''}
                  </ul>
                </div>
              ` : ''}
            </div>
            
            <div class="full-content" style="display:none;">
              ${fullContent.split('\n').map(para => `<p>${para}</p>`).join('')}
              
              ${keyPoints.length > 0 ? `
                <div class="key-points-full mt-3 mb-3">
                  <p class="mb-1"><strong>Summary:</strong></p>
                  <ul>
                    ${keyPoints.map(point => `<li>${point}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${hasMultipleImages && news.images.length > 3 ? `
                <div class="image-gallery mt-3">
                  <p class="mb-2"><strong>More Images:</strong></p>
                  <div class="row g-2">
                    ${news.images.slice(3, 6).map((img, index) => `
                      <div class="col-4">
                        <img src="${img}" class="img-fluid thumbnail rounded" alt="${news.title} additional image">
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              
              <p class="mt-3">
                <a href="/news/${news._id}" class="btn btn-sm btn-primary">View Full Article</a>
              </p>
            </div>
          </div>
        </div>
        
        <div class="card-footer bg-transparent d-flex justify-content-between align-items-center">
          <div>
            <button class="btn btn-sm btn-primary read-more-toggle" data-news-id="${news._id}">Read More</button>
            <a href="/news/${news._id}" class="btn btn-sm btn-outline-primary ms-2">View Article</a>
          </div>
          ${hasMultipleImages ? `<small class="text-muted"><i class="bi bi-images"></i> ${news.images.length} images</small>` : ''}
        </div>
      </div>
    </div>
  `;
}

// Extract key points from content
function extractKeyPoints(content) {
  if (!content || content.length < 50) return [];
  
  // Split into sentences
  const sentences = content.replace(/([.?!])\s*(?=[A-Z])/g, "$1|").split("|");
  
  // Filter for likely key points (longer sentences, ones with numbers, etc.)
  return sentences
    .filter(sentence => 
      sentence.length > 20 && 
      (sentence.includes(',') || 
       /\d/.test(sentence) || 
       sentence.includes(':') ||
       /important|key|highlight|according to|reported|announced/i.test(sentence))
    )
    .map(sentence => sentence.trim())
    .slice(0, 5); // Limit to 5 key points
}

// Add global event listener for dynamically loaded content
document.addEventListener('click', function(e) {
    // Handle read more toggle clicks
    if (e.target.classList.contains('read-more-toggle')) {
        e.preventDefault();
        
        // Find the parent card
        const card = e.target.closest('.news-card');
        if (!card) return;
        
        // Find text containers
        const shortText = card.querySelector('.short-text');
        const fullContent = card.querySelector('.full-content');
        
        // Toggle display
        if (fullContent.style.display === 'none') {
            shortText.style.display = 'none';
            fullContent.style.display = 'block';
            e.target.textContent = 'Show Less';
        } else {
            shortText.style.display = 'block';
            fullContent.style.display = 'none';
            e.target.textContent = 'Read More';
        }
    }
    
    // Handle old read more links for backward compatibility
    else if (e.target.classList.contains('read-more') || e.target.closest('.read-more')) {
        const target = e.target.classList.contains('read-more') ? e.target : e.target.closest('.read-more');
        if (target.href) {
            window.location.href = target.href;
        }
    }
}); 