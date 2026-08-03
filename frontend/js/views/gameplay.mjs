// views/gameplay.mjs — UI3. DOM-laag van het spelscherm (flags_mc). Alle
// logica zit in round-model.mjs (puur, getest); dit bestand rendert alleen en
// vertaalt tikken naar callbacks. Regels (UI3-gameplay-screen.md):
// nooit innerHTML voor payloadcontent, nooit goed/fout vóór round:ended,
// timer via secondsRemaining herberekend per render-tick.
//
// Gebruik (bedrading door app.mjs / de viewswitcher, UI0):
//   const view = createGameplayView({ root, t, onAnswer });
//   view.update(model, { secondsLeft });   // bij elk event of timer-tick
// `onAnswer(optionId)` doet zelf de transport-send; de aanroeper past daarna
// het model aan (selectOption / applyAnswerRejected) en roept update opnieuw.

import { countryName, flagAssetPath } from './country-names.mjs';
import { displayState, optionsLocked } from './round-model.mjs';
import { headlineRevealed } from './reveal-model.mjs';
import { socialHeadlineFor } from './social-headline.mjs';

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
  const timer = el('p', 'gameplay-timer');
  header.append(roundLabel, timer);

  const questionPrompt = el('p', 'gameplay-question');
  questionPrompt.textContent = t('game.questionPrompt');

  const flag = document.createElement('img');
  flag.className = 'gameplay-flag';
  // Nooit leeg: dit ís de vraag, geen decoratie. Wel bewust generiek — de
  // landnaam in alt-tekst zou het antwoord verklappen aan wie een
  // screenreader gebruikt, vóórdat ze kunnen "kijken" zoals een ziende
  // speler. Zelfde vraag, zelfde uitdaging, geen voorsprong of achterstand.
  flag.alt = t('game.flagAlt');

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

  root.append(screenTitle, countdown, header, questionPrompt, flag, options, status, progress, result, headline);

  let renderedRoundId = null;
  let optionButtons = new Map();
  // Reveal-pacing (S13): lokale Date.now(), geen servertijd nodig — dit
  // bepaalt alleen hoe lang dít scherm wacht vóór het de headline toont, geen
  // cross-client-gesynchroniseerd moment zoals de rondetimer.
  let revealedRoundId = null;
  let revealedAt = null;
  let skippedReveal = false;
  let lastRoundModel = null;

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
      timer.textContent = '';
      questionPrompt.hidden = true;
      flag.removeAttribute('src');
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
      flag.src = flagAssetPath(model.question.targetIso2);
      options.textContent = '';
      optionButtons = new Map();
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
      result.textContent = '';
    }

    // Vergrendeling + eigen selectie zichtbaar (géén goed/fout-kleur vóór ended)
    const locked = optionsLocked(model);
    for (const [iso2, btn] of optionButtons) {
      btn.disabled = locked;
      const selected = iso2 === model.selectedOptionId;
      btn.classList.toggle('is-selected', selected);
      // `.is-selected` is puur visueel; `aria-pressed` is wat een screenreader
      // hoort — zelfde discipline als app-menu.mjs's taal-/themaknoppen.
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
      timer.textContent = secondsLeft === null ? '' : String(Math.max(0, secondsLeft));
      progress.textContent = model.progress
        ? `${model.progress.answeredCount}/${model.progress.eligiblePlayerCount} ${t('game.answered')}`
        : '';
    } else {
      timer.textContent = '';
      progress.textContent = '';
    }

    // Uitslag — uitsluitend uit round:ended. Drie gelijkwaardige staten via
    // één stempelcomponent (09-CONTENT-AND-MICROCOPY.md §9: JUIST/ONJUIST/
    // GEEN ANTWOORD) — hoofdletters komen van CSS (`.gameplay-own`,
    // text-transform), niet van de vertaalwaarde zelf.
    if (model.result !== null && result.childElementCount === 0) {
      const correct = el('p', 'gameplay-correct');
      correct.textContent = `${t('game.correctAnswer')}: ${countryName(model.result.correctOptionId, lang)}`;
      const resultClass = model.result.selfNoAnswer ? 'is-noanswer' : model.result.selfCorrect ? 'is-correct' : 'is-wrong';
      const resultKey = model.result.selfNoAnswer
        ? 'game.resultNoAnswer'
        : model.result.selfCorrect
          ? 'game.resultCorrect'
          : 'game.resultIncorrect';
      const own = el('p', `gameplay-own ${resultClass}`);
      own.textContent = t(resultKey);
      result.append(correct, own);
      if (model.result.roundPoints !== null) {
        const score = el('p', 'gameplay-score');
        score.textContent = `${t('game.roundPoints')}: ${model.result.roundPoints}`;
        result.append(score);
      }
      const correctBtn = optionButtons.get(model.result.correctOptionId);
      if (correctBtn) correctBtn.classList.add('is-correct');
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
  // reveal-model.mjs voor waarom), die hoort bij scoreboard.mjs.
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
      correctOptionId: lastRoundModel.result.correctOptionId,
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
      return t('headline.misleadingAnswer').replace('{country}', countryName(found.optionId, lang));
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
