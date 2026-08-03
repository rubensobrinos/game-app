// leaderboard-row.mjs — T2-6. Eén rij van de tussenstand (`05` §10).
//
// Vier kolommen: rank, naam, score, beweging. Die laatste is wat een lijst een
// wedstrijd maakt — zonder `↑2` is een tussenstand alleen een opsomming.
//
// De component rekent niets uit. Hij krijgt `{ rank, name, score, delta }`
// binnen en tekent. Waar `delta` vandaan komt is een modelvraag voor gebied 1
// (`standings-model.mjs` kent de vorige stand nog niet).
//
// Rankanimatie hoort hier níét: dat is `E11` en dus gebied 3. Deze module
// levert de rij; de beweging naar een nieuwe positie hangt hij eraan.

/**
 * `04` S15 toont top vijf plus de eigen rij, dus de reeks is discontinu —
 * #1 t/m #5 en dan #12. Daarom is de rank een expliciete kolom van vaste
 * breedte en niet "de zoveelste rij".
 *
 * @param {{
 *   root: HTMLElement,
 *   t: (key: string) => string,
 *   tCount: (key: string, n: number) => string,
 * }} options
 */
export function createLeaderboardRow({ root, t, tCount }) {
  const rij = document.createElement('li');
  rij.className = 'leaderboard-row';

  const rank = span('leaderboard-rank');
  const naam = span('leaderboard-name');
  const eigen = span('leaderboard-self-tag');
  const score = span('leaderboard-score');
  const beweging = span('leaderboard-move');

  rij.append(rank, naam, eigen, score, beweging);
  root.appendChild(rij);

  /**
   * @param {{
   *   rank: number,
   *   name: string,
   *   score: number,
   *   delta?: number|null,
   *   isSelf?: boolean,
   *   gedeeld?: boolean,
   * }} model
   */
  function update({ rank: positie, name, score: punten, delta = null, isSelf = false, gedeeld = false }) {
    rij.classList.toggle('is-self', isSelf);
    rij.classList.toggle('is-shared', gedeeld);

    rank.textContent = `#${positie}`;
    naam.textContent = name; // gebruikersinvoer — nooit innerHTML
    naam.title = name;
    score.textContent = String(punten);

    // `05` §10 en `04` S06: de eigen rij moet herkenbaar zijn. Een rand alleen
    // is te subtiel in een lijst van tien, dus ook een label.
    eigen.hidden = !isSelf;
    eigen.textContent = isSelf ? t('standings.you') : '';

    toonBeweging(delta);

    // `09` §11 heeft copy voor een gedeelde plaats; de regel wannéér dat geldt
    // is een openstaand productbesluit (`04` S15, `UI-15`). De component kan
    // het tonen zodra het model het meegeeft.
    if (gedeeld) {
      rank.title = t('standings.sharedPlace');
    } else {
      rank.removeAttribute('title');
    }
  }

  function toonBeweging(delta) {
    beweging.classList.remove('is-up', 'is-down', 'is-same');

    if (typeof delta !== 'number' || Number.isNaN(delta) || delta === 0) {
      // `—` en niet niets: een lege cel leest als ontbrekende data.
      beweging.classList.add('is-same');
      beweging.textContent = '—';
      beweging.setAttribute('aria-label', t('standings.moveSame'));
      return;
    }

    const omhoog = delta > 0;
    const plaatsen = Math.abs(delta);
    beweging.classList.add(omhoog ? 'is-up' : 'is-down');
    // Symbool én getal: `08` §2.3 verbiedt kleur als enige drager, dus een
    // groene pijl alleen is niet genoeg.
    beweging.textContent = `${omhoog ? '↑' : '↓'}${plaatsen}`;
    // En de zin voor wie het hoort in plaats van ziet (`08` §2.2).
    beweging.setAttribute('aria-label', tCount(omhoog ? 'standings.moveUp' : 'standings.moveDown', plaatsen));
  }

  return { update, element: rij };
}

function span(className) {
  const node = document.createElement('span');
  node.className = className;
  return node;
}
