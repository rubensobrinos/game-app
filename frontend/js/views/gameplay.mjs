// views/gameplay.mjs — UI3. DOM-laag van het spelscherm. Alle logica zit in
// round-model.mjs (puur, getest); dit bestand rendert alleen en vertaalt
// tikken naar callbacks. Regels (UI3-gameplay-screen.md): nooit innerHTML
// voor payloadcontent, nooit goed/fout vóór round:ended, timer via
// secondsRemaining herberekend per render-tick.
//
// 14-S09-S10: dit bestand was ooit flags_mc-only. De "shell" (kop, timer,
// status, voortgang, uitslagstempel, sociale headline) is gedeeld over alle
// drie de spelvormen; alleen de vraagopbouw en de correcte-antwoord-tekst
// takken af op `model.gameType`. `options`/`.gameplay-option` wordt voor alle
// drie hergebruikt (vier landknoppen / Echt-Nep / de twee zijden van een
// duel) — geen los `duel`-blok, minder nieuwe structuur.
//
// Gebruik (bedrading door app.mjs / de viewswitcher, UI0):
//   const view = createGameplayView({ root, t, onAnswer });
//   view.update(model, { secondsLeft });   // bij elk event of timer-tick
// `onAnswer(value)` doet zelf de transport-send; `value` is de iso2 (flags_mc),
// 'real'/'fake' (real_or_fake_flag) of 0/1 (higher_lower) — de aanroeper (
// session-shell.mjs) weet via `roundModel.gameType`/`answerPayloadFor()` welke
// `round:answer`-vorm daarbij hoort. De aanroeper past daarna het model aan
// (selectOption/selectChoice/selectSide) en roept update opnieuw.

import { countryName, flagAssetPath } from './country-names.mjs';
import { displayState, optionsLocked } from './round-model.mjs';
import { headlineRevealed } from './reveal-model.mjs';
import { socialHeadlineFor } from './social-headline.mjs';
import { renderFlagSpec } from './flag-renderer.mjs';

/** Waarde die de speler net gekozen heeft, ongeacht gameType. */
function selectedValueFor(model) {
  if (model.gameType === 'real_or_fake_flag') return model.selectedChoice;
  if (model.gameType === 'higher_lower') return model.selectedSide;
  return model.selectedOptionId;
}

/** Het bevestigde juiste antwoord (pas ná round:ended), ongeacht gameType. */
function correctValueFor(model) {
  if (model.result === null) return null;
  if (model.gameType === 'real_or_fake_flag') return model.result.correctChoice;
  if (model.gameType === 'higher_lower') return model.result.correctSide;
  return model.result.correctOptionId;
}

export function createGameplayView({ root, t, onAnswer, lang = 'nl' }) {
  root.textContent = '';

  // Screenreader-only titel: dit scherm heeft geen zichtbare <h1>/<h2> (de
  // ronde-header is bewust klein, geen paginatitel), maar een screenreader
  // heeft bij elke schermwissel wél een aankondigingspunt nodig.
  const screenTitle = el('h2', 'sr-only');
  screenTitle.textContent = t('game.screenTitle');

  // S07: countdown als sub-state van dit scherm (geen aparte view/mount-
  // cyclus, zie 04-S07-countdown.md) — `model` (roundModel) is tijdens
  // `COUNTDOWN` nog leeg, dus dit vervangt tijdelijk alles eronder i.p.v. er
  // "boven" te zitten.
  const countdown = el('p', 'gameplay-countdown');
  countdown.setAttribute('aria-live', 'polite');
  countdown.hidden = true;

  const header = el('div', 'gameplay-header');
  const roundLabel = el('p', 'gameplay-round');
  // M8/E07: thema 2 leverde de balkvorm (`.timer`/`.timer-track`/
  // `.timer-fill`, T2-3, 05 §9) en de contrast-kant van `.is-urgent`
  // (`components.css`) al, met expliciet "de puls is thema 3's werk" — dit
  // bouwt op die structuur voort i.p.v. een eigen platte-tekst-timer.
  const timer = el('div', 'timer');
  const timerTrack = el('div', 'timer-track');
  const timerFill = el('div', 'timer-fill');
  timerTrack.appendChild(timerFill);
  const timerValue = el('p', 'timer-value');
  timer.append(timerTrack, timerValue);
  header.append(roundLabel, timer);

  const questionPrompt = el('p', 'gameplay-question');

  const flag = document.createElement('img');
  flag.className = 'gameplay-flag';
  // Nooit leeg: dit ís de vraag, geen decoratie. Wel bewust generiek — de
  // landnaam in alt-tekst zou het antwoord verklappen aan wie een
  // screenreader gebruikt, vóórdat ze kunnen "kijken" zoals een ziende
  // speler. Zelfde vraag, zelfde uitdaging, geen voorsprong of achterstand.
  flag.alt = t('game.flagAlt');
  // T5-4 (gemeten): zonder dit toont een falende asset (404, of lokaal het
  // bekende `/flags/*`-gat) het browser-standaard gebroken-icoon. Fallback
  // toont dezelfde `alt`-tekst als zichtbare tekst i.p.v. onzichtbaar attribuut
  // — geen landnaam (08 §7: geen antwoordlek), wél duidelijk dat er een vlag
  // hoorde te staan.
  const flagFallback = el('p', 'gameplay-flag-fallback');
  flagFallback.hidden = true;
  flag.addEventListener('error', () => {
    flag.hidden = true;
    flagFallback.hidden = false;
    flagFallback.textContent = t('game.flagAlt');
  });

  // S09, `question.kind === 'generated'`: geen bestaand vlagasset, canvas
  // tekent `flag-renderer.mjs`'s poort van de singleplayer-renderer i.p.v.
  // een <img src>. Zelfde `alt`-discipline als `flag` hierboven (geen
  // landnaam-lek — hier is er sowieso geen bestaand land).
  const flagCanvas = document.createElement('canvas');
  flagCanvas.className = 'gameplay-flag gameplay-flag-canvas';
  flagCanvas.setAttribute('role', 'img');
  flagCanvas.hidden = true;

  const options = el('div', 'gameplay-options');
  const status = el('p', 'gameplay-status');
  status.setAttribute('aria-live', 'polite');
  const progress = el('p', 'gameplay-progress');
  const result = el('div', 'gameplay-result');
  result.setAttribute('aria-live', 'polite');
  result.setAttribute('aria-atomic', 'true');

  // S13/S14: sociale headline, hooguit één, pas ná een korte vertraging
  // (reveal-model.mjs) — een tik op de uitslag toont 'm meteen (overslaanbaar,
  // zelfde patroon als podium.mjs's 3→2→1-opbouw).
  const headline = el('p', 'gameplay-headline');
  headline.setAttribute('aria-live', 'polite');
  headline.hidden = true;
  result.addEventListener('click', () => {
    if (revealedRoundId !== null) {
      skippedReveal = true;
      renderHeadline();
    }
  });

  root.append(screenTitle, countdown, header, questionPrompt, flag, flagCanvas, flagFallback, options, status, progress, result, headline);

  let renderedRoundId = null;
  let optionButtons = new Map(); // value (iso2 | 'real'/'fake' | 0/1) -> button
  // Reveal-pacing (S13): lokale Date.now(), geen servertijd nodig — dit
  // bepaalt alleen hoe lang dít scherm wacht vóór het de headline toont, geen
  // cross-client-gesynchroniseerd moment zoals de rondetimer.
  let revealedRoundId = null;
  let revealedAt = null;
  let skippedReveal = false;
  let lastRoundModel = null;

  /** Bouwt de vraag opnieuw op — takt af op `model.gameType`. */
  function buildQuestion(model) {
    flag.hidden = true;
    flagFallback.hidden = true;
    flagCanvas.hidden = true;
    options.textContent = '';
    options.classList.toggle('gameplay-options-duel', model.gameType === 'higher_lower');
    optionButtons = new Map();

    if (model.gameType === 'real_or_fake_flag') {
      questionPrompt.textContent = t('game.realOrFakePrompt');
      const q = model.question;
      if (q.kind === 'real') {
        flag.hidden = false;
        flag.src = flagAssetPath(q.iso2);
      } else {
        flagCanvas.hidden = false;
        flagCanvas.setAttribute('aria-label', t('game.flagAlt'));
        renderFlagSpec(flagCanvas, q.spec);
      }
      for (const choice of ['real', 'fake']) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gameplay-option';
        btn.textContent = t(choice === 'real' ? 'game.choiceReal' : 'game.choiceFake');
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onAnswer(choice));
        optionButtons.set(choice, btn);
        options.appendChild(btn);
      }
      return;
    }

    if (model.gameType === 'higher_lower') {
      const metricLabel = t(`game.metric.${model.question.metric}`);
      // Geen vertaling voor een onbekende metric bekend: toon de rauwe
      // waarde i.p.v. een lege/kapotte string — expliciet punt voor
      // ../PROGRESS.md, geen aanname over een vaste metric-set (14's DoD).
      questionPrompt.textContent = t('game.higherLowerPrompt').replace(
        '{metric}',
        metricLabel === `game.metric.${model.question.metric}` ? model.question.metric : metricLabel,
      );
      for (const { side, iso2 } of model.question.sides) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gameplay-option gameplay-option-duel';
        const btnFlag = document.createElement('img');
        btnFlag.className = 'gameplay-option-duel-flag';
        btnFlag.src = flagAssetPath(iso2);
        btnFlag.alt = '';
        btnFlag.setAttribute('aria-hidden', 'true');
        const btnName = document.createElement('span');
        btnName.textContent = countryName(iso2, lang);
        btn.append(btnFlag, btnName);
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onAnswer(side));
        optionButtons.set(side, btn);
        options.appendChild(btn);
      }
      return;
    }

    // flags_mc (default)
    questionPrompt.textContent = t('game.questionPrompt');
    flag.hidden = false;
    flag.src = flagAssetPath(model.question.targetIso2);
    for (const iso2 of model.question.optionIso2s) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gameplay-option';
      btn.textContent = countryName(iso2, lang);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => onAnswer(iso2));
      optionButtons.set(iso2, btn);
      options.appendChild(btn);
    }
  }

  /** Tekst + eventuele markering voor de correcte-antwoord-stempel, per gameType. */
  function correctAnswerStampText(model) {
    if (model.gameType === 'real_or_fake_flag') {
      return t(model.result.correctChoice === 'real' ? 'game.wasReal' : 'game.wasFake');
    }
    if (model.gameType === 'higher_lower') {
      const side = model.question.sides.find((s) => s.side === model.result.correctSide);
      const name = side ? countryName(side.iso2, lang) : '';
      const metricLabel = t(`game.metric.${model.question.metric}`);
      return t('game.higherLowerResult')
        .replace('{country}', name)
        .replace('{metric}', metricLabel === `game.metric.${model.question.metric}` ? model.question.metric : metricLabel);
    }
    return `${t('game.correctAnswer')}: ${countryName(model.result.correctOptionId, lang)}`;
  }

  function update(model, { secondsLeft = null, phase = null, countdownSecondsLeft = null } = {}) {
    // Reken het getal uit de resterende tijd (`secondsRemaining()` rondt al af
    // op hele seconden) — geen vaste `3`/`2`/`1`-reeks aannemen, want de
    // serverduur kan afwijken (zie 04-S07-countdown.md's HANDOFF-punt over
    // `COUNTDOWN_MS` vs. `03` §6).
    countdown.hidden = phase !== 'COUNTDOWN';
    if (!countdown.hidden) {
      countdown.textContent = countdownSecondsLeft === null ? '' : String(countdownSecondsLeft);
    }

    const state = displayState(model);

    if (state === 'empty') {
      roundLabel.textContent = '';
      timerValue.textContent = '';
      timerFill.style.width = '100%';
      timer.classList.remove('is-urgent');
      questionPrompt.hidden = true;
      flag.removeAttribute('src');
      flag.hidden = false;
      flagFallback.hidden = true;
      flagCanvas.hidden = true;
      options.textContent = '';
      status.textContent = '';
      progress.textContent = '';
      result.textContent = '';
      renderedRoundId = null;
      headline.hidden = true;
      revealedRoundId = null;
      return;
    }

    lastRoundModel = model;

    questionPrompt.hidden = false;

    // Ronde-header
    roundLabel.textContent =
      model.roundNumber !== null && model.totalRounds !== null
        ? `${t('game.round')} ${model.roundNumber}/${model.totalRounds}`
        : '';

    // Vraag (her)opbouwen bij een nieuwe ronde
    if (model.roundId !== renderedRoundId) {
      renderedRoundId = model.roundId;
      buildQuestion(model);
      result.textContent = '';
    }

    // Vergrendeling + eigen selectie zichtbaar (géén goed/fout-kleur vóór ended)
    const locked = optionsLocked(model);
    const selectedValue = selectedValueFor(model);
    // M2/E06: dimmen pas ná serverbevestiging (`accepted`), niet al tijdens
    // `sending` — dat zou een bevestiging suggereren die er nog niet is
    // (reviewbevinding, exacte toestandstabel in M2's prompt).
    const dimOthers = model.answerStatus === 'accepted';
    for (const [value, btn] of optionButtons) {
      btn.disabled = locked;
      const selected = value === selectedValue;
      btn.classList.toggle('is-selected', selected);
      btn.classList.toggle('is-dimmed', dimOthers && !selected);
      // `.is-selected`/`.is-dimmed` zijn puur visueel; `aria-pressed` is wat
      // een screenreader hoort — zelfde discipline als app-menu.mjs's
      // taal-/themaknoppen.
      btn.setAttribute('aria-pressed', String(selected));
    }

    // Verzendstatus
    if (model.result !== null) {
      status.textContent = '';
    } else if (model.answerStatus === 'sending') {
      status.textContent = t('game.sending');
    } else if (model.answerStatus === 'accepted') {
      status.textContent = t('game.received');
    } else if (model.answerStatus === 'rejected') {
      status.textContent = model.rejectionCode === 'DEADLINE_PASSED' ? t('game.tooLate') : t('game.notAccepted');
    } else {
      status.textContent = '';
    }

    // Timer en voortgang (verborgen zodra de uitslag er is)
    if (model.result === null) {
      timerValue.textContent = secondsLeft === null ? '' : String(Math.max(0, secondsLeft));
      // M8/E07: `.timer-fill`'s breedte volgt de resterende tijd —
      // `model.startsAt`/`endsAt` staan al op het model (round-model.mjs),
      // geen aparte totaalduur-parameter nodig. Urgentie (contrast + puls)
      // pas in de laatste drie seconden (06 §4 E07, checklist F).
      const totalSeconds =
        model.startsAt !== null && model.endsAt !== null
          ? Math.max(1, Math.round((model.endsAt - model.startsAt) / 1000))
          : null;
      const fillPercent =
        totalSeconds !== null && secondsLeft !== null
          ? Math.max(0, Math.min(100, (Math.max(0, secondsLeft) / totalSeconds) * 100))
          : 100;
      timerFill.style.width = `${fillPercent}%`;
      timer.classList.toggle('is-urgent', secondsLeft !== null && secondsLeft <= 3);
      progress.textContent = model.progress
        ? `${model.progress.answeredCount}/${model.progress.eligiblePlayerCount} ${t('game.answered')}`
        : '';
    } else {
      timerValue.textContent = '';
      timer.classList.remove('is-urgent');
      progress.textContent = '';
    }

    // Uitslag — uitsluitend uit round:ended. Drie gelijkwaardige staten via
    // één stempelcomponent (09-CONTENT-AND-MICROCOPY.md §9: JUIST/ONJUIST/
    // GEEN ANTWOORD) — hoofdletters komen van CSS (`.gameplay-own`,
    // text-transform), niet van de vertaalwaarde zelf.
    if (model.result !== null && result.childElementCount === 0) {
      // M2/E09: de volledige tekst gaat direct + synchroon de DOM/aria-live-
      // regio in (accessibility-eis: nooit een timer die de accessibility
      // tree ophoudt) — `gameplay-reveal-enter` hieronder is uitsluitend een
      // visuele fade, geen vertraagde tekstinvoeging.
      const correct = el('p', 'gameplay-correct gameplay-reveal-enter');
      correct.textContent = correctAnswerStampText(model);
      const resultClass = model.result.selfNoAnswer ? 'is-noanswer' : model.result.selfCorrect ? 'is-correct' : 'is-wrong';
      const resultKey = model.result.selfNoAnswer
        ? 'game.resultNoAnswer'
        : model.result.selfCorrect
          ? 'game.resultCorrect'
          : 'game.resultIncorrect';
      const own = el('p', `gameplay-own ${resultClass} gameplay-reveal-enter`);
      own.textContent = t(resultKey);
      result.append(correct, own);
      if (model.result.roundPoints !== null) {
        // M2/E10: twee losse nodes — de `aria-hidden`-span animeert
        // visueel, de `sr-only`-span krijgt meteen de definitieve waarde.
        // Eén tekstnode die 0,1,2… doorloopt is onbetrouwbaar voor
        // assistive technology (leest mogelijk elke tussenwaarde).
        const score = el('p', 'gameplay-score gameplay-reveal-enter');
        score.append(`${t('game.roundPoints')}: `);
        const scoreAnimated = el('span', 'gameplay-score-animated');
        scoreAnimated.setAttribute('aria-hidden', 'true');
        scoreAnimated.textContent = '0';
        const scoreSrOnly = el('span', 'sr-only');
        scoreSrOnly.textContent = String(model.result.roundPoints);
        score.append(scoreAnimated, scoreSrOnly);
        result.append(score);
        animateScoreCount(scoreAnimated, model.result.roundPoints);
      }
      // M2/E09: correcte optie krijgt eerst accent (deze klasse, direct) —
      // het tekstblok hierboven verschijnt daarna (animation-delay in CSS),
      // een vaste, korte opbouwvolgorde i.p.v. alles ineens.
      const correctValue = correctValueFor(model);
      const correctBtn = optionButtons.get(correctValue);
      if (correctBtn) correctBtn.classList.add('is-correct');
      // M2/E09: foute eigen keuze — kleur is nooit de enige informatiedrager
      // (11 K). `.is-wrong` (niet-kleur ✕-icoon, components.css) plus een
      // sr-only-label direct op de knop, náást de al bestaande
      // aria-live-tekst in `.gameplay-own`.
      if (selectedValue !== null && selectedValue !== correctValue) {
        const wrongBtn = optionButtons.get(selectedValue);
        if (wrongBtn) {
          wrongBtn.classList.add('is-wrong');
          const ownAnswerLabel = el('span', 'sr-only');
          ownAnswerLabel.textContent = t('game.ownAnswer');
          wrongBtn.appendChild(ownAnswerLabel);
        }
      }
    }

    // S13: eerste keer dat dít ronderesultaat verschijnt — reveal-klok
    // starten. Ná dezelfde-ronde-ticks (elke 250ms, session-shell.mjs's
    // ticker) blijft dit ongewijzigd, geen herstart per tick.
    if (model.result !== null && revealedRoundId !== model.roundId) {
      revealedRoundId = model.roundId;
      revealedAt = Date.now();
      skippedReveal = false;
    }
    renderHeadline();
  }

  // S14: hooguit één sociale headline, alleen ná de reveal-vertraging (of een
  // tik om te skippen). Puur uit rondelokale data (distribution/eligible-
  // PlayerCount) — comeback vuurt hier bewust nooit (movement leeg, zie
  // reveal-model.mjs voor waarom), die hoort bij scoreboard.mjs. Werkt
  // ongewijzigd voor alle drie de spelvormen: `distribution` is altijd een
  // telling per antwoordwaarde, ongeacht wat die waarde betekent.
  function renderHeadline() {
    if (lastRoundModel === null || lastRoundModel.result === null || revealedRoundId !== lastRoundModel.roundId) {
      headline.hidden = true;
      return;
    }
    const elapsedMs = revealedAt === null ? null : Date.now() - revealedAt;
    if (!headlineRevealed(elapsedMs, skippedReveal)) {
      headline.hidden = true;
      return;
    }
    const found = socialHeadlineFor({
      distribution: lastRoundModel.result.distribution,
      correctOptionId: correctValueFor(lastRoundModel),
      eligiblePlayerCount: lastRoundModel.progress?.eligiblePlayerCount ?? null,
      movement: new Map(),
      participants: new Map(),
      selfCorrect: lastRoundModel.result.selfCorrect,
    });
    if (found === null) {
      headline.hidden = true;
      return;
    }
    headline.hidden = false;
    headline.textContent = textForHeadline(found);
  }

  function textForHeadline(found) {
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
      // Alleen zinvol voor flags_mc: het misleidende antwoord is daar een
      // land. Voor de andere twee spelvormen levert `socialHeadlineFor` dit
      // type sowieso niet op zinvolle wijze op (optionId is dan 'real'/'fake'
      // of 0/1) — geen aparte tekst hiervoor nodig zolang dat pad niet vuurt.
      return t('headline.misleadingAnswer').replace('{country}', countryName(found.optionId, lang));
    }
    return '';
  }

  return { update };
}

// M2/E10: score kort oplopend naar de eindwaarde — puur de aria-hidden-span
// (gameplay.mjs's DOM-structuur houdt de sr-only-span apart en direct
// definitief). Reduced motion expliciet gecheckt: dit is JS-gedreven
// (requestAnimationFrame), M0's CSS-blanket-regel raakt dit niet.
const SCORE_COUNT_DURATION_MS = 500;

function animateScoreCount(node, target) {
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || target <= 0) {
    node.textContent = String(target);
    return;
  }
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / SCORE_COUNT_DURATION_MS);
    node.textContent = String(Math.round(target * progress));
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
