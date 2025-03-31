document.addEventListener('DOMContentLoaded', function() {
  // Load users
  loadUsers();
  
  // Setup event listeners
  setupEventListeners();
});

// Load users
function loadUsers(page = 1, filters = {}) {
  const tableBody = document.getElementById('users-table-body');
  tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading users...</td></tr>';
  
  // Build query string from filters
  let queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', 10);
  
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.role) queryParams.append('role', filters.role);
  if (filters.status) queryParams.append('status', filters.status);
  
  // Fetch users
  fetch(`/api/users?${queryParams.toString()}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        renderUsers(data.data, data.pagination);
      } else {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${data.message || 'Error loading users'}</td></tr>`;
      }
    })
    .catch(error => {
      console.error('Error loading users:', error);
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading users. Please try again.</td></tr>';
    });
}

// Render users in the table
function renderUsers(users, pagination) {
  const tableBody = document.getElementById('users-table-body');
  const paginationElement = document.getElementById('user-pagination');
  const showingInfo = document.getElementById('showing-info');
  
  // Clear the table
  tableBody.innerHTML = '';
  
  if (users.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
    return;
  }
  
  // Add users to the table
  users.forEach(user => {
    const row = document.createElement('tr');
    
    const createdDate = new Date(user.createdAt).toLocaleDateString();
    const statusClass = user.status === 'active' ? 'bg-success' : 'bg-secondary';
    
    row.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <div class="me-2">
            <i class="bi bi-person-circle fs-4"></i>
          </div>
          <div>
            <div class="small">${user.name || 'N/A'}</div>
            <small class="text-muted">@${user.username}</small>
          </div>
        </div>
      </td>
      <td>${user.email}</td>
      <td><span class="badge bg-primary">${user.role}</span></td>
      <td><span class="badge ${statusClass}">${user.status}</span></td>
      <td>${createdDate}</td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-primary edit-user-btn" data-id="${user._id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-outline-danger delete-user-btn" data-id="${user._id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Update pagination info
  if (pagination) {
    showingInfo.textContent = `Showing ${users.length} of ${pagination.total} users`;
    
    // Build pagination
    paginationElement.innerHTML = '';
    
    // Previous button
    const prevDisabled = pagination.page <= 1 ? 'disabled' : '';
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${prevDisabled}`;
    prevItem.innerHTML = `<a class="page-link" href="#" data-page="${pagination.page - 1}" ${prevDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>Previous</a>`;
    paginationElement.appendChild(prevItem);
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const active = i === pagination.page ? 'active' : '';
      const pageItem = document.createElement('li');
      pageItem.className = `page-item ${active}`;
      pageItem.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
      paginationElement.appendChild(pageItem);
    }
    
    // Next button
    const nextDisabled = pagination.page >= pagination.pages ? 'disabled' : '';
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${nextDisabled}`;
    nextItem.innerHTML = `<a class="page-link" href="#" data-page="${pagination.page + 1}" ${nextDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>Next</a>`;
    paginationElement.appendChild(nextItem);
    
    // Add event listeners to pagination links
    document.querySelectorAll('.page-link[data-page]').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        if (!this.parentElement.classList.contains('disabled') && !this.parentElement.classList.contains('active')) {
          const page = parseInt(this.dataset.page);
          const filters = getFilters();
          loadUsers(page, filters);
        }
      });
    });
  }
  
  // Add event listeners to edit and delete buttons
  setupUserActionButtons();
}

// Setup event listeners
function setupEventListeners() {
  // Filter form
  const filterBtn = document.getElementById('apply-filters');
  if (filterBtn) {
    filterBtn.addEventListener('click', function() {
      const filters = getFilters();
      loadUsers(1, filters);
    });
  }
  
  // Search input (apply filter on enter)
  const searchInput = document.getElementById('search-users');
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const filters = getFilters();
        loadUsers(1, filters);
      }
    });
  }
  
  // Add user form
  const addUserForm = document.getElementById('add-user-form');
  const saveUserBtn = document.getElementById('save-user-btn');
  
  if (addUserForm && saveUserBtn) {
    saveUserBtn.addEventListener('click', function() {
      // Validate form
      if (!addUserForm.checkValidity()) {
        addUserForm.reportValidity();
        return;
      }
      
      // Get form data
      const userData = {
        name: document.getElementById('user-name').value,
        email: document.getElementById('user-email').value,
        username: document.getElementById('user-username').value,
        password: document.getElementById('user-password').value,
        role: document.getElementById('user-role').value,
        status: document.getElementById('user-status').value
      };
      
      // Create user
      fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            
            // Reset form
            addUserForm.reset();
            
            // Reload users
            loadUsers();
            
            // Show success message
            alert('User created successfully');
          } else {
            alert(data.message || 'Error creating user');
          }
        })
        .catch(error => {
          console.error('Error creating user:', error);
          alert('Error creating user. Please try again.');
        });
    });
  }
  
  // Edit user form
  const editUserForm = document.getElementById('edit-user-form');
  const updateUserBtn = document.getElementById('update-user-btn');
  
  if (editUserForm && updateUserBtn) {
    updateUserBtn.addEventListener('click', function() {
      // Validate form
      if (!editUserForm.checkValidity()) {
        editUserForm.reportValidity();
        return;
      }
      
      // Get form data
      const userId = document.getElementById('edit-user-id').value;
      const userData = {
        name: document.getElementById('edit-user-name').value,
        email: document.getElementById('edit-user-email').value,
        username: document.getElementById('edit-user-username').value,
        role: document.getElementById('edit-user-role').value,
        status: document.getElementById('edit-user-status').value
      };
      
      // Add password if provided
      const password = document.getElementById('edit-user-password').value;
      if (password.trim()) {
        userData.password = password;
      }
      
      // Update user
      fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            
            // Reload users
            loadUsers();
            
            // Show success message
            alert('User updated successfully');
          } else {
            alert(data.message || 'Error updating user');
          }
        })
        .catch(error => {
          console.error('Error updating user:', error);
          alert('Error updating user. Please try again.');
        });
    });
  }
}

// Setup user action buttons (edit and delete)
function setupUserActionButtons() {
  // Edit user buttons
  document.querySelectorAll('.edit-user-btn').forEach(button => {
    button.addEventListener('click', function() {
      const userId = this.dataset.id;
      
      // Get user data
      fetch(`/api/users/${userId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Fill the form
            document.getElementById('edit-user-id').value = data.data._id;
            document.getElementById('edit-user-name').value = data.data.name || '';
            document.getElementById('edit-user-email').value = data.data.email;
            document.getElementById('edit-user-username').value = data.data.username;
            document.getElementById('edit-user-role').value = data.data.role;
            document.getElementById('edit-user-status').value = data.data.status || 'active';
            
            // Reset password field
            document.getElementById('edit-user-password').value = '';
            
            // Show modal
            const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
            editModal.show();
          } else {
            alert(data.message || 'Error loading user data');
          }
        })
        .catch(error => {
          console.error('Error loading user data:', error);
          alert('Error loading user data. Please try again.');
        });
    });
  });
  
  // Delete user buttons
  document.querySelectorAll('.delete-user-btn').forEach(button => {
    button.addEventListener('click', function() {
      const userId = this.dataset.id;
      
      if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        // Delete user
        fetch(`/api/users/${userId}`, {
          method: 'DELETE'
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              // Reload users
              loadUsers();
              
              // Show success message
              alert('User deleted successfully');
            } else {
              alert(data.message || 'Error deleting user');
            }
          })
          .catch(error => {
            console.error('Error deleting user:', error);
            alert('Error deleting user. Please try again.');
          });
      }
    });
  });
}

// Get filters from form inputs
function getFilters() {
  return {
    search: document.getElementById('search-users').value.trim(),
    role: document.getElementById('filter-role').value,
    status: document.getElementById('filter-status').value
  };
} 