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

import { socialHeadlineFor, pickHeadlineVariantKey } from './social-headline.mjs';
import { countryName, capitalName, capitalsQuestionDirection, flagAssetPath } from './country-names.mjs';
import { renderFlagSpec } from './flag-renderer.mjs';

// 11-verzoek (BOUWSPRINT doel 4): een streak van 1 of 2 is geen "reactie"
// waard. Dezelfde grens als het origineel in gameplay.mjs — GAME-RULES.md
// geeft er geen voorschrift voor, dus geen nieuwe drempel verzinnen.
const STREAK_REACTIE_DREMPEL = 3;

export function createScoreboardView({ root, t, tCount }) {
  root.textContent = '';

  // ── Scherm 5, beat 1: het goede antwoord + eigen resultaat ──
  //
  // B3 (producteigenaar, 5 aug): de kaart was ALTIJD lime, ook als je het
  // antwoord miste — "Geen antwoord +0" onder een feestelijke groene balk.
  // De kleur volgt nu de uitslag: lime bij goed, magenta bij fout, gedempt
  // bij geen antwoord (je hebt niets fout gedaan, je was er niet bij).
  // `data-state` stuurt dat vanuit CSS; kleur is nooit de énige drager —
  // het icoon (✓/✗/·) en de regel eronder zeggen hetzelfde in tekst.
  const revealCard = document.createElement('div');
  revealCard.className = 'reveal-card';
  revealCard.hidden = true;
  const revealLabel = el('span', 'reveal-card-label');
  revealLabel.textContent = t('reveal.correctLabel');

  // B3: de vlag hoort terug op dit scherm. Zonder haar is een vlaggenspel
  // een woord op een scherm — en de lege onderhelft (punt 42) is precies de
  // ruimte die ze nodig heeft. Twee dragers, want een vraagvlag kan
  // GEGENEREERD zijn (`spec`, geen bestaand land): een <img> voor bestaande
  // vlagassets, een <canvas> voor wat `flag-renderer.mjs` tekent.
  const revealMain = el('div', 'reveal-card-main');
  const revealFlag = document.createElement('img');
  revealFlag.className = 'reveal-card-flag';
  revealFlag.alt = '';
  revealFlag.setAttribute('aria-hidden', 'true'); // de landnaam staat ernaast
  revealFlag.hidden = true;
  revealFlag.addEventListener('error', () => {
    // Zelfde discipline als gameplay.mjs: een ontbrekend asset toont geen
    // gebroken-icoon maar simpelweg niets — de naam draagt het antwoord al.
    revealFlag.hidden = true;
  });
  const revealFlagCanvas = document.createElement('canvas');
  revealFlagCanvas.className = 'reveal-card-flag reveal-card-flag-canvas';
  revealFlagCanvas.setAttribute('aria-hidden', 'true');
  revealFlagCanvas.hidden = true;
  const revealAnswer = el('strong', 'reveal-card-answer');
  revealMain.append(revealFlag, revealFlagCanvas, revealAnswer);

  const revealCount = el('span', 'reveal-card-count');
  // Doelbeeld v2 §1: bij "Welke hoort er niet bij" wordt de afwijklogica ná
  // het antwoord kort getoond — anders denkt een speler terecht dat meerdere
  // antwoorden verdedigbaar waren. Dit is de ENIGE uitlegregel die blijft:
  // B3 besluit expliciet géén "waarom"-tekst bij de andere spelvormen.
  const revealWhy = el('span', 'reveal-card-why');
  revealWhy.hidden = true;
  revealCard.append(revealLabel, revealMain, revealCount, revealWhy);

  const revealSelf = document.createElement('div');
  revealSelf.className = 'reveal-self';
  revealSelf.hidden = true;
  const revealSelfIcon = el('span', 'reveal-self-icon');
  const revealSelfText = el('span', 'reveal-self-text');
  const revealSelfPoints = el('strong', 'reveal-self-points');
  revealSelf.append(revealSelfIcon, revealSelfText, revealSelfPoints);

  // B3: je eigen antwoord, klein, en ALLEEN als je ernaast zat. Niet om het
  // in te wrijven — Moldavië en Roemenië verwarren is de leuke bijna-goed,
  // en zonder te zien wát je koos mis je precies dat.
  const revealMine = el('p', 'reveal-mine');
  revealMine.hidden = true;

  // 11-verzoek (BOUWSPRINT doel 4), hersteld: de streakreactie. Stond in
  // gameplay.mjs's uitslagblok en werd daarmee onzichtbaar toen besluit 40 de
  // reveal naar dit scherm verhuisde — de producteigenaar heeft 'm dus nooit
  // gezien terwijl hij erom vroeg.
  //
  // Deelt bewust de plek met `revealMine`: die twee sluiten elkaar uit. Een
  // streak telt alleen door bij `selfCorrect` (streak-model.mjs reset naar 0
  // bij fout of geen antwoord), en `revealMine` verschijnt uitsluitend bij
  // fout. Ze kunnen dus nooit samen zichtbaar zijn, en het scherm wordt er in
  // het slechtste geval geen pixel hoger van.
  const revealStreak = el('p', 'reveal-streak');
  revealStreak.hidden = true;

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

  root.append(revealCard, revealSelf, revealMine, revealStreak, title, list, selfLine, headline, nextFooter);

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

  /**
   * Correcte-antwoordtekst per gameType.
   *
   * B3: dit was de armere van twee implementaties — `gameplay.mjs` had een
   * `correctAnswerStampText()` die bij hoger/lager óók de metric noemde
   * ("Frankrijk had de meeste inwoners"), maar die kon nooit renderen omdat
   * gameplay alleen tijdens COUNTDOWN/ROUND_ACTIVE gemount is en `result`
   * dan altijd `null` is. Die regel is hierheen overgenomen en de dode kopie
   * is verwijderd — twee implementaties van hetzelfde lopen uit elkaar.
   */
  function correctAnswerTextFor(round, lang) {
    const result = round.result;
    if (round.gameType === 'real_or_fake_flag') {
      return t(result.correctChoice === 'real' ? 'game.wasReal' : 'game.wasFake');
    }
    if (round.gameType === 'higher_lower') {
      const side = round.question?.sides?.find((s) => s.side === result.correctSide);
      if (side === undefined) return null;
      const metric = round.question?.metric;
      const metricLabel = t(`game.metric.${metric}`);
      return t('game.higherLowerResult')
        .replace('{country}', countryName(side.iso2, lang))
        // Geen vertaling bekend voor deze metric: de rauwe waarde i.p.v. een
        // kapotte sleutel op het scherm (overgenomen uit gameplay.mjs).
        .replace('{metric}', metricLabel === `game.metric.${metric}` ? String(metric) : metricLabel);
    }
    if (round.gameType === 'odd_one_out') {
      const kaart = round.question?.cards?.find((c) => c.cardIndex === result.correctCardIndex);
      if (kaart === undefined) return null;
      // Een gegenereerde vlag heeft geen land; dan noemt de kaart wát het was.
      return kaart.spec !== undefined && kaart.spec !== null
        ? t('game.oddOneOutFakeAnswer')
        : countryName(kaart.iso2, lang);
    }
    if (round.gameType === 'capitals_mc') {
      // Besluit 49: de vraagRICHTING bepaalt wat "het juiste antwoord" is —
      // bij de gewone vraag ("hoofdstad van X?") is dat de hoofdstad, bij de
      // omgekeerde ("Y hoort bij welk land?", al beantwoord met een landcode)
      // is dat het land. `correctOptionId` is in beide gevallen dezelfde
      // landcode; alleen welke naam we ervan tonen verschilt.
      if (round.question === null || result.correctOptionId === null) return null;
      const direction = capitalsQuestionDirection(round.question.targetIso2, round.question.optionIso2s);
      return direction === 'ask-capital'
        ? capitalName(result.correctOptionId, lang)
        : countryName(result.correctOptionId, lang);
    }
    return result.correctOptionId !== null ? countryName(result.correctOptionId, lang) : null;
  }

  /**
   * De vlag die bij het JUISTE antwoord hoort, per gameType. Levert óf een
   * `iso2` (bestaand vlagasset) óf een `spec` (gegenereerde vlag) op, of
   * `null` als er niets te tonen valt — dan blijft het beeld gewoon leeg in
   * plaats van dat we een verkeerde vlag verzinnen.
   *
   * @returns {{ iso2: string } | { spec: object } | null}
   */
  function correctFlagFor(round) {
    const result = round.result;
    if (round.gameType === 'real_or_fake_flag') {
      // De vlag die de vraag wás — echt of gegenereerd, dat is nu net de clou.
      const q = round.question;
      if (q?.spec !== undefined && q?.spec !== null) return { spec: q.spec };
      return typeof q?.iso2 === 'string' ? { iso2: q.iso2 } : null;
    }
    if (round.gameType === 'higher_lower') {
      const side = round.question?.sides?.find((s) => s.side === result.correctSide);
      return side === undefined ? null : { iso2: side.iso2 };
    }
    if (round.gameType === 'odd_one_out') {
      // De kaart die het juiste antwoord wás — niet de vraag, die bestaat
      // hier uit vier kaarten tegelijk.
      const kaart = round.question?.cards?.find((c) => c.cardIndex === result.correctCardIndex);
      if (kaart === undefined) return null;
      return kaart.spec !== undefined && kaart.spec !== null ? { spec: kaart.spec } : { iso2: kaart.iso2 };
    }
    // flags_mc: de getoonde vlag ís het antwoord.
    if (typeof round.question?.targetIso2 === 'string') return { iso2: round.question.targetIso2 };
    return typeof result.correctOptionId === 'string' ? { iso2: result.correctOptionId } : null;
  }

  /**
   * Wat de speler zelf koos, als tekst. `null` zodra er niets te tonen valt
   * (geen antwoord, of een selectie die we niet kunnen benoemen) — dan blijft
   * de regel weg in plaats van "Jij: undefined".
   */
  function ownAnswerTextFor(round, lang) {
    if (round.gameType === 'real_or_fake_flag') {
      if (round.selectedChoice === null || round.selectedChoice === undefined) return null;
      return t(round.selectedChoice === 'real' ? 'game.choiceReal' : 'game.choiceFake');
    }
    if (round.gameType === 'higher_lower') {
      const side = round.question?.sides?.find((s) => s.side === round.selectedSide);
      return side === undefined ? null : countryName(side.iso2, lang);
    }
    if (round.gameType === 'odd_one_out') {
      const kaart = round.question?.cards?.find((c) => c.cardIndex === round.selectedCardIndex);
      if (kaart === undefined) return null;
      return kaart.spec !== undefined && kaart.spec !== null
        ? t('game.oddOneOutFakeAnswer')
        : countryName(kaart.iso2, lang);
    }
    if (round.gameType === 'capitals_mc') {
      if (typeof round.selectedOptionId !== 'string' || round.question === null) return null;
      const direction = capitalsQuestionDirection(round.question.targetIso2, round.question.optionIso2s);
      return direction === 'ask-capital'
        ? capitalName(round.selectedOptionId, lang)
        : countryName(round.selectedOptionId, lang);
    }
    return typeof round.selectedOptionId === 'string' ? countryName(round.selectedOptionId, lang) : null;
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

  // Besluit 44: negen varianten per situatie. De keuze valt ÉÉN keer per ronde
  // per situatie — `update()` draait bij elke statuswijziging, en opnieuw
  // kiezen zou de zin onder je ogen laten verspringen. `vorigeSleutel` draagt
  // over rondes heen zodat dezelfde variant nooit twee keer achter elkaar komt.
  let variantKeuze = { roundId: null, type: null, key: null };
  let vorigeSleutel = null;

  /**
   * @param {string} type situatie uit social-headline.mjs
   * @param {string|null} roundId
   * @returns {string} volledige sleutel, bv. `headline.comeback.3`
   */
  function variantSleutel(type, roundId) {
    if (variantKeuze.roundId !== roundId || variantKeuze.type !== type) {
      const key = pickHeadlineVariantKey(type, vorigeSleutel, Math.random);
      variantKeuze = { roundId, type, key };
      vorigeSleutel = key;
    }
    return variantKeuze.key;
  }

  function update(standings, { movement = new Map(), participants = new Map(), round = null, lang = 'nl', pacing = null, phase = null, scoreboardSeconds = null, resultSeconds = null, streak = 0 } = {}) {
    // ── Scherm 5, beat 1: reveal ──
    const result = round?.result ?? null;
    // Beat 1 = ROUND_RESULT mét een uitslag om te tonen; anders (SCOREBOARD,
    // of een reload zonder result) direct beat 2.
    const beatOne = phase === 'ROUND_RESULT' && result !== null;
    for (const node of [title, list, selfLine]) {
      node.hidden = beatOne;
    }
    // Besluit 50: allebei de momenten vullen het scherm. In beat 1 stond alles
    // bovenaan geplakt met een lege onderhelft — de ruimte was gereserveerd
    // voor de tussenstand die pas een paar tellen later komt. Nu centreert de
    // inhoud verticaal zolang de stand nog niet in beeld is. In beat 2 krimpt
    // de uitslagkaart tot één regel, zodat de stand de ruimte krijgt: dat is
    // ook waar de spelersidentiteit en de rijkere reactiezinnen straks heen
    // moeten (besluit 41 en 44).
    root.classList.toggle('is-beat-1', beatOne);
    revealCard.classList.toggle('is-compact', !beatOne && result !== null);
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

      // B3: de kleur van de kaart volgt de uitslag. Zie de toelichting bij
      // `revealCard` hierboven — dit stuurt alleen `data-state`, de kleuren
      // zelf staan in rounda-1c.css.
      revealCard.dataset.state = result.selfNoAnswer ? 'noanswer' : result.selfCorrect ? 'correct' : 'wrong';

      // B3: de vlag terug. `renderFlagSpec` tekent alleen als er echt een
      // spec is; anders het gewone asset. Beide dragers eerst uit, zodat een
      // vorige ronde nooit blijft staan.
      const vlag = correctFlagFor(round);
      revealFlag.hidden = true;
      revealFlagCanvas.hidden = true;
      if (vlag !== null && 'spec' in vlag) {
        revealFlagCanvas.hidden = false;
        renderFlagSpec(revealFlagCanvas, vlag.spec);
      } else if (vlag !== null) {
        revealFlag.hidden = false;
        revealFlag.src = flagAssetPath(vlag.iso2);
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

    // ── Scherm 5, beat 1c: wát je koos, alleen als je ernaast zat ──
    // Bij goed voegt het niets toe (dat staat al groot bovenaan) en bij geen
    // antwoord bestaat het niet.
    const mine = result !== null && !result.selfCorrect && !result.selfNoAnswer
      ? ownAnswerTextFor(round, lang)
      : null;
    revealMine.hidden = mine === null;
    revealMine.textContent = mine === null ? '' : t('reveal.yourAnswer').replace('{answer}', mine);

    // ── Scherm 5, beat 1d: de streakreactie ──
    // Een beloning, geen mededeling: bij een onderbroken streak staat er
    // niets. Dat volgt vanzelf uit `streak-model.mjs` (reset naar 0 bij fout
    // of geen antwoord), dus geen tweede `selfCorrect`-check nodig — die zou
    // alleen maar uit de pas kunnen gaan lopen met het model.
    //
    // `streak` is al `0` van de aanroeper als de speler reactiezinnen heeft
    // uitgezet (session-shell.mjs leest de voorkeur), dus die keuze wordt
    // hier vanzelf gerespecteerd. Nooit een telbare vorm nodig: de drempel is
    // 3, dus dit pad toont nooit "1".
    const toonStreak = result !== null && streak >= STREAK_REACTIE_DREMPEL;
    revealStreak.hidden = !toonStreak;
    revealStreak.textContent = toonStreak
      ? t(variantSleutel('streak', round?.roundId ?? null)).replace('{n}', String(streak))
      : '';

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
      headline.textContent = textForHeadline(found, lang, round?.roundId ?? null);
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
  function textForHeadline(found, lang, roundId) {
    const zin = t(variantSleutel(found.type, roundId));
    if (found.type === 'misleading-answer') {
      return zin.replace('{country}', countryName(found.optionId, lang));
    }
    if (found.type === 'comeback') {
      return zin.replace('{naam}', found.name).replace('{n}', String(found.diff));
    }
    return zin;
  }

  return { update };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
