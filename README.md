# places_page

A personal page of places I have been to — the [running_page](https://github.com/yihong0618/running_page) idea, but for places instead of runs.

- **Home** — stat cards plus a *Place Log* table (newest first, 16 per page) mirroring running_page's Run Log; click a row to open it on the Wall.
- **Wall** — the Track Wall layout: detail card (defaults to the most recently added place), map, geo tabs, search, tag pills and a wall of circles carrying place names.
- Each place has **tags** (many), an optional **link**, a short **description** and an **added** date.
- **Tabs** drill down by geography: country → province → city (empty levels are skipped; municipalities like 北京 collapse to one row).
- **Search** works like running_page's tag search: space-separated terms are AND-ed, matched case-insensitively as substrings against name / tags / description. Tag pills are hard filters and are computed from the geographic scope, not from the search result, so they stay clickable.

## Add a place

Paste a map URL (Baidu, Amap, Google, OSM, Mapbox) into `tools/parse-place.py`; it detects the vendor, converts the coordinates to WGS-84 / GCJ-02 / BD-09 and prints a record to append to `src/data/places.json`:

```bash
./tools/parse-place.py --country 中国 --province 北京 --city 北京 \
  --tags 美食 港式 --desc '港式茶餐厅，北京首店' '<map URL>'
```

Why three coordinate sets: Baidu and Amap each use their own offset datum, and the same spot differs by ~0.5–1.3 km between them, so every record keeps its source and all three datums. The page renders on a WGS-84 basemap (Carto via MapLibre, no token needed). A bare `@lon,lat` without a URL needs an explicit `--source`; the script refuses to guess.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run ci         # typecheck + tests + build (what GitHub Actions runs)
```

Deployed to GitHub Pages on every push to `main` (Settings → Pages → Source = GitHub Actions).
