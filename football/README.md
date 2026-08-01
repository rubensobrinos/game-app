# football/

Club crest images for the **Football Logos** game mode.

## Contents

52 PNG club crests, one per file. Every file corresponds to an entry in `data/football.js`.

## Naming convention

Files are named after the club's **slug** — a lowercase, hyphen-separated identifier:

```
<slug>.png
```

Examples: `real-madrid.png`, `manchester-city.png`, `borussia-monchengladbach.png`.

The slug is the same value used in the `slug` field of each entry in `data/football.js`, so the app can resolve the correct image at runtime with:

```js
`football/${club.slug}.png`
```

## Downloading / updating assets

Run the PowerShell script at the project root:

```powershell
.\download_football.ps1
```

The script maps each slug to its **api-sports.io (API-Football) team ID** and downloads the crest from:

```
https://media.api-sports.io/football/teams/<id>.png
```

Each downloaded file is validated (PNG magic bytes + size > 1 KB). Invalid or missing files are removed and reported. A 250 ms delay between requests avoids rate-limiting.

To add a new club: add its slug/ID pair to the `$teams` hashtable in `download_football.ps1`, add the corresponding entry to `data/football.js`, then re-run the script.

## Usage in the app

The **Football Logos** game mode reads club data from `data/football.js`, which provides:

- `slug` — used to load the crest image from this directory
- `difficulty` — `easy`, `medium`, or `hard`
- `name_en` / `name_nl` / `name_es` — localised display names
- `aliases` — accepted alternative answers per language

The app displays a crest and challenges the player to name the club. Accepted answers include the canonical name and all configured aliases.
