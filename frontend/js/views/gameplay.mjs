// views/gameplay.mjs — UI3. DOM-laag van het spelscherm. Alle logica zit in
// round-model.mjs (puur, getest); dit bestand rendert alleen en vertaalt
// tikken naar callbacks. Regels (UI3-gameplay-screen.md): nooit innerHTML
// voor payloadcontent, nooit goed/fout vóór round:ended, timer via
// secondsRemaining herberekend per render-tick.
//
// 14-S09-S10: dit bestand was ooit flags_mc-only. De "shell" (kop, timer,
// status, voortgang) is gedeeld over alle drie de spelvormen; alleen de
// vraagopbouw takt af op `model.gameType`. `options`/`.gameplay-option` wordt
// voor alle drie hergebruikt (vier landknoppen / Echt-Nep / de twee zijden
// van een duel) — geen los `duel`-blok, minder nieuwe structuur.
//
// B3 (5 aug 2026): DIT SCHERM TOONT GEEN UITSLAG MEER. Sinds besluit 40
// routeert `view-switcher.mjs` `ROUND_RESULT`/`SCOREBOARD` naar
// `scoreboard.mjs`, en gameplay is alleen nog gemount tijdens `COUNTDOWN` en
// `ROUND_ACTIVE` — momenten waarop `model.result` per definitie `null` is.
// Het uitslagblok dat hier stond (correcte-antwoord-stempel, eigen resultaat,
// streakreactie, puntentelling, sociale headline) was daarmee onbereikbaar
// geworden: een tweede, afwijkende implementatie van wat scherm 5 al doet.
// Verwijderd, met het bruikbare deel (de metric-regel bij hoger/lager)
// overgenomen in `scoreboard.mjs`'s `correctAnswerTextFor()`.
//
// Gebruik (bedrading door app.mjs / de viewswitcher, UI0):
//   const view = createGameplayView({ root, t, onAnswer });
//   view.update(model, { secondsLeft });   // bij elk event of timer-tick
// `onAnswer(value)` doet zelf de transport-send; `value` is de iso2 (flags_mc),
// 'real'/'fake' (real_or_fake_flag) of 0/1 (higher_lower) — de aanroeper (
// session-shell.mjs) weet via `roundModel.gameType`/`answerPayloadFor()` welke
// `round:answer`-vorm daarbij hoort. De aanroeper past daarna het model aan
// (selectOption/selectChoice/selectSide) en roept update opnieuw.

import { countryName, capitalName, capitalsQuestionDirection, flagAssetPath } from './country-names.mjs';
import { displayState, optionsLocked } from './round-model.mjs';
import { renderFlagSpec } from './flag-renderer.mjs';
import { loadCountryShape, renderCountryShape } from './shape-renderer.mjs';
import { createTimerBar } from '../timer-bar.mjs';

/** Waarde die de speler net gekozen heeft, ongeacht gameType. */
function selectedValueFor(model) {
  if (model.gameType === 'real_or_fake_flag') return model.selectedChoice;
  if (model.gameType === 'higher_lower') return model.selectedSide;
  if (model.gameType === 'odd_one_out') return model.selectedCardIndex;
  return model.selectedOptionId;
}

export function createGameplayView({ root, t, tCount = null, onAnswer, lang = 'nl' }) {
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
  // R2-8 (producteigenaar, 5 aug): "dat iedereen echt klaar is". Sinds §A2 is
  // dit scherm alleen nog de OPENING van de match — tussen rondes telt de
  // server niet meer af. Het gebeurt dus één keer per potje, en dan is het
  // startsein van een groep belangrijker dan het cijfer: wie er meedoet staat
  // bovenaan, het cijfer eronder.
  const countdownPlayers = el('span', 'gameplay-countdown-players');
  countdownPlayers.hidden = true;
  // BOUWSPRINT: kaal getal had geen enkele tekst errond — voor een
  // screenreader zijn "5… 4… 3…" losse getallen zonder context. Label +
  // getal als aparte spans zodat de tick-animatie (hieronder) alleen op het
  // getal blijft werken, niet op de hele regel.
  const countdownLabel = el('span', 'gameplay-countdown-label');
  const countdownValue = el('span', 'gameplay-countdown-value');
  countdown.append(countdownPlayers, countdownLabel, countdownValue);

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
  root.append(screenTitle, countdown, header, timerHost, questionPrompt, flag, flagCanvas, flagFallback, options, status, progress);

  let renderedRoundId = null;
  let optionButtons = new Map(); // value (iso2 | 'real'/'fake' | 0/1) -> button
  // BOUWSPRINT/E04: welk cijfer al een tick-animatie kreeg — voorkomt dat
  // dezelfde waarde opnieuw pulseert bij elke render-tick (ticker draait
  // vaker dan het cijfer wisselt).
  let tickedCountdownValue = null;

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

        // GEEN LANDNAAM ONDER DE KAART. Sinds punt 11 (5 aug 2026) kan een
        // kaart ook een GEGENEREERDE vlag zijn, en die heeft geen land. Zou de
        // echte kaart dan wél een naam krijgen en de nep niet, dan wijst het
        // ontbreken van de naam het antwoord aan. Vier vlaggen, verder niets —
        // dat is ook precies wat punt 11 beschrijft.
        if (kaart.spec !== undefined && kaart.spec !== null) {
          const doek = document.createElement('canvas');
          doek.className = 'gameplay-option-card-flag';
          doek.setAttribute('aria-hidden', 'true');
          renderFlagSpec(doek, kaart.spec);
          btn.appendChild(doek);
        } else {
          const kaartVlag = document.createElement('img');
          kaartVlag.className = 'gameplay-option-card-flag';
          kaartVlag.src = flagAssetPath(kaart.iso2);
          kaartVlag.alt = '';
          kaartVlag.setAttribute('aria-hidden', 'true');
          btn.appendChild(kaartVlag);
        }

        // Voor een screenreader een neutrale positieaanduiding: de naam van
        // het land zou hetzelfde weggeven als hierboven beschreven.
        btn.setAttribute(
          'aria-label',
          t('game.oddOneOutCard').replace('{n}', String(kaart.cardIndex + 1)).replace('{m}', String(model.question.cards.length)),
        );
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onAnswer(kaart.cardIndex));
        optionButtons.set(kaart.cardIndex, btn);
        options.appendChild(btn);
      }
      return;
    }

    if (model.gameType === 'capitals_mc') {
      // Besluit 49: tekst i.p.v. een vlag, dicht bij flags_mc — geen `flag`
      // hier (blijft `hidden` uit de reset bovenaan `buildQuestion`). Zelfde
      // payloadvorm als flags_mc (`targetIso2`+`optionIso2s`); de richting
      // (gewone vraag "hoofdstad van X?" of de omgekeerde "Y hoort bij welk
      // land?") volgt uit `capitalsQuestionDirection` — zie die functie voor
      // waarom dat geen apart protocolveld is.
      const { targetIso2, optionIso2s } = model.question;
      const direction = capitalsQuestionDirection(targetIso2, optionIso2s);
      questionPrompt.textContent =
        direction === 'ask-capital'
          ? t('game.capitalsPrompt').replace('{country}', countryName(targetIso2, lang))
          : t('game.capitalsReversePrompt').replace('{capital}', capitalName(targetIso2, lang));
      for (const iso2 of optionIso2s) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gameplay-option';
        btn.textContent = direction === 'ask-capital' ? capitalName(iso2, lang) : countryName(iso2, lang);
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onAnswer(iso2));
        optionButtons.set(iso2, btn);
        options.appendChild(btn);
      }
      return;
    }

    if (model.gameType === 'country_shape_mc') {
      // "Raad het land" (besluit C-2). Contour boven, vier landnamen eronder —
      // zelfde payloadvorm als flags_mc/capitals_mc (`targetIso2`+
      // `optionIso2s`, `optionId` als antwoord), dus geen wijziging nodig in
      // round-model.mjs. Hergebruikt de bestaande vlag-canvas (`flagCanvas`,
      // al `hidden` gereset bovenaan deze functie) i.p.v. een derde
      // mediaslot: exact hetzelfde budget (`--media-max-h`, 200px) geeft een
      // vierkante contour precies zo veel ruimte als een 3:2-vlag, zonder
      // eigen CSS.
      questionPrompt.textContent = t('game.shapePrompt');
      flagCanvas.hidden = false;
      flagCanvas.setAttribute('aria-label', t('game.shapeAlt'));
      const shapeCtx = flagCanvas.getContext('2d');
      shapeCtx?.clearRect(0, 0, flagCanvas.width, flagCanvas.height); // geen vorige contour tonen tijdens het laden

      // shape-renderer.mjs importeert de 234 KB contourdata pas bij deze
      // aanroep, en alleen dan (zie de moduledoc daar) — een potje
      // flags_mc/capitals_mc/... roept dit nooit aan en haalt dus nooit op.
      // Asynchroon, dus: de vraag (en de antwoordknoppen) staan meteen, de
      // contour komt zodra hij binnen is. `roundIdBijStart` bewaakt dat een
      // trage download niet alsnog op een inmiddels andere ronde tekent.
      const { targetIso2, optionIso2s } = model.question;
      const roundIdBijStart = model.roundId;
      loadCountryShape(targetIso2).then((shape) => {
        if (renderedRoundId !== roundIdBijStart) {
          return;
        }
        renderCountryShape(flagCanvas, shape);
      });

      for (const iso2 of optionIso2s) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gameplay-option';
        btn.textContent = countryName(iso2, lang);
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onAnswer(iso2));
        optionButtons.set(iso2, btn);
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

  function update(model, { secondsLeft = null, phase = null, countdownSecondsLeft = null, playerCount = null } = {}) {
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
      // R2-8: "5 spelers klaar" boven de teller. `tCount` is optioneel zodat
      // een aanroeper die 'm niet doorgeeft (of een room zonder telling) een
      // regel minder krijgt in plaats van "1 spelers" of een sleutelnaam.
      const toonSpelers = typeof playerCount === 'number' && playerCount > 0 && tCount !== null;
      countdownPlayers.hidden = !toonSpelers;
      if (toonSpelers) {
        countdownPlayers.textContent = tCount('game.countdownPlayersReady', playerCount);
      }
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

    // R2-8, punt 1: het aftellen krijgt het scherm voor zichzelf. Tot nu toe
    // bleef de vlag-`<img>` staan zónder `src` — een browser tekent dan het
    // kader plus de alt-tekst, dus stond er een leeg vak met "Te raden vlag"
    // in. Dat leest als een kapot scherm, en het is bovendien onwaar: er ís
    // nog geen vraag. Dit gebeurt bij élke COUNTDOWN, niet alleen bij een leeg
    // model — hervatten na een pauze telt ook af terwijl `roundModel` nog de
    // vorige ronde draagt (§A2).
    if (!countdown.hidden || state === 'empty') {
      roundLabel.textContent = '';
      headerProgress.hidden = true;
      timer.update({ secondsLeft: null, totalSeconds: null });
      timer.reset();
      questionPrompt.hidden = true;
      flag.removeAttribute('src');
      flag.hidden = true;
      flagFallback.hidden = true;
      flagCanvas.hidden = true;
      options.textContent = '';
      status.textContent = '';
      progress.textContent = '';
      // Op `null` zodat de vraag ná het aftellen opnieuw wordt opgebouwd: de
      // opties zijn hierboven gewist, dus een gelijk gebleven `roundId` mag
      // niet betekenen "er staat al iets".
      renderedRoundId = null;
      return;
    }

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
    } else if (secondsLeft === 0 && model.answerStatus !== 'rejected') {
      // Fase 4 (autoReveal, besluit 51): de tijd is om maar er is nog geen
      // `round:ended` — dat kan zijn omdat autoReveal uit staat en de host nog
      // moet tikken, óf omdat de server het antwoord nog moet uitzenden. In
      // beide gevallen is dit de eerlijke tekst, of de speler nu wel
      // ('accepted') of niet ('idle') geantwoord heeft. Een net mislukte
      // poging ('rejected', bv. DEADLINE_PASSED) houdt voorrang: die feedback
      // gaat over de eigen actie van de speler en is specifieker.
      status.textContent = t('game.waitingForReveal');
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
  }

  return { update };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
