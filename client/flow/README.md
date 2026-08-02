# `client/flow/`

Pure, dependency-free client-side state modules that realize
[`docs/multiplayer/GAME-FLOW.md`](../../docs/multiplayer/GAME-FLOW.md). Built per the
plan in [`docs/game-flow-plan/`](../../docs/game-flow-plan/) — that folder has the
full rationale, open questions, and per-phase prompts; this file is only the
orientation for the code itself.

## What lives here

Every module is a small set of pure functions: given a state and an event/context,
return the next state or the request to send — no `fetch`, no `Socket.IO`, no DOM,
no `Date.now()`/timers. The server stays authoritative; these modules only reflect
server state and translate user actions into intents.

| Module | Responsibility |
| --- | --- |
| `route-resolver.mjs` | Path → route type (`home`/`join`/`game`/`host`/`screen`), without ever inferring rights from a URL |
| `join-state.mjs` | Join flow (QR/link primary, code fallback): name entry → submit → joined/error |
| `host-setup-state.mjs` | Quick-start / advanced host setup, produces a `POST /api/v1/games` request |
| `match-phase-state.mjs` | Reflects server-reported match phase; deliberately has no transition-legality table of its own |
| `reconnect-state.mjs` | Socket reconnect backoff (1/2/4/8/16/30s) and snapshot-request signaling |
| `edge-case-messaging.mjs` | Error code / pause reason / connection status / kick-revoke → message key |
| `share-actions.mjs` | Which share action is available, and the `src`-tagged QR/copy-link URLs |
| `session-store.mjs` | Session token persistence, with the storage backend injected (works with real `localStorage` or an in-memory test fake) |
| `host-controls-state.mjs` | Which host action is currently valid, and its event payload — no rule stricter than `PROTOCOL.md` |
| `leave-state.mjs` | Confirm-before-leave flow ahead of `player:leave` |

Each `*.mjs` file has a matching `*.test.mjs` next to it.

## Running the tests

```sh
node --test client/flow/*.test.mjs
```

No `package.json`, no build step, no bundler — native ES modules run directly under
Node's built-in test runner. Wiring these modules into the actual browser app
(`<script type="module">`) or a real transport layer is a later, separate step; see
[`docs/game-flow-plan/GF-PROGRESS.md`](../../docs/game-flow-plan/GF-PROGRESS.md) for
what's done and what's still open.

## Conventions worth knowing before editing

- **`*RequestFor(state)` functions are non-null only during the in-flight status**
  (`submitting`/`creating`/`leaving`), never before. This was originally
  inconsistent between two modules until a review caught it — keep new
  request-producing modules on the same convention.
- **Never invent a stricter rule than the source document.** Several modules
  (`match-phase-state`, `host-controls-state`) explicitly avoid re-implementing
  legality checks that the server (or `PROTOCOL.md`) already owns, to avoid two
  sources of truth drifting apart.
- **Malformed/untrusted input never throws.** Server payloads, browser storage
  contents, and event objects are all treated as untrusted; every module falls back
  to a safe default instead of throwing. Genuine I/O failures (e.g. a real
  `storage.setItem` quota error in `session-store.mjs`) are the one deliberate
  exception — those propagate, since swallowing them would hide a real failure.
