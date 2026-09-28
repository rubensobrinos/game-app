# deploy/lib.sh — gedeelde functies voor start.sh, uitrollen-test.sh en release.sh.
#
# Wordt GESOURCED, niet uitgevoerd. Standaard: devkit ADR-0032, met aseso.co
# (producten/aseso/aseso_search/scripts/) als referentie.
#
# Exitcode 78 (EX_CONFIG) betekent overal hetzelfde: de configuratie wijst naar de
# verkeerde omgeving, of er ontbreekt iets. Luid falen, nooit stil de verkeerde data
# tonen. Er wordt nooit een waarde gelogd, alleen namen van variabelen en databases:
# een DATABASE_URL bevat een wachtwoord.

DEPLOY="$(cd "$(dirname "$0")" && pwd)"
OMGEVING_NAAM="$(basename "$0")"

# launchd geeft een kaal PATH mee (/usr/bin:/bin:/usr/sbin:/sbin). Achteraan
# toevoegen, zodat wat de aanroeper al vooraan zette blijft winnen.
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/share/fnm/aliases/default/bin:$HOME/.local/bin"
export PATH

weiger() {
  echo "$OMGEVING_NAAM WEIGERT: $*" >&2
  exit 78
}

# omgeving_laden <test|productie>
# Leest omgeving.conf en het env-bestand van die omgeving, en zet OMGEVING, POORT,
# DB_VERWACHT, OMGEVING_MAP, DIENST, PUBLIC_URL, PORT en HOST.
omgeving_laden() {
  OMGEVING="$1"
  OMGEVING_NAAM="$(basename "$0") ($OMGEVING)"
  [ -f "$DEPLOY/omgeving.conf" ] || weiger "$DEPLOY/omgeving.conf ontbreekt"
  # shellcheck disable=SC1091
  . "$DEPLOY/omgeving.conf"

  case "$OMGEVING" in
    test)
      POORT="$POORT_TEST"; DB_VERWACHT="$DB_TEST"; ENV_BESTAND="$ENV_TEST"
      OMGEVING_MAP="$TEST_WORKTREE"; PUBLIC_URL="https://test.$DOMEIN" ;;
    productie)
      POORT="$POORT_PRODUCTIE"; DB_VERWACHT="$DB_PRODUCTIE"; ENV_BESTAND="$ENV_PRODUCTIE"
      OMGEVING_MAP="$RELEASES/live"; PUBLIC_URL="https://$DOMEIN" ;;
    *)
      OMGEVING_NAAM="$(basename "$0")"
      weiger "eerste argument moet 'test' of 'productie' zijn, niet '$OMGEVING'" ;;
  esac
  DIENST="$LABEL.$OMGEVING"

  [ -f "$ENV_BESTAND" ] || weiger "env-bestand $ENV_BESTAND ontbreekt. Maak het aan (mag leeg zijn) met mode 600."
  case "$(stat -f %Lp "$ENV_BESTAND" 2>/dev/null || echo onbekend)" in
    600 | 400) ;;
    *) echo "$OMGEVING_NAAM waarschuwing: $ENV_BESTAND is niet mode 600 (chmod 600 \"$ENV_BESTAND\")" >&2 ;;
  esac
  set -a
  # shellcheck disable=SC1090
  . "$ENV_BESTAND"
  set +a

  # Na het env-bestand: omgeving.conf is de bron voor poort en adres, niet een
  # vergeten regel in een env-bestand.
  PORT="$POORT"; HOST="127.0.0.1"
  export OMGEVING PORT HOST PUBLIC_URL
}

# releases_pad_veilig — weigert (78) tenzij RELEASES een niet-leeg, absoluut pad
# is met minstens twee segmenten (dus nooit "", "/", of een relatief pad) ÉN onder
# de vaste basismap ligt die het sjabloon zelf voorschrijft: $HOME/releases/<naam>
# (devkit ADR-0035, reviewpunt 1 van de tweede review). Elke destructieve operatie
# in release.sh (rm -rf op .vorige.tmp, vorige, oude releasemappen) gaat hierachter:
# "set -u" alleen vangt een ONTBREKENDE variabele, geen LEGE (RELEASES="" is een
# geldige, gezette lege string en zou "rm -rf $RELEASES/vorige" laten resolven naar
# "rm -rf /vorige"). Zonder de basismap-eis zou RELEASES="$HOME" zelf de eerdere
# regel ook doorstaan (absoluut, twee-plus segmenten) en zou "rm -rf $RELEASES/vorige"
# de hele HOME-map raken via een pad dat toevallig "/vorige" erachter plakt — dat is
# geen hypothetisch geval: een leeg NAAM-sjabloonveld (RELEASES="$HOME/releases/")
# of een handmatige tikfout in omgeving.conf kan dit opleveren. Geen enkele "rm -rf"
# -regel in release.sh mag draaien voordat dit is aangeroepen.
releases_pad_veilig() {
  case "${RELEASES:-}" in
    "") weiger "RELEASES is leeg in omgeving.conf — destructieve releasestappen geweigerd" ;;
  esac
  case "$RELEASES" in
    /*/*) ;;  # absoluut pad, minstens twee segmenten (bv. /Users/x/releases/naam)
    *) weiger "RELEASES ('$RELEASES') is geen absoluut pad met minstens twee segmenten — destructieve releasestappen geweigerd" ;;
  esac
  [ "$RELEASES" != "/" ] || weiger "RELEASES mag niet '/' zijn — destructieve releasestappen geweigerd"
  [ -n "${HOME:-}" ] || weiger "HOME is niet gezet, kan RELEASES niet tegen de basismap controleren"
  [ "$RELEASES" != "$HOME" ] || weiger "RELEASES mag niet \$HOME zelf zijn ('$RELEASES') — destructieve releasestappen geweigerd"
  case "$RELEASES" in
    "$HOME"/*) ;;  # onder de vaste basismap, zoals het sjabloon voorschrijft ($HOME/releases/<naam>)
    *) weiger "RELEASES ('$RELEASES') ligt niet onder \$HOME — destructieve releasestappen geweigerd" ;;
  esac
}

# omgeving_eisen — weigert (78) als iets naar de verkeerde omgeving wijst.
omgeving_eisen() {
  [ -n "$POORT" ] || weiger "de poort voor $OMGEVING is leeg in omgeving.conf. Kies een vrije en schrijf hem in ~/dev/0. PORTS.md."

  # Elke DATABASE_URL* (ook _READ/_WRITE-varianten) moet naar de database van deze
  # omgeving wijzen. Alleen de databasenaam wordt genoemd, nooit de URL.
  _gevonden=""
  for _naam in $(env | sed -n 's/^\(DATABASE_URL[A-Z0-9_]*\)=.*/\1/p'); do
    eval "_url=\${$_naam}"
    _db="${_url##*/}"; _db="${_db%%\?*}"
    [ -n "$DB_VERWACHT" ] || weiger "$_naam is gezet, maar omgeving.conf zegt dat $OMGEVING geen database heeft"
    [ "$_db" = "$DB_VERWACHT" ] || weiger "$_naam wijst naar database '$_db', verwacht '$DB_VERWACHT'"
    _gevonden="ja"
  done
  if [ -n "$DB_VERWACHT" ] && [ -z "$_gevonden" ]; then
    weiger "geen DATABASE_URL in $ENV_BESTAND, terwijl omgeving.conf database '$DB_VERWACHT' verwacht. Zet DB_$(echo "$OMGEVING" | tr 'a-z' 'A-Z') leeg als de site geen database heeft."
  fi

  # Geen enkele variabele mag het adres van de ándere omgeving bevatten: een
  # PUBLIC_BASE_URL of API-adres dat naar productie wijst, maakt van test een
  # tweede productie. Alleen de namen van de variabelen worden gemeld.
  _domein_re="$(printf '%s' "$DOMEIN" | sed 's/\./\\./g')"
  if [ "$OMGEVING" = "test" ]; then
    _verboden="://(www\\.)?${_domein_re}([/:\"']|\$)"
  else
    _verboden="://test\\.${_domein_re}([/:\"']|\$)"
  fi
  _fout="$(env | grep -E "^[A-Za-z_][A-Za-z0-9_]*=.*${_verboden}" | cut -d= -f1 | tr '\n' ' ')"
  [ -z "$_fout" ] || weiger "deze variabelen wijzen naar de andere omgeving: $_fout"

  # De eigen eis van deze site (EIS_TEST / EIS_PRODUCTIE in omgeving.conf), bijvoorbeeld
  # dat sms op test nooit echt verstuurd wordt. Gemeld wordt de voorwaarde, geen waarde.
  if [ "$OMGEVING" = "test" ]; then _eis="${EIS_TEST:-}"; else _eis="${EIS_PRODUCTIE:-}"; fi
  if [ -n "$_eis" ] && ! eval "$_eis"; then
    weiger "de eis uit omgeving.conf is niet gehaald: $_eis"
  fi

  unset _gevonden _naam _url _db _domein_re _verboden _fout _eis
}

# rookproef <poort> — elk pad in ROOKPROEF_PADEN moet binnen ROOKPROEF_WACHTEN s 200 geven.
rookproef() {
  for _pad in $ROOKPROEF_PADEN; do
    _i=0
    until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$1$_pad")" = 200 ]; do
      _i=$((_i + 1))
      [ "$_i" -lt "${ROOKPROEF_WACHTEN:-30}" ] || { echo "rookproef: http://127.0.0.1:$1$_pad geeft geen 200" >&2; return 1; }
      sleep 1
    done
  done
  echo "rookproef: $ROOKPROEF_PADEN op :$1 geven 200"
}

# herstarten <launchd-label> — start de dienst (opnieuw), ook als hij nog niet draaide.
herstarten() {
  launchctl kickstart -k "gui/$(id -u)/$1"
}

# herstel_onderbroken_wissel — maakt een wissel_naar af die halverwege werd
# onderbroken (procesdood tussen twee mv's, devkit ADR-0035). Wordt bij elke
# release.sh-start aangeroepen, VOOR een nieuwe wissel: "live" ontbreekt dan
# kortstondig (het gat tussen twee rename(2)-aanroepen, geen atomaire
# directory-swap bestaat in POSIX voor twee niet-lege mappen), maar
# ".vorige.tmp" bestaat nog altijd en bevat de vorige "live". Dit zet dat terug,
# zodat "live" nooit langer ontbreekt dan de duur van één voltooide wissel_naar.
herstel_onderbroken_wissel() {
  releases_pad_veilig
  if [ ! -d "$RELEASES/live" ] && [ -d "$RELEASES/.vorige.tmp" ]; then
    echo "$OMGEVING_NAAM: onderbroken wissel gevonden (live ontbrak, .vorige.tmp aanwezig) — hersteld" >&2
    mv "$RELEASES/.vorige.tmp" "$RELEASES/live"
  fi
}

# volgende_release_tag — eerstvolgende YYYY-MM-DD.N voor vandaag, in deze repo (ADR-0035).
volgende_release_tag() {
  _vandaag="$(date -u +%Y-%m-%d)"
  _hoogste=0
  for _t in $(git -C "$REPO" tag --list "$_vandaag.*"); do
    _n="${_t#"$_vandaag".}"
    case "$_n" in *[!0-9]*) continue ;; esac
    [ "$_n" -gt "$_hoogste" ] && _hoogste="$_n"
  done
  echo "$_vandaag.$((_hoogste + 1))"
}

# log_release <tag-of-null> <commit> <uitslag> <vorige_tag-of-null> <reden-of-null>
# Schrijft één regel naar RELEASES_LOG (devkit ADR-0035, devkit/data/release.schema.json).
# "null" (de letterlijke tekst) betekent hier een JSON-null, niet de string "null".
log_release() {
  [ -n "${RELEASES_LOG:-}" ] || weiger "RELEASES_LOG is niet gezet in omgeving.conf"
  _tag_json="null"; [ "$1" = "null" ] || _tag_json="\"$1\""
  _vorige_json="null"; [ "$4" = "null" ] || _vorige_json="\"$4\""
  _reden_json="null"
  if [ "$5" != "null" ]; then
    _reden_json="\"$(printf '%s' "$5" | sed 's/\\/\\\\/g; s/"/\\"/g')\""
  fi
  _wie="$(git config user.email 2>/dev/null || true)"; [ -n "$_wie" ] || _wie="${USER:-onbekend}"
  mkdir -p "$(dirname "$RELEASES_LOG")"
  printf '{"tijdstip":"%s","site":"%s","tag":%s,"commit":"%s","wie":"%s","uitslag":"%s","vorige_tag":%s,"reden":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${RELEASE_SITENAAM:-$DOMEIN}" "$_tag_json" "$2" "$_wie" "$3" "$_vorige_json" "$_reden_json" \
    >> "$RELEASES_LOG"
  unset _tag_json _vorige_json _reden_json _wie
}
