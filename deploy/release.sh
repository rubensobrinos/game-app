#!/bin/sh
# deploy/release.sh [ref] — zet rounda.io op een commit (standaard: main).
#
# Het enige pad naar productie. Pakt de commit uit met `git archive` in een nieuwe
# releasemap (ongecommit werk kan dus niet meeliften), bouwt daar, wisselt om naar
# $RELEASES/live (twee gewone mappen, geen symlink — devkit ADR-0035), herstart
# nl.aseso.rounda.productie en voert de rookproef uit. Slaagt die, dan taggt het script de
# commit als YYYY-MM-DD.N en schrijft een regel in RELEASES_LOG. Faalt de rookproef,
# dan gaat live terug naar vorige en wordt er getagd noch een ok gelogd.
#
# WISSEL_NAAR, EXACTE VOLGORDE (geen symlink, dus geen enkele atomaire
# directory-swap mogelijk — POSIX rename(2) vervangt een niet-lege map niet):
#   1. mv "$RELEASES/live"      -> "$RELEASES/.vorige.tmp"   (oude live opzij)
#   2. mv "$1" (de nieuwe map)  -> "$RELEASES/live"          (nieuwe live)
#   3. mv "$RELEASES/.vorige.tmp" -> "$RELEASES/vorige"      (terugrolpunt)
# Elke stap is zelf een enkele rename(2) en dus atomair; met drie stappen bestaat
# er een kort venster (tussen stap 1 en 2) waarin "live" niet bestaat. Een falende
# rookproef of falende bouwstap onderbreekt wissel_naar zelf NOOIT: die controles
# gebeuren vóór (bouwen) of ná (rookproef) de volledige wissel_naar-aanroep, nooit
# er middenin. Twee lagen zelfherstel dekken het venster tussen stap 1 en 2:
#   - DIRECT: een trap op EXIT/INT/TERM binnen wissel_naar zelf zet ".vorige.tmp"
#     meteen terug naar "live" als dit proces eindigt terwijl het venster nog open
#     stond (Ctrl-C, een normale TERM, een gewone procesbeëindiging).
#   - VERTRAAGD: overleeft het venster een SIGKILL (kill -9, niet te vangen in
#     shell) of een host-crash, dan bestaat ".vorige.tmp" nog op schijf; de
#     eerstvolgende release.sh-aanroep herstelt dat via herstel_onderbroken_wissel()
#     in lib.sh, vóórdat hij zelf een nieuwe wissel probeert.
# Er is dus geen permanente inconsistentie mogelijk: hooguit een venster dat wacht
# op de eerstvolgende aanroep (of een handmatige `mv .vorige.tmp live`) als zelfs de
# trap niet kon draaien.
#
# Faalt de rookproef NA een voltooide wissel_naar (het normale rode pad), dan
# roept dit script wissel_naar opnieuw aan met "$RELEASES/vorige" als bron —
# dat is een gewone, volledige wissel (dezelfde drie stappen), geen halve.
#
# Draait nooit vanzelf: een release is een bewust moment (devkit ADR-0017, ADR-0032).
set -eu
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

omgeving_laden productie
omgeving_eisen
releases_pad_veilig
herstel_onderbroken_wissel

REPO="$(git -C "$DEPLOY" rev-parse --show-toplevel)"
SHA="$(git -C "$REPO" rev-parse --verify "${1:-main}^{commit}")"
KORT="$(git -C "$REPO" rev-parse --short "$SHA")"
NIEUW="$RELEASES/$(date +%Y%m%d-%H%M%S)-$KORT"
VORIGE_TAG="$(git -C "$REPO" describe --tags --exact-match "$(cat "$RELEASES/live/.release-sha" 2>/dev/null || echo HEAD)" 2>/dev/null || echo null)"

# wissel_naar <nieuwe-map> — hernoemt, wisselt geen symlink (ADR-0035). Zie de
# header hierboven voor de exacte volgorde en de garantie.
#
# DIRECT herstel via een trap (ADR-0035, reviewpunt 2 van de tweede review): naast
# herstel_onderbroken_wissel() in lib.sh (die pas bij de VOLGENDE release.sh-aanroep
# kijkt), zet een trap op EXIT/INT/TERM ".vorige.tmp" METEEN terug naar "live" als
# dit proces eindigt terwijl de wissel middenin het venster tussen stap 1 en 2 zat.
# Vangt dus een normale procesbeëindiging, Ctrl-C, of een TERM van bijvoorbeeld
# launchd/het systeem tijdens de wissel — niet een SIGKILL (kill -9, niet te vangen
# in shell); dát scenario blijft bij herstel_onderbroken_wissel() bij de volgende
# aanroep. De trap wordt aan het eind van een geslaagde wissel weer opgeheven, dus
# hij blijft niet actief nadat wissel_naar al klaar is (en verstoort dus niet de
# EXIT-trap van een latere, tweede wissel_naar-aanroep in hetzelfde script, zoals
# bij het terugrol-pad hieronder).
wissel_naar() {
  _wissel_actief=1
  # RELEASES moet NU worden ingevuld (het is constant binnen dit script), niet pas
  # als de trap afgaat: vandaar dubbele quotes voor de trap-string, niet enkele.
  # shellcheck disable=SC2064
  trap "
    if [ -n \"\${_wissel_actief:-}\" ] && [ ! -d \"$RELEASES/live\" ] && [ -d \"$RELEASES/.vorige.tmp\" ]; then
      echo '$OMGEVING_NAAM: onderbroken wissel — direct hersteld (trap)' >&2
      mv \"$RELEASES/.vorige.tmp\" \"$RELEASES/live\"
    fi
  " EXIT INT TERM
  if [ -d "$RELEASES/live" ]; then
    rm -rf "$RELEASES/.vorige.tmp"
    mv "$RELEASES/live" "$RELEASES/.vorige.tmp"
  fi
  mv "$1" "$RELEASES/live"
  if [ -d "$RELEASES/.vorige.tmp" ]; then
    rm -rf "$RELEASES/vorige"
    mv "$RELEASES/.vorige.tmp" "$RELEASES/vorige"
  fi
  _wissel_actief=""
  trap - EXIT INT TERM
}

echo "[1/4] $KORT uitpakken in $NIEUW"
mkdir -p "$NIEUW"
git -C "$REPO" archive "$SHA" | tar -x -C "$NIEUW"
printf '%s\n' "$SHA" > "$NIEUW/.release-sha"

echo "[2/4] bouwen"
if ! (cd "$NIEUW" && /bin/sh -c "$BOUWEN"); then
  rm -rf "$NIEUW"
  echo "AFGEBROKEN: bouwen faalde. Productie is niet aangeraakt." >&2
  log_release null "$SHA" rood-voor-release "$VORIGE_TAG" "bouwen faalde"
  exit 1
fi

echo "[3/4] omwisselen en herstarten"
wissel_naar "$NIEUW"
herstarten "$DIENST" || echo "herstarten gaf een fout; de rookproef beslist" >&2

echo "[4/4] rookproef"
if rookproef "$POORT"; then
  TAG="$(volgende_release_tag)"
  git -C "$REPO" tag -a "$TAG" "$SHA" -m "release $TAG"
  echo "$DOMEIN draait op $TAG ($KORT, $RELEASES/live)"
  log_release "$TAG" "$SHA" ok "$VORIGE_TAG" null
  # Oude releasemappen opruimen; live en vorige zijn geen [0-9]*-mappen meer, dus die blijven vanzelf staan.
  ls -1d "$RELEASES"/[0-9]*/ 2>/dev/null | sed 's:/$::' | sort -r | tail -n +$((RELEASES_BEWAREN + 1)) |
    while read -r oud; do
      rm -rf "$oud"
    done
  exit 0
fi

if [ ! -d "$RELEASES/vorige" ]; then
  echo "rookproef faalde en er is geen vorige release om naar terug te gaan" >&2
  log_release null "$SHA" rood-na-uitrol-teruggerold "$VORIGE_TAG" "rookproef faalde; geen vorige release om op terug te vallen"
  exit 2
fi
echo "TERUGROLLEN naar $RELEASES/vorige" >&2
TERUGROL_SHA="$(cat "$RELEASES/vorige/.release-sha" 2>/dev/null || echo "$SHA")"
wissel_naar "$RELEASES/vorige"
herstarten "$DIENST" || echo "herstarten gaf een fout; de rookproef beslist" >&2
if rookproef "$POORT"; then
  echo "vorige release draait weer; de mislukte staat nog in $NIEUW" >&2
  log_release null "$TERUGROL_SHA" rood-na-uitrol-teruggerold "$VORIGE_TAG" "rookproef faalde na uitrol van $KORT; teruggerold"
  exit 1
fi
echo "ook de vorige release komt niet op; $DOMEIN ligt eruit" >&2
log_release null "$SHA" rood-na-uitrol-teruggerold "$VORIGE_TAG" "rookproef faalde na uitrol van $KORT, en ook na terugrollen"
exit 2
