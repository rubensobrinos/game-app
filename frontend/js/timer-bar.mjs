// timer-bar.mjs — T2-3, herzien naar de 12-segmentenvorm (1c).
//
// De timer is geen doorlopende balk maar twaalf segmenten die van rechts naar
// links doven. Waarom segmenten: een doorlopende balk van 100% naar 0% laat
// je aflezen dat er "iets minder" is; twaalf blokjes laat je tellen. Op een
// luidruchtige borrel is dat het verschil tussen weten en gokken.
//
// De laatste twee segmenten zijn magenta. Ze zijn dat altijd, niet pas als ze
// aan de beurt zijn: zo zie je de gevarenzone aankomen in plaats van erdoor
// verrast te worden. Dat is ook waarom er niet geknipperd wordt — de urgentie
// zit in kleur en in het aantal, niet in beweging (`08` §2.4: nooit alleen in
// beweging, en `06` §7 verbiedt flikkeren onder reduced motion).
//
// Deze module rekent geen tijd uit. Hij krijgt de resterende seconden binnen
// en tekent; `secondsRemaining()` in `server-time.mjs` blijft de bron en de
// tick blijft van `session-shell.mjs`.

/** `06` E07 spreekt van "de laatste drie seconden" — als default, niet als wet. */
export const URGENT_VANAF_SECONDEN = 3;

/** 1c-vorm: twaalf segmenten, de laatste twee in magenta. */
export const SEGMENTEN = 12;
export const URGENTE_SEGMENTEN = 2;

/**
 * Bepaalt of de screenreader een update hoort te krijgen. `08` §2.2: niet elke
 * seconde spammen. Twee momenten volstaan — de start van de ronde en het
 * ingaan van de urgente fase.
 *
 * @param {number|null} vorige seconden bij de vorige tick, `null` bij de eerste
 * @param {number} huidige
 * @param {number} urgentVanaf
 * @returns {boolean}
 */
export function moetAankondigen(vorige, huidige, urgentVanaf = URGENT_VANAF_SECONDEN) {
  if (typeof huidige !== 'number' || Number.isNaN(huidige)) {
    return false;
  }
  if (vorige === null) {
    return true;
  }
  return vorige > urgentVanaf && huidige <= urgentVanaf;
}

/**
 * @param {number} resterend
 * @param {number} totaal
 * @returns {number} 0..1
 */
export function fractie(resterend, totaal) {
  if (typeof totaal !== 'number' || totaal <= 0) {
    return 0;
  }
  const veilig = typeof resterend === 'number' && !Number.isNaN(resterend) ? resterend : 0;
  return Math.min(1, Math.max(0, veilig / totaal));
}

/**
 * Hoeveel segmenten branden er nog.
 *
 * `ceil` en niet `round`: zolang er ook maar een fractie van een seconde over
 * is hoort er een segment te branden. Anders staat de timer op nul terwijl je
 * nog kunt antwoorden — en dat is erger dan een segment te veel.
 *
 * @param {number} resterend @param {number} totaal @param {number} segmenten
 * @returns {number} 0..segmenten
 */
export function brandendeSegmenten(resterend, totaal, segmenten = SEGMENTEN) {
  const f = fractie(resterend, totaal);
  if (f === 0) {
    return 0;
  }
  return Math.max(1, Math.min(segmenten, Math.ceil(f * segmenten)));
}

/**
 * @param {{
 *   root: HTMLElement,
 *   t: (key: string) => string,
 *   urgentVanaf?: number,
 *   segmenten?: number,
 * }} options
 */
export function createTimerBar({ root, t, urgentVanaf = URGENT_VANAF_SECONDEN, segmenten = SEGMENTEN }) {
  const wrap = el('div', 'timer');

  const track = el('div', 'timer-track');
  // Decoratie bovenop de tekst: een screenreader krijgt de tijd via de
  // meldingsregel, niet via twaalf div's die elke seconde van klasse wisselen.
  track.setAttribute('aria-hidden', 'true');

  const blokjes = [];
  for (let i = 0; i < segmenten; i++) {
    // De laatste twee segmenten zijn de linkerste: de balk dooft van rechts
    // naar links, dus index 0 en 1 zijn wat er als laatste overblijft.
    const urgent = i < URGENTE_SEGMENTEN;
    const blokje = el('span', urgent ? 'timer-segment is-urgent-zone' : 'timer-segment');
    track.appendChild(blokje);
    blokjes.push(blokje);
  }

  // Zichtbaar: alleen het cijfer, altijd even breed (tabulair). Zou de
  // aankondiging hier ook in staan, dan sprong de balk smaller zodra
  // "30 seconden te gaan" verscheen.
  const value = el('span', 'timer-value');
  value.setAttribute('aria-hidden', 'true');

  const melding = el('span', 'sr-only');
  melding.setAttribute('aria-live', 'polite');
  melding.setAttribute('aria-atomic', 'true');

  wrap.append(track, value, melding);
  root.appendChild(wrap);

  let vorige = null;

  /**
   * @param {{ secondsLeft: number|null, totalSeconds: number|null }} model
   */
  function update({ secondsLeft, totalSeconds }) {
    if (secondsLeft === null || totalSeconds === null) {
      wrap.hidden = true;
      vorige = null;
      return;
    }
    wrap.hidden = false;

    const seconden = Math.max(0, Math.ceil(secondsLeft));
    const aan = brandendeSegmenten(secondsLeft, totalSeconds, segmenten);
    for (let i = 0; i < blokjes.length; i++) {
      blokjes[i].classList.toggle('is-on', i < aan);
    }

    // Alleen nog voor de tekstkleur; de segmentkleur zit in de zone-klasse.
    wrap.classList.toggle('is-urgent', seconden <= urgentVanaf);

    value.textContent = String(seconden);
    if (moetAankondigen(vorige, seconden, urgentVanaf)) {
      melding.textContent = `${seconden} ${t('game.secondsLeft')}`;
    }
    vorige = seconden;
  }

  function reset() {
    vorige = null;
    melding.textContent = '';
  }

  return { update, reset, element: wrap };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
