// views/podium.mjs — UI4. Eindpodium (fase FINISHED): top 3 + eigen
// samenvatting uit `game:finished`, plus vervolgacties. `Revanche`/`Nieuw
// spel` zijn hostspecifiek (een niet-host kan geen nieuwe match starten);
// `Deel uitslag`/`Afsluiten` zijn er voor iedereen — een niet-host zat eerder
// vast op dit scherm zonder enige uitweg als de host niet meteen een
// revanche startte (prompt 08, S20).
// De overgang na `game:rematch-started` regelt de viewswitcher; hier zit geen
// navigatielogica.

import { podiumTop3 } from './standings-model.mjs';
import { createRoundaView } from './rounda.mjs';
import { identityText, identityFlagUrl } from './identity-display.mjs';
import { countryName, flagAssetPath } from './country-names.mjs';
import { passportSummaryForPodium } from '../session/passport-tracker.mjs';
import { getCountryPool } from '../../../shared/content/index.mjs';

// S20 (04): "korte, overslaanbare 3→2→1-opbouw". Geen motion-tokens (thema 3
// levert die pas) — een vaste vertraging in dezelfde orde als de andere
// reveal-stappen (07-reveal-en-sociale-headline.md noemt 1,0–1,8s), geen
// eigen animatiesysteem vooruitlopend op dat werk.
const PODIUM_STEP_DELAY_MS = 1400;

export function createPodiumView({ root, t, isHost, capabilities, storage, onRematch, onNewGame, onClose }) {
  root.textContent = '';

  const title = document.createElement('h2');
  title.className = 'podium-title';
  title.textContent = t('podium.title');

  const steps = document.createElement('ol');
  steps.className = 'podium-steps';

  // M10/E14: begrensd, CSS-only confetti — alleen ná de laatste (winnaar-)
  // stap, nooit onder reduced motion. Vast aantal deeltjes, vaste korte
  // duur, geen lus (06 §9 performancebudget — nogmaals getoetst in M5).
  const confetti = document.createElement('div');
  confetti.className = 'podium-confetti';
  confetti.setAttribute('aria-hidden', 'true');
  let confettiTimer = null;
  const CONFETTI_COUNT = 16;
  const CONFETTI_DURATION_MS = 1800;

  function showConfetti() {
    confetti.textContent = '';
    for (let i = 0; i < CONFETTI_COUNT; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'podium-confetti-piece';
      piece.style.setProperty('--i', String(i));
      confetti.appendChild(piece);
    }
    clearTimeout(confettiTimer);
    confettiTimer = setTimeout(() => {
      confetti.textContent = '';
    }, CONFETTI_DURATION_MS);
  }

  const selfLine = document.createElement('p');
  selfLine.className = 'podium-self';
  selfLine.setAttribute('aria-live', 'polite');

  // Besluit 53 (paspoort): NA de eindstand, ondergeschikt aan het podium
  // zelf — de winnaar blijft de kop, dit is een regel + een rij vlaggen
  // eronder, geen tweede podium. Leeg (hidden) zolang er niets te tonen is
  // (geen `storage` meegegeven, of geen enkel land deze partij — zie update()).
  const passportSection = document.createElement('div');
  passportSection.className = 'podium-passport';
  passportSection.hidden = true;
  const passportSummary = document.createElement('p');
  passportSummary.className = 'podium-passport-summary';
  const passportFlags = document.createElement('ul');
  passportFlags.className = 'podium-passport-flags';
  passportSection.append(passportSummary, passportFlags);

  const action = document.createElement('div');
  action.className = 'podium-action';

  if (isHost) {
    const rematch = document.createElement('button');
    rematch.type = 'button';
    rematch.className = 'podium-rematch';
    rematch.textContent = t('podium.rematch');
    rematch.addEventListener('click', () => {
      rematch.disabled = true; // idempotent op UI-niveau; server is leidend
      onRematch();
    });
    action.appendChild(rematch);

    // "Nieuw spel" impliceert een nieuwe room (03 §4.5) — anders dan Revanche
    // (zelfde deelnemers/config, scores resetten). Gaat vandaag terug naar
    // start; zodra 09-S02-spel-aanpassen.md bestaat kan dat een directe route
    // daarheen worden — thuis biedt straks dezelfde `Spel aanpassen`-link.
    const newGame = document.createElement('button');
    newGame.type = 'button';
    newGame.className = 'podium-new-game btn-secondary';
    newGame.textContent = t('podium.newGame');
    newGame.addEventListener('click', () => onNewGame());
    action.appendChild(newGame);
  } else {
    const wait = document.createElement('p');
    wait.className = 'podium-wait';
    wait.textContent = t('podium.waitForHost');
    action.appendChild(wait);
    // BOUWSPRINT/Rounda: wachten op revanche is een wachtmoment zonder
    // interactie voor een niet-host — het podium zelf blijft ongewijzigd
    // zichtbaar erboven, dit vult alleen het lege wachten eronder.
    const roundaRoot = document.createElement('div');
    roundaRoot.className = 'podium-rounda';
    action.appendChild(roundaRoot);
    createRoundaView({ root: roundaRoot });
  }

  // Deel uitslag: alléén de eigen score/positie (privacyvriendelijk, 03
  // §4.5) — nooit andermans naam of score, en geen roomcode/join-link (de
  // room is voorbij, dit is geen uitnodiging). Zelfde native-share-dan-
  // klembord-patroon als lobby.mjs's deelacties, geen nieuwe deellogica.
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'podium-share btn-secondary';
  shareButton.textContent = t('podium.share');
  shareButton.addEventListener('click', () => handleShare());
  const shareFeedback = document.createElement('p');
  shareFeedback.className = 'podium-share-feedback';
  shareFeedback.setAttribute('aria-live', 'polite');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'podium-close btn-quiet';
  closeButton.textContent = t('podium.close');
  closeButton.addEventListener('click', () => onClose());

  action.append(shareButton, closeButton);
  root.append(title, steps, confetti, selfLine, passportSection, action, shareFeedback);

  let currentStandings = { entries: [], self: null };
  let revealTimers = [];
  let feedbackTimer = null;

  function clearRevealTimers() {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
  }

  async function handleShare() {
    const text = shareTextFor(currentStandings.self);
    if (capabilities?.nativeShareAvailable) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Geannuleerd/geweigerd — geen foutmelding, val door naar klembord.
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        showShareFeedback(t('lobby.copied'));
        return;
      } catch {
        // valt door naar de generieke foutmelding hieronder
      }
    }
    showShareFeedback(t('lobby.copyFailed'));
  }

  function showShareFeedback(message) {
    shareFeedback.textContent = message;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      shareFeedback.textContent = '';
    }, 3000);
  }

  function shareTextFor(self) {
    if (self === null) {
      return t('podium.shareGeneric');
    }
    if (self.position === 1) {
      return t('podium.shareWon').replace('{score}', String(self.score));
    }
    return t('podium.shareResult').replace('{score}', String(self.score));
  }

  function update(standings, { lang = 'nl' } = {}) {
    currentStandings = standings;
    clearRevealTimers();
    clearTimeout(confettiTimer);
    confetti.textContent = '';
    steps.textContent = '';
    // M10/E14: `06` §7 vraagt "podium direct compleet" onder reduced motion
    // — dit moet de stagger-keten zelf overslaan (niet alleen de CSS-duur
    // verkorten), anders loopt `revealNext`'s 1400ms-per-stap-vertraging
    // gewoon door.
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const medals = ['podium.first', 'podium.second', 'podium.third'];
    const items = podiumTop3(standings).map((entry, index) => {
      // §A3: de trede volgt de POSITIE, niet de rijvolgorde. Bij een gedeelde
      // eerste plaats staan er twee spelers op goud — dat is wat de eindstand
      // zegt, en anders krijgt de ene van twee gelijke winnaars zilver.
      const step = Math.min(Math.max(entry.position ?? index + 1, 1), medals.length);
      const item = document.createElement('li');
      item.className = `podium-step podium-step-${step}${entry.isSelf ? ' is-self' : ''}`;
      item.hidden = true; // reveal-opbouw hieronder
      const label = document.createElement('span');
      label.className = 'podium-medal';
      label.textContent = t(medals[step - 1]);
      // Decoratief: de positie zit al in de volgorde van de <ol> (een
      // screenreader kondigt "item 1 van 3" enz. vanzelf aan) — het medaille-
      // emoji hoeft niet apart voorgelezen te worden.
      label.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'podium-name';
      // spelersidentiteit.md, stap 5: zelfde regel als scoreboard.mjs — het
      // paar wint, gerenderd in de eigen apptaal, `effectiveName` is de terugval.
      // Zelfde nameLabel-constructie als scoreboard.mjs: de vlag blijft een
      // los kind i.p.v. dat een latere `textContent`-toewijzing 'm wegveegt.
      const nameLabel = document.createElement('span');
      nameLabel.className = 'podium-name-label';
      const identityLabel = identityText(entry.identity, lang);
      nameLabel.textContent = identityLabel ?? entry.effectiveName;
      const identityFlagSrc = identityFlagUrl(entry.identity);
      if (identityFlagSrc !== null) {
        const identityFlag = document.createElement('img');
        identityFlag.className = 'podium-name-flag';
        identityFlag.src = identityFlagSrc;
        identityFlag.alt = '';
        name.append(identityFlag, nameLabel);
      } else {
        name.append(nameLabel);
      }
      const score = document.createElement('span');
      score.className = 'podium-score';
      score.textContent = String(entry.score);
      item.append(label, name, score);
      steps.appendChild(item);
      return item;
    });

    // 3→2→1: bronze eerst, dan silver, dan gold — omgekeerde volgorde van de
    // array (die staat goud-eerst). Een tik ergens op het podium toont alles
    // meteen (overslaanbaar, 04's eis).
    const revealOrder = [...items].reverse();
    let revealIndex = 0;
    function revealNext() {
      if (revealIndex >= revealOrder.length) {
        return;
      }
      const item = revealOrder[revealIndex];
      item.hidden = false;
      // M10/E14: entrance-animatie — alleen op het gestaggerde pad, niet bij
      // de instant-toon-alles-varianten hieronder (skip/reduced motion).
      // `hidden` en de klasse gaan tegelijk aan: een `@keyframes`-animatie
      // kan (anders dan een `transition`) wél starten zodra `display` van
      // `none` naar `flex` gaat, zolang de klasse er al op zit vóór de
      // browser de volgende frame rendert.
      item.classList.add('podium-step-enter');
      revealIndex += 1;
      if (revealIndex < revealOrder.length) {
        revealTimers.push(setTimeout(revealNext, PODIUM_STEP_DELAY_MS));
      } else {
        showConfetti();
      }
    }
    function revealAllInstantly() {
      items.forEach((item) => {
        item.hidden = false;
        item.classList.remove('podium-step-enter');
      });
    }
    if (reduceMotion) {
      revealAllInstantly();
    } else {
      revealNext();
    }
    steps.onclick = () => {
      clearRevealTimers();
      revealAllInstantly();
      if (!reduceMotion) {
        showConfetti();
      }
    };

    if (standings.self !== null) {
      selfLine.textContent =
        standings.self.position !== null
          ? `${t('standings.you')}: #${standings.self.position} — ${standings.self.score}`
          : `${t('standings.you')}: ${standings.self.score}`;
    } else {
      selfLine.textContent = '';
    }

    renderPassport(lang);
  }

  /**
   * Besluit 53. `storage` komt uit `session-shell.mjs` (localStorage) — zonder
   * `storage` (bv. een aanroeper die 'm niet meegeeft) blijft de sectie
   * gewoon verborgen i.p.v. te crashen, zelfde terugval als elders in deze
   * codebase bij een optionele integratie.
   */
  function renderPassport(lang) {
    if (storage === undefined || storage === null) {
      passportSection.hidden = true;
      return;
    }
    const { totalSeen, seenThisMatch, newThisMatch } = passportSummaryForPodium(storage);
    if (seenThisMatch.length === 0) {
      // Geen enkel land deze partij (bv. alleen nepvlaggen in Echt of nep) —
      // dan is er niets om "vanavond" te tonen. `totalSeen` zelf kan intussen
      // best > 0 zijn (eerdere partijen); zonder een "vanavond"-rij heeft de
      // regel alleen geen nieuwe zin toe te voegen.
      passportSection.hidden = true;
      return;
    }
    passportSection.hidden = false;
    const totalCountries = getCountryPool().length;
    passportSummary.textContent = t('podium.passportSummary')
      .replace('{seen}', String(totalSeen))
      .replace('{total}', String(totalCountries));

    passportFlags.textContent = '';
    const nieuw = new Set(newThisMatch);
    for (const iso2 of seenThisMatch) {
      const item = document.createElement('li');
      item.className = 'podium-passport-flag-item';
      const isNew = nieuw.has(iso2);
      item.classList.toggle('is-new', isNew);
      const naam = countryName(iso2, lang);
      const img = document.createElement('img');
      img.className = 'podium-passport-flag';
      img.src = flagAssetPath(iso2);
      // De ronde is voorbij: de landnaam hier tonen is geen antwoordlek meer
      // (anders dan `game.flagAlt` tijdens het spelen). Kleur is nooit de
      // enige drager van "nieuw" — de alt-tekst zelf zegt het er ook bij.
      img.alt = isNew ? t('podium.passportNewFlagAlt').replace('{country}', naam) : naam;
      item.appendChild(img);
      passportFlags.appendChild(item);
    }
  }

  return { update };
}
