/**
 * Minimal Bootstrap 5 Dropdown Fix
 */
(function() {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Minimal dropdown fix loaded');
        
        // STEP 1: Direct event handlers for dropdown toggles
        document.querySelectorAll('.dropdown-toggle').forEach(function(toggle) {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Find the dropdown menu
                const menu = this.nextElementSibling;
                if (!menu || !menu.classList.contains('dropdown-menu')) return;
                
                // Toggle this dropdown
                const isVisible = menu.classList.contains('show');
                
                // Close all open dropdowns first
                document.querySelectorAll('.dropdown-menu.show').forEach(function(openMenu) {
                    openMenu.classList.remove('show');
                });
                
                document.querySelectorAll('.dropdown-toggle').forEach(function(otherToggle) {
                    otherToggle.setAttribute('aria-expanded', 'false');
                });
                
                // Then open this one if it was closed
                if (!isVisible) {
                    menu.classList.add('show');
                    this.setAttribute('aria-expanded', 'true');
                }
            });
        });
        
        // STEP 2: Close dropdowns when clicking elsewhere
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown-toggle') && !e.target.closest('.dropdown-menu')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(function(menu) {
                    menu.classList.remove('show');
                });
                
                document.querySelectorAll('.dropdown-toggle[aria-expanded="true"]').forEach(function(toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                });
            }
        });
        
        // STEP 3: Fix for tabs on specific pages
        if (window.location.pathname.includes('/live-scores') || 
            window.location.pathname.includes('/leagues')) {
            
            // Handle tab clicks
            document.querySelectorAll('.nav-tabs .nav-link').forEach(function(tab) {
                tab.addEventListener('click', function(e) {
                    // Find the target pane
                    const targetSelector = this.getAttribute('data-bs-target');
                    if (!targetSelector) return;
                    
                    const targetPane = document.querySelector(targetSelector);
                    if (!targetPane) return;
                    
                    // Deactivate all tabs
                    this.closest('.nav-tabs').querySelectorAll('.nav-link').forEach(function(link) {
                        link.classList.remove('active');
                        link.setAttribute('aria-selected', 'false');
                    });
                    
                    // Activate this tab
                    this.classList.add('active');
                    this.setAttribute('aria-selected', 'true');
                    
                    // Hide all panes
                    document.querySelectorAll('.tab-pane').forEach(function(pane) {
                        pane.classList.remove('show', 'active');
                    });
                    
                    // Show target pane
                    targetPane.classList.add('show', 'active');
                });
            });
            
            // Match detail toggle buttons
            document.addEventListener('click', function(e) {
                const btn = e.target.closest('.view-details-btn');
                if (!btn) return;
                
                const details = btn.closest('.card').querySelector('.match-details');
                if (!details) return;
                
                const isVisible = details.style.display === 'block';
                details.style.display = isVisible ? 'none' : 'block';
                btn.innerHTML = isVisible ? 
                    'View Details <i class="bi bi-chevron-down"></i>' : 
                    'Hide Details <i class="bi bi-chevron-up"></i>';
            });
        }
    });
})(); 