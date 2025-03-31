// Fix for dropdowns in Bootstrap 5
document.addEventListener('DOMContentLoaded', function() {
    console.log('dropdown-fix.js loaded');
    
    // Get all dropdown toggles
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    console.log('Found dropdown toggles:', dropdownToggles.length);
    
    // Add click handlers to ensure dropdowns show/hide properly
    dropdownToggles.forEach(function(toggle) {
        console.log('Setting up toggle for:', toggle.textContent.trim());
        
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Find the parent dropdown element
            const parent = this.closest('.dropdown');
            if (!parent) {
                console.error('No parent dropdown found');
                return;
            }
            
            // Find the dropdown menu
            const menu = parent.querySelector('.dropdown-menu');
            if (!menu) {
                console.error('No dropdown menu found');
                return;
            }
            
            console.log('Toggling dropdown for:', this.textContent.trim());
            
            // Toggle the menu visibility
            if (menu.classList.contains('show')) {
                menu.classList.remove('show');
                this.setAttribute('aria-expanded', 'false');
            } else {
                // Close all other dropdowns first
                document.querySelectorAll('.dropdown-menu.show').forEach(function(openMenu) {
                    if (openMenu !== menu) {
                        openMenu.classList.remove('show');
                        const openToggle = openMenu.parentElement.querySelector('.dropdown-toggle');
                        if (openToggle) {
                            openToggle.setAttribute('aria-expanded', 'false');
                        }
                    }
                });
                
                // Show this dropdown
                menu.classList.add('show');
                this.setAttribute('aria-expanded', 'true');
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(function(menu) {
                menu.classList.remove('show');
                const toggle = menu.parentElement.querySelector('.dropdown-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    });
    
    // Add click handlers for dropdown items to make sure they work
    document.querySelectorAll('.dropdown-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            // For category links, let the existing handlers work
            if (this.classList.contains('category-link')) {
                console.log('Category link clicked:', this.dataset.category);
                // Don't prevent default here as it's handled by main.js
            } else {
                console.log('Regular dropdown item clicked:', this.textContent.trim());
                // Only prevent default for non-link items or if you want to handle the action in JS
                if (!this.getAttribute('href') || this.getAttribute('href') === '#') {
                    e.preventDefault();
                }
            }
            
            // Close the dropdown after clicking an item
            const menu = this.closest('.dropdown-menu');
            if (menu) {
                menu.classList.remove('show');
                const toggle = menu.parentElement.querySelector('.dropdown-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    });
}); 