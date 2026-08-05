// views/scoreboard.mjs — UI4. Sinds doelbeeld v2 (besluit 40, scherm 5) is
// dit het samengevoegde REVEAL + TUSSENSTAND-scherm: bovenaan het goede
// antwoord groot (lime kaart) + het eigen resultaat (+punten), daaronder de
// top 5 + eigen positie uit `scoreboard:updated` via standings-model.mjs,
// onderaan de "volgende vraag"-voet (auto-pacing) of de host-hint. De
// reveal-data komt uit `round-model.mjs`'s `result` (round:ended) en wordt
// door session-shell.mjs meegegeven — dit scherm rekent zelf niets uit
// (serverwaarheid, zie round-model.mjs kop).
// Namen altijd via textContent (het zijn spelersnamen = gebruikersinvoer).
//
// S14: comeback-headline landt hier, niet in gameplay.mjs's reveal — die
// heeft de bijgewerkte rankbeweging voor déze overgang nog niet (zie
// reveal-model.mjs's toelichting), dit scherm wél (`rankMovementFrom()`,
// S15, al gedeeld met deze headline via dezelfde `movement`-Map).

import { socialHeadlineFor } from './social-headline.mjs';
import { countryName } from './country-names.mjs';

export function createScoreboardView({ root, t, tCount }) {
  root.textContent = '';

  // ── Scherm 5, beat 1: het goede antwoord (lime kaart) + eigen resultaat ──
  const revealCard = document.createElement('div');
  revealCard.className = 'reveal-card';
  revealCard.hidden = true;
  const revealLabel = el('span', 'reveal-card-label');
  revealLabel.textContent = t('reveal.correctLabel');
  const revealAnswer = el('strong', 'reveal-card-answer');
  const revealCount = el('span', 'reveal-card-count');
  // Doelbeeld v2 §1: bij "Welke hoort er niet bij" wordt de afwijklogica ná
  // het antwoord kort getoond — anders denkt een speler terecht dat meerdere
  // antwoorden verdedigbaar waren.
  const revealWhy = el('span', 'reveal-card-why');
  revealWhy.hidden = true;
  revealCard.append(revealLabel, revealAnswer, revealCount, revealWhy);

  const revealSelf = document.createElement('div');
  revealSelf.className = 'reveal-self';
  revealSelf.hidden = true;
  const revealSelfIcon = el('span', 'reveal-self-icon');
  const revealSelfText = el('span', 'reveal-self-text');
  const revealSelfPoints = el('strong', 'reveal-self-points');
  revealSelf.append(revealSelfIcon, revealSelfText, revealSelfPoints);

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

  // ── Scherm 5, voet: wat er hierna gebeurt. Auto-pacing: aftelbalk-gevoel
  // zonder secondenclaim (het protocol geeft géén "volgende ronde om"-
  // tijdstip mee, dus we beloven geen getal dat we niet hebben — alleen een
  // lopende balk + tekst). Host-pacing: kalme hint voor de speler; de host
  // heeft z'n eigen Volgende-knop al in de hostbalk.
  const nextFooter = document.createElement('div');
  nextFooter.className = 'reveal-next';
  nextFooter.hidden = true;
  const nextBar = el('div', 'reveal-next-bar');
  nextBar.appendChild(el('i', ''));
  const nextText = el('p', 'reveal-next-text');
  nextFooter.append(nextBar, nextText);

  root.append(revealCard, revealSelf, title, list, selfLine, headline, nextFooter);

  /**
   * De sleutel waarop de antwoordverdeling het juiste antwoord bijhoudt,
   * ongeacht gameType (stap 6): meerkeuze telt per iso2, echt-of-nep per
   * keuze, hoger/lager per kant. Zonder dit bleef "N van M zaten goed" bij
   * Echt of nep stilletjes weg — `correctOptionId` is daar altijd null.
   */
  function correctDistributionKeyFor(round) {
    const result = round.result;
    if (round.gameType === 'real_or_fake_flag') return result.correctChoice;
    // `higher_lower` en `odd_one_out` tellen per index; de verdeling gebruikt
    // die als tekstsleutel ('0'..'3'), dus vergelijken op string.
    if (round.gameType === 'higher_lower') {
      return result.correctSide === null ? null : String(result.correctSide);
    }
    if (round.gameType === 'odd_one_out') {
      return result.correctCardIndex === null ? null : String(result.correctCardIndex);
    }
    return result.correctOptionId;
  }

  /**
   * De uitlegregel van "Welke hoort er niet bij" (punt 11: de afwijklogica
   * wordt ná het antwoord kort getoond). Elke logica heeft zijn eigen zin;
   * ontbreekt `resultDetails`, dan tonen we niets in plaats van iets te
   * verzinnen.
   */
  function uitlegVoor(details) {
    if (details === null || typeof details !== 'object') return null;
    if (details.logic === 'fake_among_real') return t('game.oddOneOutWhyFake');
    if (details.logic === 'real_among_fake') return t('game.oddOneOutWhyReal');
    if (typeof details.majorityContinent !== 'string' || typeof details.minorityContinent !== 'string') {
      return null;
    }
    return t('game.oddOneOutWhy')
      .replace('{majority}', t(`continent.${details.majorityContinent}`))
      .replace('{minority}', t(`continent.${details.minorityContinent}`));
  }

  /** Correcte-antwoordtekst per gameType — zelfde bronvelden als gameplay.mjs. */
  function correctAnswerTextFor(round, lang) {
    const result = round.result;
    if (round.gameType === 'real_or_fake_flag') {
      return t(result.correctChoice === 'real' ? 'game.wasReal' : 'game.wasFake');
    }
    if (round.gameType === 'higher_lower') {
      const side = round.question?.sides?.find((s) => s.side === result.correctSide);
      return side ? countryName(side.iso2, lang) : null;
    }
    if (round.gameType === 'odd_one_out') {
      const kaart = round.question?.cards?.find((c) => c.cardIndex === result.correctCardIndex);
      if (kaart === undefined) return null;
      // Een gegenereerde vlag heeft geen land; dan noemt de kaart wát het was.
      return kaart.spec !== undefined && kaart.spec !== null
        ? t('game.oddOneOutFakeAnswer')
        : countryName(kaart.iso2, lang);
    }
    return result.correctOptionId !== null ? countryName(result.correctOptionId, lang) : null;
  }

  /**
   * @param {import('./standings-model.mjs').standingsFrom extends (p: any) => infer R ? R : never} standings
   * @param {{ movement?: Map<string, number>, participants?: Map<string, string>, round?: object | null, lang?: string, pacing?: string }} [options] S15:
   *   positieverschil t.o.v. de vorige stand (`rankMovementFrom()`,
   *   session-shell.mjs) — geen entry (nieuwe speler, of nog geen vorige
   *   stand) toont geen badge. `participants` voor de comeback-headline
   *   (S14), om de naam bij de grootste stijger te tonen. `round` (scherm 5):
   *   het roundModel van de zojuist geëindigde ronde — zonder `result` (bv.
   *   reload middenin SCOREBOARD, snapshot draagt geen rondeuitslag) blijft
   *   de revealkaart gewoon verborgen en is dit het oude tussenstand-scherm.
   *   `phase` stuurt de twee beats: tijdens ROUND_RESULT (beat 1) is alleen
   *   de reveal zichtbaar — de stand van dát moment is nog de vórige ronde
   *   (scoreboard:updated komt pas bij de faseovergang, zie reveal-model.mjs)
   *   en die tonen zou verkeerde bewegingspijlen geven. Beat 2 (SCOREBOARD)
   *   toont beide. Reload zonder result valt terug op alleen-de-stand.
   */
  let lastDrainKey = null;

  /**
   * Hoe lang de speler vanaf NU nog op de volgende vraag wacht, in seconden.
   *
   * Vanaf beat 1 (ROUND_RESULT) is dat de volledige uitslagtijd: eerst
   * `resultSeconds`, daarna `scoreboardSeconds`. Wie pas bij beat 2 binnenkomt
   * (herladen middenin SCOREBOARD) heeft de eerste beat al gemist; dan is
   * alleen `scoreboardSeconds` nog waar. Ontbreekt een waarde in de
   * serverconfig, dan vallen we terug op de defaults uit
   * `server/composition/room-lifecycle.mjs` — niets verzinnen, wel de bekende
   * standaard gebruiken zodat de balk niet stilvalt.
   *
   * @param {string|null} huidigeFase
   * @param {number|null} result seconden voor beat 1
   * @param {number|null} scoreboard seconden voor beat 2
   * @returns {number}
   */
  function wachtSeconden(huidigeFase, result, scoreboard) {
    const positief = (waarde, standaard) =>
      typeof waarde === 'number' && waarde > 0 ? waarde : standaard;
    const beatTwee = positief(scoreboard, 4);
    return huidigeFase === 'ROUND_RESULT' ? positief(result, 5) + beatTwee : beatTwee;
  }

  function update(standings, { movement = new Map(), participants = new Map(), round = null, lang = 'nl', pacing = null, phase = null, scoreboardSeconds = null, resultSeconds = null } = {}) {
    // ── Scherm 5, beat 1: reveal ──
    const result = round?.result ?? null;
    // Beat 1 = ROUND_RESULT mét een uitslag om te tonen; anders (SCOREBOARD,
    // of een reload zonder result) direct beat 2.
    const beatOne = phase === 'ROUND_RESULT' && result !== null;
    for (const node of [title, list, selfLine]) {
      node.hidden = beatOne;
    }
    const answerText = result !== null ? correctAnswerTextFor(round, lang) : null;
    revealCard.hidden = answerText === null;
    if (answerText !== null) {
      revealAnswer.textContent = answerText;
      // "9 van 14 zaten goed" — alleen als beide getallen er echt zijn:
      // het aantal goede antwoorden uit de distributie, het totaal uit de
      // laatste round:progress (eligiblePlayerCount). Niets verzinnen.
      const correctKey = correctDistributionKeyFor(round);
      const correctCount = Array.isArray(result.distribution) && correctKey !== null
        ? (result.distribution.find((d) => d.optionId === correctKey)?.count ?? null)
        : null;
      // De uitlegregel: alleen tonen als de server de continenten meestuurde
      // (`resultDetails`). Niets verzinnen als ze ontbreken.
      const details = result.resultDetails ?? null;
      const uitleg = round.gameType === 'odd_one_out' ? uitlegVoor(details) : null;
      revealWhy.hidden = uitleg === null;
      revealWhy.textContent = uitleg ?? '';

      const total = round.progress?.eligiblePlayerCount ?? null;
      if (typeof correctCount === 'number' && typeof total === 'number' && total > 0) {
        revealCount.hidden = false;
        revealCount.textContent = t('reveal.countCorrect').replace('{n}', String(correctCount)).replace('{m}', String(total));
      } else {
        revealCount.hidden = true;
        revealCount.textContent = '';
      }
    }

    // ── Scherm 5, beat 1b: eigen resultaat + punten ──
    revealSelf.hidden = result === null;
    if (result !== null) {
      const state = result.selfNoAnswer ? 'noanswer' : result.selfCorrect ? 'correct' : 'wrong';
      revealSelf.dataset.state = state;
      revealSelfIcon.textContent = state === 'correct' ? '✓' : state === 'wrong' ? '✗' : '·';
      revealSelfText.textContent = t(
        state === 'correct' ? 'reveal.youCorrect' : state === 'wrong' ? 'reveal.youWrong' : 'reveal.youNone'
      );
      const points = typeof result.roundPoints === 'number' ? result.roundPoints : null;
      revealSelfPoints.hidden = points === null;
      revealSelfPoints.textContent = points !== null ? `+${points}` : '';
    }
    // M9/E11: FLIP — meet waar bestaande rijen NU staan (op `playerId`,
    // vóór de herbouw), zodat we ze ná de herbouw naar hun oude plek terug
    // kunnen zetten en dan pas laten bewegen naar de nieuwe. Overgeslagen
    // onder reduced motion: `06` §7 verbiedt bewegende rankrows met naam.
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousRects = new Map();
    if (!reduceMotion) {
      for (const item of list.children) {
        const playerId = item.dataset.playerId;
        if (playerId) {
          previousRects.set(playerId, item.getBoundingClientRect());
        }
      }
    }

    list.textContent = '';
    standings.entries.slice(0, 5).forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = entry.isSelf ? 'scoreboard-entry is-self' : 'scoreboard-entry';
      item.dataset.playerId = entry.playerId;
      // S15 toont top vijf plús de eigen rij, dus de reeks is discontinu —
      // #1 t/m #5 en dan #12. "De zoveelste rij" klopt daar niet, dus de rang
      // staat er expliciet bij (`05` §10: rankkolom vast).
      // §A3: `entry.position` komt van de server (competitierang: bij een
      // gelijke stand delen twee spelers een nummer). De rijvolgorde is dus
      // niet hetzelfde als het rangnummer — daarom nooit `index + 1`.
      const rank = el('span', 'scoreboard-rank');
      rank.textContent = `#${entry.position}`;
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
      item.append(rank, name, move, score);
      list.appendChild(item);
    });

    // M9/E11: FLIP-afspelen — voor elke rij die vóór en ná bestond, zet 'm
    // direct terug op zijn oude plek (geen transitie), forceer een reflow,
    // verwijder de offset mét transitie zodat 'm zichtbaar naar de nieuwe
    // plek "beweegt". `--ease-rank` is hier letterlijk voor bedoeld (06 §3).
    if (!reduceMotion && previousRects.size > 0) {
      for (const item of list.children) {
        const previousRect = previousRects.get(item.dataset.playerId);
        if (previousRect === undefined) {
          continue;
        }
        const newRect = item.getBoundingClientRect();
        const deltaY = previousRect.top - newRect.top;
        if (deltaY === 0) {
          continue;
        }
        item.style.transition = 'none';
        item.style.transform = `translateY(${deltaY}px)`;
        void item.offsetHeight; // forceer reflow vóór de transitie
        item.style.transition = 'transform var(--motion-emphasis) var(--ease-rank)';
        item.style.transform = '';
      }
    }

    // Eigen rij: korte emphasis bovenop de FLIP-beweging, alleen bij een
    // daadwerkelijke rangwijziging (niet bij elke render).
    const selfDiff = standings.self !== null ? movement.get(standings.self.playerId) : undefined;
    if (!reduceMotion && typeof selfDiff === 'number' && selfDiff !== 0) {
      const selfRow = list.querySelector('.scoreboard-entry.is-self');
      selfRow?.classList.add('scoreboard-entry-emphasis');
    }

    if (standings.self !== null) {
      selfLine.textContent =
        standings.self.position !== null
          ? `${t('standings.you')}: #${standings.self.position} — ${standings.self.score}`
          : `${t('standings.you')}: ${standings.self.score}`;
    } else {
      selfLine.textContent = '';
    }

    // S14: sinds ROUND_RESULT hier ook landt (besluit 40) draagt dit scherm
    // álle headline-typen — de distribution-gebaseerde (gameplay's oude
    // reveal-headlines) én de comeback uit de rankbeweging. Nog steeds
    // hooguit één per ronde (social-headline.mjs kiest).
    const found = socialHeadlineFor({
      distribution: result?.distribution ?? [],
      correctOptionId: result === null ? null : correctDistributionKeyFor(round),
      eligiblePlayerCount: round?.progress?.eligiblePlayerCount ?? null,
      movement: beatOne ? new Map() : movement, // stale beweging nooit in beat 1
      participants,
      selfCorrect: result?.selfCorrect,
    });
    if (found !== null) {
      headline.hidden = false;
      headline.textContent = textForHeadline(found, lang);
    } else {
      headline.hidden = true;
      headline.textContent = '';
    }

    // ── Scherm 5, voet ──
    nextFooter.hidden = pacing !== 'auto' && pacing !== 'host';
    if (!nextFooter.hidden) {
      nextBar.hidden = pacing !== 'auto';
      nextText.textContent = t(pacing === 'auto' ? 'standings.nextAuto' : 'standings.nextHost');
      // Feedbackronde 2 (punt 12): geen pendel — een echte aflopende balk.
      //
      // Punt 40 (B2): de balk startte op `phase === 'SCOREBOARD'`, terwijl de
      // voet al zichtbaar is vanaf ROUND_RESULT (beat 1). De speler keek dus
      // eerst `resultSeconds` lang naar een balk die vol stilstond — dat is de
      // "voortgangsbalk loopt niet af" van IMG_0296. De balk hoort af te lopen
      // over de tijd die de speler DAADWERKELIJK wacht, en dat zijn beide
      // beats samen; daarom start hij nu bij de eerste render mét uitslag en
      // loopt hij door de faseovergang heen (`drainKey` is de ronde, niet
      // meer ronde+fase — anders herstartte hij halverwege op vol).
      const bar = nextBar.firstElementChild;
      const drainKey = round?.roundId ?? null;
      if (pacing === 'auto' && bar != null && typeof bar.style === 'object' && drainKey !== null && drainKey !== lastDrainKey) {
        lastDrainKey = drainKey;
        bar.style.animation = 'none';
        void bar.offsetWidth; // reflow zodat de animatie echt herstart
        bar.style.animation = `reveal-drain ${wachtSeconden(phase, resultSeconds, scoreboardSeconds)}s linear forwards`;
      }
    }
  }

  // Zelfde sleutel-mapping als gameplay.mjs's textForHeadline — de
  // distribution-headlines zijn met besluit 40 meeverhuisd naar dit scherm.
  function textForHeadline(found, lang) {
    if (found.type === 'self-sole-correct') {
      return t('headline.selfSoleCorrect');
    }
    if (found.type === 'everyone-correct') {
      return t('headline.everyoneCorrect');
    }
    if (found.type === 'everyone-wrong') {
      return t('headline.everyoneWrong');
    }
    if (found.type === 'misleading-answer') {
      return t('headline.misleadingAnswer').replace('{country}', countryName(found.optionId, lang));
    }
    if (found.type === 'comeback') {
      return t('headline.comeback').replace('{naam}', found.name).replace('{n}', String(found.diff));
    }
    return '';
  }

  return { update };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
