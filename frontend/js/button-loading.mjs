// button-loading.mjs — T2-2. De laadstaat op een knop (`05` §4.1, `06` E02).
//
// Thema 2 levert dit mechanisme, thema 1 en 4 roepen het aan. Bewust één
// functie voor alle drie de uitkomsten die `E02` beschrijft — bezig, gelukt,
// mislukt-met-retry — want een `setLoading(true/false)` zonder foutafloop legt
// de naad half vast en dan bouwt de aanroeper er alsnog omheen.
//
//   bezig    setButtonLoading(btn, { loading: true, label: t('home.creating') })
//   gelukt   setButtonLoading(btn, { loading: false })
//   mislukt  setButtonLoading(btn, { loading: false, label: t('join.retry') })
//
// Het oorspronkelijke label wordt onthouden en bij `loading: false` zonder
// `label` teruggezet, zodat de aanroeper het niet zelf hoeft te bewaren.
//
// BOUWSPRINT (rounda-1c): een knop kan sinds de 1c-transplantatie een
// sublabel dragen (bv. home.mjs's "Je bent de spelleider" onder "Start
// direct een game") — `button.textContent = ...` zou die sublabel-node
// stilzwijgend wegvegen (textContent vervangt ALLE children door één
// tekstnode). Callers zonder sublabel zijn ongewijzigd: zonder een
// `[data-button-loading-label]`-kind valt dit terug op de knop zelf, exact
// het oude gedrag.
const IDLE_LABEL = 'idleLabel';

function labelTarget(button) {
  if (typeof button.querySelector !== 'function') {
    return button;
  }
  return button.querySelector('[data-button-loading-label]') ?? button;
}

/**
 * @param {HTMLButtonElement} button
 * @param {{ loading: boolean, label?: string | null }} options
 */
export function setButtonLoading(button, { loading, label = null }) {
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const target = labelTarget(button);

  if (loading) {
    if (button.dataset[IDLE_LABEL] === undefined) {
      button.dataset[IDLE_LABEL] = target.textContent ?? '';
    }
    // Breedte vastzetten vóór de labelwissel: `E01` en `05` §4.1 verbieden
    // layoutshift, en `Start direct een game` → `Potje maken…` is smaller —
    // zonder dit krimpt de knop zichtbaar onder je vinger.
    const breedte = button.getBoundingClientRect().width;
    if (breedte > 0) {
      button.style.minWidth = `${Math.ceil(breedte)}px`;
    }
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    // `disabled` en niet alleen een klasse: `05` §5, `08` §4.1 en de
    // QA-checklist §L eisen dat de actie tijdens het laden niet opnieuw kan
    // vuren. Een knop die er alleen bezig uitziet is geen laadstaat.
    button.disabled = true;
    if (label !== null) {
      target.textContent = label;
    }
    return;
  }

  button.classList.remove('is-loading');
  button.removeAttribute('aria-busy');
  button.disabled = false;
  button.style.minWidth = '';

  if (label !== null) {
    // Foutafloop: de aanroeper geeft een eigen vervolglabel mee (`Opnieuw
    // proberen`). Het oorspronkelijke label blijft onthouden, zodat een
    // geslaagde retry er alsnog op terugvalt.
    target.textContent = label;
    return;
  }

  if (button.dataset[IDLE_LABEL] !== undefined) {
    target.textContent = button.dataset[IDLE_LABEL];
    delete button.dataset[IDLE_LABEL];
  }
}

/** @param {HTMLButtonElement} button @returns {boolean} */
export function isButtonLoading(button) {
  return button instanceof HTMLElement && button.classList.contains('is-loading');
}
