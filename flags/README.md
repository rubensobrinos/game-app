# flags/

Contains ~230 PNG flag images used by the geography game.

## Naming convention

Files are named by **ISO 3166-1 alpha-2** country code in lowercase:

```
nl.png   → Netherlands
fr.png   → France
de.png   → Germany
```

## Downloading / updating flags

Run the PowerShell script from the project root:

```powershell
.\download-flags.ps1
```

- Source: [flagcdn.com](https://flagcdn.com) (`w640` size preset)
- Already-downloaded files are skipped (safe to re-run)
- Failed codes are printed in yellow at the end

To add a new country, add its alpha-2 code to the `$codes` array in `download-flags.ps1` and re-run the script.

## Usage in the app

Flag images are referenced by ISO2 code at runtime:

```html
<img src="flags/{iso2}.png" />
```

For example, the Dutch flag is loaded as `flags/nl.png`.

## Format & size

- **Format:** PNG (as served by flagcdn.com)
- **Width:** 640 px (`w640` preset); height varies by aspect ratio
- Do not rename files or change the extension — the app constructs the path dynamically from the country code.
