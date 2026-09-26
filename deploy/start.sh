#!/bin/sh
# deploy/start.sh <test|productie> — wat launchd start (nl.aseso.rounda.test / .productie).
#
# Laadt omgeving.conf en het env-bestand van de omgeving, weigert te starten (exit 78)
# als een database of adres bij de andere omgeving hoort, en start dan de app op
# 127.0.0.1:<poort> vanuit de map van die omgeving: de test-worktree, of
# $RELEASES/current voor productie. Standaard: devkit ADR-0032.
set -eu
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

omgeving_laden "${1:-}"
omgeving_eisen
[ -d "$OMGEVING_MAP" ] || weiger "$OMGEVING_MAP bestaat niet. Test: git worktree add --detach \"$TEST_WORKTREE\" main. Productie: eerst deploy/release.sh."

cd "$OMGEVING_MAP"
exec /bin/sh -c "$STARTEN"
