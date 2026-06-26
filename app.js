const restaurants = window.RESTAURANTS || [];

const categoryColors = {
  "Dessert/drinks": "#e0a100",
  Drinks: "#d9480f",
  "Fine dining": "#5b5fc7",
  "Fine dining/drinks": "#c026d3",
  Food: "#1f9d55",
  "Want to try": "#0f766e",
};

const defaultColor = "#667085";
const allLabel = "All";

const controls = {
  search: document.querySelector("#searchInput"),
  food: document.querySelector("#foodFilter"),
  price: document.querySelector("#priceFilter"),
  location: document.querySelector("#locationFilter"),
  category: document.querySelector("#categoryFilter"),
  recommended: document.querySelector("#recommendedFilter"),
  reset: document.querySelector("#resetFilters"),
  shownCount: document.querySelector("#shownCount"),
  matchSummary: document.querySelector("#matchSummary"),
  inViewCount: document.querySelector("#inViewCount"),
  inViewList: document.querySelector("#inViewList"),
  pinSummary: document.querySelector("#pinSummary"),
  rows: document.querySelector("#restaurantRows"),
  cards: document.querySelector("#restaurantCards"),
  legend: document.querySelector("#legend"),
};

let lastFiltered = restaurants;

const map = L.map("map", {
  scrollWheelZoom: true,
  zoomControl: true,
}).setView([40.735, -73.98], 12);

L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
  subdomains: "abcd",
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
}).addTo(map);

const markerLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 42,
  iconCreateFunction(cluster) {
    const count = cluster.getChildCount();
    const size = count < 10 ? 38 : count < 100 ? 46 : 54;
    return L.divIcon({
      html: `<span>${count}</span>`,
      className: "custom-cluster",
      iconSize: [size, size],
    });
  },
}).addTo(map);
const markers = new Map();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function optionLabel(value, formatter = (item) => item) {
  return value === allLabel ? allLabel : formatter(value);
}

function uniqueValues(key) {
  return [...new Set(restaurants.map((restaurant) => restaurant[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function sourceValues() {
  return [
    ...new Set(
      restaurants.flatMap((restaurant) => restaurant.sources || [restaurant.recommendedBy]).filter(Boolean),
    ),
  ].sort((a, b) => String(a).localeCompare(String(b)));
}

function fillSelect(select, values, formatter) {
  select.innerHTML = "";
  [allLabel, ...values].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = optionLabel(value, formatter);
    select.append(option);
  });
}

function priceLabel(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? "$".repeat(price) : "Unknown";
}

function hasCoords(restaurant) {
  return Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng);
}

function getColor(category) {
  return categoryColors[category] || defaultColor;
}

function markerIcon(category) {
  const color = getColor(category);
  return L.divIcon({
    className: "restaurant-marker",
    html: `<span class="marker-pin" style="--marker-color: ${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });
}

function popupHtml(restaurant) {
  return `
    <h3 class="popup-title">${escapeHtml(restaurant.name)}</h3>
    <div class="popup-meta">
      <span><strong>Type:</strong> ${escapeHtml(restaurant.foodType)}</span>
      <span><strong>Price:</strong> ${priceLabel(restaurant.price)}</span>
      <span><strong>Location:</strong> ${escapeHtml(restaurant.location)}</span>
      <span><strong>Source:</strong> ${escapeHtml(restaurant.recommendedBy)}</span>
      <span><strong>Category:</strong> ${escapeHtml(restaurant.category)}</span>
    </div>
    <p class="popup-notes">${escapeHtml(restaurant.notes)}</p>
    <a class="map-link" href="${escapeHtml(restaurant.googleMapsUrl)}" target="_blank" rel="noopener">Open in Google Maps</a>
  `;
}

function addMarker(restaurant) {
  if (!hasCoords(restaurant)) {
    return;
  }

  const marker = L.marker([restaurant.lat, restaurant.lng], {
    icon: markerIcon(restaurant.category),
    title: restaurant.name,
  }).bindPopup(popupHtml(restaurant));

  markers.set(restaurant.id, marker);
}

function renderLegend() {
  controls.legend.innerHTML = uniqueValues("category")
    .map(
      (category) => `
        <span class="legend-item">
          <span class="legend-dot" style="--dot: ${getColor(category)}"></span>
          ${escapeHtml(category)}
        </span>
      `,
    )
    .join("");
}

function currentFilters() {
  return {
    search: controls.search.value.trim().toLowerCase(),
    food: controls.food.value,
    price: controls.price.value,
    location: controls.location.value,
    category: controls.category.value,
    recommended: controls.recommended.value,
  };
}

function textMatches(restaurant, search) {
  if (!search) {
    return true;
  }

  const haystack = [
    restaurant.name,
    restaurant.foodType,
    restaurant.location,
    restaurant.category,
    restaurant.recommendedBy,
    ...(restaurant.sources || []),
    restaurant.notes,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function selectMatches(value, selected) {
  return selected === allLabel || String(value) === selected;
}

function sourceMatches(restaurant, selected) {
  return (
    selected === allLabel ||
    (restaurant.sources || [restaurant.recommendedBy]).includes(selected)
  );
}

function matchesFilters(restaurant, filters) {
  return (
    textMatches(restaurant, filters.search) &&
    selectMatches(restaurant.foodType, filters.food) &&
    selectMatches(restaurant.price, filters.price) &&
    selectMatches(restaurant.location, filters.location) &&
    selectMatches(restaurant.category, filters.category) &&
    sourceMatches(restaurant, filters.recommended)
  );
}

function tableRow(restaurant) {
  const color = getColor(restaurant.category);
  return `
    <tr tabindex="0" data-id="${restaurant.id}">
      <td class="name-cell">${escapeHtml(restaurant.name)}</td>
      <td>${escapeHtml(restaurant.foodType)}</td>
      <td>${priceLabel(restaurant.price)}</td>
      <td>${escapeHtml(restaurant.location)}</td>
      <td>
        <span class="category-pill" style="--dot: ${color}">
          ${escapeHtml(restaurant.category)}
        </span>
      </td>
      <td>${escapeHtml(restaurant.recommendedBy)}</td>
      <td class="notes-cell">
        ${escapeHtml(restaurant.notes)}
        ${hasCoords(restaurant) ? "" : '<span class="unpinned-note">No map pin yet</span>'}
      </td>
      <td><a class="table-link" href="${escapeHtml(restaurant.googleMapsUrl)}" target="_blank" rel="noopener">Google</a></td>
    </tr>
  `;
}

function renderTable(filtered) {
  controls.rows.innerHTML = filtered.map(tableRow).join("");
}

function mobileCard(restaurant) {
  const color = getColor(restaurant.category);
  const pinText = hasCoords(restaurant) ? "View on map" : "No pin";
  return `
    <article class="mobile-restaurant-card" data-id="${restaurant.id}" tabindex="0">
      <div class="mobile-card-head">
        <h3>${escapeHtml(restaurant.name)}</h3>
        <span class="mobile-price">${priceLabel(restaurant.price)}</span>
      </div>
      <p class="mobile-meta">${escapeHtml(restaurant.foodType)} · ${escapeHtml(restaurant.location)}</p>
      <div class="mobile-card-tags">
        <span class="category-pill" style="--dot: ${color}">
          ${escapeHtml(restaurant.category)}
        </span>
        <span class="source-pill">${escapeHtml(restaurant.recommendedBy)}</span>
      </div>
      <p class="mobile-notes">${escapeHtml(restaurant.notes || "No notes yet.")}</p>
      <div class="mobile-card-actions">
        <button class="mobile-map-button" type="button" data-focus-id="${restaurant.id}" ${hasCoords(restaurant) ? "" : "disabled"}>
          ${pinText}
        </button>
        <a class="mobile-google-link" href="${escapeHtml(restaurant.googleMapsUrl)}" target="_blank" rel="noopener">
          Google Maps
        </a>
      </div>
    </article>
  `;
}

function renderCards(filtered) {
  controls.cards.innerHTML = filtered.map(mobileCard).join("");
}

function renderMarkers(filtered, shouldFit = false) {
  markerLayer.clearLayers();
  const pinned = filtered.filter(hasCoords);

  pinned.forEach((restaurant) => {
    const marker = markers.get(restaurant.id);
    if (marker) {
      markerLayer.addLayer(marker);
    }
  });

  if (shouldFit && pinned.length > 0) {
    const bounds = L.latLngBounds(pinned.map((restaurant) => [restaurant.lat, restaurant.lng]));
    map.fitBounds(bounds, {
      maxZoom: pinned.length === 1 ? 15 : 13,
      padding: [28, 28],
    });
  }

  window.setTimeout(renderInViewList, 0);
}

function updateSummary(filtered) {
  const pinned = filtered.filter(hasCoords).length;
  const unpinned = filtered.length - pinned;
  controls.shownCount.textContent = filtered.length;
  controls.matchSummary.textContent =
    filtered.length === restaurants.length
      ? `${restaurants.length} total recommendations`
      : `${filtered.length} of ${restaurants.length} recommendations`;
  controls.pinSummary.textContent = unpinned
    ? `${pinned} pinned, ${unpinned} unpinned`
    : `${pinned} pinned`;
}

function applyFilters({ fit = true } = {}) {
  const filters = currentFilters();
  const filtered = restaurants.filter((restaurant) => matchesFilters(restaurant, filters));
  lastFiltered = filtered;

  renderMarkers(filtered, fit);
  renderTable(filtered);
  renderCards(filtered);
  updateSummary(filtered);
}

function focusRestaurant(id) {
  const restaurant = restaurants.find((item) => item.id === Number(id));
  const marker = markers.get(Number(id));
  if (!restaurant || !marker || !hasCoords(restaurant)) {
    if (restaurant) {
      window.open(restaurant.googleMapsUrl, "_blank", "noopener");
    }
    return;
  }

  map.setView([restaurant.lat, restaurant.lng], Math.max(map.getZoom(), 15), {
    animate: true,
  });
  markerLayer.zoomToShowLayer(marker, () => marker.openPopup());
}

function inCurrentBounds(restaurant) {
  if (!hasCoords(restaurant)) {
    return false;
  }

  return map.getBounds().contains([restaurant.lat, restaurant.lng]);
}

function inViewCard(restaurant) {
  return `
    <button class="in-view-card" type="button" data-id="${restaurant.id}">
      <span class="in-view-name">${escapeHtml(restaurant.name)}</span>
      <span class="in-view-meta">${priceLabel(restaurant.price)} · ${escapeHtml(restaurant.foodType)}</span>
      <span class="in-view-meta">${escapeHtml(restaurant.location)}</span>
    </button>
  `;
}

function renderInViewList() {
  const visible = lastFiltered.filter(inCurrentBounds);
  controls.inViewCount.textContent = visible.length;
  controls.inViewList.innerHTML = visible.length
    ? visible.slice(0, 80).map(inViewCard).join("")
    : '<p class="in-view-empty">No filtered pins in the current map view.</p>';
}

function resetFilters() {
  controls.search.value = "";
  controls.food.value = allLabel;
  controls.price.value = allLabel;
  controls.location.value = allLabel;
  controls.category.value = allLabel;
  controls.recommended.value = allLabel;
  applyFilters();
}

function setupFilters() {
  fillSelect(controls.food, uniqueValues("foodType"));
  fillSelect(controls.price, uniqueValues("price"), priceLabel);
  fillSelect(controls.location, uniqueValues("location"));
  fillSelect(controls.category, uniqueValues("category"));
  fillSelect(controls.recommended, sourceValues());

  [
    controls.search,
    controls.food,
    controls.price,
    controls.location,
    controls.category,
    controls.recommended,
  ].forEach((control) => {
    control.addEventListener("input", () => applyFilters());
    control.addEventListener("change", () => applyFilters());
  });

  controls.reset.addEventListener("click", resetFilters);
}

function setupTableInteractions() {
  controls.rows.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
      return;
    }

    const row = event.target.closest("tr[data-id]");
    if (row) {
      focusRestaurant(row.dataset.id);
    }
  });

  controls.rows.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const row = event.target.closest("tr[data-id]");
    if (row) {
      event.preventDefault();
      focusRestaurant(row.dataset.id);
    }
  });

  controls.cards.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
      return;
    }

    const button = event.target.closest("[data-focus-id]");
    const card = event.target.closest("[data-id]");
    const id = button?.dataset.focusId || card?.dataset.id;
    if (id) {
      focusRestaurant(id);
    }
  });

  controls.cards.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const card = event.target.closest("[data-id]");
    if (card) {
      event.preventDefault();
      focusRestaurant(card.dataset.id);
    }
  });
}

function setupSidebarInteractions() {
  controls.inViewList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (card) {
      focusRestaurant(card.dataset.id);
    }
  });

  map.on("moveend zoomend", renderInViewList);
}

restaurants.forEach(addMarker);
setupFilters();
setupTableInteractions();
setupSidebarInteractions();
renderLegend();
applyFilters();
