#!/bin/sh
# deploy/release.sh [ref] — zet rounda.io op een commit (standaard: main).
#
# Het enige pad naar productie. Pakt de commit uit met `git archive` in een nieuwe
# releasemap (ongecommit werk kan dus niet meeliften), bouwt daar, wisselt de symlink
# $RELEASES/current atomair om, herstart nl.aseso.rounda.productie en voert de rookproef uit.
# Faalt de rookproef, dan gaat current terug naar de vorige release.
#
# Draait nooit vanzelf: een release is een bewust moment (devkit ADR-0017, ADR-0032).
set -eu
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

omgeving_laden productie
omgeving_eisen

REPO="$(git -C "$DEPLOY" rev-parse --show-toplevel)"
SHA="$(git -C "$REPO" rev-parse --verify "${1:-main}^{commit}")"
KORT="$(git -C "$REPO" rev-parse --short "$SHA")"
NIEUW="$RELEASES/$(date +%Y%m%d-%H%M%S)-$KORT"
VORIG="$(readlink "$RELEASES/current" 2>/dev/null || true)"

wissel_naar() {
  ln -s "$1" "$RELEASES/.current.$$"
  mv -h "$RELEASES/.current.$$" "$RELEASES/current"
}

echo "[1/4] $KORT uitpakken in $NIEUW"
mkdir -p "$NIEUW"
git -C "$REPO" archive "$SHA" | tar -x -C "$NIEUW"
printf '%s\n' "$SHA" > "$NIEUW/.release-sha"

echo "[2/4] bouwen"
if ! (cd "$NIEUW" && /bin/sh -c "$BOUWEN"); then
  rm -rf "$NIEUW"
  echo "AFGEBROKEN: bouwen faalde. Productie is niet aangeraakt." >&2
  exit 1
fi

echo "[3/4] omwisselen en herstarten"
wissel_naar "$NIEUW"
herstarten "$DIENST" || echo "herstarten gaf een fout; de rookproef beslist" >&2

echo "[4/4] rookproef"
if rookproef "$POORT"; then
  echo "$DOMEIN draait op $KORT ($NIEUW)"
  # Oude releases opruimen, nooit de huidige of de vorige (het terugrolpunt).
  ls -1d "$RELEASES"/[0-9]*/ 2>/dev/null | sed 's:/$::' | sort -r | tail -n +$((RELEASES_BEWAREN + 1)) |
    while read -r oud; do
      [ "$oud" = "$NIEUW" ] || [ "$oud" = "$VORIG" ] || rm -rf "$oud"
    done
  exit 0
fi

if [ -z "$VORIG" ]; then
  echo "rookproef faalde en er is geen vorige release om naar terug te gaan" >&2
  exit 2
fi
echo "TERUGROLLEN naar $VORIG" >&2
wissel_naar "$VORIG"
herstarten "$DIENST" || echo "herstarten gaf een fout; de rookproef beslist" >&2
if rookproef "$POORT"; then
  echo "vorige release draait weer; de mislukte staat nog in $NIEUW" >&2
  exit 1
fi
echo "ook de vorige release komt niet op; $DOMEIN ligt eruit" >&2
exit 2
