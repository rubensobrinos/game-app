# data/

JavaScript files loaded via `<script>` tags. Each file declares one global variable that the game reads directly — no module bundler, no imports.

---

## Files

| File | Global | Description |
|---|---|---|
| `countries.js` | `COUNTRIES` | Country entries for the flag-guessing game (name in EN/NL/ES + difficulty) |
| `country-facts.js` | `COUNTRY_FACTS` | Extra facts per country keyed by `iso2`: capital, population, area, GDP, continent |
| `flag-info.js` | `FLAG_INFO` | One-sentence flag origin story per country in EN/NL/ES, keyed by `iso2` |
| `logos.js` | `LOGOS` | Brand logo entries for the logo-guessing game (name in EN/NL/ES + difficulty) |
| `logo-themes.js` | `LOGO_THEME_LIST` | Ordered list of logo theme categories with labels in EN/NL/ES |
| `football.js` | `FOOTBALL` | Football club entries for the club-logo game (name in EN/NL/ES + difficulty) |
| `geo-countries.js` | `GEO_COUNTRIES` | Country outlines for the geography map game: lat/lon centroid + SVG `<path>` shape |
| `geo-records.js` | `GEO_RECORDS` | Geographic superlatives (mountains, rivers, lakes, etc.) for a higher/lower game |
| `shapes.js` | `COUNTRY_SHAPES` | **Auto-generated.** Country silhouettes as SVG paths, keyed by `iso2` |
| `provinces.js` | `PROVINCES` | **Auto-generated.** Admin-1 (province/state) silhouettes per country |

---

## Schemas

### `countries.js` — `COUNTRIES` (array)

```js
{ iso2: 'fr', difficulty: 'easy', name_en: 'France', name_nl: 'Frankrijk', name_es: 'Francia',
  aliases: { en: ['french republic'], nl: [], es: [] } }
```

| Field | Type | Notes |
|---|---|---|
| `iso2` | string | ISO 3166-1 alpha-2 code (lowercase). Used to resolve the flag image. |
| `difficulty` | string | `'easy'` / `'medium'` / `'hard'` |
| `name_en` / `name_nl` / `name_es` | string | Official display name per language |
| `aliases` | object | Extra accepted spellings per language (lowercased, no accents needed) |

### `country-facts.js` — `COUNTRY_FACTS` (object keyed by `iso2`)

```js
fr: { capital_nl: 'Parijs', capital_en: 'Paris', capital_es: 'París',
      capitalAliases: { nl: [], en: [], es: [] },
      population: 68000000, area: 551695, gdp: 3130, continent: 'Europe' }
```

### `flag-info.js` — `FLAG_INFO` (object keyed by `iso2`)

```js
"fr": { nl: "...", en: "...", es: "..." }
```

One sentence per language explaining the origin of the flag.

### `logos.js` — `LOGOS` (array)

```js
{ slug: 'apple', difficulty: 'easy', name_en: 'Apple', name_nl: 'Apple', name_es: 'Apple',
  aliases: { en: [], nl: [], es: [] } }
```

| Field | Type | Notes |
|---|---|---|
| `slug` | string | Filename stem for the logo image (e.g. `apple` → `logos/apple.svg`) |
| `difficulty` | string | `'easy'` / `'medium'` / `'hard'` |
| `name_en` / `name_nl` / `name_es` | string | Brand name per language |
| `aliases` | object | Extra accepted spellings (e.g. `['Twitter']` for `x`) |

### `logo-themes.js` — `LOGO_THEME_LIST` (array)

```js
{ key: 'tech', nl: 'Tech', en: 'Tech', es: 'Tecnología' }
```

Controls the order and labels of theme filter tabs in the UI. The `key` matches the `theme` field on logo entries (if used).

### `football.js` — `FOOTBALL` (array)

Same schema as `logos.js`. `slug` maps to the club badge image. `name_en/nl/es` carry the full club name.

```js
{ slug: 'real-madrid', difficulty: 'easy', name_en: 'Real Madrid', name_nl: 'Real Madrid',
  name_es: 'Real Madrid', aliases: { en: ['real'], nl: ['real'], es: ['real','madrid'] } }
```

### `geo-countries.js` — `GEO_COUNTRIES` (array)

```js
{ name: 'Afghanistan', aliases: [], region: 'Asia', lat: 35.2292, lon: 68.0918,
  shape: '<path d="M97.6 16.0 L95.8 16.9 ..." />' }
```

| Field | Type | Notes |
|---|---|---|
| `name` | string | English country name |
| `aliases` | array | Alternative accepted spellings |
| `region` | string | Continent/region label |
| `lat` / `lon` | number | Centroid coordinates (decimal degrees) |
| `shape` | string | SVG `<path>` element projected into a `0 0 100 100` viewBox |

### `geo-records.js` — `GEO_RECORDS` (object)

Keyed by category (e.g. `mountains`, `rivers`). Each category contains an `emoji`, a `unit`, and an `items` array sorted **largest → smallest** so the game can do higher/lower comparisons.

---

## How to add new entries

### New country (`countries.js`)
1. Add an entry to `COUNTRIES` in the appropriate difficulty block.
2. Required fields: `iso2`, `difficulty`, `name_en`, `name_nl`, `name_es`, `aliases`.
3. Add matching facts to `COUNTRY_FACTS` in `country-facts.js` using the same `iso2` key.
4. Optionally add a flag story to `FLAG_INFO` in `flag-info.js`.
5. The flag image must exist at `flags/<iso2>.svg` (or `.png`).

### New logo (`logos.js`)
1. Add an entry to `LOGOS` in the appropriate difficulty block.
2. Required fields: `slug`, `difficulty`, `name_en`, `name_nl`, `name_es`, `aliases`.
3. The logo image must exist at `logos/<slug>.svg` (or `.png`).

### New football club (`football.js`)
Same as logos. Club badge image must exist at `logos/<slug>.svg`.

### New geo entry (`geo-countries.js`)
Add an object with `name`, `aliases`, `region`, `lat`, `lon`, and `shape`. The `shape` path must be projected into a `0 0 100 100` viewBox (use `build-shapes.js` as a reference for the projection).

---

## Auto-generated files

Do **not** edit these by hand — they are overwritten by build scripts.

| File | Generated by | Command |
|---|---|---|
| `data/shapes.js` | `build-shapes.js` | `node build-shapes.js` |
| `data/provinces.js` | `build-provinces.js` | `node --max-old-space-size=2048 build-provinces.js` |

Both scripts read from `build/world.geo.json` and `build/iso.json`. Run them after updating source GeoJSON data.
