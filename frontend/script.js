// frontend/script.js
// Automatically detect the backend address, with a manual override option.
const BASE_URL = (() => {
  // 1) Manual override (optional): set window.BACKEND_URL before this file loads.
  if (window.BACKEND_URL) return window.BACKEND_URL;

  const host = window.location.hostname; // e.g., 127.0.0.1, localhost, capstone-5502.app.github.dev

  // 2) GitHub Codespaces / app.github.dev (frontend port -> backend 5050)
  if (host.endsWith('app.github.dev')) {
    // Replace the trailing "-<port>.app.github.dev" with "-5050.app.github.dev"
    return 'https://' + host.replace(/-\d+\.app\.github\.dev$/, '-5050.app.github.dev');
  }

  // 3) Local dev (Live Server / plain localhost)
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5050';
  }

  // 4) Fallback: same-origin (useful if you ever reverse-proxy /api)
  return `${window.location.protocol}//${host}${window.location.port ? ':' + window.location.port : ''}`;
})();

const form = document.getElementById('searchForm');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const priceEl = document.getElementById('priceInput');
const openNowEl = document.getElementById('openNowCheck');

// Modal elements
let reserveModal; // Bootstrap modal instance
const resRestaurantId = document.getElementById('resRestaurantId');
const resName = document.getElementById('resName');
const resParty = document.getElementById('resParty');
const resDate = document.getElementById('resDate');
const resTime = document.getElementById('resTime');
const reserveBtn = document.getElementById('reserveSubmit');

// -----------------------
// Helpers
// -----------------------
function setStatus(msg, type = 'secondary') {
  statusEl.innerHTML = msg ? `<div class="alert alert-${type} py-2">${msg}</div>` : '';
}

// Snap any HH:mm string to :00 or :30 (rounding: <15 -> :00, <45 -> :30, else next hour :00)
function snapToHalfHour(hhmm) {
  if (!hhmm) return hhmm;
  const [hStr, mStr] = hhmm.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const snapped = m < 15 ? 0 : (m < 45 ? 30 : 60);
  if (snapped === 60) h = (h + 1) % 24;
  const hh = String(h).padStart(2, '0');
  const mm = String(snapped === 60 ? 0 : snapped).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Default to the next half-hour from now
function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  d.setMinutes(mins < 30 ? 30 : 60);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
          ${r.open_now ? '<span class="badge bg-info">Open now</span>' : '<span class="badge bg-secondary">Closed</span>'}
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

// -----------------------
// Time input enforcement
// -----------------------
// If you also set step="1800" on the <input type="time"> in index.html, the UI will restrict selection.
// These listeners ensure any free-typed time snaps properly too.
resTime.addEventListener('change', () => {
  resTime.value = snapToHalfHour(resTime.value);
});
resTime.addEventListener('blur', () => {
  resTime.value = snapToHalfHour(resTime.value);
});

// -----------------------
// Reservation flow
// -----------------------
resultsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="reserve"]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  resRestaurantId.value = id;

  // Set a sensible default time if empty
  if (!resTime.value) resTime.value = nextHalfHour();

  if (!reserveModal) {
    reserveModal = new bootstrap.Modal(document.getElementById('reserveModal'));
  }
  reserveModal.show();
});

reserveBtn.addEventListener('click', async () => {
  // Defensive snap before sending to backend
  resTime.value = snapToHalfHour(resTime.value);

  const payload = {
    restaurantId: resRestaurantId.value,
    name: resName.value.trim(),
    partySize: Number(resParty.value),
    date: resDate.value, // YYYY-MM-DD
    time: resTime.value  // HH:mm snapped to :00 or :30
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
setStatus('Enter a city and/or cuisine, then press Search.', 'secondary');
resultsEl.innerHTML = '';
