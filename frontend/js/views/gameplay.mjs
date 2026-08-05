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
import { createTimerBar } from '../timer-bar.mjs';

/** Waarde die de speler net gekozen heeft, ongeacht gameType. */
function selectedValueFor(model) {
  if (model.gameType === 'real_or_fake_flag') return model.selectedChoice;
  if (model.gameType === 'higher_lower') return model.selectedSide;
  if (model.gameType === 'odd_one_out') return model.selectedCardIndex;
  return model.selectedOptionId;
}

/** Het bevestigde juiste antwoord (pas ná round:ended), ongeacht gameType. */
function correctValueFor(model) {
  if (model.result === null) return null;
  if (model.gameType === 'real_or_fake_flag') return model.result.correctChoice;
  if (model.gameType === 'higher_lower') return model.result.correctSide;
  if (model.gameType === 'odd_one_out') return model.result.correctCardIndex;
  return model.result.correctOptionId;
}

// 11-verzoek (BOUWSPRINT doel 4): eigen keuze, geen voorschrift in
// GAME-RULES.md — een streak van 1 of 2 is geen "reactie" waard.
const STREAK_REACTION_THRESHOLD = 3;

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
  // BOUWSPRINT: kaal getal had geen enkele tekst errond — voor een
  // screenreader zijn "5… 4… 3…" losse getallen zonder context. Label +
  // getal als aparte spans zodat de tick-animatie (hieronder) alleen op het
  // getal blijft werken, niet op de hele regel.
  const countdownLabel = el('span', 'gameplay-countdown-label');
  const countdownValue = el('span', 'gameplay-countdown-value');
  countdown.append(countdownLabel, countdownValue);

  const header = el('div', 'gameplay-header');
  const roundWrap = el('p', 'gameplay-round');
  const roundDial = el('span', 'gameplay-round-dial');
  roundDial.setAttribute('aria-hidden', 'true');
  const roundLabel = el('span', 'gameplay-round-text');
  roundWrap.append(roundDial, roundLabel);
  // Feedbackronde 3 (mockup 4): "9/14 BINNEN" hoort in de kop, met dot.
  const headerProgress = el('p', 'gameplay-inline-progress');
  const headerProgressDot = el('span', 'gameplay-inline-progress-dot');
  headerProgressDot.setAttribute('aria-hidden', 'true');
  const headerProgressText = el('span', 'gameplay-inline-progress-text');
  headerProgress.append(headerProgressDot, headerProgressText);
  // M8/E07: de timer komt uit thema 2's module (`timer-bar.mjs`), niet meer
  // hier handmatig opgebouwd. Die inline versie animeerde `width` (reflow bij
  // elke tik, de enige overtreding uit thema 3's performancebudget), had de
  // urgentiegrens hardgecodeerd op 3, en kondigde niets aan een screenreader
  // aan. De module lost alle drie op en is de 12-segmentenvorm uit 1c.
  const timerHost = el('div', 'gameplay-timer-host');
  const timer = createTimerBar({ root: timerHost, t });
  header.append(roundWrap, headerProgress);

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

  root.append(screenTitle, countdown, header, timerHost, questionPrompt, flag, flagCanvas, flagFallback, options, status, progress, result, headline);

  let renderedRoundId = null;
  let optionButtons = new Map(); // value (iso2 | 'real'/'fake' | 0/1) -> button
  // BOUWSPRINT/E04: welk cijfer al een tick-animatie kreeg — voorkomt dat
  // dezelfde waarde opnieuw pulseert bij elke render-tick (ticker draait
  // vaker dan het cijfer wisselt).
  let tickedCountdownValue = null;
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
    options.classList.toggle('gameplay-options-cards', model.gameType === 'odd_one_out');
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

    if (model.gameType === 'odd_one_out') {
      // Vier vlaggen, één hoort er niet bij (doelbeeld v2 §1). Geen
      // vraagafbeelding bovenaan: de kaarten ZIJN de vraag.
      questionPrompt.textContent = t('game.oddOneOutPrompt');
      options.classList.add('gameplay-options-cards');
      for (const kaart of model.question.cards) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gameplay-option gameplay-option-card';
        const kaartVlag = document.createElement('img');
        kaartVlag.className = 'gameplay-option-card-flag';
        kaartVlag.src = flagAssetPath(kaart.iso2);
        kaartVlag.alt = '';
        kaartVlag.setAttribute('aria-hidden', 'true');
        const kaartNaam = document.createElement('span');
        kaartNaam.textContent = countryName(kaart.iso2, lang);
        btn.append(kaartVlag, kaartNaam);
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onAnswer(kaart.cardIndex));
        optionButtons.set(kaart.cardIndex, btn);
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
    if (model.gameType === 'odd_one_out') {
      const kaart = model.question.cards.find((c) => c.cardIndex === model.result.correctCardIndex);
      const naam = kaart ? countryName(kaart.iso2, lang) : '';
      return `${t('game.correctAnswer')}: ${naam}`;
    }
    return `${t('game.correctAnswer')}: ${countryName(model.result.correctOptionId, lang)}`;
  }

  function update(model, { secondsLeft = null, phase = null, countdownSecondsLeft = null, streak = 0 } = {}) {
    // Reken het getal uit de resterende tijd (`secondsRemaining()` rondt al af
    // op hele seconden) — geen vaste `3`/`2`/`1`-reeks aannemen, want de
    // serverduur kan afwijken (zie 04-S07-countdown.md's HANDOFF-punt over
    // `COUNTDOWN_MS` vs. `03` §6).
    countdown.hidden = phase !== 'COUNTDOWN';
    if (countdown.hidden) {
      tickedCountdownValue = null;
    } else {
      countdownLabel.textContent = t('game.countdownLabel');
      countdownValue.textContent = countdownSecondsLeft === null ? '' : String(countdownSecondsLeft);
      // BOUWSPRINT/E04: "zachte tick per cijfer" (06 §4) — een puls per
      // wisselend cijfer, niet per render-tick. Klasse verwijderen+
      // terugzetten (forceer reflow) om de animatie telkens opnieuw te
      // laten spelen, zelfde patroon als M7's tellerpuls (lobby.mjs).
      if (countdownSecondsLeft !== null && countdownSecondsLeft !== tickedCountdownValue) {
        tickedCountdownValue = countdownSecondsLeft;
        countdownValue.classList.remove('gameplay-countdown-tick');
        void countdownValue.offsetWidth;
        countdownValue.classList.add('gameplay-countdown-tick');
      }
    }

    const state = displayState(model);

    if (state === 'empty') {
      roundLabel.textContent = '';
      headerProgress.hidden = true;
      timer.update({ secondsLeft: null, totalSeconds: null });
      timer.reset();
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

    // Ronde-header: mini-rad (conic vult mee met de voortgang) + "06/10".
    if (model.roundNumber !== null && model.totalRounds !== null) {
      const pct = Math.round((model.roundNumber / model.totalRounds) * 100);
      roundDial.style.background = `conic-gradient(var(--rounda-lime, #d8ff3e) ${pct}%, var(--rounda-row-border, #23232c) ${pct}%)`;
      roundLabel.textContent = '';
      const current = document.createElement('strong');
      current.textContent = String(model.roundNumber).padStart(2, '0');
      const total = document.createElement('span');
      total.textContent = `/${model.totalRounds}`;
      roundLabel.append(current, total);
      roundWrap.setAttribute('aria-label', `${t('game.round')} ${model.roundNumber}/${model.totalRounds}`);
    } else {
      roundLabel.textContent = '';
    }

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
      // BOUWSPRINT: `ALREADY_ANSWERED` is net als `DEADLINE_PASSED` terminaal
      // (round-model.mjs's `applyAnswerRejected` vergrendelt de opties voor
      // beide) — maar toonde tot nu toe dezelfde generieke "Niet gelukt,
      // probeer opnieuw" als een écht mislukte, wél-opnieuw-te-proberen
      // poging. Dat is misleidend: de opties zijn hier al vergrendeld, een
      // nieuwe poging is dus sowieso niet mogelijk. Hergebruikt de bestaande
      // `error.ALREADY_ANSWERED`-sleutel i.p.v. een nieuwe te verzinnen.
      status.textContent =
        model.rejectionCode === 'DEADLINE_PASSED'
          ? t('game.tooLate')
          : model.rejectionCode === 'ALREADY_ANSWERED'
            ? t('error.ALREADY_ANSWERED')
            : t('game.notAccepted');
    } else {
      status.textContent = '';
    }

    // Timer en voortgang (verborgen zodra de uitslag er is)
    if (model.result === null) {
      // `model.startsAt`/`endsAt` staan al op het model (round-model.mjs),
      // dus de totaalduur komt daaruit — geen aparte parameter. De module
      // bepaalt zelf hoeveel segmenten branden en wanneer de urgente zone
      // begint; dit scherm levert alleen de twee getallen.
      const totalSeconds =
        model.startsAt !== null && model.endsAt !== null
          ? Math.max(1, Math.round((model.endsAt - model.startsAt) / 1000))
          : null;
      timer.update({ secondsLeft, totalSeconds });
      headerProgress.hidden = model.progress === null;
      if (model.progress !== null) {
        headerProgressText.textContent = t('game.inCount')
          .replace('{n}', String(model.progress.answeredCount))
          .replace('{m}', String(model.progress.eligiblePlayerCount));
      }
      progress.textContent = '';
    } else {
      timer.update({ secondsLeft: null, totalSeconds: null });
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
      // 11-verzoek (BOUWSPRINT doel 4): naast (niet i.p.v.) het stempel
      // hierboven, alleen vanaf STREAK_REACTION_THRESHOLD op een rij — een
      // streak van 1 of 2 is geen "reactie" waard (GAME-RULES.md geeft geen
      // eigen drempel, eigen keuze). `streak` is al `0` van de aanroeper als
      // reactiezinnen uitstaan of dit geen `selfCorrect`-ronde is (session-
      // shell.mjs's `applyRoundResult` reset 'm dan al) — hier dus geen
      // aparte `selfCorrect`-check nodig, `streak >= drempel` volstaat.
      if (streak >= STREAK_REACTION_THRESHOLD) {
        // Nooit een telbare vorm nodig: de drempel is al 3, dus dit pad
        // toont nooit "1" — geen `tCount`/enkelvoudsvorm hoeft hierheen.
        const streakReaction = el('p', 'gameplay-streak gameplay-reveal-enter');
        streakReaction.textContent = t('headline.streak').replace('{n}', String(streak));
        result.append(streakReaction);
      }
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
        // BOUWSPRINT/reveal-choreografie: `score` deelt `.gameplay-reveal-
        // enter` met `correct`/`own` (opacity 0 tijdens `--motion-emphasis`,
        // zie components.css) — zonder deze vertraging liep de telling
        // onzichtbaar al (deels) af vóórdat het element zelf zichtbaar werd.
        // Reduced motion: geen wachttijd, `animateScoreCount` toont dan toch
        // meteen de eindwaarde.
        const reduceMotionForReveal =
          typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(
          () => animateScoreCount(scoreAnimated, model.result.roundPoints),
          reduceMotionForReveal ? 0 : REVEAL_TEXT_DELAY_MS,
        );
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
// BOUWSPRINT/reveal-choreografie: komt overeen met --motion-emphasis
// (components.css se `.gameplay-reveal-enter`) — de vertraging vóór het
// resultaatblok zichtbaar wordt. Geen `getComputedStyle`-koppeling: dat zou
// een synchrone stijlberekening op elke reveal forceren voor iets dat toch
// al als vaste waarde in beide bestanden staat (zelfde patroon als M8's
// SCORE_COUNT_DURATION_MS hierboven, ook geen live CSS-read).
const REVEAL_TEXT_DELAY_MS = 400;

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
