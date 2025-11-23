/*
  Project: Smart Restaurants
  File: profile.js
  Description:
    Handles all profile page functionality, including profiles, favorites,
    reviews, reservations, and generating recommendations.
*/

const BASE_URL = (() => {
  const host = window.location.hostname;
  if (host.endsWith("app.github.dev")) {
    return `https://${host.replace(/-\d+\.app\.github\.dev$/, "-5050.app.github.dev")}`;
  }
  return "http://localhost:5050";
})();

let activeUser = null;

// Element references
const profileSelect        = document.getElementById("profileSelect");
const createProfileBtn     = document.getElementById("createProfileBtn");
const createProfileSection = document.getElementById("createProfileSection");

const newProfileName    = document.getElementById("newProfileName");
const newProfileEmail   = document.getElementById("newProfileEmail");
const newProfileCuisine = document.getElementById("newProfileCuisine");
const saveProfileBtn    = document.getElementById("saveProfileBtn");

const profileName    = document.getElementById("profileName");
const profileEmail   = document.getElementById("profileEmail");
const profileCuisine = document.getElementById("profileCuisine");
const profileCreated = document.getElementById("profileCreated");

const editProfileBtn     = document.getElementById("editProfileBtn");
const editProfileSection = document.getElementById("editProfileSection");
const editProfileName    = document.getElementById("editProfileName");
const editProfileEmail   = document.getElementById("editProfileEmail");
const editProfileCuisine = document.getElementById("editProfileCuisine");
const updateProfileBtn   = document.getElementById("updateProfileBtn");
const cancelEditBtn      = document.getElementById("cancelEditBtn");

const favoritesList    = document.getElementById("favoritesList");
const reviewsList      = document.getElementById("reviewsList");
const reservationsList = document.getElementById("reservationsList");

const generateRecsBtn     = document.getElementById("generateRecsBtn");
const recommendationsList = document.getElementById("recommendationsList");


// Load cuisine dropdowns
async function loadCuisineOptions() {
  const res = await fetch(`${BASE_URL}/api/restaurants`);
  if (!res.ok) return;
  const data = await res.json();

  const cuisines = [...new Set(data.map(r => r.cuisine).filter(Boolean))].sort();

  newProfileCuisine.innerHTML = '<option value="">Any</option>';
  editProfileCuisine.innerHTML = '<option value="">Any</option>';

  cuisines.forEach(c => {
    newProfileCuisine.appendChild(new Option(c, c));
    editProfileCuisine.appendChild(new Option(c, c));
  });
}


// Load profile list
async function loadProfiles() {
  const res = await fetch(`${BASE_URL}/api/users`);
  const users = await res.json();

  profileSelect.innerHTML = '<option value="">(none)</option>';

  users.forEach(u => {
    profileSelect.appendChild(new Option(u.name || `User ${u.id}`, u.id));
  });
}


// Load active profile
async function loadActiveProfile() {
  const res = await fetch(`${BASE_URL}/api/users/active`);
  if (!res.ok) return;

  const user = await res.json();
  activeUser = user;

  profileName.textContent    = user.name || "(unnamed)";
  profileEmail.textContent   = user.email || "";
  profileCuisine.textContent = user.preferred_cuisine || "";
  profileCreated.textContent = user.created_at || "";
  profileSelect.value = user.id;
}


// Toggle create profile form
createProfileBtn.addEventListener("click", () => {
  const hidden = createProfileSection.style.display === "none";
  createProfileSection.style.display = hidden ? "block" : "none";
});


// Save new profile
saveProfileBtn.addEventListener("click", async () => {
  const name = newProfileName.value.trim();
  const email = newProfileEmail.value.trim();
  const preferred_cuisine = newProfileCuisine.value;

  if (!name) return alert("Name is required");

  const res = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, preferred_cuisine })
  });

  if (!res.ok) {
    alert("Failed to create profile");
    return;
  }

  newProfileName.value = "";
  newProfileEmail.value = "";
  newProfileCuisine.value = "";
  createProfileSection.style.display = "none";

  await loadProfiles();
  await loadActiveProfile();
  await loadFavorites();
  await loadReviews();
  await loadReservations();
  clearRecommendations();
});


// Switch active profile
profileSelect.addEventListener("change", async () => {
  const user_id = Number(profileSelect.value);
  if (!user_id) return;

  await fetch(`${BASE_URL}/api/users/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id })
  });

  await loadActiveProfile();
  await loadFavorites();
  await loadReviews();
  await loadReservations();
  clearRecommendations();
});


// Show edit profile inputs
editProfileBtn.addEventListener("click", () => {
  if (!activeUser) return;

  editProfileSection.style.display = "block";
  editProfileName.value = activeUser.name || "";
  editProfileEmail.value = activeUser.email || "";
  editProfileCuisine.value = activeUser.preferred_cuisine || "";
});


// Cancel editing
cancelEditBtn.addEventListener("click", () => {
  editProfileSection.style.display = "none";
});


// Save profile changes
updateProfileBtn.addEventListener("click", async () => {
  const name = editProfileName.value.trim();
  const email = editProfileEmail.value.trim();
  const preferred_cuisine = editProfileCuisine.value;

  const res = await fetch(`${BASE_URL}/api/users/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, preferred_cuisine })
  });

  if (!res.ok) return alert("Failed to update profile");

  editProfileSection.style.display = "none";
  await loadActiveProfile();
  clearRecommendations();
});


// Load favorites
async function loadFavorites() {
  favoritesList.innerHTML = "";
  const res = await fetch(`${BASE_URL}/api/user/favorites`);
  const data = await res.json();

  if (!data.length) {
    favoritesList.innerHTML =
      "<li class='list-group-item text-muted'>No favorites yet.</li>";
    return;
  }

  data.forEach(r => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";

    li.innerHTML = `
      <span>${r.name} (${r.city})</span>
      <button class="btn btn-sm btn-outline-danger"
        data-action="remove-favorite"
        data-id="${r.id}">
        Remove
      </button>
    `;

    favoritesList.appendChild(li);
  });
}


// Add a favorite
async function addFavorite(id) {
  await fetch(`${BASE_URL}/api/user/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurant_id: id })
  });
  loadFavorites();
}


// Remove a favorite
async function removeFavorite(id) {
  const res = await fetch(`${BASE_URL}/api/user/favorites`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurant_id: id })
  });

  if (!res.ok) {
    alert("Failed to remove favorite.");
    return;
  }

  loadFavorites();
}


// Favorites list click handler
favoritesList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action='remove-favorite']");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  if (!confirm("Remove this restaurant from your favorites?")) return;

  await removeFavorite(id);
  clearRecommendations();
});


// Load reviews
async function loadReviews() {
  reviewsList.innerHTML = "";
  const res = await fetch(`${BASE_URL}/api/user/reviews`);
  const data = await res.json();

  if (!data.length) {
    reviewsList.innerHTML =
      "<li class='list-group-item text-muted'>No reviews yet.</li>";
    return;
  }

  data.forEach(r => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";

    li.innerHTML = `
      <div>
        <strong>${r.restaurant_name}</strong><br>
        ⭐ ${r.rating}<br>
        <small>${r.review_text || ""}</small>
      </div>

      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary"
          data-action="edit-review"
          data-id="${r.id}">
          Edit
        </button>
        <button class="btn btn-outline-danger"
          data-action="delete-review"
          data-id="${r.id}">
          Delete
        </button>
      </div>
    `;

    reviewsList.appendChild(li);
  });
}


// Create review from recommendation card
async function submitReview(id) {
  const rating = Number(prompt("Rating (1–5):"));
  if (!rating || rating < 1 || rating > 5) return;

  const review_text = prompt("Review (optional):") || "";

  await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurant_id: id, rating, review_text })
  });

  loadReviews();
  clearRecommendations();
}


// Edit a review
async function editReview(reviewId) {
  const rating = Number(prompt("New rating (1–5):"));
  if (!rating || rating < 1 || rating > 5) return;

  const review_text = prompt("Updated review:") || "";

  const res = await fetch(`${BASE_URL}/api/reviews/${reviewId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating, review_text })
  });

  if (!res.ok) return alert("Failed to update review.");

  loadReviews();
  clearRecommendations();
}


// Delete a review
async function deleteReview(reviewId) {
  if (!confirm("Delete this review?")) return;

  const res = await fetch(`${BASE_URL}/api/reviews/${reviewId}`, {
    method: "DELETE"
  });

  if (!res.ok) return alert("Failed to delete review.");

  loadReviews();
  clearRecommendations();
}


// Reviews list click handler
reviewsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const reviewId = Number(btn.dataset.id);

  if (action === "edit-review") await editReview(reviewId);
  else if (action === "delete-review") await deleteReview(reviewId);
});


// Load reservations
async function loadReservations() {
  reservationsList.innerHTML = "";
  const res = await fetch(`${BASE_URL}/api/user/reservations`);
  const data = await res.json();

  if (!data.length) {
    reservationsList.innerHTML =
      "<li class='list-group-item text-muted'>No upcoming reservations.</li>";
    return;
  }

  data.forEach(r => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";

    li.innerHTML = `
      <div>
        <strong>${r.restaurant_name}</strong>
        <small class="text-muted">(${r.restaurant_city})</small><br>
        For ${r.party_size} on ${r.date} at ${r.time}
      </div>

      <button class="btn btn-sm btn-outline-danger"
        data-action="cancel-res"
        data-id="${r.id}">
        Cancel
      </button>
    `;

    reservationsList.appendChild(li);
  });
}


// Cancel reservation
reservationsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action='cancel-res']");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  if (!confirm("Cancel this reservation?")) return;

  await fetch(`${BASE_URL}/api/user/reservations/${id}`, {
    method: "DELETE"
  });

  loadReservations();
});


// Recommendation card HTML
function recCard(r) {
  return `
    <div class="col-12 col-md-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body d-flex flex-column">

          <div class="d-flex justify-content-between align-items-center mb-1">
            <h6 class="mb-0">${r.name}</h6>
            <span class="badge bg-info-subtle text-dark">${r.cuisine}</span>
          </div>

          <p class="text-muted mb-2">
            ${r.city} • ${r.price || ""} ${r.tables ? `• ${r.tables} tables` : ""}
          </p>

          <button class="btn btn-outline-primary w-100 mb-2"
            data-action="reserve" data-id="${r.id}">
            Reserve
          </button>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-danger flex-fill"
              data-action="favorite" data-id="${r.id}">
              ❤️ Add Favorite
            </button>
            <button class="btn btn-outline-secondary flex-fill"
              data-action="review" data-id="${r.id}">
              ✏️ Review
            </button>
          </div>

        </div>
      </div>
    </div>
  `;
}


// Clear recommendations display
function clearRecommendations() {
  recommendationsList.innerHTML =
    `<p class="text-muted">Click “Generate Recommendations” to see suggestions.</p>`;
}


// Load recommendations
async function generateRecommendations() {
  recommendationsList.innerHTML = "<p class='text-muted'>Loading…</p>";

  const res = await fetch(`${BASE_URL}/api/user/recommendations`);
  const data = await res.json();

  if (!data.length) {
    recommendationsList.innerHTML =
      "<p class='text-muted'>No recommendations yet.</p>";
    return;
  }

  recommendationsList.innerHTML = data.map(recCard).join("");
}


// Recommendation card click handler
recommendationsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  if (action === "favorite") {
    await addFavorite(id);
  } else if (action === "review") {
    await submitReview(id);
  } else if (action === "reserve") {
    alert("Use the Search page to make reservations.");
  }
});


// Startup
(async () => {
  await loadCuisineOptions();
  await loadProfiles();
  await loadActiveProfile();
  await loadFavorites();
  await loadReviews();
  await loadReservations();
  clearRecommendations();
})();

generateRecsBtn.addEventListener("click", generateRecommendations);
