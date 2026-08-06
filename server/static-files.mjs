import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

/**
 * De statische mappings uit `transport-contract-response.md` §UI-3, plus
 * `frontend/` als root. Volgorde is betekenisvol: de twee expliciete prefixen
 * gaan vóór de root-catch-all.
 * @type {ReadonlyArray<{ urlPrefix: string, directory: string }>}
 */
const STATIC_MOUNTS = Object.freeze([
  { urlPrefix: '/client/', directory: path.join(REPO_ROOT, 'client') },
  { urlPrefix: '/shared/', directory: path.join(REPO_ROOT, 'shared') },
  // `flags/` staat in de repo-root, náást client/ en shared/ — niet eronder.
  // Zonder deze mapping geeft elke vlagafbeelding lokaal een 404 en is een
  // `flags_mc`-vraag onspeelbaar via `npm start`. Achter Caddy valt dat niet op
  // omdat de proxy die map zelf bedient; dat maakt het juist een stille bug.
  { urlPrefix: '/flags/', directory: path.join(REPO_ROOT, 'flags') },
]);

/** De root waaruit de app zelf wordt geserveerd (`/`, `/css/...`, deep links). */
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend');

/**
 * Content-types voor de bestandssoorten die deze repo daadwerkelijk serveert.
 * Bewust een kleine, expliciete tabel in plaats van een mime-dependency —
 * "geen nieuwe dependencies" is een harde grens van deze stap.
 * @type {Readonly<Record<string, string>>}
 */
const CONTENT_TYPE_BY_EXTENSION = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
});

// ─────────────────────────────────────────────────────────────────────────────
// Statische bestanden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zet een URL-pad om naar een absoluut bestandspad binnen `rootDirectory`, of
 * `null` wanneer het pad daarbuiten zou uitkomen (path traversal, `%2e%2e`,
 * absolute paden, een NUL-byte).
 * @param {string} rootDirectory
 * @param {string} relativeUrlPath
 * @returns {string | null}
 */
export function resolveWithinRoot(rootDirectory, relativeUrlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(relativeUrlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) {
    return null;
  }
  const resolved = path.resolve(rootDirectory, `.${path.posix.sep}${decoded}`);
  const rootWithSeparator = rootDirectory.endsWith(path.sep) ? rootDirectory : rootDirectory + path.sep;
  if (resolved !== rootDirectory && !resolved.startsWith(rootWithSeparator)) {
    return null;
  }
  return resolved;
}

/**
 * Stuurt een bestand, of `false` wanneer het niet bestaat (dan mag de
 * aanroeper zijn eigen fallback kiezen).
 * @param {import('fastify').FastifyReply} reply
 * @param {string} absolutePath
 * @returns {Promise<boolean>}
 */
async function sendFile(reply, absolutePath) {
  let stats;
  try {
    stats = await stat(absolutePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) {
    return false;
  }
  // Cachebeleid (regie-fix, 3 aug 2026): zonder headers vielen browsers terug
  // op heuristische caching en draaiden spelers ná een deploy minutenlang
  // oude `.mjs`-modules (gezien bij de doelbeeld v2-verificatie: de pagina
  // laadde verse HTML met oude JS — de CSS-cachebust `?v=` dekt de module-
  // graaf niet). `no-cache` = wél cachen, maar élke keer revalideren; met
  // Last-Modified + 304 kost dat één conditionele request per bestand en is
  // elke deploy direct overal zichtbaar.
  const lastModified = stats.mtime.toUTCString();
  reply
    .header('x-content-type-options', 'nosniff')
    .header('cache-control', 'no-cache')
    .header('last-modified', lastModified);
  if (reply.request?.headers['if-modified-since'] === lastModified) {
    reply.code(304).send();
    return true;
  }
  const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(absolutePath).toLowerCase()]
    ?? 'application/octet-stream';
  reply
    .header('content-type', contentType)
    .header('content-length', String(stats.size))
    .send(createReadStream(absolutePath));
  return true;
}

/**
 * Registreert `/client/*`, `/shared/*` en de `frontend/`-root.
 *
 * De root-catch-all valt terug op `frontend/index.html` voor paden zónder
 * bestandsextensie, zodat deep links als `/j/{inviteId}` en `/game/{code}`
 * werken (`transport-contract-response.md` §UI-3, tweede deel van de vraag:
 * `<base href="/">` + absolute paden).
 * @param {import('fastify').FastifyInstance} fastify
 */
export function registerStaticRoutes(fastify) {
  for (const mount of STATIC_MOUNTS) {
    fastify.get(`${mount.urlPrefix}*`, async (request, reply) => {
      const absolutePath = resolveWithinRoot(mount.directory, request.params['*'] ?? '');
      if (absolutePath === null || !(await sendFile(reply, absolutePath))) {
        return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
      }
      return reply;
    });
  }

  fastify.get('/*', async (request, reply) => {
    const requestPath = request.params['*'] ?? '';

    // Een onbekend API- of socketpad is nooit een statisch bestand en mag ook
    // niet stilletjes de SPA-shell krijgen: dan zou een client HTML als JSON
    // proberen te lezen. De REST-plugin heeft zijn eigen 404 voor /api/v1/**;
    // dit dekt de rest.
    if (requestPath.startsWith('api/') || requestPath.startsWith('socket.io/')) {
      return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
    }

    const absolutePath = resolveWithinRoot(FRONTEND_ROOT, requestPath);
    if (absolutePath !== null && await sendFile(reply, absolutePath)) {
      return reply;
    }
    // SPA-fallback: alleen voor extensieloze paden. Een ontbrekende `.js` of
    // `.png` hoort een eerlijke 404 te zijn, geen HTML-pagina.
    if (path.extname(requestPath) === '' && await sendFile(reply, path.join(FRONTEND_ROOT, 'index.html'))) {
      return reply;
    }
    return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
  });

  fastify.get('/', async (request, reply) => {
    if (await sendFile(reply, path.join(FRONTEND_ROOT, 'index.html'))) {
      return reply;
    }
    return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
  });
}


