#!/bin/sh
# deploy/uitrol-wachter.sh — door launchd (nl.aseso.rounda.uitrol-test) gestart zodra main
# verschuift (WatchPaths op .git/refs/heads/main), of zodra deploy/.uitrollen-test
# verschijnt. Zet in dat seinbestand een commit of ref om iets anders dan main naar test
# te sturen.
#
# Waarom launchd en geen git-hook: een commit hoort nooit op een build te wachten, een
# hook moet in .pre-commit-config.yaml (dat devkit beheert), en een agent die alleen in
# deze checkout mag schrijven kan de test-worktree niet bijwerken. launchd kan dat wel.
set -u
DEPLOY="$(cd "$(dirname "$0")" && pwd)"
SEIN="$DEPLOY/.uitrollen-test"
LOG="$HOME/Library/Logs/rounda-uitrol-test.log"
REPO="$(git -C "$DEPLOY" rev-parse --show-toplevel)"
# shellcheck disable=SC1091
. "$DEPLOY/omgeving.conf"

if [ -f "$SEIN" ]; then
  REF="$(tr -d '[:space:]' < "$SEIN" 2>/dev/null)"
  rm -f "$SEIN"
else
  # main is verschoven, of launchd zag iets anders aan het ref-bestand (git gc). Staat
  # test al op main, dan is er niets te doen.
  REF=main
  [ "$(git -C "$REPO" rev-parse main 2>/dev/null)" != "$(git -C "$TEST_WORKTREE" rev-parse HEAD 2>/dev/null)" ] || exit 0
fi
{
  echo "=== uitrol naar test $(date '+%Y-%m-%d %H:%M:%S') (ref: ${REF:-main}) ==="
  sh "$DEPLOY/uitrollen-test.sh" "${REF:-main}"
  echo "=== klaar, exit $? $(date '+%H:%M:%S') ==="
} >> "$LOG" 2>&1
