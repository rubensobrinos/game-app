// mock/names.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Naam- en ID-generatie"-kopje
// (het naamgedeelte; ID-generatie zit in mock/ids.mjs). Geen gedragsverandering.
// Gedeeld door mock/room.mjs's renamePlayer én door transport-mock.mjs zelf
// (createGame/joinGame/previewInvite) — vandaar een eigen bestand.

const NAME_MAX_GRAPHEMES = 20;
const NAME_ADJECTIVES = ['Vlugge', 'Slimme', 'Dappere', 'Rustige', 'Gouden', 'Wakkere'];
const NAME_NOUNS = ['Vos', 'Uil', 'Leeuw', 'Reiger', 'Das', 'Havik'];

// Zelfde patroon als client/flow/join-state.mjs en
// client/flow/host-setup-state.mjs: telt grapheme clusters, niet UTF-16 code
// units, zodat een emoji of combining character nooit doormidden wordt geknipt.
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function normalizeDisplayName(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.normalize('NFKC').trim();
  return trimmed.length === 0 ? null : truncateToGraphemes(trimmed, NAME_MAX_GRAPHEMES);
}

// Zelfde patroon als client/flow/join-state.mjs en
// client/flow/host-setup-state.mjs's `truncateToGraphemes`: telt
// grapheme-clusters via Intl.Segmenter, niet UTF-16 code units, zodat een
// emoji of combining character nooit doormidden wordt geknipt.
function truncateToGraphemes(value, limit) {
  let result = '';
  let count = 0;
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (count >= limit) {
      break;
    }
    result += segment;
    count += 1;
  }
  return result;
}

export function generateSuggestedName() {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}

// Lost botsingen met een reeds gebruikte naam in dezelfde room op door een
// volgnummer toe te voegen — de server bepaalt de uiteindelijke, unieke naam
// pas bij join (PROTOCOL.md, §preview-endpoint "Grenzen").
export function finalizeName(requestedName, room) {
  const base = requestedName ?? generateSuggestedName();
  if (room === undefined) {
    return base;
  }
  const used = new Set([...room.players.values()].map((player) => player.effectiveName));
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base} ${suffix}`)) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}
