/**
 * `/samen` is de multiplayer-ingang vanuit het singleplayer-menu (HANDOFF-UI
 * UI-6, producteigenaar 2 aug 2026) — resolvet identiek aan `/`, ook `home`.
 *
 * @param {string} pathname
 * @param {string} [search]
 * @returns
 *   | { route: 'home' }
 *   | { route: 'join', inviteId: string }
 *   | { route: 'game' | 'host' | 'screen', code: string }
 *   | { route: 'unknown' }
 */

const JOIN_PATH = /^\/j\/([^/]*)\/?$/;
const GAME_PATH = /^\/game\/([^/]*)\/?$/;
const HOST_PATH = /^\/host\/([^/]*)\/?$/;
const SCREEN_PATH = /^\/screen\/([^/]*)\/?$/;

const CODE_FORMAT = /^[0-9]{6}$/;
const INVITE_ID_FORMAT = /^[A-Za-z0-9_-]+$/;

const CODE_ROUTES = [
  ['game', GAME_PATH],
  ['host', HOST_PATH],
  ['screen', SCREEN_PATH],
];

export function resolveRoute(pathname, search) {
  if (typeof pathname !== 'string' || pathname.charAt(0) !== '/') {
    return { route: 'unknown' };
  }

  if (pathname === '/' || pathname === '/samen') {
    return { route: 'home' };
  }

  const joinMatch = pathname.match(JOIN_PATH);
  if (joinMatch !== null) {
    const inviteId = joinMatch[1];
    return INVITE_ID_FORMAT.test(inviteId)
      ? { route: 'join', inviteId }
      : { route: 'unknown' };
  }

  for (const [route, pattern] of CODE_ROUTES) {
    const match = pathname.match(pattern);
    if (match !== null) {
      const code = match[1];
      return CODE_FORMAT.test(code) ? { route, code } : { route: 'unknown' };
    }
  }

  return { route: 'unknown' };
}
