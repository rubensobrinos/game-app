# Game App

A vanilla JavaScript quiz game with ten game modes covering flags, logos, capitals, geography, and more. Runs entirely in the browser — no build step, no dependencies.

## How to run

Open `index.html` in any modern browser. That's it.

```
# Example with a local server (optional, not required):
npx serve .
# or just double-click index.html
```

## Game modes

| Mode | Description |
|------|-------------|
| **Vlaggen Quiz** | See a country flag, type (or choose) the country name. |
| **Logo Quiz** | Recognise brand logos — type or pick the brand name. |
| **Echt of Nep?** | Decide whether a flag is real or AI-generated. |
| **Geo Quiz** | Identify a country from its silhouette (optional random rotation). |
| **Hoofdsteden Quiz** | Name the capital city of a shown country. |
| **Voetballogo's** | Recognise football club crests. |
| **Logo: Echt of Nep?** | Real company logo vs AI-generated fake — spot the difference. |
| **Hoger of Lager** | Compare two countries by population, area, or GDP — pick which is higher. |
| **Buitenbeentje** | Odd one out — which item doesn't belong to the group? |
| **Records** | Country record trivia (largest, smallest, most populated, etc.). |

### Options available across modes

- **Language:** Dutch (NL), English (EN), Spanish (ES)
- **Difficulty:** Easy / Normal / Hard / Extreme
- **Play style:** Solo or Team vs Team
- **Input mode:** Type answer / Multiple choice / Flashcard
- **Streaks:** Enthusiastic comments triggered by correct-answer streaks

## Project structure

```
index.html          Main entry point — open this to play
style.css           All styles
app.js              Game logic, translations, UI state
geo.js              Geo Quiz rendering (SVG silhouettes)
hint.js             Hint system
flaginfo.js         Extra flag metadata
provinces.js        Province-level data

data/
  countries.js      Country list with names in NL/EN/ES, difficulty, ISO2 code
  logos.js          Brand logo list (slug maps to logos/<slug>.png)
  football.js       Football club list
  flag-info.js      Flag descriptions and trivia
  geo-countries.js  Country shapes for Geo Quiz
  geo-records.js    Country record data for Records mode
  country-facts.js  Facts used in Hoger of Lager
  logo-themes.js    Themes/categories for Logo Quiz
  provinces.js      Province shapes

flags/              Flag images (named by ISO2, e.g. nl.svg)
logos/              Brand logo images (named by slug, e.g. apple.png)
football/           Football club logo images
```

## Adding content

### New country / flag
1. Add an entry to `data/countries.js` following the existing pattern — set `iso2`, `difficulty`, names in all three languages, and optional `aliases`.
2. Drop the flag image in `flags/` named `<iso2>.svg` (e.g. `zz.svg`).

### New brand logo
1. Add an entry to `data/logos.js` with a `slug`, `difficulty`, names, and aliases.
2. Drop the logo image in `logos/` named `<slug>.png`.

### New football club
1. Add an entry to `data/football.js`.
2. Drop the crest image in `football/` with the matching filename.

### Downloading images in bulk
`download-flags.ps1`, `download-logos.ps1`, and `download_football.ps1` are PowerShell scripts that fetch images automatically — see the comments inside each script for usage.
