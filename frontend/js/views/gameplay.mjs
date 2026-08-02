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

export function createGameplayView({ root, t, onAnswer, lang = 'nl' }) {
  root.textContent = '';

  // Screenreader-only titel: dit scherm heeft geen zichtbare <h1>/<h2> (de
  // ronde-header is bewust klein, geen paginatitel), maar een screenreader
  // heeft bij elke schermwissel wél een aankondigingspunt nodig.
  const screenTitle = el('h2', 'sr-only');
  screenTitle.textContent = t('game.screenTitle');

  const header = el('div', 'gameplay-header');
  const roundLabel = el('p', 'gameplay-round');
  const timer = el('p', 'gameplay-timer');
  header.append(roundLabel, timer);

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

  root.append(screenTitle, header, flag, options, status, progress, result);

  let renderedRoundId = null;
  let optionButtons = new Map();

  function update(model, { secondsLeft = null } = {}) {
    const state = displayState(model);

    if (state === 'empty') {
      roundLabel.textContent = '';
      timer.textContent = '';
      flag.removeAttribute('src');
      options.textContent = '';
      status.textContent = '';
      progress.textContent = '';
      result.textContent = '';
      renderedRoundId = null;
      return;
    }

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

    // Uitslag — uitsluitend uit round:ended
    if (model.result !== null && result.childElementCount === 0) {
      const correct = el('p', 'gameplay-correct');
      correct.textContent = `${t('game.correctAnswer')}: ${countryName(model.result.correctOptionId, lang)}`;
      const own = el('p', model.result.selfCorrect ? 'gameplay-own is-correct' : 'gameplay-own is-wrong');
      own.textContent = model.result.selfCorrect ? t('game.youWereRight') : t('game.youWereWrong');
      result.append(correct, own);
      if (model.result.selfScore !== null) {
        const score = el('p', 'gameplay-score');
        score.textContent = `${t('game.yourScore')}: ${model.result.selfScore}`;
        result.append(score);
      }
      const correctBtn = optionButtons.get(model.result.correctOptionId);
      if (correctBtn) correctBtn.classList.add('is-correct');
    }
  }

  return { update };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
