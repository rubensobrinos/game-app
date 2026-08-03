# Prompt — 06: Start-en-join-polish (S01, S03, S04)

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Drie schermen die
in de code al één cluster zijn (`home.mjs` + `join.mjs`) en samen de eerste
indruk van de app vormen.

## Brondocument

[`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md) S01, S03,
S04.

## S01 — Landing

1. **`Potje maken…`-laadstatus — al gebouwd, niet meer doen.** Klopte bij het
   schrijven van deze prompt, klopt niet meer: thema 4 heeft dit inmiddels
   gebouwd (`home.mjs`'s `quickStartStatus`, aria-live, rendert
   `t('home.creating')` zolang `state.status === 'creating'`; `nl.mjs` heeft
   `'home.creating': 'Potje maken…'`). **Actie hier is verifiëren dat het nog
   werkt, niet een tweede statuswissel toevoegen.** Ook de knoptekst zelf is
   inmiddels `Start direct een game` (`home.quickStart`), niet meer
   `Snel starten` — punt 3 hieronder gaat daarvan uit.
2. **Belofte-regel onder de fold**: `Geen account. Geen download. Iedereen
   speelt op zijn eigen telefoon.` — nieuwe i18n-sleutel in alle drie de
   locales, nieuw element in `home.mjs`. Controleer eerst of dit ook al
   gebouwd is (net als punt 1 dat bleek te zijn) vóórdat je een nieuw element
   toevoegt.
3. **Hero-knopstijl**: `04` vraagt een duidelijk gewicht-verschil tussen de
   primaire (`Start direct een game`) en secundaire (code-invoer) actie. Nu
   delen ze grotendeels dezelfde `.btn-primary`/`.btn-secondary`-stijl uit
   `components.css` — controleer of dat visueel voldoende onderscheidend is
   of dat de hero een eigen, groter accent verdient. Dit raakt gedeelde CSS
   (thema 2's territorium) — als je meer dan een kleine aanpassing nodig
   hebt, meld dat als `HANDOFF`-item in plaats van `components.css` zelf
   ingrijpend te herschrijven.

## S03 — Roomcode invoeren

1. **Enter/submit bedraden**: `codeInput` heeft nu geen keydown-handler — een
   druk op Enter doet niets. Voeg toe (zelfde patroon als een form-submit).
2. **Visuele codeformattering**: toon `123 456` i.p.v. `123456` terwijl de
   onderliggende waarde schoon blijft (zelfde aanpak als
   `room-header.mjs`'s `formatCode()` — hergebruik dat patroon, dupliceer het
   niet).
3. **Plakken van een volledige join-URL — let op een echt spanningsveld
   vóórdat je dit bouwt:** het codeveld verwacht een 6-cijferige `gameCode`
   (`join-state`'s `{type:'code', code}`-locator). Een gedeelde join-URL is
   echter een `/j/{inviteId}`-link (`share-actions.shareUrlsFor`) met een
   alfanumerieke `inviteId`, geen 6-cijferige code. Een geplakte join-URL
   bevat dus meestal geen code om te extraheren. Twee eerlijke opties: (a)
   detecteer een `/j/{inviteId}`-patroon bij het plakken en navigeer
   rechtstreeks naar die route (dus niet "extraheren", maar doorschakelen
   naar de invite-flow), of (b) beperk deze eis tot het schonen van
   incidentele spaties/`https://`-prefixes rond een wél 6-cijferige waarde.
   Kies bewust, leg de keuze vast — niet stilzwijgend aannemen dat "code
   extraheren uit een link" altijd kan.

## S04 — Naam kiezen

1. **Tekenteller bij de limiet.** `join-state.mjs` kapt al stil af op 20
   grafeem-clusters (`Intl.Segmenter`, dezelfde aanpak als elders in de repo)
   — voeg een zichtbare teller toe die met dezelfde segmenter telt, niet met
   `.length` (dat telt UTF-16-eenheden, niet grafemen — zie de bestaande
   waarschuwing in `join-state.mjs` zelf).
2. **Sociaal bewijs (`19 spelers wachten al`) — ook hier een echte
   beperking:** dit getal is alleen beschikbaar via `previewInvite`'s
   `playerCount`, en preview loopt **uitsluitend** voor de invite-locator
   (`PROTOCOL.md`'s previewendpoint is invite-only, `join-state.mjs` slaat
   preview bewust over bij een code-locator). Sociaal bewijs kan dus wél
   getoond worden ná een invite-link, maar **niet** ná code-invoer — er is
   simpelweg geen call die dat aantal ophaalt in dat pad. Bouw geen
   schijn-call om dit alsnog te forceren; toon het veld conditioneel, alleen
   als de data er al is.

## Regels

- Geen nieuwe validatie die verder gaat dan wat `join-state.mjs`/
  `host-setup-state.mjs` al doen.
- Nieuwe teksten in alle drie de locales tegelijk.
- Geen `innerHTML`.

## Definition of done

- Tegen `transport-mock.mjs`: quick start toont `Potje maken…` tijdens het
  aanmaken; de belofte-regel staat op de landing; Enter in het codeveld
  submit't; de code toont geformatteerd terwijl de onderliggende waarde
  schoon blijft; het naamveld toont een tekenteller die grafemen telt, niet
  tekens; sociaal bewijs verschijnt ná een invite-link met een `playerCount`
  en blijft weg bij code-invoer.
- De S03-plakkeuze (a of b hierboven) staat expliciet benoemd in de
  commitmessage.
- `../PROGRESS.md` bijgewerkt voor S01, S03 en S04.
