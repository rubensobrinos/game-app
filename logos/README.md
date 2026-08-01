# logos/

This directory holds the ~100 SVG logo files used in the **Logo Quiz** game mode.

---

## Naming convention

Every file is named `<slug>.svg`, where `slug` matches the `slug` field of the corresponding entry in `data/logos.js`.

```
apple.svg      ← { slug: 'apple', name_en: 'Apple', ... }
google.svg     ← { slug: 'google', name_en: 'Google', ... }
```

The quiz looks up `logos/<slug>.svg` at runtime, so the filename must match exactly (lowercase, no spaces).

---

## Downloading / updating logos

Logos are sourced from [Simple Icons](https://simpleicons.org/) via their CDN.

Run the PowerShell script from the project root:

```powershell
.\download-logos.ps1
```

- Already-downloaded files are skipped (safe to re-run).
- Any slugs that fail are printed at the end in yellow.
- To add a new logo: add its slug to the appropriate difficulty section in `download-logos.ps1` **and** add a matching entry in `data/logos.js`, then re-run the script.

---

## How logos are used

The Logo Quiz mode reads `data/logos.js` to build the question pool. For each question it:

1. Picks a random entry from `LOGOS`.
2. Loads `logos/<slug>.svg` as the image to display.
3. Accepts the player's typed answer and checks it against `name_<lang>` and the `aliases` list for the active language (`en`, `nl`, or `es`).

Difficulty tiers (`easy` / `medium` / `hard` / `extreme`) control which pool the quiz draws from at each stage.

---

## Format requirements

| Requirement | Detail |
|---|---|
| Format | SVG only |
| Source | `https://cdn.simpleicons.org/<slug>` (Simple Icons CDN) |
| `viewBox` | Simple Icons SVGs ship with `viewBox="0 0 24 24"` — leave it intact so the logo scales correctly at any size |
| Colors | Files arrive as a single-color filled path; the app renders them as-is |
| Manual additions | If you source an SVG elsewhere, make sure it includes a `viewBox` attribute; width/height attributes alone will cause scaling issues |
