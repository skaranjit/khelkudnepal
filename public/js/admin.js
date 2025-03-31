document.addEventListener('DOMContentLoaded', function() {
  const adminLoginForm = document.getElementById('admin-login-form');
  const errorMessage = document.getElementById('error-message');
  
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Clear previous errors
      errorMessage.classList.add('d-none');
      errorMessage.textContent = '';
      
      // Get form data
      const identifier = document.getElementById('identifier').value;
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('remember-me').checked;
      
      // Validate inputs
      if (!identifier || !password) {
        showError('Please provide both username/email and password');
        return;
      }
      
      // Submit login request
      fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier,
          password,
          rememberMe
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Redirect to dashboard on successful login
          window.location.href = '/admin/dashboard';
        } else {
          // Show error message
          showError(data.message || 'Invalid login credentials. Please try again.');
        }
      })
      .catch(error => {
        console.error('Login error:', error);
        showError('An error occurred during login. Please try again.');
      });
    });
  }
  
  // Show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
  }
}); 