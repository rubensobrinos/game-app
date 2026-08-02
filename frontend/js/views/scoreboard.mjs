// views/scoreboard.mjs — UI4. Tussenstand (fase SCOREBOARD): top 5 + eigen
// positie, rechtstreeks uit `scoreboard:updated` via standings-model.mjs.
// Namen altijd via textContent (het zijn spelersnamen = gebruikersinvoer).

export function createScoreboardView({ root, t }) {
  root.textContent = '';

  const title = document.createElement('h2');
  title.className = 'scoreboard-title';
  title.textContent = t('standings.title');

  const list = document.createElement('ol');
  list.className = 'scoreboard-list';

  const selfLine = document.createElement('p');
  selfLine.className = 'scoreboard-self';
  selfLine.setAttribute('aria-live', 'polite');

  root.append(title, list, selfLine);

  /** @param {import('./standings-model.mjs').standingsFrom extends (p: any) => infer R ? R : never} standings */
  function update(standings) {
    list.textContent = '';
    for (const entry of standings.entries.slice(0, 5)) {
      const item = document.createElement('li');
      item.className = entry.isSelf ? 'scoreboard-entry is-self' : 'scoreboard-entry';
      const name = document.createElement('span');
      name.className = 'scoreboard-name';
      name.textContent = entry.effectiveName;
      const score = document.createElement('span');
      score.className = 'scoreboard-score';
      score.textContent = String(entry.score);
      item.append(name, score);
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
  }

  return { update };
}
