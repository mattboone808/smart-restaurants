/*
  Project: Smart Restaurants
  File: script.js
  Description:
    Frontend logic for the main search page, including
    searching restaurants, rendering cards, reservations,
    favorites, reviews, and saving/restoring the last search.
*/

const BASE_URL = (() => {
  const host = window.location.hostname;
  if (host.endsWith("app.github.dev")) {
    return `https://${host.replace(/-\d+\.app\.github\.dev$/, "-5050.app.github.dev")}`;
  }
  return "http://localhost:5050";
})();

// Elements
const searchBtn   = document.getElementById("searchBtn");
const resultsEl   = document.getElementById("results");
const statusEl    = document.getElementById("status");
const priceEl     = document.getElementById("priceInput");
const openNowEl   = document.getElementById("openNowCheck");

// Reservation modal
let reserveModal;
const resRestaurantId = document.getElementById("resRestaurantId");
const resName         = document.getElementById("resName");
const resParty        = document.getElementById("resParty");
const resDate         = document.getElementById("resDate");
const resTime         = document.getElementById("resTime");
const reserveBtn      = document.getElementById("reserveSubmit");

// Review modal
let reviewModal;
const reviewRestaurantId = document.getElementById("reviewRestaurantId");
const reviewRating       = document.getElementById("reviewRating");
const reviewText         = document.getElementById("reviewText");
const reviewSubmit       = document.getElementById("reviewSubmit");

// Favorites and last search
let activeFavorites = new Set();
const LAST_SEARCH_KEY      = "smartRestaurants:lastSearch";
const SESSION_SEARCH_FLAG  = "smartRestaurants:sessionHasSearch";


// "Open Now" check
function isOpenNowClient(hours) {
  if (!hours || typeof hours !== "object") return false;

  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date();
  const dayKey = days[now.getDay()];
  const ranges = hours[dayKey] || [];
  const curMin = now.getHours() * 60 + now.getMinutes();

  return ranges.some(([start, end]) => {
    if (!start || !end) return false;

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some(isNaN)) return false;

    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;

    // Normal window
    if (endMin > startMin) {
      return curMin >= startMin && curMin < endMin;
    }

    // Overnight window
    return curMin >= startMin || curMin < endMin;
  });
}


// Load active favorites
async function loadActiveFavorites() {
  try {
    const res = await fetch(`${BASE_URL}/api/user/favorites`);
    if (!res.ok) return (activeFavorites = new Set());

    const favs = await res.json();
    activeFavorites = new Set(favs.map(f => f.id));
  } catch {
    activeFavorites = new Set();
  }
}


// Toggle favorite
async function toggleFavorite(restaurantId) {
  try {
    const isFav = activeFavorites.has(restaurantId);
    const method = isFav ? "DELETE" : "POST";

    const res = await fetch(`${BASE_URL}/api/user/favorites`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId })
    });

    if (res.status === 401) {
      alert("Please create or select a profile first on the Profile page.");
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not update favorites.");
      return;
    }

    if (isFav) activeFavorites.delete(restaurantId);
    else activeFavorites.add(restaurantId);

    updateFavoriteButtonUI(restaurantId);
  } catch {
    alert("Failed to update favorites.");
  }
}


// Update favorite button text/styles
function updateFavoriteButtonUI(restaurantId) {
  const buttons = document.querySelectorAll(
    `button[data-id='${restaurantId}'][data-action='favorite']`
  );

  const isFav = activeFavorites.has(restaurantId);

  buttons.forEach(btn => {
    if (isFav) {
      btn.textContent = "💔 Remove Favorite";
      btn.classList.remove("btn-outline-danger");
      btn.classList.add("btn-danger");
    } else {
      btn.textContent = "❤️ Add to Favorites";
      btn.classList.add("btn-outline-danger");
      btn.classList.remove("btn-danger");
    }
  });
}


// Set status message
function setStatus(msg, type = "secondary") {
  statusEl.innerHTML = msg
    ? `<div class="alert alert-${type} py-2">${msg}</div>`
    : "";
}


// Build restaurant card HTML
function cardHtml(r) {
  const isFav = activeFavorites.has(r.id);
  const favText  = isFav ? "💔 Remove Favorite" : "❤️ Add to Favorites";
  const favClass = isFav ? "btn-danger" : "btn-outline-danger";

  return `
    <div class="col-12 col-sm-6 col-md-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body d-flex flex-column">

          <div class="d-flex justify-content-between align-items-center mb-1">
            <h5 class="card-title mb-0">${r.name}</h5>
            ${r.open_now ? '<span class="badge bg-info text-dark">Open now</span>' : ""}
          </div>

          <p class="text-muted mb-2">
            ${r.cuisine} • ${r.city} • ${r.price || ""}
            ${typeof r.tables === "number" ? ` • <strong>${r.tables} tables</strong>` : ""}
          </p>

          <button class="btn btn-outline-primary mb-2"
            data-id="${r.id}" data-action="reserve">Reserve</button>

          <div class="d-flex gap-2">
            <button class="btn ${favClass} w-50"
              data-id="${r.id}" data-action="favorite">${favText}</button>

            <button class="btn btn-outline-secondary w-50"
              data-id="${r.id}" data-action="review">Leave Review</button>
          </div>

        </div>
      </div>
    </div>
  `;
}


// Populate dropdown filters
async function populateFilters() {
  try {
    const res = await fetch(`${BASE_URL}/api/restaurants`);
    const data = await res.json();

    const cityInput    = document.getElementById("cityInput");
    const cuisineInput = document.getElementById("cuisineInput");

    const cities   = [...new Set(data.map(r => r.city).filter(Boolean))].sort();
    const cuisines = [...new Set(data.map(r => r.cuisine).filter(Boolean))].sort();

    cities.forEach(c => cityInput.appendChild(new Option(c, c)));
    cuisines.forEach(c => cuisineInput.appendChild(new Option(c, c)));
  } catch {}
}


// Save last search
function saveLastSearch(filters, data) {
  try {
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify({ filters, data }));
  } catch {}
}


// Restore last search
function restoreLastSearch() {
  try {
    if (!sessionStorage.getItem(SESSION_SEARCH_FLAG)) return;

    const raw = localStorage.getItem(LAST_SEARCH_KEY);
    if (!raw) return;

    const { filters, data } = JSON.parse(raw);
    if (!filters || !Array.isArray(data)) return;

    document.getElementById("cityInput").value    = filters.city || "";
    document.getElementById("cuisineInput").value = filters.cuisine || "";
    priceEl.value = filters.price || "";
    openNowEl.checked = !!filters.openNowFilter;

    resultsEl.innerHTML = data.length ? data.map(cardHtml).join("") : "";
  } catch {}
}


// Search restaurants
async function search() {
  const city          = document.getElementById("cityInput").value.trim();
  const cuisine       = document.getElementById("cuisineInput").value.trim();
  const price         = priceEl.value;
  const openNowFilter = openNowEl.checked;

  if (!city && !cuisine && !price && !openNowFilter) return;

  setStatus("Searching…", "info");

  try {
    const url = new URL("/api/restaurants", BASE_URL);
    if (city) url.searchParams.set("city", city);
    if (cuisine) url.searchParams.set("cuisine", cuisine);
    if (price) url.searchParams.set("price", price);

    const res = await fetch(url);
    const data = await res.json();

    const enriched = data.map(r => ({
      ...r,
      open_now: isOpenNowClient(r.hours)
    }));

    const filtered = openNowFilter
      ? enriched.filter(r => r.open_now)
      : enriched;

    resultsEl.innerHTML = filtered.length
      ? filtered.map(cardHtml).join("")
      : '<p class="text-muted">No matches found.</p>';

    sessionStorage.setItem(SESSION_SEARCH_FLAG, "1");
    saveLastSearch({ city, cuisine, price, openNowFilter }, filtered);
    setStatus("");
  } catch {
    setStatus("Could not reach the server.", "danger");
  }
}


// Submit review
reviewSubmit.addEventListener("click", async () => {
  const restaurantId = Number(reviewRestaurantId.value);
  const rating       = Number(reviewRating.value);
  const text         = reviewText.value.trim();

  if (!restaurantId || !rating || rating < 1 || rating > 5) {
    alert("Please choose a rating from 1–5.");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        rating,
        review_text: text
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not submit review.");
      return;
    }

    alert("Review submitted!");
    reviewText.value = "";
    reviewModal?.hide();
  } catch {
    alert("Failed to submit review.");
  }
});


// Card button actions
resultsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = Number(btn.dataset.id);

  if (action === "reserve") {
    resRestaurantId.value = id;
    reserveModal ??= new bootstrap.Modal(document.getElementById("reserveModal"));
    reserveModal.show();
  }

  if (action === "favorite") toggleFavorite(id);

  if (action === "review") {
    reviewRestaurantId.value = id;
    reviewModal ??= new bootstrap.Modal(document.getElementById("reviewModal"));
    reviewModal.show();
  }
});


// Submit reservation
reserveBtn.addEventListener("click", async () => {
  const payload = {
    restaurantId: resRestaurantId.value,
    name:        resName.value.trim(),
    partySize:   Number(resParty.value),
    date:        resDate.value,
    time:        resTime.value
  };

  if (!payload.restaurantId || !payload.name || !payload.partySize ||
      !payload.date || !payload.time) {
    alert("Please complete all fields.");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      const err = await res.json();
      alert(err.error || "No tables available.");
      return;
    }

    if (!res.ok) throw new Error();

    const data = await res.json();
    reserveModal?.hide();
    alert(`Reservation confirmed! #${data.id}`);
  } catch {
    alert("Could not make the reservation.");
  }
});


// Startup
searchBtn.addEventListener("click", (e) => {
  e.preventDefault();
  search();
});

setStatus("Select filters and press Search.", "secondary");
resultsEl.innerHTML = "";

(async () => {
  await loadActiveFavorites();
  await populateFilters();
  restoreLastSearch();
})();
