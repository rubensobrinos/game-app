#!/bin/bash
# schrijf-health.sh <uitvoermap> [versie] — schrijf health.json en health-ready.json
# voor statische sites (devkit ADR-0062).

set -eu

# Geen netwerk, geen afhankelijkheden.

uitvoermap="${1:-}"
versie="${2:-}"

# Weigeren (64) zonder uitvoermap of als de map niet bestaat.
if [ -z "$uitvoermap" ]; then
  echo "schrijf-health.sh: geen uitvoermap opgegeven" >&2
  exit 64
fi

if [ ! -d "$uitvoermap" ]; then
  echo "schrijf-health.sh: '$uitvoermap' bestaat niet" >&2
  exit 64
fi

# Versie bepalen: argument, of git rev-parse --short HEAD.
if [ -z "$versie" ]; then
  versie="$(git rev-parse --short HEAD 2>/dev/null || true)"
  if [ -z "$versie" ]; then
    versie="onbekend"
  fi
fi

# Weigeren (65) als versie iets anders dan letters, cijfers, punt, min en underscore bevat.
if ! echo "$versie" | grep -qE '^[a-zA-Z0-9._-]+$'; then
  echo "schrijf-health.sh: versie bevat ongeldige karakters: '$versie'" >&2
  exit 65
fi

# health.json: {"status":"ok"}
printf '{"status":"ok"}\n' > "$uitvoermap/health.json"

# health-ready.json: {"status":"ok","dienst":"rounda","versie":"<versie>","checks":{}}
printf '{"status":"ok","dienst":"rounda","versie":"%s","checks":{}}\n' "$versie" > "$uitvoermap/health-ready.json"
