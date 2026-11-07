#!/bin/sh
# deploy/beelink-test.sh <sha> — bouwt test.rounda.io op de Beelink uit `git archive <sha>` en (her)start het
# compose-project `rounda-test` daar (aangeroepen door uitrollen-test.sh via TEST_OP_BEELINK, kaart #105871).
#
# Bron: de tar van de commit gaat naar ~/sites/rounda-test.nieuw, die daarna de plek van ~/sites/rounda-test inneemt
# (de vorige blijft als rounda-test.vorige staan, één stuk). Wat niet gecommit is komt er niet in. Het env-bestand
# (~/.config/rounda/test.env, 600) staat op de Beelink en wordt hier nooit gelezen of getoond. Volumes
# (rounda-test_pg-data e.d.) blijven staan; dit commando doet nooit `down -v`.
set -eu

SHA="${1:?gebruik: beelink-test.sh <sha>}"
HOST_SSH="${BEELINK_SSH:-beelink}"
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
git -C "$REPO" rev-parse --verify "$SHA^{commit}" >/dev/null

git -C "$REPO" archive --format=tar "$SHA" \
  | ssh -o BatchMode=yes "$HOST_SSH" 'set -eu
      rm -rf "$HOME/sites/rounda-test.nieuw" && mkdir -p "$HOME/sites/rounda-test.nieuw"
      tar -x -C "$HOME/sites/rounda-test.nieuw"'

ssh -o BatchMode=yes "$HOST_SSH" 'set -eu
  cd "$HOME/sites"
  rm -rf rounda-test.vorige
  [ ! -d rounda-test ] || mv rounda-test rounda-test.vorige
  mv rounda-test.nieuw rounda-test
  cd rounda-test
  docker compose -p rounda-test --env-file "$HOME/.config/rounda/test.env" \
    -f docker-compose.yml -f compose.testsite.override.yml -f compose.beelink.override.yml \
    up -d --build --remove-orphans'
echo "test op de Beelink: rounda-test staat op $(git -C "$REPO" rev-parse --short=12 "$SHA")"
