#!/bin/sh
# deploy/controleer-config.sh [--streng] — controleert ZONDER iets te starten, te bouwen of te schrijven of de uitrolconfiguratie van rounda.io klopt.
#
# Draai dit vóór de eerste uitrol en na elke wijziging aan omgeving.conf of een env-bestand. Het gebruikt dezelfde controles als de scripts
# zelf (omgeving_laden en omgeving_eisen uit lib.sh, per omgeving in een aparte shell), maar meldt alle bezwaren in één keer in plaats van het
# eerste en dan te stoppen:
#   1. de verplichte variabelen in omgeving.conf zijn gezet;
#   2. de poorten zijn getallen en botsen niet met elkaar;
#   3. per omgeving (test en productie): het env-bestand bestaat, de database en het adres wijzen naar de eigen omgeving, de eigen eis uit
#      omgeving.conf is gehaald (alle weigeringen van omgeving_eisen);
#   4. de env-bestanden hebben mode 600.
# Gemeld worden alleen NAMEN van variabelen en databases, nooit waarden uit een env-bestand.
#
# Zonder --streng zijn plaatshouders (een domein als *.example, "vul-in...") "nog in te vullen"; met --streng zijn ze een bezwaar: draai zo
# vlak voor de eerste echte uitrol.
# Exit 0: geen bezwaren. Exit 1: bezwaren. Exit 2: verkeerd gebruik.
set -u

STRENG=""
case "${1:-}" in
  "") ;;
  --streng) STRENG=1 ;;
  *) echo "gebruik: $0 [--streng]" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BEZWAREN=0
OPEN=0
ok() { echo "  ok       $*"; }
bezwaar() { echo "  BEZWAAR  $*"; BEZWAREN=$((BEZWAREN + 1)); }
openstaand() { echo "  invullen $*"; OPEN=$((OPEN + 1)); }

CONF="$SCRIPT_DIR/omgeving.conf"
echo "controleer-config: $SCRIPT_DIR"
if [ ! -f "$CONF" ]; then
  bezwaar "omgeving.conf ontbreekt"
  echo "controleer-config: 1 bezwaar" >&2
  exit 1
fi

waarde() { # waarde <NAAM>: de waarde na het inlezen van omgeving.conf, in een aparte shell
  ( . "$CONF" >/dev/null 2>&1; eval "printf '%s' \"\${$1:-}\"" )
}

# --- 1. omgeving.conf ---
echo "omgeving.conf:"
for v in NAAM DOMEIN LABEL POORT_TEST ENV_PRODUCTIE ENV_TEST TEST_WORKTREE RELEASES BOUWEN STARTEN; do
  if [ -n "$(waarde "$v")" ]; then ok "$v is gezet"; else bezwaar "$v is leeg of ontbreekt"; fi
done
DOMEIN="$(waarde DOMEIN)"
case "$DOMEIN" in
  *.example | *.invalid | "vul-in"* | "") if [ -n "$DOMEIN" ]; then
      if [ -n "$STRENG" ]; then bezwaar "DOMEIN is nog een plaatshouder ($DOMEIN)"; else openstaand "DOMEIN is nog een plaatshouder ($DOMEIN)"; fi
    fi ;;
esac

# --- 2. poorten ---
echo "poorten:"
P_TEST="$(waarde POORT_TEST)"; P_PROD="$(waarde POORT_PRODUCTIE)"
for paar in "POORT_TEST=$P_TEST" "POORT_PRODUCTIE=$P_PROD"; do
  naam="${paar%%=*}"; p="${paar#*=}"
  case "$p" in
    "") if [ "$naam" = POORT_TEST ]; then bezwaar "$naam is leeg (claim er een met 'devkit claim poort claim')"; else ok "$naam is leeg (toegestaan bij RELEASE_VORM=compose of tot productie bestaat)"; fi ;;
    *[!0-9]*) bezwaar "$naam is geen getal" ;;
    *) if [ "$p" -ge 1024 ] && [ "$p" -le 65535 ]; then ok "$naam=$p"; else bezwaar "$naam=$p ligt niet tussen 1024 en 65535"; fi ;;
  esac
done
[ -z "$P_TEST" ] || [ "$P_TEST" != "$P_PROD" ] || bezwaar "POORT_TEST en POORT_PRODUCTIE zijn gelijk"

# --- 3 en 4. per omgeving: dezelfde controles als de scripts zelf ---
for omgeving in test productie; do
  echo "omgeving $omgeving:"
  uit="$( ( DEPLOY="$SCRIPT_DIR"; . "$SCRIPT_DIR/lib.sh"; omgeving_laden "$omgeving"; omgeving_eisen ) 2>&1 )"
  code=$?
  if [ "$code" -eq 0 ]; then
    ok "omgeving_laden en omgeving_eisen: geen weigering"
  else
    # De weigering staat in de eerste regel als "<script> WEIGERT: <reden>"; waarden uit een env-bestand staan daar nooit in.
    reden="$(printf '%s\n' "$uit" | sed -n 's/^.*WEIGERT: //p' | head -1)"
    bezwaar "${reden:-weigering zonder melding (exit $code)}"
  fi
  printf '%s\n' "$uit" | sed -n 's/^.* waarschuwing: /  let op    /p'
done

echo
if [ "$BEZWAREN" -gt 0 ]; then
  echo "controleer-config: $BEZWAREN bezwaar/bezwaren, $OPEN nog in te vullen" >&2
  exit 1
fi
echo "controleer-config: geen bezwaren, $OPEN nog in te vullen"
exit 0
