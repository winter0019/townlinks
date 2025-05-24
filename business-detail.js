// business-detail.js

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';

    // --- Auth Utility Functions ---
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    };

    const isAuthenticated = () => !!localStorage.getItem('token');

    const logout = () => {
        ['token', 'userId', 'username'].forEach(key => localStorage.removeItem(key));
        window.location.reload();
    };

    // --- DOM Element References ---
    const el = {
        name: document.getElementById('detail-business-name'),
        category: document.getElementById('detail-business-category'),
        rating: document.getElementById('detail-business-rating'),
        location: document.getElementById('detail-business-location'),
        description: document.getElementById('detail-business-description'),
        reviews: document.getElementById('detail-business-reviews'),
        image: document.getElementById('detail-business-image'),
        phone: document.getElementById('detail-business-phone'),
        email: document.getElementById('detail-business-email'),
        website: document.getElementById('detail-business-website'),
        hours: document.getElementById('detail-business-hours'),
        map: document.getElementById('map'),
        mobileMenuButton: document.getElementById('mobile-menu-button'),
        navMenu: document.getElementById('nav-menu'),
        logoutLink: document.getElementById('logout-link'),
        registerLink: document.querySelector('a[href="register.html"]'),
        loginLink: document.querySelector('a[href="login.html"]'),
    };

    // --- Auth UI ---
    if (isAuthenticated()) {
        el.logoutLink?.classList.remove('hidden');
        el.registerLink?.classList.add('hidden');
        el.loginLink?.classList.add('hidden');
    } else {
        el.logoutLink?.classList.add('hidden');
    }

    // --- Star Rating Generator ---
    const generateStars = (rating) => {
        const full = Math.floor(rating);
        const half = rating % 1 >= 0.5 ? '★' : '';
        const empty = 5 - full - (half ? 1 : 0);
        return `<span class="text-yellow-500">${'★'.repeat(full)}${half}</span><span class="text-gray-300">${'☆'.repeat(empty)}</span>`;
    };

    // --- Fetch & Display Business Details ---
    const displayBusinessDetails = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const businessId = parseInt(urlParams.get('id'));

        if (!businessId) {
            el.name.textContent = 'Business Not Found';
            el.location.textContent = 'Missing or invalid business ID.';
            el.reviews.innerHTML = '<p class="text-red-500">No business ID in the URL.</p>';
            el.map.innerHTML = '<p class="text-gray-600">Map unavailable.</p>';
            el.map.style.height = 'auto';
            return;
        }

        try {
            const [businessRes, reviewsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/businesses/${businessId}`),
                fetch(`${API_BASE_URL}/reviews/${businessId}`)
            ]);

            if (!businessRes.ok || !reviewsRes.ok) throw new Error('Fetch failed');

            const business = await businessRes.json();
            const reviews = await reviewsRes.json();

            el.name.textContent = business.name || 'No Name';
            el.category.textContent = business.category ? `Category: ${business.category.charAt(0).toUpperCase() + business.category.slice(1)}` : '';
            el.rating.innerHTML = generateStars(business.rating || 0);
            el.location.textContent = business.location ? `Location: ${business.location}` : 'Location: Not available';
            el.description.textContent = business.description || '';
            el.image.src = business.image || 'https://via.placeholder.com/400x250?text=No+Image+Available';
            el.image.alt = business.name || 'Business image';

            el.phone.textContent = business.phone ? `Phone: ${business.phone}` : 'Phone: Not available';
            el.email.textContent = business.email ? `Email: ${business.email}` : 'Email: Not available';
            el.website.innerHTML = business.website
                ? `Website: <a href="${business.website}" target="_blank" class="text-blue-600 hover:underline">${business.website}</a>`
                : 'Website: Not available';
            el.hours.textContent = business.hours ? `Hours: ${business.hours}` : 'Hours: Not available';

            if (business.latitude && business.longitude) {
                el.map.style.display = 'block';
                if (window.myMapInstance) window.myMapInstance.remove();

                const map = L.map('map').setView([business.latitude, business.longitude], 15);
                window.myMapInstance = map;

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(map);

                L.marker([business.latitude, business.longitude]).addTo(map)
                    .bindPopup(`<b>${business.name}</b><br>${business.location || ''}`).openPopup();
            } else {
                el.map.innerHTML = '<p class="text-gray-600">Map not available for this business.</p>';
                el.map.style.height = 'auto';
            }

            if (Array.isArray(reviews) && reviews.length > 0) {
                el.reviews.innerHTML = '';
                reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
                reviews.forEach(({ reviewerName, rating, text, date }) => {
                    el.reviews.insertAdjacentHTML('beforeend', `
                        <div class="bg-gray-100 p-4 rounded-lg shadow-sm mb-2">
                            <p class="font-semibold">${reviewerName || 'Anonymous'} - ${generateStars(rating || 0)}</p>
                            <p class="text-sm text-gray-500 mb-2">${date || ''}</p>
                            <p class="text-gray-700">${text || ''}</p>
                        </div>
                    `);
                });
            } else {
                el.reviews.innerHTML = '<p class="text-gray-600">No reviews yet. Be the first!</p>';
            }

        } catch (err) {
            console.error('Error:', err);
            el.name.textContent = 'Error Loading Business';
            el.location.textContent = 'There was an error loading the business details.';
            el.reviews.innerHTML = '<p class="text-red-500">Could not load reviews.</p>';
            el.map.innerHTML = '<p class="text-red-500">Map not available due to error.</p>';
            el.map.style.height = 'auto';
        }
    };

    // --- Events ---
    el.mobileMenuButton?.addEventListener('click', () => {
        el.navMenu?.classList.toggle('hidden');
    });

    el.logoutLink?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // --- Load Details ---
    displayBusinessDetails();
});
