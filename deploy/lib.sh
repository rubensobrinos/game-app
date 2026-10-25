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

# ci_poort <sha> — een release gaat alleen door met een groene devkit-ci-regel voor precies deze sha (devkit ADR-0035 regel 1, amendement 05-10).
# Vraagt het aan `devkit release-site --alleen-poort --meet` (leest runs.jsonl en poort.jsonl; heeft de sha nog geen meting, dan meet het die zelf in een schone
# kopie, per pakket bij een monorepo, in plaats van op de uurronde te wachten, kaart #103119; logt rood-voor-release bij een weigering).
# Onbekend is niet groen: staat `devkit` niet op het PATH, dan weigert dit script ook.
ci_poort() {
  _cp_begin=$(date +%s)
  _devkit="$(command -v devkit 2>/dev/null || true)"
  if [ -z "$_devkit" ]; then
    telemetrie_stap poort "$_cp_begin" rood "$1" "devkit niet op PATH"
    weiger "devkit staat niet op het PATH: kan niet vaststellen of $1 een groene CI-regel heeft (onbekend is niet groen)"
  fi
  if "$_devkit" release-site "$REPO" "$1" --alleen-poort --meet >&2; then
    telemetrie_stap poort "$_cp_begin" ok "$1"
  else
    telemetrie_stap poort "$_cp_begin" rood "$1" "geen groene devkit-ci-regel"
    weiger "geen groene devkit-ci-regel voor $1: draai 'devkit ci' op deze commit en probeer opnieuw"
  fi
  unset _devkit _cp_begin
}

# droog_plan <sha> <kort> <wat> — voor `release.sh --droog`: toont wat er zou gebeuren en de stand van de ci-poort, en stopt. Schrijft, bouwt,
# wisselt, herstart, tagt en logt niets. Exit 0: een echte release zou doorgaan; exit 1: de ci-poort zou weigeren.
droog_plan() {
  echo "DROOG ($OMGEVING_NAAM): niets wordt gebouwd, omgewisseld, herstart, getagd of gelogd"
  echo "  doel      $DOMEIN"
  echo "  commit    $2 ($1)"
  echo "  plan      $3"
  _devkit="$(command -v devkit 2>/dev/null || true)"
  if [ -z "$_devkit" ]; then
    echo "  ci-poort  ONBEKEND: devkit staat niet op het PATH (onbekend is niet groen: een echte release weigert)" >&2
    exit 1
  fi
  if "$_devkit" release-site "$REPO" "$1" --alleen-poort >/dev/null 2>&1; then
    echo "  ci-poort  groen: een echte release zou doorgaan"
    exit 0
  fi
  echo "  ci-poort  ROOD: geen groene devkit-ci-regel voor $2; een echte release weigert (draai 'devkit ci' op deze commit)" >&2
  exit 1
}

# omgeving_laden <test|productie>
# Leest omgeving.conf en het env-bestand van die omgeving, en zet OMGEVING, POORT,
# DB_VERWACHT, OMGEVING_MAP, DIENST, PUBLIC_URL, PORT en HOST. Voor test is
# PUBLIC_URL_TEST in omgeving.conf optioneel: leeg of niet gezet betekent
# https://test.$DOMEIN, een andere testhost staat daar (kaart #101181).
omgeving_laden() {
  OMGEVING="$1"
  OMGEVING_NAAM="$(basename "$0") ($OMGEVING)"
  [ -f "$DEPLOY/omgeving.conf" ] || weiger "$DEPLOY/omgeving.conf ontbreekt"
  # shellcheck disable=SC1091
  . "$DEPLOY/omgeving.conf"
  # Het adres van de Beelink staat op één plek: devkit data/beelink.env (BEELINK_HOST=...). Dat bestand wint van een eigen BEELINK_HOST in
  # omgeving.conf, zodat een nieuw adres één wijziging is. DEVKIT_BEELINK_ENV wijst naar een ander bestand (tests).
  _bh_env="${DEVKIT_BEELINK_ENV:-$HOME/dev/platform/devkit/data/beelink.env}"
  # shellcheck disable=SC1090
  [ -f "$_bh_env" ] && . "$_bh_env"

  case "$OMGEVING" in
    test)
      POORT="$POORT_TEST"; DB_VERWACHT="$DB_TEST"; ENV_BESTAND="$ENV_TEST"
      OMGEVING_MAP="$TEST_WORKTREE"
      # Niet elke testomgeving staat op test.<domein>: cobri-academy draait op
      # academy-test.cobrigroup.com en kreeg daardoor na elke uitrol een valse
      # noindex-waarschuwing (kaart #101181). PUBLIC_URL_TEST in omgeving.conf is
      # optioneel; leeg of niet gezet betekent de standaard, en een afsluitende /
      # mag (het adres wordt met "/" erachter opgevraagd in uitrollen-test.sh).
      # Staat hier het adres van productie, dan weigert omgeving_eisen dat zo.
      PUBLIC_URL="${PUBLIC_URL_TEST:-https://test.$DOMEIN}"
      PUBLIC_URL="${PUBLIC_URL%/}" ;;
    productie)
      POORT="$POORT_PRODUCTIE"; DB_VERWACHT="$DB_PRODUCTIE"; ENV_BESTAND="$ENV_PRODUCTIE"
      OMGEVING_MAP="$RELEASES/live"; PUBLIC_URL="https://$DOMEIN" ;;
    *)
      OMGEVING_NAAM="$(basename "$0")"
      weiger "eerste argument moet 'test' of 'productie' zijn, niet '$OMGEVING'" ;;
  esac
  DIENST="$LABEL.$OMGEVING"

  # Een remote compose-stack (COMPOSE_HOST, devkit ADR-0093) heeft zijn geheimen op die host (COMPOSE_HOST_MAP/.env): lokaal is voor
  # productie geen env-bestand nodig, en er wordt er ook geen gelezen.
  if [ "$OMGEVING" = productie ] && compose_remote; then
    ENV_BESTAND=""
  else
    [ -f "$ENV_BESTAND" ] || weiger "env-bestand $ENV_BESTAND ontbreekt. Maak het aan (mag leeg zijn) met mode 600."
    case "$(stat -f %Lp "$ENV_BESTAND" 2>/dev/null || echo onbekend)" in
      600 | 400) ;;
      *) echo "$OMGEVING_NAAM waarschuwing: $ENV_BESTAND is niet mode 600 (chmod 600 \"$ENV_BESTAND\")" >&2 ;;
    esac
    set -a
    # shellcheck disable=SC1090
    . "$ENV_BESTAND"
    set +a
  fi

  # Na het env-bestand: omgeving.conf is de bron voor poort en adres, niet een
  # vergeten regel in een env-bestand.
  PORT="$POORT"; HOST="127.0.0.1"
  export OMGEVING PORT HOST PUBLIC_URL
}

# releases_pad_veilig — weigert (78) tenzij RELEASES een niet-leeg, absoluut pad
# is met minstens twee segmenten (dus nooit "", "/", of een relatief pad) ÉN onder
# de vaste basismap ligt die het sjabloon zelf voorschrijft: $HOME/.devkit/sites/<naam>/productie
# (devkit ADR-0035, reviewpunt 1 van de tweede review; pad bijgewerkt door ADR-0038 —
# deze functie hoefde zelf niet te veranderen, de nieuwe basismap voldeed al aan alle
# checks hieronder). Elke destructieve operatie
# in release.sh (rm -rf op .vorige.tmp, vorige, oude releasemappen) gaat hierachter:
# "set -u" alleen vangt een ONTBREKENDE variabele, geen LEGE (RELEASES="" is een
# geldige, gezette lege string en zou "rm -rf $RELEASES/vorige" laten resolven naar
# "rm -rf /vorige"). Zonder de basismap-eis zou RELEASES="$HOME" zelf de eerdere
# regel ook doorstaan (absoluut, twee-plus segmenten) en zou "rm -rf $RELEASES/vorige"
# de hele HOME-map raken via een pad dat toevallig "/vorige" erachter plakt — dat is
# geen hypothetisch geval: een leeg NAAM-sjabloonveld (RELEASES="$HOME/.devkit/sites//productie")
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
    "$HOME"/*) ;;  # onder de vaste basismap, zoals het sjabloon voorschrijft ($HOME/.devkit/sites/<naam>/productie, ADR-0038)
    *) weiger "RELEASES ('$RELEASES') ligt niet onder \$HOME — destructieve releasestappen geweigerd" ;;
  esac
}

# omgeving_eisen — weigert (78) als iets naar de verkeerde omgeving wijst.
#
# POORT_PRODUCTIE mag leeg zijn bij RELEASE_VORM="compose" (devkit ADR-0037):
# zo'n site heeft geen vast, door start.sh beheerd proces op één poort — de
# rookproef gebruikt dan COMPOSE_ROOKPROEF_POORT, gecontroleerd in
# release_compose() zelf, niet hier. Voor "test" en voor "mappen" (het
# default/ADR-0035-pad) blijft de poort verplicht, ongewijzigd.
omgeving_eisen() {
  if [ "$OMGEVING" != "productie" ] || [ "${RELEASE_VORM:-mappen}" != "compose" ]; then
    [ -n "$POORT" ] || weiger "de poort voor $OMGEVING is leeg in omgeving.conf. Kies een vrije met 'devkit claim poort vrij' en claim hem met 'devkit claim poort claim' (poortregister)."
  fi

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

# rookproef <poort> [host] — elk pad in ROOKPROEF_PADEN moet binnen ROOKPROEF_WACHTEN s 200 geven (host: standaard 127.0.0.1, de Beelink voor TEST_OP_BEELINK).
rookproef() {
  _host="${2:-127.0.0.1}"
  for _pad in $ROOKPROEF_PADEN; do
    _i=0
    until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$_host:$1$_pad")" = 200 ]; do
      _i=$((_i + 1))
      [ "$_i" -lt "${ROOKPROEF_WACHTEN:-30}" ] || { echo "rookproef: http://$_host:$1$_pad geeft geen 200" >&2; return 1; }
      sleep 1
    done
  done
  echo "rookproef: $ROOKPROEF_PADEN op $_host:$1 geven 200"
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

# compose_dc <werkmap> <extra argumenten...> — docker compose met -p en -f uit
# omgeving.conf, vanuit <werkmap>: COMPOSE_BESTANDEN zijn paden relatief aan de
# repo-root (zoals de build-context in een Dockerfile ook is), en zonder een
# expliciete cd zoekt `docker compose` ze op in de cwd van het AANROEPENDE proces
# — bij release.sh is dat niet gegarandeerd de repo-root (bv. launchd start het
# vanuit een andere map). <werkmap> is de git-archive-checkout tijdens een build
# (COMPOSE_DIENSTEN.build) of $REPO voor commando's die geen bestanden lezen
# (up/ps/images): "docker compose up" met --no-build leest het compose-bestand
# ook, dus die heeft ook een geldige werkmap nodig, niet per se de checkout van
# DEZE release (een oude checkout is na een geslaagde release al opgeruimd).
compose_dc() {
  _dc_werkmap="$1"; shift
  [ -n "${COMPOSE_PROJECT:-}" ] || weiger "COMPOSE_PROJECT is leeg in omgeving.conf"
  [ -n "${COMPOSE_BESTANDEN:-}" ] || weiger "COMPOSE_BESTANDEN is leeg in omgeving.conf"
  _dc_bestanden=""
  for _b in $COMPOSE_BESTANDEN; do _dc_bestanden="$_dc_bestanden -f $_b"; done
  # shellcheck disable=SC2086
  (cd "$_dc_werkmap" && if compose_remote; then export DOCKER_HOST="ssh://$COMPOSE_HOST"; fi && docker compose -p "$COMPOSE_PROJECT" $_dc_bestanden "$@")
}

# --- Remote compose (devkit ADR-0093, aanvulling op ADR-0037) ---------------------------------------------------------------
# Draait de productie-stack op een andere host (COMPOSE_HOST in omgeving.conf, een ssh-alias zoals "beelink"), dan blijft de
# release.sh op deze Mac draaien: de image wordt gebouwd door de docker-daemon van die host (DOCKER_HOST=ssh://...), de stack
# wordt gestart vanuit COMPOSE_HOST_MAP op die host (daar staat het .env-bestand met de geheimen; dat verlaat die host nooit)
# en de rookproef loopt binnen het compose-netwerk van die host. Leeg COMPOSE_HOST = alles lokaal, zoals voor ADR-0093.

# compose_remote — waar (0) als de stack op een andere host draait.
compose_remote() {
  [ -n "${COMPOSE_HOST:-}" ]
}

# docker_x <docker-argumenten...> — docker op de plek waar de stack draait (lokaal, of de daemon van COMPOSE_HOST).
docker_x() {
  if compose_remote; then
    DOCKER_HOST="ssh://$COMPOSE_HOST" docker "$@"
  else
    docker "$@"
  fi
}

# ssh_x <commando> — één opdracht op COMPOSE_HOST. Nooit een wachtwoordvraag (BatchMode) en nooit eeuwig wachten.
ssh_x() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$COMPOSE_HOST" "$1"
}

# compose_remote_eisen — de velden voor een remote stack zijn gezet en bevatten geen tekens die een shell iets laten doen: ze gaan
# als tekst naar ssh. Een lokale stack heeft niets nodig.
compose_remote_eisen() {
  compose_remote || return 0
  case "$COMPOSE_HOST" in *[!A-Za-z0-9._@-]*) weiger "COMPOSE_HOST bevat een teken dat niet in een ssh-alias hoort (devkit ADR-0093)" ;; esac
  [ -n "${COMPOSE_HOST_MAP:-}" ] || weiger "COMPOSE_HOST_MAP is leeg in omgeving.conf, terwijl COMPOSE_HOST gezet is (devkit ADR-0093)"
  case "$COMPOSE_HOST_MAP" in *[!A-Za-z0-9._/-]*) weiger "COMPOSE_HOST_MAP bevat een teken dat niet in een pad hoort (devkit ADR-0093)" ;; esac
  # Zonder COMPOSE_ROOKPROEF_URL moet elk pad in ROOKPROEF_PADEN zelf een volledig adres zijn.
  if [ -z "${COMPOSE_ROOKPROEF_URL:-}" ]; then
    for _pad in ${ROOKPROEF_PADEN:-}; do
      case "$_pad" in http://* | https://*) ;; *) weiger "COMPOSE_ROOKPROEF_URL is leeg in omgeving.conf en het pad '$_pad' is geen volledig adres, terwijl COMPOSE_HOST gezet is (bv. http://web:8000)" ;; esac
    done
    [ -n "${ROOKPROEF_PADEN:-}" ] || weiger "COMPOSE_ROOKPROEF_URL en ROOKPROEF_PADEN zijn leeg in omgeving.conf, terwijl COMPOSE_HOST gezet is"
  else
    case "$COMPOSE_ROOKPROEF_URL" in http://* | https://*) ;; *) weiger "COMPOSE_ROOKPROEF_URL moet met http:// of https:// beginnen" ;; esac
    case "$COMPOSE_ROOKPROEF_URL" in *[!A-Za-z0-9._:/-]*) weiger "COMPOSE_ROOKPROEF_URL bevat een teken dat niet in een adres hoort" ;; esac
  fi
  case "${COMPOSE_BESTANDEN:-}" in *[!A-Za-z0-9._/\ -]*) weiger "COMPOSE_BESTANDEN bevat een teken dat niet in een bestandsnaam hoort (devkit ADR-0094)" ;; esac
  case "${ROOKPROEF_PADEN:-}" in *[!A-Za-z0-9._:/\ -]*) weiger "ROOKPROEF_PADEN bevat een teken dat niet in een pad of adres hoort" ;; esac
  case "${COMPOSE_IMAGES:-}" in *[!A-Za-z0-9._:/=\ -]*) weiger "COMPOSE_IMAGES bevat een teken dat niet in 'dienst=naam:tag' hoort" ;; esac
}

# compose_sync <checkout> <sha> — zet de compose-bestanden van deze release en een .release-sha in COMPOSE_HOST_MAP, zodat de stack
# daar met de definitie van deze release start. Alleen COMPOSE_BESTANDEN: het .env-bestand en de volumes blijven staan waar ze staan.
compose_sync() {
  compose_remote || return 0
  # shellcheck disable=SC2086
  (cd "$1" && tar -cf - $COMPOSE_BESTANDEN) | ssh -o BatchMode=yes -o ConnectTimeout=10 "$COMPOSE_HOST" \
    "mkdir -p '$COMPOSE_HOST_MAP' && cd '$COMPOSE_HOST_MAP' && tar -xf - && printf '%s\n' '$2' > .release-sha"
}

# compose_drift_controle <vorige-sha> — de compose-bestanden op de host zijn nog precies die van de vorige release (devkit ADR-0094).
# Een hand-wijziging op de host (bv. een extra netwerk, zonder commit) wordt door compose_sync stil overschreven: 18-10 verloor aseso.co zo zijn
# netwerk en lag 22 uur eruit. Daarom vergelijkt dit de COMPOSE_BESTANDEN op de host met `git show <vorige-sha>:<bestand>` en weigert bij elk
# verschil. Env-bestanden (.env, *.env: de geheimen) worden nooit gelezen. Geen baseline = niets te vergelijken en dus geen weigering: een
# lokale stack, een eerste release (vorige-sha "null"), of een host zonder .release-sha. Een bestand dat op de host niet te lezen is, telt als
# verschil (onbekend is niet gelijk). COMPOSE_DRIFT_TOESTAAN=1 slaat de controle bewust over (met een melding); dat is een besluit van Ruben.
# Exit 0 = door, 1 = drift (de verschillen staan op stderr).
compose_drift_controle() {
  compose_remote || return 0
  [ "$1" != "null" ] || return 0
  if [ "${COMPOSE_DRIFT_TOESTAAN:-}" = "1" ]; then
    echo "LET OP: COMPOSE_DRIFT_TOESTAAN=1, de compose op $COMPOSE_HOST is niet vergeleken met de vorige release" >&2
    return 0
  fi
  _cdc_baseline="$(ssh_x "cat '$COMPOSE_HOST_MAP/.release-sha'" 2>/dev/null || true)"
  [ -n "$_cdc_baseline" ] || { echo "compose-drift: $COMPOSE_HOST_MAP heeft nog geen .release-sha, niets om mee te vergelijken" >&2; return 0; }
  _cdc_tmp="$(mktemp -d "${TMPDIR:-/tmp}/devkit-compose-drift.XXXXXX")"
  _cdc_drift=""
  for _cdc_bestand in $COMPOSE_BESTANDEN; do
    case "${_cdc_bestand##*/}" in .env | .env.* | *.env) continue ;; esac
    # Zat het bestand niet in de vorige release, dan is er niets om mee te vergelijken.
    git -C "$REPO" show "$1:$_cdc_bestand" > "$_cdc_tmp/git" 2>/dev/null || continue
    if ! ssh_x "cat '$COMPOSE_HOST_MAP/$_cdc_bestand'" > "$_cdc_tmp/host" 2>/dev/null || ! cmp -s "$_cdc_tmp/git" "$_cdc_tmp/host"; then
      _cdc_drift="$_cdc_drift $_cdc_bestand"
    fi
  done
  rm -rf "$_cdc_tmp"
  [ -z "$_cdc_drift" ] && return 0
  echo "compose-drift: op $COMPOSE_HOST (map $COMPOSE_HOST_MAP) wijkt af van de vorige release ($1) of is niet te lezen:$_cdc_drift" >&2
  echo "  Zet de wijziging in git (en release die), of haal hem van de host. Bewust overslaan: COMPOSE_DRIFT_TOESTAAN=1." >&2
  return 1
}

# compose_terugzetten <vorige-sha> — bij een terugrol ook de compose-bestanden van de vorige release terug op de host, niet alleen de images:
# anders start `up --no-build` het vorige image onder de compose van de mislukte release (devkit ADR-0094). Zonder vorige sha, of als een
# bestand niet in de vorige release zat, is er niets om terug te zetten: dat is een melding, geen fout.
compose_terugzetten() {
  compose_remote || return 0
  [ "$1" != "null" ] || return 0
  _ct_tmp="$(mktemp -d "${TMPDIR:-/tmp}/devkit-compose-terug.XXXXXX")"
  # shellcheck disable=SC2086
  if ! git -C "$REPO" archive "$1" $COMPOSE_BESTANDEN 2>/dev/null | tar -x -C "$_ct_tmp" 2>/dev/null; then
    rm -rf "$_ct_tmp"
    echo "LET OP: de compose-bestanden van $1 zijn niet uit git te halen; de compose op $COMPOSE_HOST blijft die van de mislukte release" >&2
    return 1
  fi
  if ! compose_sync "$_ct_tmp" "$1"; then
    rm -rf "$_ct_tmp"
    echo "LET OP: de compose-bestanden van $1 terugzetten op $COMPOSE_HOST faalde" >&2
    return 1
  fi
  rm -rf "$_ct_tmp"
  echo "compose-bestanden van $1 teruggezet op $COMPOSE_HOST" >&2
}

# compose_up <argumenten...> — `docker compose up -d --no-deps <argumenten>`: lokaal vanuit $REPO, remote vanuit COMPOSE_HOST_MAP.
compose_up() {
  if ! compose_remote; then
    compose_dc "$REPO" up -d --no-deps "$@"
    return
  fi
  _cu_bestanden=""
  for _b in $COMPOSE_BESTANDEN; do _cu_bestanden="$_cu_bestanden -f $_b"; done
  ssh_x "cd '$COMPOSE_HOST_MAP' && docker compose -p '$COMPOSE_PROJECT' $_cu_bestanden up -d --no-deps $*"
}

# rookproef_compose — de rookproef van een compose-release: lokaal op 127.0.0.1:COMPOSE_ROOKPROEF_POORT, remote binnen het
# compose-netwerk van COMPOSE_HOST (COMPOSE_ROOKPROEF_URL, bv. http://web:8000). Elk pad in ROOKPROEF_PADEN moet binnen
# ROOKPROEF_WACHTEN seconden slagen. Remote is "slagen" wat wget (busybox) een succes noemt: een 2xx na eventuele redirects.
rookproef_compose() {
  if ! compose_remote; then
    rookproef "$COMPOSE_ROOKPROEF_POORT"
    return
  fi
  for _pad in $ROOKPROEF_PADEN; do
    # Een pad dat met http:// of https:// begint is een volledig adres binnen het netwerk (bv. een api én een site); anders hoort het
    # bij COMPOSE_ROOKPROEF_URL.
    case "$_pad" in http://* | https://*) _url="$_pad" ;; *) _url="$COMPOSE_ROOKPROEF_URL$_pad" ;; esac
    _i=0
    until ssh_x "docker run --rm --network '${COMPOSE_PROJECT}_default' alpine wget -q -T 5 -O /dev/null '$_url'" >/dev/null 2>&1; do
      _i=$((_i + 1))
      [ "$_i" -lt "${ROOKPROEF_WACHTEN:-30}" ] || { echo "rookproef: $_url op $COMPOSE_HOST geeft geen succes" >&2; return 1; }
      sleep 1
    done
  done
  echo "rookproef: $ROOKPROEF_PADEN${COMPOSE_ROOKPROEF_URL:+ op $COMPOSE_ROOKPROEF_URL} (via $COMPOSE_HOST) geven succes"
}

# compose_image_ref <dienst> — de image (naam:tag) waarmee de stack deze dienst draait. Standaard de naam die compose zelf geeft
# (<project>-<dienst>:latest). Zet de compose-file een eigen `image:` (bv. aseso-search-api:productie), dan staat die in COMPOSE_IMAGES
# als "dienst=naam:tag" (spatie-gescheiden): daarop werken beschermen, taggen en terugrollen dan. (devkit ADR-0093)
compose_image_ref() {
  for _ci_paar in ${COMPOSE_IMAGES:-}; do
    if [ "${_ci_paar%%=*}" = "$1" ]; then
      printf '%s\n' "${_ci_paar#*=}"
      return
    fi
  done
  printf '%s\n' "${COMPOSE_PROJECT}-$1:latest"
}

# migratie_gedetecteerd <vorige-sha> <nieuwe-sha> — waar (0) als MIGRATIE_PAD
# wijzigde tussen de twee commits (devkit ADR-0037, punt 6). Leeg MIGRATIE_PAD of
# een ontbrekende vorige-sha (eerste release ooit, niets om mee te vergelijken)
# betekent altijd "geen migratie" (1) — er is dan niets om tegen te vergelijken.
migratie_gedetecteerd() {
  [ -n "${MIGRATIE_PAD:-}" ] || return 1
  [ "$1" != "null" ] || return 1
  git -C "$REPO" diff --name-only "$1" "$2" -- "$MIGRATIE_PAD" 2>/dev/null | grep -q .
}

# migraties_toepassen <werkmap> <vorige-sha> <nieuwe-sha> — past migraties toe vóór de
# herstart, voor het mappen-pad van release.sh (devkit ADR-0098; de compose-variant
# verwerkt migraties zelf, via de container-entrypoint, en blijft bij de detectie in
# release_compose() hierboven).
#
# Geen wijziging onder MIGRATIE_PAD: niets te doen (0), ook als MIGRATIE_CMD leeg is —
# bestaande sites zonder migraties blijven zo ongewijzigd werken.
#
# Wél een wijziging:
#   - MIGRATIE_CMD leeg: geeft 1 terug (geen weiger: $NIEUW bestaat dan al en de aanroeper
#     moet die nog opruimen en loggen, net als bij een mislukte ledger/backup/toepassen
#     hieronder) — onbekend is niet veilig, nooit stilzwijgend de oude database onder de
#     nieuwe code laten staan.
#   - MIGRATIE_CMD gezet: eerst "$MIGRATIE_CMD ledger" (dry-run, schrijft niets; de regels
#     op stdout zijn de nog openstaande migraties, hooguit namen/nummers — devkit logt of
#     toont nooit de inhoud). Leeg = niets open (bijvoorbeeld al met de hand toegepast) en
#     deze functie keert terug zonder iets te doen. Staat er iets open, dan "$MIGRATIE_CMD
#     backup" (vóór enige schrijfactie) en pas daarna "$MIGRATIE_CMD toepassen".
# Alle drie draaien in <werkmap>: de git-archive-checkout van de NIEUWE release (die heeft
# de nieuwe migratiebestanden), met de env van deze omgeving al geladen (omgeving_laden).
#
# Faalt ledger, backup of toepassen, dan geeft dit 1 terug (geen weiger: dat is geen
# configuratiefout maar een mislukte release) en logt/stopt de AANROEPER, net als bij
# "bouwen faalde" — er wordt nooit automatisch teruggerold op een migratie: het schema kan
# al half gewijzigd zijn, en oude code op een nieuw schema is zelden veilig (zelfde
# redenatie als release_compose() voor de compose-variant).
migraties_toepassen() {
  _mt_werkmap="$1"; _mt_vorige_sha="$2"; _mt_sha="$3"
  migratie_gedetecteerd "$_mt_vorige_sha" "$_mt_sha" || return 0
  if [ -z "${MIGRATIE_CMD:-}" ]; then
    echo "AFGEBROKEN: migratiewijziging gedetecteerd in $MIGRATIE_PAD ($_mt_vorige_sha..$_mt_sha), maar MIGRATIE_CMD is leeg in omgeving.conf — onbekend is niet veilig." >&2
    return 1
  fi

  echo "migraties: ledger-check (dry-run, '$MIGRATIE_CMD ledger')"
  if ! _mt_open="$(cd "$_mt_werkmap" && /bin/sh -c "$MIGRATIE_CMD ledger")"; then
    echo "AFGEBROKEN: '$MIGRATIE_CMD ledger' faalde. Niets toegepast, productie niet aangeraakt." >&2
    return 1
  fi
  if [ -z "$_mt_open" ]; then
    echo "migraties: ledger zegt niets open, niets toe te passen"
    unset _mt_werkmap _mt_vorige_sha _mt_sha _mt_open
    return 0
  fi
  echo "migraties: open volgens het ledger:"
  printf '%s\n' "$_mt_open" | sed 's/^/  /'

  echo "migraties: back-up vooraf ('$MIGRATIE_CMD backup')"
  if ! (cd "$_mt_werkmap" && /bin/sh -c "$MIGRATIE_CMD backup"); then
    echo "AFGEBROKEN: '$MIGRATIE_CMD backup' faalde. Niets toegepast, productie niet aangeraakt." >&2
    return 1
  fi

  echo "migraties: toepassen ('$MIGRATIE_CMD toepassen')"
  if ! (cd "$_mt_werkmap" && /bin/sh -c "$MIGRATIE_CMD toepassen"); then
    echo "AFGEBROKEN: '$MIGRATIE_CMD toepassen' faalde NA een gelukte back-up. Database mogelijk half gewijzigd; met de hand verder, geen automatische terugrol." >&2
    return 1
  fi
  echo "migraties: toegepast"
  unset _mt_werkmap _mt_vorige_sha _mt_sha _mt_open
}

# release_compose <ref-sha> <kort-sha> <vorige-tag-of-null> — de compose-variant
# van wissel_naar()+rookproef+taggen uit release.sh (devkit ADR-0037). Geen
# live/vorige-mappen: bouwt en herstart alleen COMPOSE_DIENSTEN (--no-deps,
# postgres/redis/caddy e.d. worden nooit geraakt). Roept zelf log_release aan en
# exit't, net als release.sh's hoofdpad: dit vervangt dat hele pad, niet een los
# stuk ervan.
#
# GIT ARCHIVE, ZELFDE GARANTIE ALS HET MAPPEN-PAD: gebouwd wordt vanuit een verse
# `git archive <sha> | tar -x`-checkout in een tijdelijke map, niet vanuit $REPO
# (de werkboom) zelf — anders zou ongecommit werk kunnen meeliften in het image,
# precies wat ADR-0035 voor het mappen-pad al uitsluit. Commando's die geen
# bestanden lezen (up/ps/images op al gebouwde images) draaien gewoon vanuit
# $REPO, dat heeft altijd de compose-bestanden staan.
#
# IMAGE-BESCHERMING, EXACTE VOLGORDE (bewezen met een lokale docker compose-test,
# zie de kaart-inventaris): `docker compose build` OVERSCHRIJFT het `:latest`-tag
# van dezelfde naam. Zonder een los tag op het OUDE image vóór die build, is het
# oude image na de build "dangling" (geen tag meer) en kan er niets meer naar
# teruggerold worden — een `docker inspect`-ID onthouden is dan NUTTELOOS, want
# het image zelf kan intussen zijn opgeruimd. Daarom:
#   1. VOOR de build: elke dienst in COMPOSE_DIENSTEN krijgt zijn NU draaiende
#      image een tijdelijke, eigen tag (":release-vorig") — dat beschermt het
#      tegen overschrijven/pruning door de build in stap 2, ongeacht wat daarna
#      met :latest gebeurt.
#   2. compose build (alle COMPOSE_DIENSTEN in één aanroep, vanuit de
#      git-archive-checkout) — overschrijft :latest per dienst, laat elke
#      :release-vorig intact (aparte tag, telt niet als "unused").
#   3. compose up -d --no-deps (alle COMPOSE_DIENSTEN in één aanroep) —
#      vervangt elke container.
#   4. rookproef groen: elke dienst krijgt tag YYYY-MM-DD.N + :<tag> + :<sha>
#      op zijn NIEUWE image (nu veilig, de vorige stand staat nog apart als
#      :release-vorig).
#      rookproef rood: per dienst `docker tag :release-vorig :latest` + één
#      gezamenlijke `up -d --no-build` — dat is de terugrol, ZELFDE tag-truc
#      in omgekeerde richting.
#
# MEERDERE DIENSTEN (kaart #100796): COMPOSE_DIENSTEN is een spatiegescheiden
# lijst — elke dienst met een eigen build:-directive krijgt zijn EIGEN
# _rc_naam ("${COMPOSE_PROJECT}-${dienst}") en dus zijn eigen :release-vorig/
# :<tag>/:<sha>, onafhankelijk beschermd en onafhankelijk teruggerold. Vóór
# deze kaart gebruikte de hele functie ÉÉN _rc_naam (afgeleid van alleen het
# EERSTE woord van COMPOSE_DIENSTEN) voor protect/tag/opruimen/terugrol — een
# tweede of derde dienst werd dan wél gebouwd en uitgerold (build/up -d nemen
# COMPOSE_DIENSTEN altijd al als geheel), maar kreeg NOOIT een eigen
# terugrolgarantie: bij een rode rookproef ging alleen de eerste dienst terug,
# de rest bleef op de kapotte build staan. Ontdekt bij rounda.io (#100796)
# toen frontend naast game-server aan COMPOSE_DIENSTEN werd toegevoegd.
release_compose() {
  _rc_sha="$1"; _rc_kort="$2"; _rc_vorige_tag="$3"
  [ -n "${COMPOSE_DIENSTEN:-}" ] || weiger "COMPOSE_DIENSTEN is leeg in omgeving.conf (devkit ADR-0037)"
  compose_remote_eisen
  compose_remote || [ -n "${COMPOSE_ROOKPROEF_POORT:-}" ] || weiger "COMPOSE_ROOKPROEF_POORT is leeg in omgeving.conf"

  # Vorige commit-SHA uit VORIGE_TAG (al door release.sh bepaald via git describe op
  # de laatst bekende release), niet uit een Docker-label: dat zou een LABEL-
  # instructie in elke Dockerfile vereisen, wat niet bij elke repo past.
  _rc_vorige_sha="null"
  if [ "$_rc_vorige_tag" != "null" ]; then
    _rc_vorige_sha="$(git -C "$REPO" rev-list -n1 "$_rc_vorige_tag" 2>/dev/null || true)"
    [ -n "$_rc_vorige_sha" ] || _rc_vorige_sha="null"
  fi

  _rc_migratie=""
  if migratie_gedetecteerd "$_rc_vorige_sha" "$_rc_sha"; then
    _rc_migratie=1
    echo "$OMGEVING_NAAM: migratie gedetecteerd in $MIGRATIE_PAD ($_rc_vorige_sha..$_rc_sha) — automatisch terugrollen wordt bij rood geweigerd" >&2
  fi

  _rc_build_begin=$(date +%s)
  if ! compose_drift_controle "$_rc_vorige_sha"; then
    telemetrie_stap build "$_rc_build_begin" rood "$_rc_sha" "compose op $COMPOSE_HOST wijkt af van de vorige release"
    echo "AFGEBROKEN: de compose op $COMPOSE_HOST is met de hand aangepast. Productie is niet aangeraakt." >&2
    log_release null "$_rc_sha" rood-voor-release "$_rc_vorige_tag" "compose op $COMPOSE_HOST wijkt af van de vorige release (hand-wijziging); niets gebouwd of gekopieerd"
    exit 1
  fi

  echo "[1/4] vorig image beschermen ($COMPOSE_DIENSTEN)"
  # Ruimtegescheiden lijst van "dienst:had_vorig" (1/0), zodat stap 4 hieronder
  # weet welke diensten ECHT al een :release-vorig hadden — een dienst zonder
  # eerder image (allereerste release) mag straks niet naar een niet-bestaand
  # :release-vorig proberen terug te rollen.
  _rc_had_vorig_lijst=""
  for _rc_dienst in $COMPOSE_DIENSTEN; do
    _rc_ref="$(compose_image_ref "$_rc_dienst")"; _rc_naam="${_rc_ref%:*}"
    _rc_huidig_id="$(docker_x images -q --filter "reference=$_rc_ref" | head -1)"
    if [ -n "$_rc_huidig_id" ]; then
      docker_x tag "$_rc_huidig_id" "$_rc_naam:release-vorig"
      _rc_had_vorig_lijst="$_rc_had_vorig_lijst $_rc_dienst:1"
    else
      _rc_had_vorig_lijst="$_rc_had_vorig_lijst $_rc_dienst:0"
    fi
  done

  echo "[2/4] $_rc_kort uitpakken en bouwen ($COMPOSE_DIENSTEN)"
  _rc_checkout="$(mktemp -d "${TMPDIR:-/tmp}/devkit-release-compose.XXXXXX")"
  git -C "$REPO" archive "$_rc_sha" | tar -x -C "$_rc_checkout"
  # shellcheck disable=SC2086
  if ! compose_dc "$_rc_checkout" build $COMPOSE_DIENSTEN; then
    rm -rf "$_rc_checkout"
    telemetrie_stap build "$_rc_build_begin" rood "$_rc_sha" "bouwen faalde"
    echo "AFGEBROKEN: bouwen faalde. Productie is niet aangeraakt." >&2
    log_release null "$_rc_sha" rood-voor-release "$_rc_vorige_tag" "bouwen faalde"
    exit 1
  fi
  if ! compose_sync "$_rc_checkout" "$_rc_sha"; then
    rm -rf "$_rc_checkout"
    telemetrie_stap build "$_rc_build_begin" rood "$_rc_sha" "compose-bestanden kopiëren naar $COMPOSE_HOST faalde"
    echo "AFGEBROKEN: de compose-bestanden naar $COMPOSE_HOST kopiëren faalde. De draaiende stack is niet aangeraakt." >&2
    log_release null "$_rc_sha" rood-voor-release "$_rc_vorige_tag" "compose-bestanden naar $COMPOSE_HOST kopiëren faalde"
    exit 1
  fi
  rm -rf "$_rc_checkout"
  telemetrie_stap build "$_rc_build_begin" ok "$_rc_sha"

  _rc_up_begin=$(date +%s)
  echo "[3/4] uitrollen ($COMPOSE_DIENSTEN, --no-deps)"
  # shellcheck disable=SC2086
  compose_up $COMPOSE_DIENSTEN
  telemetrie_stap compose_up "$_rc_up_begin" ok "$_rc_sha"

  _rc_health_begin=$(date +%s)
  echo "[4/4] rookproef"
  if rookproef_compose; then
    telemetrie_stap healthcheck "$_rc_health_begin" ok "$_rc_sha"
    _rc_tag="$(volgende_release_tag)"
    git -C "$REPO" tag -a "$_rc_tag" "$_rc_sha" -m "release $_rc_tag"
    for _rc_dienst in $COMPOSE_DIENSTEN; do
      _rc_ref="$(compose_image_ref "$_rc_dienst")"; _rc_naam="${_rc_ref%:*}"
      _rc_nieuw_id="$(docker_x images -q --filter "reference=$_rc_ref" | head -1)"
      [ -n "$_rc_nieuw_id" ] && docker_x tag "$_rc_nieuw_id" "$_rc_naam:$_rc_tag" 2>/dev/null || true
      [ -n "$_rc_nieuw_id" ] && docker_x tag "$_rc_nieuw_id" "$_rc_naam:$_rc_sha" 2>/dev/null || true
      # RELEASES_BEWAREN telt release-images (met een :YYYY-MM-DD.N-tag) PER
      # DIENST: oudere opruimen, :latest/:release-vorig/:<sha>-tags op dezelfde
      # ID's blijven gewoon bestaan (image rm faalt dan zacht, vandaar
      # "|| true"). De format-string wordt uit twee stukken opgebouwd, niet als
      # een aaneengesloten letterlijke tekst hieronder: dat zou Docker's eigen
      # Go-template-syntax zijn (geen devkit-sjabloonplaceholder), maar
      # devkit's eigen "is elke placeholder ingevuld"-test in de repo kan de
      # twee vormen niet uit elkaar houden.
      if [ -n "${RELEASES_BEWAREN:-}" ]; then
        _rc_fmt='{'; _rc_fmt="$_rc_fmt{.Tag}}"
        docker_x images --filter "reference=$_rc_naam" --format "$_rc_fmt" 2>/dev/null |
          grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$' | sort -r | tail -n +$((RELEASES_BEWAREN + 1)) |
          while read -r _rc_oud_tag; do docker_x image rm "$_rc_naam:$_rc_oud_tag" 2>/dev/null || true; done
      fi
    done
    echo "$DOMEIN draait op $_rc_tag ($_rc_kort, compose-project $COMPOSE_PROJECT)"
    log_release "$_rc_tag" "$_rc_sha" ok "$_rc_vorige_tag" null
    exit 0
  fi

  telemetrie_stap healthcheck "$_rc_health_begin" rood "$_rc_sha" "rookproef faalde"
  _rc_terugrol_begin=$(date +%s)

  # Terugrollen kan alleen ECHT voor de diensten die al een :release-vorig
  # hadden (_rc_had_vorig_lijst hierboven) — bij de allereerste release van
  # een nieuwe dienst is er niets om naar terug te gaan, die dienst blijft dan
  # op zijn (kapotte) eerste build staan, net als het mappen-pad zonder
  # $RELEASES/vorige.
  if [ -z "$_rc_migratie" ]; then
    _rc_had_er_een_vorig=""
    for _rc_paar in $_rc_had_vorig_lijst; do
      _rc_dienst="${_rc_paar%%:*}"; _rc_had="${_rc_paar##*:}"
      if [ "$_rc_had" = "1" ]; then
        _rc_ref="$(compose_image_ref "$_rc_dienst")"; _rc_naam="${_rc_ref%:*}"
        echo "TERUGROLLEN $_rc_dienst naar het vorige image ($_rc_naam:release-vorig)" >&2
        docker_x tag "$_rc_naam:release-vorig" "$_rc_ref"
        _rc_had_er_een_vorig=1
      else
        echo "$_rc_dienst had nog geen vorig image (eerste release) — blijft op de nieuwe build staan" >&2
      fi
    done
    if [ -n "$_rc_had_er_een_vorig" ]; then
      compose_terugzetten "$_rc_vorige_sha" || true
      # shellcheck disable=SC2086
      compose_up --no-build $COMPOSE_DIENSTEN
      if rookproef_compose; then
        telemetrie_stap terugrol "$_rc_terugrol_begin" ok "$_rc_vorige_sha"
        echo "vorige release draait weer" >&2
        log_release null "$_rc_vorige_sha" rood-na-uitrol-teruggerold "$_rc_vorige_tag" "rookproef faalde na uitrol van $_rc_kort; teruggerold"
        exit 1
      fi
      telemetrie_stap terugrol "$_rc_terugrol_begin" rood "$_rc_sha" "ook de vorige release komt niet op"
      echo "ook de vorige release komt niet op; $DOMEIN ligt eruit" >&2
      log_release null "$_rc_sha" rood-na-uitrol-teruggerold "$_rc_vorige_tag" "rookproef faalde na uitrol van $_rc_kort, en ook na terugrollen"
      exit 2
    fi
  fi

  if [ -n "$_rc_migratie" ]; then
    telemetrie_stap terugrol "$_rc_terugrol_begin" afgebroken "$_rc_sha" "migratie gedetecteerd, automatisch terugrollen geweigerd"
    echo "MIGRATIE GEDETECTEERD: automatisch terugrollen geweigerd, handmatig beslissen" >&2
    log_release null "$_rc_sha" rood-na-uitrol-teruggerold "$_rc_vorige_tag" \
      "MIGRATIE GEDETECTEERD: automatisch terugrollen geweigerd, handmatig beslissen (rookproef faalde na $_rc_kort)"
    exit 2
  fi

  telemetrie_stap terugrol "$_rc_terugrol_begin" rood "$_rc_sha" "geen vorig image om op terug te vallen"
  echo "rookproef faalde en er is geen vorig image om naar terug te gaan" >&2
  log_release null "$_rc_sha" rood-na-uitrol-teruggerold "$_rc_vorige_tag" "rookproef faalde; geen vorig image om op terug te vallen"
  exit 2
}

# foutregel_zonder_geheimen <tekst> — de laatste 20 regels van <tekst>, met credentials in een URL
# (://gebruiker:wachtwoord@) en de waarde van een regel die op een geheime naam lijkt (KEY/SECRET/TOKEN/
# PASSWORD/PASSWD, hoofdletterongevoelig, zoals NAAM=waarde of NAAM: waarde) vervangen door ***. Devkit kaart
# #103643: een foutregel in stappen.jsonl mag nooit een geheim lekken, ook niet via de ruwe uitvoer van een
# gefaald bouw- of rookproefcommando (anders dan log_release hierboven, die nooit meer dan een vaste tekst
# krijgt — dit krijgt echte procesuitvoer).
foutregel_zonder_geheimen() {
  printf '%s' "$1" | sed -E \
    -e 's#://[^/@[:space:]]*:[^/@[:space:]]*@#://***@#g' \
    -e 's/^([A-Za-z_][A-Za-z0-9_]*(KEY|SECRET|TOKEN|PASSW(OR)?D)[A-Za-z0-9_]*)[=:].*/\1=***/I' |
    tail -20
}

# telemetrie_stap <stap> <gestart-epoch> <uitkomst> <sha> [foutregel] — devkit kaart #103490.
# Eén regel per releasestap in ~/.devkit/releases/stappen.jsonl, naast de samenvatting die
# log_release hieronder schrijft. RUN_ID (door release.sh/release_compose gezet vóór de eerste
# stap) correleert de stappen van één run. Nooit fataal, nooit traag: een telemetriefout of een
# volle schijf mag een echte release niet laten mislukken of vertragen (alles achter "|| true").
telemetrie_stap() {
  _ts_pad="${DEVKIT_STAPPEN_LOGBOEK:-$HOME/.devkit/releases/stappen.jsonl}"
  _ts_duur=$(($(date +%s) - $2))
  _ts_fout_json="null"
  if [ -n "${5:-}" ]; then
    _ts_fout_json="\"$(printf '%s' "$5" | tail -c 2000 | tr '\n' ' ' | sed 's/\\/\\\\/g; s/"/\\"/g')\""
  fi
  (
    mkdir -p "$(dirname "$_ts_pad")" 2>/dev/null
    printf '{"tijdstip":"%s","run_id":"%s","site":"%s","omgeving":"%s","sha":"%s","stap":"%s","duur_s":%s,"uitkomst":"%s","foutregel":%s}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${RUN_ID:-onbekend}" "${RELEASE_SITENAAM:-$DOMEIN}" "${OMGEVING:-onbekend}" "$4" "$1" "$_ts_duur" "$3" "$_ts_fout_json" \
      >> "$_ts_pad"
  ) 2>/dev/null || true
  unset _ts_pad _ts_duur _ts_fout_json
}

# meet_stap <stap> <sha> <commando...> — draait <commando...>, meet <stap> (telemetrie_stap) en geeft bij een
# fout de eigen gecombineerde uitvoer van het commando door als foutregel (laatste 20 regels, zonder geheimen,
# foutregel_zonder_geheimen). Devkit kaart #103643: zonder dit zegt een rode telemetrie-stap alleen DAT iets
# faalde, niet WAT er misging. Geeft de eigen exitcode van het commando terug, dus "meet_stap ... || return 1"
# werkt zoals een gewone `&&`-keten.
meet_stap() {
  _ms_stap="$1"; _ms_sha="$2"; shift 2
  _ms_begin=$(date +%s)
  _ms_uit="$("$@" 2>&1)"
  _ms_rc=$?
  # Eerst de eigen uitvoer tonen zoals het commando dat vanzelf zou doen (wie het log volgt ziet nog altijd elke
  # regel): meet_stap verandert alleen WAT er gemeten wordt, niet wat er op het scherm komt.
  [ -z "$_ms_uit" ] || printf '%s\n' "$_ms_uit"
  if [ "$_ms_rc" -eq 0 ]; then
    telemetrie_stap "$_ms_stap" "$_ms_begin" ok "$_ms_sha"
  else
    telemetrie_stap "$_ms_stap" "$_ms_begin" rood "$_ms_sha" "$(foutregel_zonder_geheimen "$_ms_uit")"
  fi
  unset _ms_stap _ms_sha _ms_begin _ms_uit
  return "$_ms_rc"
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
