// views/scoreboard.mjs — UI4. Tussenstand (fase SCOREBOARD): top 5 + eigen
// positie, rechtstreeks uit `scoreboard:updated` via standings-model.mjs.
// Namen altijd via textContent (het zijn spelersnamen = gebruikersinvoer).
//
// S14: comeback-headline landt hier, niet in gameplay.mjs's reveal — die
// heeft de bijgewerkte rankbeweging voor déze overgang nog niet (zie
// reveal-model.mjs's toelichting), dit scherm wél (`rankMovementFrom()`,
// S15, al gedeeld met deze headline via dezelfde `movement`-Map).

import { socialHeadlineFor } from './social-headline.mjs';

export function createScoreboardView({ root, t, tCount }) {
  root.textContent = '';

  const title = document.createElement('h2');
  title.className = 'scoreboard-title';
  title.textContent = t('standings.title');

  const list = document.createElement('ol');
  list.className = 'scoreboard-list';

  const selfLine = document.createElement('p');
  selfLine.className = 'scoreboard-self';
  selfLine.setAttribute('aria-live', 'polite');

  const headline = document.createElement('p');
  headline.className = 'scoreboard-headline';
  headline.hidden = true;
  headline.setAttribute('aria-live', 'polite');

  root.append(title, list, selfLine, headline);

  /**
   * @param {import('./standings-model.mjs').standingsFrom extends (p: any) => infer R ? R : never} standings
   * @param {{ movement?: Map<string, number>, participants?: Map<string, string> }} [options] S15:
   *   positieverschil t.o.v. de vorige stand (`rankMovementFrom()`,
   *   session-shell.mjs) — geen entry (nieuwe speler, of nog geen vorige
   *   stand) toont geen badge. `participants` voor de comeback-headline
   *   (S14), om de naam bij de grootste stijger te tonen.
   */
  function update(standings, { movement = new Map(), participants = new Map() } = {}) {
    list.textContent = '';
    for (const entry of standings.entries.slice(0, 5)) {
      const item = document.createElement('li');
      item.className = entry.isSelf ? 'scoreboard-entry is-self' : 'scoreboard-entry';
      const name = document.createElement('span');
      name.className = 'scoreboard-name';
      name.textContent = entry.effectiveName;
      const move = el('span', 'scoreboard-move');
      const diff = movement.get(entry.playerId);
      if (typeof diff === 'number') {
        if (diff > 0) {
          move.textContent = `↑${diff}`;
          move.classList.add('is-up');
          move.setAttribute('aria-label', tCount('standings.moveUp', diff));
        } else if (diff < 0) {
          move.textContent = `↓${Math.abs(diff)}`;
          move.classList.add('is-down');
          move.setAttribute('aria-label', tCount('standings.moveDown', Math.abs(diff)));
        } else {
          move.textContent = '—';
          move.setAttribute('aria-label', t('standings.moveSame'));
        }
      }
      const score = document.createElement('span');
      score.className = 'scoreboard-score';
      score.textContent = String(entry.score);
      item.append(name, move, score);
      list.appendChild(item);
    }

    if (standings.self !== null) {
      selfLine.textContent =
        standings.self.position !== null
          ? `${t('standings.you')}: #${standings.self.position} — ${standings.self.score}`
          : `${t('standings.you')}: ${standings.self.score}`;
    } else {
      selfLine.textContent = '';
    }

    // S14: alleen de comeback-conditie kan hier ooit vuren (geen distribution/
    // correctOptionId beschikbaar op dit scherm) — precies de bedoeling, de
    // andere headline-typen horen bij gameplay.mjs's reveal.
    const found = socialHeadlineFor({
      distribution: [],
      correctOptionId: null,
      eligiblePlayerCount: null,
      movement,
      participants,
    });
    if (found !== null && found.type === 'comeback') {
      headline.hidden = false;
      headline.textContent = t('headline.comeback').replace('{naam}', found.name).replace('{n}', String(found.diff));
    } else {
      headline.hidden = true;
      headline.textContent = '';
    }
  }

  return { update };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
