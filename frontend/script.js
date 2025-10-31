// frontend/script.js
// Automatically detect the backend address 
const BASE_URL = (() => {
  const host = window.location.hostname; // e.g., capstone-5502.app.github.dev
  if (host.endsWith('app.github.dev')) {
    // Replace the frontend port (550x) with the backend port (5050)
    return 'https://' + host.replace(/-\d+\.app\.github\.dev$/, '-5050.app.github.dev');
  }
  // Fallback for local development
  return 'http://localhost:5050';
})();

const PREF_KEY = 'sr_prefs_v1';

const form = document.getElementById('searchForm');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const priceEl = document.getElementById('priceInput');
const openNowEl = document.getElementById('openNowCheck');
const savePrefsBtn = document.getElementById('savePrefsBtn');

// Modal elements
let reserveModal; // Bootstrap modal instance
const resRestaurantId = document.getElementById('resRestaurantId');
const resName = document.getElementById('resName');
const resParty = document.getElementById('resParty');
const resDate = document.getElementById('resDate');
const resTime = document.getElementById('resTime');
const reserveBtn = document.getElementById('reserveSubmit');

function setStatus(msg, type = 'secondary') {
  statusEl.innerHTML = msg ? `<div class="alert alert-${type} py-2">${msg}</div>` : '';
}

function cardHtml(r) {
  return `
  <div class="col-12 col-sm-6 col-md-4">
    <div class="card h-100 shadow-sm">
      <div class="card-body d-flex flex-column">
        <h5 class="card-title mb-1">${r.name}</h5>
        <p class="text-muted mb-2">
          ${r.cuisine} • ${r.city} • ${r.price || ''}
          ${typeof r.tables === 'number' ? ` • <strong>${r.tables} tables total</strong>` : ''}
        </p>
        <div class="mb-2">
          <span class="badge bg-success">⭐ ${r.rating}</span>
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

async function search(evt) {
  evt?.preventDefault();

  const city = document.getElementById('cityInput').value.trim();
  const cuisine = document.getElementById('cuisineInput').value.trim();
  const price = priceEl.value;
  const open_now = openNowEl.checked ? 'true' : '';

  // Block empty searches
  if (!city && !cuisine && !price && !open_now) {
    setStatus('Enter a city and/or cuisine, then press Search.', 'secondary');
    resultsEl.innerHTML = '';
    return;
  }

  setStatus('Searching…', 'info');

  try {
    const url = new URL('/api/restaurants', BASE_URL);
    if (city) url.searchParams.set('city', city);
    if (cuisine) url.searchParams.set('cuisine', cuisine);
    if (price) url.searchParams.set('price', price);
    if (open_now) url.searchParams.set('open_now', open_now);

    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

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

// Save preferences locally
savePrefsBtn.addEventListener('click', () => {
  const prefs = {
    city: document.getElementById('cityInput').value.trim(),
    cuisine: document.getElementById('cuisineInput').value.trim(),
    price: priceEl.value,
    open_now: openNowEl.checked
  };
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  setStatus('Preferences saved! Open the Recommendations tab to explore.', 'success');
});

// Click → open reservation modal
resultsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="reserve"]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  resRestaurantId.value = id;
  if (!reserveModal) reserveModal = new bootstrap.Modal(document.getElementById('reserveModal'));
  reserveModal.show();
});

// Submit reservation
reserveBtn.addEventListener('click', async () => {
  const payload = {
    restaurantId: resRestaurantId.value,
    name: resName.value.trim(),
    partySize: Number(resParty.value),
    date: resDate.value, // YYYY-MM-DD
    time: resTime.value  // HH:mm
  };
  if (!payload.restaurantId || !payload.name || !payload.partySize || !payload.date || !payload.time) {
    alert('Please complete all fields.');
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 409) {
      const err = await res.json();
      alert(err.error || 'No tables available for that time.');
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    reserveModal?.hide();
    alert(`Reservation confirmed! #${data.id}\nTables remaining for that slot: ${data.tablesRemaining}/${data.capacity}`);
  } catch (e) {
    console.error(e);
    alert('Reservation failed. Try again.');
  }
});

// Wire up submit
form.addEventListener('submit', search);

// Initial state (no auto-search)
setStatus('Enter a city and/or cuisine, then press Search. Save preferences for recommendations.', 'secondary');
resultsEl.innerHTML = '';
