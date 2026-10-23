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

# De echte testhost, niet per se test.<domein>: PUBLIC_URL_TEST in omgeving.conf mag
# afwijken (cobri-academy draait op academy-test.cobrigroup.com, kaart #101181). Zonder
# die instelling is dit exact "test.<domein>".
TEST_HOST="${PUBLIC_URL#*://}"

REPO="$(git -C "$DEPLOY" rev-parse --show-toplevel)"
NIEUW="$(git -C "$REPO" rev-parse --verify "${1:-main}^{commit}")"
[ -d "$TEST_WORKTREE" ] || weiger "test-worktree $TEST_WORKTREE bestaat niet: git -C \"$REPO\" worktree add --detach \"$TEST_WORKTREE\" main"
VORIG="$(git -C "$TEST_WORKTREE" rev-parse HEAD)"

# Geen `set -e` binnen een `if`: elke stap expliciet laten tellen.
# TEST_OP_BEELINK (omgeving.conf, optioneel): draait test op de Beelink (docs/ops/verhuizen-naar-beelink.md).
# Dan bouwt en start dat script in deploy/ de container uit `git archive <sha>` (BOUWEN en de launchd-dienst op de
# Mac doen niet meer mee) en gaat de rookproef naar BEELINK_HOST (uit devkit data/beelink.env) op de testpoort.
zet_test_op() {
  if [ -n "${TEST_OP_BEELINK:-}" ]; then
    git -C "$TEST_WORKTREE" checkout --quiet --detach "$1" &&
      sh "$DEPLOY/$TEST_OP_BEELINK" "$1" &&
      rookproef "$POORT" "${BEELINK_HOST:-192.168.1.244}"
  else
    git -C "$TEST_WORKTREE" checkout --quiet --detach "$1" &&
      (cd "$TEST_WORKTREE" && /bin/sh -c "$BOUWEN") &&
      herstarten "$DIENST" &&
      rookproef "$POORT"
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
if zet_test_op "$VORIG"; then
  exit 1
fi
echo "ook de vorige stand komt niet op; $TEST_HOST ligt eruit" >&2
exit 2
