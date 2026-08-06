// views/lobby/zelf.mjs — UI2, uit lobby.mjs gesplitst (docs/openstaand/
// refactor/11-lobby.md). "Zo heet je vanavond" — je eigen naam en kleur
// (scherm 3, besluit 40B). Draagt ook de twee statusregels die alleen over
// "jou als speler" gaan (`playerStatus`/`waiting`) — geen van beide hoort bij
// de lijst van ANDERE spelers (spelers.mjs) of bij hostinstellingen.
//
// Geen eigen root/mount: `playerStatus`/`waiting`/`selfSection` zijn DIRECTE
// kinderen van `.lobby-main-column` (CSS-gap-ritme, `lobby.css`) — de
// aanroeper (lobby.mjs) plakt ze op hun plek, deze module wrapt ze niet in
// nog een element.

import { SERVER_KLEUREN } from '../../player-chip.mjs';
import { identityText } from '../identity-display.mjs';

export function createZelfView({ t, isHost, onRename, onRecolor }) {
  // Spelerslobby-copy (09 §6) — additief naast de host-kant, geen vervanging:
  // alleen zichtbaar voor een niet-host (T4-5).
  const playerStatus = document.createElement('div');
  playerStatus.className = 'lobby-player-status';
  playerStatus.hidden = isHost;
  const playerJoined = document.createElement('p');
  playerJoined.className = 'lobby-player-joined';
  const playerWaitingForHost = document.createElement('p');
  playerWaitingForHost.className = 'lobby-player-waiting-for-host';
  const playerInviteHint = document.createElement('p');
  playerInviteHint.className = 'lobby-player-invite-hint';
  const playerSelf = document.createElement('p');
  playerSelf.className = 'lobby-player-self';
  playerStatus.append(playerJoined, playerWaitingForHost, playerInviteHint, playerSelf);

  // Mock-review 3 aug (#3): dit is spelers-copy — de host "wacht" niet op
  // zichzelf. Spelers hebben bovendien `playerWaitingForHost` hierboven al,
  // dus deze regel zou daar dubbelen; alleen tonen als playerStatus verborgen
  // is (defensief: zou niet voorkomen, maar dan is er tenminste één wachttekst).
  const waiting = document.createElement('p');
  waiting.className = 'lobby-waiting';
  waiting.hidden = isHost || !playerStatus.hidden;

  // ── SCHERM 3 (besluit 40B): "Zo heet je vanavond" — naam kiezen gebeurt
  // hier, niet meer vóór het joinen. `player:rename` mag alleen in LOBBY en
  // max. één keer (protocol) — na een geslaagde rename verdwijnt de knop.
  // "IK BEN KLAAR" is puur client-side bevestigen (40B): naamblok klapt om
  // naar de wachtstand, er gaat níéts over de lijn. ──
  const selfSection = document.createElement('section');
  selfSection.className = 'lobby-self';
  // Zichtbaar voor iedereen MET een spelersrol (ook de meespelende host,
  // feedback 4 aug); update() zet dit op basis van selfIsPlayer.
  selfSection.hidden = true;
  const selfLead = document.createElement('p');
  selfLead.className = 'lobby-self-lead';
  const selfRow = document.createElement('div');
  selfRow.className = 'lobby-self-row';
  const selfName = document.createElement('span');
  selfName.className = 'lobby-self-name';
  const renameButton = document.createElement('button');
  renameButton.type = 'button';
  renameButton.className = 'btn-secondary lobby-self-rename';
  const renameInput = document.createElement('input');
  renameInput.type = 'text';
  renameInput.className = 'field-input lobby-self-input';
  renameInput.maxLength = 60;
  renameInput.hidden = true;
  const renameSave = document.createElement('button');
  renameSave.type = 'button';
  renameSave.className = 'btn-secondary lobby-self-save';
  renameSave.hidden = true;
  const renameError = document.createElement('p');
  renameError.className = 'lobby-self-error field-error';
  // C2 (punten 19/20/21, R2-6): het kleurvlakje ís de knop. De acht kleuren
  // stonden altijd uitgeklapt onder je naam — twee rijen, ~96px, voor een
  // keuze die je één keer maakt. Nu zit de kleur naast de naam in dezelfde
  // rij en verschijnt het palet pas na een tik erop.
  //
  // Bewust de interactie en niet een groter palet: de server kent precies
  // acht kleuren (gesloten enum, `client-events-dispatch.mjs`), dus 36 is
  // protocolwerk. Als dat er komt, groeit alléén `SERVER_KLEUREN` — de
  // opening, het sluiten en de toegankelijkheid staan hier al.
  const selfSwatch = document.createElement('button');
  selfSwatch.type = 'button';
  selfSwatch.className = 'lobby-self-swatch';
  selfSwatch.setAttribute('aria-expanded', 'false');
  let colorsOpen = false;
  selfSwatch.addEventListener('click', () => {
    colorsOpen = !colorsOpen;
    renderSelfSection();
  });
  selfRow.append(selfSwatch, selfName, renameButton, renameInput, renameSave);
  // Feedback punt 13: kleurkiezer — acht tikbare stippen, serverpalet.
  const colorRow = document.createElement('div');
  colorRow.className = 'lobby-self-colors';
  colorRow.setAttribute('role', 'group');
  colorRow.hidden = true;
  const colorButtons = new Map();
  for (const [colorName, hex] of Object.entries(SERVER_KLEUREN)) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'lobby-self-color';
    dot.style.backgroundColor = hex;
    dot.addEventListener('click', async () => {
      // Meteen dicht: gekozen is gekozen, en het palet mag de rest van de
      // lobby niet blijven wegduwen. De stand komt van de server terug.
      colorsOpen = false;
      renderSelfSection();
      try {
        await onRecolor?.(colorName);
      } catch {
        // kleurwissel is nice-to-have: fout stil laten, stand blijft server-waarheid
      }
    });
    colorButtons.set(colorName, dot);
    colorRow.appendChild(dot);
  }

  const readyButton = document.createElement('button');
  readyButton.type = 'button';
  readyButton.className = 'btn-primary lobby-ready';
  const readyPill = document.createElement('div');
  readyPill.className = 'lobby-ready-pill';
  readyPill.hidden = true;
  const readyPillDot = document.createElement('span');
  readyPillDot.className = 'lobby-ready-dot';
  const readyPillText = document.createElement('span');
  readyPillText.className = 'lobby-ready-text';
  const readyPillName = document.createElement('span');
  readyPillName.className = 'lobby-ready-name';
  readyPill.append(readyPillDot, readyPillText, readyPillName);
  selfSection.append(selfLead, selfRow, colorRow, renameError, readyButton, readyPill);

  let renameUsed = false; // protocol: player:rename max één keer
  let renameBusy = false;
  let isReady = false; // client-side (40B)
  let selfIsPlayer = false;

  renameButton.addEventListener('click', () => {
    renameInput.hidden = false;
    renameSave.hidden = false;
    renameButton.hidden = true;
    renameInput.value = selfName.textContent;
    renameInput.focus();
    renameInput.select();
  });
  renameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      renameSave.click();
    }
  });
  renameSave.addEventListener('click', async () => {
    const value = renameInput.value.trim();
    if (renameBusy || value === '' || value === selfName.textContent) {
      closeRenameEditor();
      return;
    }
    renameBusy = true;
    renameError.textContent = '';
    try {
      await onRename?.(value);
      renameUsed = true; // gelukt → protocol staat geen tweede toe
      closeRenameEditor();
    } catch (err) {
      renameError.textContent = t(`error.${err?.code ?? 'UNKNOWN_ERROR'}`);
      // Live-audit 4 aug: de echte server kent `player:rename` nog niet
      // (UNSUPPORTED_EVENT — protocol-pad bestaat, composition mist; zie
      // serverticket). Dan is opnieuw proberen zinloos: editor dicht, knop
      // weg — geen dode belofte laten staan.
      if (err?.code === 'UNSUPPORTED_EVENT') {
        renameUsed = true;
        closeRenameEditor();
      }
      renameBusy = false;
      return;
    }
    renameBusy = false;
  });
  function closeRenameEditor() {
    renameInput.hidden = true;
    renameSave.hidden = true;
    renameButton.hidden = renameUsed;
  }
  readyButton.addEventListener('click', () => {
    isReady = true;
    renameError.textContent = ''; // een hangende rename-fout hoort niet boven de wachtpil
    renderSelfSection();
  });

  function renderSelfSection() {
    selfSection.hidden = !selfIsPlayer;
    if (!selfIsPlayer) {
      return;
    }
    selfLead.textContent = t('lobby.selfNameLead');
    colorRow.setAttribute('aria-label', t('lobby.colorLabel'));
    // Het vlakje draagt zijn eigen label: zonder tekst erin is "kleur kiezen"
    // het enige wat een screenreader hier kan aankondigen.
    selfSwatch.setAttribute('aria-label', t('lobby.colorLabel'));
    selfSwatch.setAttribute('aria-expanded', String(colorsOpen));
    for (const [colorName, dot] of colorButtons) {
      dot.setAttribute('aria-label', `${t('lobby.colorLabel')}: ${colorName}`);
    }
    renameButton.textContent = t('lobby.selfRename');
    renameSave.textContent = t('lobby.selfRenameSave');
    readyButton.textContent = t('lobby.ready');
    readyPillText.textContent = t('lobby.playerWaitingForHost');
    readyPillName.textContent = selfName.textContent;
    // Klaar-stand: naamregels weg, wachtpil ervoor in de plaats. De host
    // wacht niet op zichzelf: geen klaar-knop en geen wachtpil (die start).
    selfLead.hidden = isReady;
    selfRow.hidden = isReady;
    colorRow.hidden = isReady || !colorsOpen;
    readyButton.hidden = isHost || isReady;
    readyPill.hidden = isHost || !isReady;
    renameButton.hidden = isReady || renameUsed || !renameInput.hidden;
  }

  function render() {
    waiting.textContent = t('lobby.waiting');
    playerJoined.textContent = t('lobby.playerJoined');
    playerWaitingForHost.textContent = t('lobby.playerWaitingForHost');
    playerInviteHint.textContent = t('lobby.playerInviteHint');
    renderSelfSection();
  }

  render();

  /** @param {{ selfIsPlayer?: boolean, selfName?: string|null, selfColor?: string|null, selfIdentity?: {country:string,word:string}|null, lang?: string }} model */
  function update(model) {
    // Scherm 3 (40B) + feedback 4 aug: het JIJ-blok is de plek voor naam,
    // kleur en wachtstand — voor iedereen mét spelersrol, ook de meespelende
    // host. De oude losse regels blijven verborgen (dubbeling).
    playerSelf.hidden = true;
    playerWaitingForHost.hidden = true;
    selfIsPlayer = model.selfIsPlayer === true;
    // spelersidentiteit.md, stap 5: `identity` wint van `selfName`, gerenderd
    // in de eigen apptaal — `null` (zelfgekozen naam) valt terug op de kale naam.
    const identityLabel = identityText(model.selfIdentity ?? null, model.lang ?? 'nl');
    selfName.textContent = identityLabel ?? (model.selfName ?? '');
    const selfHex = model.selfColor && model.selfColor in SERVER_KLEUREN ? SERVER_KLEUREN[model.selfColor] : null;
    selfSwatch.style.backgroundColor = selfHex ?? 'transparent';
    // Blijft staan zonder kleur: het vlakje is sinds C2 de enige ingang naar
    // het palet, dus wegstoppen zou juist de mensen zonder kleur buitensluiten.
    selfSwatch.classList.toggle('is-leeg', selfHex === null);
    for (const [colorName, dot] of colorButtons) {
      dot.classList.toggle('is-active', colorName === model.selfColor);
    }
    renderSelfSection();
  }

  return { playerStatus, waiting, selfSection, update, render };
}
