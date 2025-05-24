// app.js (for index.html - Home Page)
document.addEventListener('DOMContentLoaded', () => {
    // API Base URL (Important: make sure this matches your backend server's port)
    const API_BASE_URL = 'http://localhost:3000/api';

    // --- Utility Functions for Auth and API ---
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return token ? {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        } : {
            'Content-Type': 'application/json'
        };
    };

    const isAuthenticated = () => {
        return localStorage.getItem('token') !== null;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        window.location.reload(); // Reload page to update UI
    };

    // --- DOM Elements ---
    const businessesContainer = document.getElementById('business-listings');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const reviewForm = document.getElementById('review-form');
    const reviewBusinessSelect = document.getElementById('reviewBusinessSelect');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const navMenu = document.getElementById('nav-menu');
    const logoutLink = document.getElementById('logout-link');

    // --- UI State based on Authentication ---
    if (isAuthenticated()) {
        logoutLink.classList.remove('hidden');
        // Optionally, hide register/login links here
        document.querySelector('a[href="register.html"]').classList.add('hidden');
        document.querySelector('a[href="login.html"]').classList.add('hidden');
    } else {
        logoutLink.classList.add('hidden');
        // Hide review form if not logged in
        reviewForm.innerHTML = '<p class="text-gray-600 text-center">Please <a href="login.html" class="text-blue-600 hover:underline">log in</a> to leave a review.</p>';
    }

    // --- Utility Functions ---
    const generateStars = (rating) => {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? '★' : '';
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        return `<span class="text-yellow-500">${'★'.repeat(fullStars)}${halfStar}</span><span class="text-gray-300">${'☆'.repeat(emptyStars)}</span>`;
    };

    const renderBusinesses = (filteredBusinesses) => {
        businessesContainer.innerHTML = '';
        if (filteredBusinesses.length === 0) {
            businessesContainer.innerHTML = '<p class="col-span-full text-center text-gray-600">No businesses found matching your criteria.</p>';
            return;
        }

        filteredBusinesses.forEach(business => {
            const businessCardLink = `
                <a href="business-detail.html?id=${business.id}" class="block bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow duration-200">
                    <h2 class="text-xl font-semibold text-blue-700">${business.name}</h2>
                    <p class="text-sm text-gray-600">Category: ${business.category.charAt(0).toUpperCase() + business.category.slice(1)}</p>
                    <p class="mt-1 mb-2">${generateStars(business.rating)}</p>
                    <p class="text-sm text-gray-500">Location: ${business.location}</p>
                    <p class="mt-2 text-sm text-gray-700">${business.description.substring(0, 100)}...</p>
                </a>
            `;
            businessesContainer.insertAdjacentHTML('beforeend', businessCardLink);
        });
    };

    const fetchBusinesses = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/businesses`);
            if (!response.ok) {
                throw new Error('Failed to fetch businesses');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching businesses:', error);
            businessesContainer.innerHTML = '<p class="col-span-full text-center text-red-500">Error loading businesses. Please try again later.</p>';
            return [];
        }
    };

    const populateBusinessSelect = async () => {
        reviewBusinessSelect.innerHTML = '<option value="">Select a Business to Review</option>';
        const businesses = await fetchBusinesses(); // Fetch businesses for the dropdown
        const sortedBusinesses = [...businesses].sort((a, b) => a.name.localeCompare(b.name));
        sortedBusinesses.forEach(business => {
            const option = document.createElement('option');
            option.value = business.id;
            option.textContent = business.name;
            reviewBusinessSelect.appendChild(option);
        });
    };

    // --- Search and Filter Logic ---
    let allBusinesses = []; // To store all fetched businesses

    const filterAndSearchBusinesses = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;

        const filtered = allBusinesses.filter(business => {
            const matchesSearch = business.name.toLowerCase().includes(searchTerm) ||
                                  business.description.toLowerCase().includes(searchTerm) ||
                                  business.location.toLowerCase().includes(searchTerm);
            const matchesCategory = selectedCategory === 'all' || business.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
        renderBusinesses(filtered);
    };

    // --- Event Listeners ---
    searchInput.addEventListener('input', filterAndSearchBusinesses);
    categoryFilter.addEventListener('change', filterAndSearchBusinesses);

    // Review Form Submission
    if (isAuthenticated()) { // Only add listener if user is authenticated
        reviewForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const businessId = parseInt(reviewBusinessSelect.value);
            const reviewerName = document.getElementById('reviewerName').value.trim();
            const reviewText = document.getElementById('reviewText').value.trim();
            const reviewRating = parseFloat(document.getElementById('reviewRating').value);

            if (!businessId || !reviewerName || !reviewText || !reviewRating) {
                alert('Please select a business and fill in all review fields.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/reviews`, {
                    method: 'POST',
                    headers: getAuthHeaders(), // Include auth token
                    body: JSON.stringify({ businessId, reviewerName, text: reviewText, rating: reviewRating }),
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Thank you for your review!');
                    reviewForm.reset();
                    // Re-fetch businesses to update ratings display on home page
                    allBusinesses = await fetchBusinesses();
                    filterAndSearchBusinesses();
                } else {
                    alert(data.message || 'Failed to submit review.');
                }
            } catch (error) {
                console.error('Error submitting review:', error);
                alert('An error occurred while submitting your review.');
            }
        });
    }

    // Mobile Menu Toggle (common for all pages)
    mobileMenuButton.addEventListener('click', () => {
        navMenu.classList.toggle('hidden');
    });

    // Logout Link
    logoutLink.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
    });

    // --- Initial Load ---
    const initializePage = async () => {
        allBusinesses = await fetchBusinesses();
        filterAndSearchBusinesses(); // Display all businesses initially
        if (isAuthenticated()) {
            populateBusinessSelect(); // Only populate if able to leave review
        }
    };
    initializePage();
});