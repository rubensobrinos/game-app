#!/bin/sh
# deploy/uitrollen-test.sh [ref] — zet test.rounda.io op een commit (standaard: main).
#
# Wordt na elke commit op main vanzelf gestart (post-commit-hook -> seinbestand ->
# nl.aseso.rounda.uitrol-test -> uitrol-wachter.sh), en kan ook met de hand. Zet de
# test-worktree op de commit, bouwt, herstart nl.aseso.rounda.test en voert de rookproef uit.
# Faalt iets, dan gaat test terug naar de commit waar hij op stond.
# Standaard: devkit ADR-0032.
set -eu
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

omgeving_laden test
omgeving_eisen

# RUN_ID (devkit kaart #103490): correleert de telemetrie-stappen van deze testuitrol.
RUN_ID="${RELEASE_SITENAAM:-$DOMEIN}-test-$(date -u +%Y%m%dT%H%M%SZ)-$$"

# De echte testhost, niet per se test.<domein>: PUBLIC_URL_TEST in omgeving.conf mag
# afwijken (cobri-academy draait op academy-test.cobrigroup.com, kaart #101181). Zonder
# die instelling is dit exact "test.<domein>".
TEST_HOST="${PUBLIC_URL#*://}"

REPO="$(git -C "$DEPLOY" rev-parse --show-toplevel)"
NIEUW="$(git -C "$REPO" rev-parse --verify "${1:-main}^{commit}")"
[ -d "$TEST_WORKTREE" ] || weiger "test-worktree $TEST_WORKTREE bestaat niet: git -C \"$REPO\" worktree add --detach \"$TEST_WORKTREE\" main"
VORIG="$(git -C "$TEST_WORKTREE" rev-parse HEAD)"

# _checkout_naar <sha> / _bouwen_lokaal / _herstart_test / _rookproef_lokaal / _beelink_bouwen <sha> /
# _rookproef_beelink: elk één losse stap van zet_test_op hieronder, zodat meet_stap (lib.sh, kaart #103643) ze
# apart kan meten met zijn eigen uitvoer als foutregel bij een fout — vóór deze kaart stond dat allemaal samen
# onder één "build"-stap met een vaste tekst, zonder te zeggen wélke stap (checkout, bouwen, herstarten of de
# rookproef) het was en zonder de echte foutmelding.
_checkout_naar() {
  git -C "$TEST_WORKTREE" checkout --quiet --detach "$1"
}

_bouwen_lokaal() {
  (cd "$TEST_WORKTREE" && /bin/sh -c "$BOUWEN")
}

_herstart_test() {
  herstarten "$DIENST"
}

_rookproef_lokaal() {
  rookproef "$POORT"
}

# TEST_OP_BEELINK (omgeving.conf, optioneel): draait test op de Beelink (docs/ops/verhuizen-naar-beelink.md).
# Dan bouwt en start dat script in deploy/ de container uit `git archive <sha>` (BOUWEN en de launchd-dienst op de
# Mac doen niet meer mee) en gaat de rookproef naar BEELINK_HOST (uit devkit data/beelink.env) op de testpoort.
_beelink_bouwen() {
  sh "$DEPLOY/$TEST_OP_BEELINK" "$1"
}

_rookproef_beelink() {
  rookproef "$POORT" "${BEELINK_HOST:-192.168.1.244}"
}

# zet_test_op <sha> — checkout, bouwen (lokaal of op de Beelink), herstarten (alleen lokaal) en de rookproef,
# elk gemeten als eigen telemetrie-stap (checkout/build/herstarten/healthcheck) op <sha>. Geen `set -e` binnen
# een `if`: elke stap expliciet laten tellen via zijn eigen exitcode (meet_stap geeft die door).
zet_test_op() {
  meet_stap checkout "$1" _checkout_naar "$1" || return 1
  if [ -n "${TEST_OP_BEELINK:-}" ]; then
    meet_stap build "$1" _beelink_bouwen "$1" || return 1
    meet_stap healthcheck "$1" _rookproef_beelink || return 1
  else
    meet_stap build "$1" _bouwen_lokaal || return 1
    meet_stap herstarten "$1" _herstart_test || return 1
    meet_stap healthcheck "$1" _rookproef_lokaal || return 1
  fi
}

echo "$TEST_HOST: $(git -C "$REPO" rev-parse --short "$VORIG") -> $(git -C "$REPO" rev-parse --short "$NIEUW")"
if zet_test_op "$NIEUW"; then
  # Regel 7: testsites staan achter de poortwachter, die noindex zet. Waarschuwen,
  # niet falen: zonder poortwachter werkt test nog steeds.
  if ! curl -sI --max-time 10 "$PUBLIC_URL/" | grep -qi '^x-robots-tag:.*noindex'; then
    echo "waarschuwing: $PUBLIC_URL stuurt geen X-Robots-Tag: noindex (staat hij achter de poortwachter?)" >&2
  fi
  echo "$TEST_HOST draait op $(git -C "$REPO" rev-parse --short "$NIEUW")"
  exit 0
fi

echo "TERUGDRAAIEN: test gaat terug naar $(git -C "$REPO" rev-parse --short "$VORIG")" >&2
# Devkit kaart #103643: dit rolt terug NAAR $VORIG, dus de terugrol-telemetrie draagt ook $VORIG — niet $NIEUW
# (de kapotte sha die net werd verlaten). zet_test_op's eigen sub-stappen loggen intussen al op $VORIG.
_ut_terugrol_begin=$(date +%s)
if zet_test_op "$VORIG"; then
  telemetrie_stap terugrol "$_ut_terugrol_begin" ok "$VORIG"
  exit 1
fi
telemetrie_stap terugrol "$_ut_terugrol_begin" rood "$VORIG" "ook de vorige stand komt niet op"
echo "ook de vorige stand komt niet op; $TEST_HOST ligt eruit" >&2
exit 2
