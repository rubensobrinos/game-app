// timer-bar.mjs — T2-3. De rondetimer als horizontale balk (`05` §9).
//
// Tot nu toe was de timer één getal. `05` §9 noemt de progressbalk de
// basisvorm en het getal de optionele aanvulling; wij hadden alleen het getal,
// en geen enkel verschil tussen seconde 30 en seconde 2.
//
// Deze module rekent niets uit. Hij krijgt de resterende seconden binnen en
// tekent — `secondsRemaining()` in `server-time.mjs` blijft de bron, en de
// tick blijft van `session-shell.mjs`. Een tweede tijdrekening naast die ene
// is precies wat `AGENTS.md` verbiedt.
//
// Beweging hoort hier níét. `06` E07 (de puls in de laatste seconden) staat in
// thema 3's catalogus; deze module levert het contrastverschil en de klassen,
// thema 3 hangt er eventueel beweging aan. Daarmee is de urgentie ook zonder
// motion zichtbaar, wat `08` §2.4 sowieso eist.

/** `06` E07 spreekt van "de laatste drie seconden" — als default, niet als wet. */
export const URGENT_VANAF_SECONDEN = 3;

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
  // Precies de overgang naar urgent, niet elke tick daarbinnen.
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
 * @param {{
 *   root: HTMLElement,
 *   t: (key: string) => string,
 *   urgentVanaf?: number,
 * }} options
 */
export function createTimerBar({ root, t, urgentVanaf = URGENT_VANAF_SECONDEN }) {
  const wrap = el('div', 'timer');

  const track = el('div', 'timer-track');
  const fill = el('div', 'timer-fill');
  track.appendChild(fill);
  // De balk is decoratie bovenop de tekst: een screenreader krijgt de tijd via
  // `timer-value`, niet via een percentage dat elke tick verandert.
  track.setAttribute('aria-hidden', 'true');

  const value = el('span', 'timer-value');
  value.setAttribute('aria-live', 'polite');
  value.setAttribute('aria-atomic', 'true');

  wrap.append(track, value);
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
    fill.style.width = `${fractie(secondsLeft, totalSeconds) * 100}%`;

    const urgent = seconden <= urgentVanaf;
    wrap.classList.toggle('is-urgent', urgent);

    // De zichtbare tekst wisselt elke seconde; de aankondiging niet. Beide uit
    // hetzelfde element zou de screenreader elke tick laten praten, dus de
    // `aria-live` staat op `polite` en we schrijven alleen bij een
    // aankondigingsmoment een volledige zin — anders alleen het cijfer.
    if (moetAankondigen(vorige, seconden, urgentVanaf)) {
      value.textContent = `${seconden} ${t('game.secondsLeft')}`;
    } else {
      value.textContent = String(seconden);
    }
    vorige = seconden;
  }

  function reset() {
    vorige = null;
  }

  return { update, reset };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
