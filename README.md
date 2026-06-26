# NYC Restaurant Map

Static Leaflet map generated from `nyc_food_recs.csv`.

## Files

- `index.html` opens the app.
- `restaurants.js` contains the geocoded restaurant data.
- `app.js` handles map pins, filters, popups, and table interactions.
- `styles.css` handles responsive layout and marker colors.

The map uses Leaflet, Leaflet.markercluster, and CARTO Voyager raster tiles.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static
server. For example, from this folder:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy for free with GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root.
3. In GitHub, open `Settings` > `Pages`.
4. Set `Source` to `Deploy from a branch`.
5. Choose the `main` branch and `/ (root)`, then save.
6. GitHub will publish the map at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

No build command or paid hosting is needed.

## Data notes

Coordinates were generated with Nominatim/OpenStreetMap. A small set of restaurants
that Nominatim could not find by name use address-level lookups or Wikidata
coordinate fallbacks. All retained rows have map pins.
