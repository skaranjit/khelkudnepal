document.addEventListener('DOMContentLoaded', function() {
  // Load comments
  loadComments();
  
  // Setup event listeners
  setupEventListeners();
});

// Load comments for the current article
function loadComments() {
  const articleId = window.location.pathname.split('/').pop();
  const commentsContainer = document.getElementById('comments-container');
  
  if (!commentsContainer) return;
  
  fetch(`/api/comments?article=${articleId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.data.length > 0) {
        commentsContainer.innerHTML = '';
        
        data.data.forEach(comment => {
          const date = new Date(comment.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const html = `
            <div class="comment mb-3">
              <div class="d-flex">
                <div class="flex-shrink-0">
                  <div class="avatar bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                    ${comment.user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div class="flex-grow-1 ms-3">
                  <div class="d-flex justify-content-between">
                    <h6 class="mb-0">${comment.user.name}</h6>
                    <small class="text-muted">${date}</small>
                  </div>
                  <p class="mb-1">${comment.content}</p>
                </div>
              </div>
            </div>
          `;
          
          commentsContainer.innerHTML += html;
        });
      } else {
        commentsContainer.innerHTML = '<p class="text-center text-muted">No comments yet. Be the first to comment!</p>';
      }
    })
    .catch(error => {
      console.error('Error loading comments:', error);
      commentsContainer.innerHTML = '<p class="text-center text-muted">Error loading comments. Please try again later.</p>';
    });
}

// Setup event listeners
function setupEventListeners() {
  // Comment form submission
  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const content = document.getElementById('comment-content').value;
      const articleId = window.location.pathname.split('/').pop();
      
      if (!content.trim()) {
        alert('Please enter a comment.');
        return;
      }
      
      fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          article: articleId,
          content: content
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Clear the form
            document.getElementById('comment-content').value = '';
            
            // Reload comments
            loadComments();
          } else {
            alert(data.message || 'Error posting comment. Please try again.');
          }
        })
        .catch(error => {
          console.error('Error posting comment:', error);
          alert('Error posting comment. Please try again later.');
        });
    });
  }
  
  // Share links
  const shareLinks = document.querySelectorAll('.social-share');
  shareLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const platform = this.dataset.platform;
      const url = encodeURIComponent(window.location.href);
      const title = encodeURIComponent(document.title);
      
      let shareUrl = '';
      
      switch (platform) {
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
          break;
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
          break;
        case 'pinterest':
          const image = document.querySelector('.featured-image img');
          const imageUrl = image ? encodeURIComponent(image.src) : '';
          shareUrl = `https://pinterest.com/pin/create/button/?url=${url}&media=${imageUrl}&description=${title}`;
          break;
      }
      
      if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }
    });
  });
} 