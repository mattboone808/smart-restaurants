/*
  Project: Smart Restaurants
  File: script.js
  Description:
    This script handles the frontend logic for the Smart Restaurants web app.
    It connects to the backend API, populates filters dynamically, performs
    search queries, displays restaurant results, and handles reservation requests.
*/

// Auto-detect the backend URL - supports GitHub Codespaces and localhost
const BASE_URL = (() => {
  const host = window.location.hostname;
  if (host.endsWith('app.github.dev')) {
    return `https://${host.replace(/-\d+\.app\.github\.dev$/, '-5050.app.github.dev')}`;
  }
  return 'http://localhost:5050';
})();
console.log('[SmartRestaurants] API:', BASE_URL);

// Connect to HTML elements
const form = document.getElementById('searchForm');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const priceEl = document.getElementById('priceInput');
const openNowEl = document.getElementById('openNowCheck');

// Reservation form
let reserveModal;
const resRestaurantId = document.getElementById('resRestaurantId');
const resName = document.getElementById('resName');
const resParty = document.getElementById('resParty');
const resDate = document.getElementById('resDate');
const resTime = document.getElementById('resTime');
const reserveBtn = document.getElementById('reserveSubmit');

// Display "Searching" after Search button is pressed or displays an error message
function setStatus(msg, type = 'secondary') {
  statusEl.innerHTML = msg ? `<div class="alert alert-${type} py-2">${msg}</div>` : '';
}

// Makes a card for each restaurant in the results list
function cardHtml(r) {
  return `
  <div class="col-12 col-sm-6 col-md-4">
    <div class="card h-100 shadow-sm">
      <div class="card-body d-flex flex-column">
        <h5 class="card-title mb-1">${r.name}</h5>
        <p class="text-muted mb-2">
          ${r.cuisine} • ${r.city} • ${r.price || ''}
          ${typeof r.tables === 'number' ? ` • <strong>${r.tables} tables</strong>` : ''}
        </p>
        <div class="mb-2">
          ${r.open_now ? '<span class="badge bg-info ms-2">Open now</span>' : ''}
        </div>
        <div class="mt-auto d-grid">
          <button class="btn btn-outline-primary" data-id="${r.id}" data-action="reserve" ${r.open_now ? '' : 'disabled'}>
            Reserve
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

// Fills the City and Cuisine dropdowns using data from the database file
async function populateFilters() {
  try {
    // Gets all restaurants to see which cities and cuisines exist
    const res = await fetch(`${BASE_URL}/api/restaurants`);
    if (!res.ok) throw new Error('Failed to fetch restaurants');
    const data = await res.json();

    const citySet = new Set();
    const cuisineSet = new Set();

    // Collect city and cuisine names
    data.forEach(r => {
      if (r.city) citySet.add(r.city.trim());
      if (r.cuisine) cuisineSet.add(r.cuisine.trim());
    });

    // Fills in the dropdown menus
    const cityInput = document.getElementById('cityInput');
    const cuisineInput = document.getElementById('cuisineInput');

    [...citySet].sort().forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      cityInput.appendChild(opt);
    });

    [...cuisineSet].sort().forEach(cuisine => {
      const opt = document.createElement('option');
      opt.value = cuisine;
      opt.textContent = cuisine;
      cuisineInput.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to populate filters:', err);
  }
}

// Searches for restaurants based on what the user selected
async function search(evt) {
  evt?.preventDefault();

  const city = document.getElementById('cityInput').value.trim();
  const cuisine = document.getElementById('cuisineInput').value.trim();
  const price = priceEl.value;
  const open_now = openNowEl.checked ? 'true' : '';

  // If no filters are chosen, shows a helpful hint
  if (!city && !cuisine && !price && !open_now) {
    setStatus('Enter or select filters, then press Search.', 'secondary');
    resultsEl.innerHTML = '';
    return;
  }

  setStatus('Searching…', 'info');

  try {
    // Build the search URL
    const url = new URL('/api/restaurants', BASE_URL);
    if (city) url.searchParams.set('city', city);
    if (cuisine) url.searchParams.set('cuisine', cuisine);
    if (price) url.searchParams.set('price', price);
    if (open_now) url.searchParams.set('open_now', open_now);

    // Ask the server for matching restaurants
    const res = await fetch(url);
    if (!res.ok) throw new Error('Server error: ' + res.status);
    const data = await res.json();

    // Show the results or a “no matches” message
    resultsEl.innerHTML = data.length
      ? data.map(cardHtml).join('')
      : '<p class="text-muted">No matches found.</p>';
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('Could not reach the server. Is it running?', 'danger');
    resultsEl.innerHTML = '';
  }
}

// Opens the reservation form when the user clicks “Reserve”
resultsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="reserve"]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  resRestaurantId.value = id;
  if (!reserveModal) reserveModal = new bootstrap.Modal(document.getElementById('reserveModal'));
  reserveModal.show();
});

// Sends the reservation info to the server
reserveBtn.addEventListener('click', async () => {
  const payload = {
    restaurantId: resRestaurantId.value,
    name: resName.value.trim(),
    partySize: Number(resParty.value),
    date: resDate.value,
    time: resTime.value
  };

  // Check that all fields are filled in
  if (!payload.restaurantId || !payload.name || !payload.partySize || !payload.date || !payload.time) {
    alert('Please complete all fields.');
    return;
  }

  try {
    // Send reservation to the backend
    const res = await fetch(`${BASE_URL}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Handle the case where no tables are left
    if (res.status === 409) {
      const err = await res.json();
      alert(err.error || 'No tables available.');
      return;
    }

    if (!res.ok) throw new Error('Server error: ' + res.status);

    // Show a success message
    const data = await res.json();
    reserveModal?.hide();
    alert(`Reservation confirmed! #${data.id}\nTables remaining: ${data.tablesRemaining}/${data.capacity}`);
  } catch (e) {
    console.error(e);
    alert('Could not make the reservation. Please try again.');
  }
});

// Run the startup functions
form.addEventListener('submit', search);
setStatus('Select filters and press Search.', 'secondary');
resultsEl.innerHTML = '';
populateFilters();