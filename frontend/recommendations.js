// frontend/recommendations.js
const BASE_URL = 'https://lifeless-spooky-haunting-wrqqgvwq5gx6395gv-5050.app.github.dev';
const PREF_KEY = 'sr_prefs_v1';

const recForm = document.getElementById('recsForm');
const recStatus = document.getElementById('recStatus');
const recResults = document.getElementById('recResults');

const recCity = document.getElementById('recCity');
const recCuisine = document.getElementById('recCuisine');
const recLimit = document.getElementById('recLimit');
const recOpenNow = document.getElementById('recOpenNow');
const applySavedBtn = document.getElementById('applySavedBtn');

// Modal (shared booking)
let reserveModal;
const resRestaurantId = document.getElementById('resRestaurantId');
const resName = document.getElementById('resName');
const resParty = document.getElementById('resParty');
const resDate = document.getElementById('resDate');
const resTime = document.getElementById('resTime');
const reserveBtn = document.getElementById('reserveSubmit');

function setStatus(msg, type = 'secondary') {
  recStatus.innerHTML = msg ? `<div class="alert alert-${type} py-2">${msg}</div>` : '';
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

function loadSavedPrefsIntoForm() {
  const raw = localStorage.getItem(PREF_KEY);
  if (!raw) {
    setStatus('No saved preferences found. Go to the Search page and click “Save as My Preferences.”', 'warning');
    return;
  }
  try {
    const prefs = JSON.parse(raw);
    recCity.value = prefs.city || '';
    // Leave cuisine blank by default to encourage discovery; user can fill it.
    recCuisine.value = '';
    recOpenNow.checked = !!prefs.open_now;
    setStatus('Saved preferences loaded. Adjust and click “Get recommendations.”', 'success');
  } catch {
    setStatus('Could not read saved preferences. Try saving them again on the Search page.', 'danger');
  }
}

async function getRecs(evt) {
  evt?.preventDefault();
  const city = recCity.value.trim();
  const cuisine = recCuisine.value.trim();
  const limit = Math.max(1, Math.min(12, Number(recLimit.value) || 3));
  const open_now = recOpenNow.checked ? 'true' : '';

  if (!city && !cuisine && !open_now) {
    setStatus('Enter at least a city or choose Open now.', 'secondary');
    recResults.innerHTML = '';
    return;
  }

  setStatus('Fetching recommendations…', 'info');
  recResults.innerHTML = '';

  try {
    const url = new URL('/api/recommendations', BASE_URL);
    if (city) url.searchParams.set('city', city);
    if (cuisine) url.searchParams.set('cuisine', cuisine);
    if (open_now) url.searchParams.set('open_now', open_now);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    recResults.innerHTML = data.length
      ? data.map(cardHtml).join('')
      : '<p class="text-muted">No recommendations match those settings.</p>';
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('Could not reach the server. Is it running?', 'danger');
  }
}

// Click → open reservation modal
recResults.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="reserve"]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  resRestaurantId.value = id;
  if (!reserveModal) reserveModal = new bootstrap.Modal(document.getElementById('reserveModal'));
  reserveModal.show();
});

// Submit reservation (same as search page)
reserveBtn.addEventListener('click', async () => {
  const payload = {
    restaurantId: resRestaurantId.value,
    name: resName.value.trim(),
    partySize: Number(resParty.value),
    date: resDate.value,
    time: resTime.value
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

// Wire up events
recForm.addEventListener('submit', getRecs);
applySavedBtn.addEventListener('click', loadSavedPrefsIntoForm);

// Initial state
setStatus('Load your saved preferences or fill the form, then click Get recommendations.', 'secondary');
recResults.innerHTML = '';
