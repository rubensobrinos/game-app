import { randomBytes } from 'node:crypto';

import { CONTENT_VERSION } from '../shared/content/index.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Configuratie uit de omgeving — de ENIGE plek in de server die env leest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Leest de peppers voor sessietokens en de invite-index (besluit 26).
 *
 * Twee vormen, in volgorde van voorrang:
 *   1. `TOKEN_PEPPERS` — JSON `{"v1": "...", "v2": "..."}`, alle nog geldige
 *      versies tegelijk. Nodig voor een rotatie: `verifyToken` leest de versie
 *      uit de opgeslagen hash en zoekt hem hierin op.
 *   2. `TOKEN_PEPPER` — de enkele pepper die vandaag in `.env.example` en
 *      `docker-compose.yml` staat. Krijgt versie `TOKEN_PEPPER_VERSION`
 *      (default `v1`).
 *
 * Ontbreekt allebei, dan hangt het van `NODE_ENV` af: in productie is dat een
 * harde fout, daarbuiten wordt een vluchtige pepper gegenereerd zodat
 * `npm start` lokaal werkt. Die vluchtige pepper maakt bij elke herstart alle
 * bestaande sessietokens ongeldig — vandaar de waarschuwing.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {(line: string) => void} warn
 * @returns {{ version: string, peppers: Record<string, string> }}
 */
export function readTokenPeppers(env, warn) {
  const activeVersion = env.TOKEN_PEPPER_VERSION ?? 'v1';

  if (typeof env.TOKEN_PEPPERS === 'string' && env.TOKEN_PEPPERS.trim().length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(env.TOKEN_PEPPERS);
    } catch {
      throw new Error('TOKEN_PEPPERS moet geldige JSON zijn: {"v1": "<pepper>", ...}');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('TOKEN_PEPPERS moet een JSON-object {versie: pepper} zijn.');
    }
    // Verdere keuring (lege map, ontbrekende actieve versie, te korte pepper)
    // doet createContext; niet hier dupliceren.
    return { version: activeVersion, peppers: parsed };
  }

  if (typeof env.TOKEN_PEPPER === 'string' && env.TOKEN_PEPPER.length > 0) {
    return { version: activeVersion, peppers: { [activeVersion]: env.TOKEN_PEPPER } };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('TOKEN_PEPPER (of TOKEN_PEPPERS) is verplicht in productie — besluit 26.');
  }
  warn('TOKEN_PEPPER ontbreekt; er is een vluchtige ontwikkelpepper gegenereerd. Sessietokens overleven een herstart niet.');
  return { version: activeVersion, peppers: { [activeVersion]: randomBytes(32).toString('base64url') } };
}

/**
 * Bouwt de volledige serverconfiguratie uit de omgeving.
 *
 * `PUBLIC_APP_URL` is besluit 6: één configuratiewaarde waaruit `joinUrl`
 * wordt afgeleid. Hij staat nog niet in `.env.example`/`docker-compose.yml` —
 * zie het handoff-item. Lokaal valt hij terug op `http://localhost:${PORT}`
 * zodat `npm start` zonder env werkt; in productie is hij verplicht, want een
 * verkeerde `joinUrl` in een QR-code is niet achteraf te repareren.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(line: string) => void} [warn]
 */
export function readConfigFromEnvironment(env = process.env, warn = () => {}) {
  const port = Number.parseInt(env.PORT ?? '3000', 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT moet een geldig poortnummer zijn, kreeg: ${JSON.stringify(env.PORT)}`);
  }

  let publicAppUrl = env.PUBLIC_APP_URL;
  if (typeof publicAppUrl !== 'string' || publicAppUrl.length === 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error('PUBLIC_APP_URL is verplicht in productie — besluit 6 (joinUrl).');
    }
    publicAppUrl = `http://localhost:${port}`;
    warn(`PUBLIC_APP_URL ontbreekt; teruggevallen op ${publicAppUrl} (besluit 6).`);
  }

  // ── De storekeuze, als CONFIGURATIEWAARDE ────────────────────────────────
  //
  // `REDIS_URL` gezet → de persistente Redis-adapter; niet gezet → de
  // in-memory fake voor ontwikkeling. De KEUZE valt hier, want dit is de enige
  // plek die de omgeving leest; het BOUWEN gebeurt in `createStoreHandle()`
  // hieronder, omdat verbinden asynchroon is en deze functie dat niet is.
  //
  // Een lege of witruimte-string telt als "niet gezet". Dat is geen
  // toegeeflijkheid maar juist het tegenovergestelde: `REDIS_URL=` in een
  // .env-bestand is de vorm die iemand schrijft als hij hem uit wil zetten, en
  // een lege string zou anders verderop als onparsebare URL knallen met een
  // melding die niet uitlegt wat er aan de hand is.
  const rawRedisUrl = typeof env.REDIS_URL === 'string' ? env.REDIS_URL.trim() : '';
  const redisUrl = rawRedisUrl.length > 0 ? rawRedisUrl : null;
  if (redisUrl === null) {
    if (env.NODE_ENV === 'production') {
      // Stil terugvallen op de fake is hier de ergst denkbare uitkomst: de
      // server draait dan, lijkt gezond, en verliest elke room bij een
      // herstart zonder dat iemand het merkt.
      throw new Error('REDIS_URL is verplicht in productie — zonder persistente store overleeft geen enkele room een herstart.');
    }
    warn('REDIS_URL ontbreekt; de server gebruikt de in-memory store. Rooms, matches en scores overleven een herstart niet.');
  }

  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    publicAppUrl,
    redisUrl,
    tokenPeppers: readTokenPeppers(env, warn),
    // Besluit 21: canoniek en onveranderlijk op Match. Komt uit de gedeelde
    // contentmodule (besluit 29), niet uit env — een verkeerde versie in env
    // zou een verzonnen waarde in echte Match-documenten pinnen.
    contentVersion: CONTENT_VERSION,
    // Stap 9 (INT4b): zonder eigen secret bestáát `/metrics` niet — dan geeft
    // het pad 404. Zo kan er nooit per ongeluk een onbeveiligd endpoint
    // ontstaan door een vergeten configuratieregel. Bewust NIET het
    // sessiepepper of een spelertoken hergebruiken.
    metricsSecret: readMetricsSecret(env, warn),
  };
}

/**
 * Het secret waarmee `/metrics` beveiligd is. Leeg/afwezig betekent: het
 * endpoint wordt niet geregistreerd (INT4b: "geen onbeveiligd endpoint").
 *
 * Minimale lengte omdat een kort secret in een publiek bereikbare service geen
 * secret is; te kort telt als niet-geconfigureerd, mét waarschuwing, zodat de
 * fout zichtbaar is in plaats van stil te leiden tot een open endpoint.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {(line: string) => void} warn
 * @returns {string | null}
 */
export function readMetricsSecret(env, warn) {
  const raw = (env.METRICS_SECRET ?? '').trim();
  if (raw.length === 0) return null;
  if (raw.length < 16) {
    warn('METRICS_SECRET is korter dan 16 tekens en wordt genegeerd; /metrics blijft uit.');
    return null;
  }
  return raw;
}


