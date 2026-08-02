# E2E-scenario's (pseudocode) — Playwright, Deel 1 (DT4a)

Onderdeel van [`README.md`](README.md), fase DT4a, uitgevoerd volgens
[`prompts/DT4a-playwright-e2e.md`](prompts/DT4a-playwright-e2e.md) — Deel 1. Bron:
[`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen → Browser/E2E (regels 306–319), en de routes uit
[`docs/multiplayer/GAME-FLOW.md`](../multiplayer/GAME-FLOW.md) §Routes (regels 26–38).

## Waarom pseudocode en geen `.spec.ts`

Playwright is niet geïnstalleerd in deze repo (geen `package.json`). Zonder
Playwright's eigen parser/linter/typedefinities kan geen enkele echte `.spec.ts` op
syntax- of API-correctheid gecontroleerd worden — een geschreven maar nooit
uitgevoerd specbestand zou dus een valse indruk van gereedheid geven. Dit document
levert daarom per scenario een leesbare beschrijving in proza/pseudocode: geen
`page.goto(...)`, `page.click(...)` of `expect(locator).toBeVisible()`, maar
"navigeer naar", "klik op", "verwacht dat" in doorlopende, genummerde stappen. Het
toevoegen van Playwright zelf, en het omzetten van deze scenario's naar echt
draaiende specs onder `tests/e2e/`, is Deel 2 van
[`prompts/DT4a-playwright-e2e.md`](prompts/DT4a-playwright-e2e.md) en wacht op een
expliciet `deps`-akkoord (CLAUDE.md §Beslisbevoegdheid).

## Scope en aanpak

- Gedekt: alles wat Chromium/WebKit-**emulatie** daadwerkelijk kan bewijzen —
  routes/navigatie, refresh-gedrag, responsive viewports en browser-API-fallbacks.
- Niet gedekt (zie onderaan): schermlock, native share, echte Safari/iPhone, trage
  4G op een echt toestel. Die horen bij DT4b
  ([`prompts/DT4b-device-matrix.md`](prompts/DT4b-device-matrix.md)), als handmatig
  in te vullen runbook op echte toestellen — Playwright kan die niet betrouwbaar
  bewijzen.
- De client-side flow/state-logica die deze scenario's aansturen (join-state,
  match-phase-state, reconnect-state) bestaat op dit moment als pure state-machines
  zonder DOM/transport (zie
  [`docs/game-flow-plan/README.md`](../game-flow-plan/README.md) §Uitgangspunt 1).
  Waar een scenario hieronder afhankelijk is van serverrespons (snapshot, join,
  events), gaat het uitdrukkelijk tegen een **gemockte transportlaag** die de
  PROTOCOL.md-eventnamen en -payloads volgt — dezelfde aanpak als
  `game-flow-plan`'s testplan (`docs/game-flow-plan/README.md` regel 183–185: "een
  gemockte transportlaag die exact de PROTOCOL.md-eventnamen en -payloads volgt,
  zodat wanneer de echte implementatie klaar is alleen die laag wisselt"). Dat is
  bewust: er bestaat nog geen draaiende server om echt tegenaan te testen, en een
  scenario dat dat wél veronderstelt zou "groen" kunnen worden zonder iets te bewijzen
  (zie `README.md` §Uitgangspunt 4, "groen betekent bewezen, niet 'map bestaat'").
- Routes uit GAME-FLOW.md §Routes die in de scenario's hieronder voorkomen: `/`
  (start), `/j/{inviteId}` (publieke join-route), `/game/{code}` (speler),
  `/host/{code}` (host, dezelfde UI + hostbediening), `/screen/{code}` (optionele
  spectatorroute — expliciet **niet** vereist voor de kernflow, zie scenario 6).

**Aanvulling na [`prompts/REVIEW-DT3B-DT7.md`](prompts/REVIEW-DT3B-DT7.md) #6:**
geen van deze zes scenario's is uitvoerbaar door alleen Playwright te installeren.
Geverifieerd (2026-08-02): `client/flow/` bevat uitsluitend losse, pure
`.mjs`-state-machinemodules (`route-resolver.mjs`, `session-store.mjs`,
`join-state.mjs`, `match-phase-state.mjs`, `reconnect-state.mjs`, enz.) — geen
enkel HTML-/DOM-toegangspunt dat ze aan een echte pagina koppelt. Playwright bestuurt
een browser die een pagina laadt; zonder een geïntegreerde host/player-kernflow
(routering, spelscherm, timer, scoreboard, podium, hostbedieningsbalk) is er geen
pagina om te besturen. Elk scenario hieronder krijgt daarom een expliciete
**implementatieprerequisite**, naar het voorbeeld van DT3a's activatiecriteria —
Deel 2 mag een scenario pas omzetten naar een echte spec zodra zowel het
`deps`-akkoord voor Playwright er is, én de genoemde prerequisite aantoonbaar
bestaat.

Elk scenario hieronder volgt hetzelfde format: **doel**, **betrokken route(s)**,
**implementatieprerequisite**, **voorwaarden**, genummerde **stappen**
(pseudocode), **verwacht resultaat**.

---

## 1. QR-/deel-link opent de juiste room

**Doel:** bewijzen dat het openen van een join-link met een geldige `inviteId` de
speler naar precies díe room brengt — niet naar een verkeerde of naar de laatst
aangemaakte room — en dat een ongeldige/verlopen `inviteId` juist geen room opent
(GAME-FLOW.md Randgeval 9).

**Betrokken route(s):** `/j/{inviteId}` → `/game/{code}`.

**Implementatieprerequisite:** een draaiende pagina die `route-resolver.mjs`
daadwerkelijk aan browser-navigatie/DOM koppelt (nu bestaat alleen de losstaande,
geteste functie), plus een naamveld- en lobby-rendering die op `join-state.mjs`
reageert. Geen backend-server nodig — een gemockte transportlaag volstaat — maar wel
een echte, gerenderde pagina om naartoe te navigeren.

**Voorwaarden:**
- Gemockte transportlaag met minimaal twee onafhankelijke, vooraf aangemaakte rooms
  (room A met `inviteId` A / `code` A, room B met `inviteId` B / `code` B), elk in
  status LOBBY.
- Eén losse, ongeldige/verlopen `inviteId` die door geen enkele room herkend wordt.

**Stappen:**
1. Navigeer naar `/j/{inviteId}` met de geldige `inviteId` van room A.
2. Verwacht dat de (gemockte) inviteId-validatie slaagt en dat een naamveld
   verschijnt met een reeds voorgestelde, willekeurige naam.
3. Klik op "Meedoen" zonder de voorgestelde naam te wijzigen.
4. Verwacht dat de app navigeert naar `/game/{code}` waarbij `{code}` gelijk is aan
   het `code` van room A, en dat de getoonde deelnemerslijst overeenkomt met room A.
5. Herhaal stap 1–4 in een aparte, onafhankelijke browsercontext met de `inviteId`
   van room B. Verwacht dat de resulterende URL het `code` van room B bevat en dat de
   deelnemerslijst van room B geen overlap vertoont met die van room A uit stap 4
   (voorkomt een regressie waarbij joins toevallig altijd in dezelfde/laatste room
   belanden).
6. Navigeer naar `/j/{inviteId}` met de ongeldige/verlopen `inviteId`.
7. Verwacht een duidelijke foutmelding in plaats van een naamveld, en geen
   navigatie naar enige `/game/{code}`.

**Verwacht resultaat:** elke geldige `inviteId` leidt uitsluitend naar zijn eigen
room, zonder kruisbesmetting tussen rooms; een ongeldige `inviteId` opent geen room.

---

## 2. Refresh behoudt fase en score (tegen een gemockte transportlaag)

**Doel:** bewijzen dat een browser-refresh op `/game/{code}` de lokaal bewaarde
sessietoken hergebruikt, een snapshot-aanvraag doet, en dat de client daarna de
snapshot van de (gemockte) server laat winnen boven verouderde lokale state —
conform GAME-FLOW.md Randgeval 2 ("actuele snapshot overschrijft oude lokale
state; score en geaccepteerde antwoorden blijven behouden") en de reconnect-regels
uit `docs/game-flow-plan/prompts/GF4-reconnect-state.md` ("na verbinding vraagt
client altijd een snapshot"; "een reeds geaccepteerd antwoord wordt niet opnieuw
verzonden").

**Betrokken route(s):** `/game/{code}` (speler); dezelfde stappen zijn ook van
toepassing op `/host/{code}` voor een meespelende host.

**Implementatieprerequisite:** `session-store.mjs` en `reconnect-state.mjs`
daadwerkelijk gekoppeld aan respectievelijk browser-`localStorage` en een
DOM-gerenderde paginalevenscyclus (refresh-event), plus een gerenderd spelscherm
dat fase/score toont — nu bestaan beide modules alleen als losse, pure
state-machines zonder koppeling aan een echte pagina.

**Voorwaarden:**
- Gemockte transportlaag die op een snapshot-aanvraag een vaste fase/score
  retourneert die bewust afwijkt van wat er vóór de refresh lokaal staat (bijv.
  mock levert ronde 3, status ACTIVE, score 340; lokale staat vóór refresh is
  kunstmatig gezet op ronde 1, score 0). Dat verschil is opzettelijk: een test die
  slaagt terwijl mock en lokale staat toevallig gelijk zijn, bewijst niets.
- Sessietoken al aanwezig in lokale opslag, alsof een eerdere join al heeft
  plaatsgevonden.
- Eén reeds geaccepteerd antwoord in de mock geregistreerd vóór de refresh.

**Stappen:**
1. Navigeer naar `/game/{code}` met de vooraf gezette sessietoken en de kunstmatig
   verouderde lokale staat (ronde 1, score 0).
2. Verwacht dat de UI vóór de refresh die verouderde fase/score toont (sanity-check
   dat er straks een echt, meetbaar verschil is).
3. Voer een paginarefresh uit.
4. Verwacht dat de client na het herladen automatisch herverbindt en een
   snapshot-aanvraag doet bij de gemockte transportlaag, zonder dat de gebruiker
   daar iets voor hoeft te doen.
5. Verwacht dat de UI na de snapshot-respons de door de mock geleverde fase (ronde
   3, ACTIVE) en score (340) toont — niet de oude lokale waarden van vóór de
   refresh.
6. Verwacht dat het al vóór de refresh geaccepteerde antwoord niet opnieuw als
   nieuwe aanroep bij de mock binnenkomt (geen dubbele verzending).

**Verwacht resultaat:** na refresh wint de snapshot van de gemockte transportlaag
altijd over verouderde lokale state; reeds geaccepteerde antwoorden worden niet
dubbel verzonden.

---

## 3. Portrait- en landscape-viewport

**Doel:** bewijzen dat het spelscherm (vraag, antwoordopties, timer,
ontvangstbevestiging) bruikbaar blijft in zowel portrait- als
landscape-oriëntatie, zonder dat elementen buiten beeld vallen of elkaar
overlappen.

**Betrokken route(s):** `/game/{code}`.

**Implementatieprerequisite:** een daadwerkelijk gerenderd spelscherm (vraag,
antwoordopties, timer, ontvangstbevestiging) met responsive CSS/layout — dit is
letterlijk de "UI-samenstelling" die tot nu toe bewust buiten de
`game-flow-plan`-modules is gehouden (die leveren alleen state, geen DOM/CSS). Zonder
gerenderde UI is er niets om op portrait/landscape te controleren.

**Voorwaarden:**
- Viewport ingesteld op een representatieve telefoonmaat, bijv. 390×844
  (portrait).
- Gemockte transportlaag levert een actieve ronde met vraag, antwoordopties en
  timer.

**Stappen:**
1. Zet de viewport op 390×844 (portrait) en navigeer naar `/game/{code}` tijdens
   een actieve ronde.
2. Verwacht dat vraag, antwoordopties, timer en de "antwoord ontvangen"-indicator
   allemaal zichtbaar zijn binnen het primaire interactiegebied, zonder dat
   essentiële elementen buiten het scherm vallen.
3. Wijzig de viewport naar 844×390 (landscape) zonder opnieuw te navigeren
   (simuleert het draaien van hetzelfde toestel tijdens dezelfde ronde).
4. Verwacht dat dezelfde elementen (vraag, opties, timer, bevestiging) nog steeds
   zichtbaar en aanklikbaar zijn, zonder dat antwoordopties elkaar overlappen of
   afgekapt worden.
5. Selecteer een antwoordoptie in landscape-stand.
6. Verwacht dezelfde "antwoord ontvangen"-bevestiging als in portrait-stand (stap
   2), niet een afwijkend of ontbrekend resultaat.

**Verwacht resultaat:** geen functionaliteit of essentieel element gaat verloren
bij het draaien van portrait naar landscape tijdens dezelfde ronde.

---

## 4. Kleine schermen

**Doel:** bewijzen dat de kernflow (join → antwoord geven → uitslag zien) werkt op
een klein schermformaat, niet alleen op een groter referentietoestel.

**Betrokken route(s):** `/j/{inviteId}`, `/game/{code}`.

**Implementatieprerequisite:** dezelfde gerenderde join- en spelschermen als
scenario's 1 en 3, nu getoetst op een kleiner formaat — voegt geen nieuwe
onderliggende module toe, maar vereist wel dat de UI-samenstelling er al is.

**Voorwaarden:**
- Viewport op een klein telefoonformaat, bijv. 375×667.
- Gemockte transportlaag zoals in scenario 1 (geldige room, geldige `inviteId`) en
  scenario 3 (actieve ronde).

**Stappen:**
1. Zet de viewport op 375×667 en doorloop de joinflow van scenario 1 (open
   `/j/{inviteId}` → naamveld → "Meedoen").
2. Verwacht dat het naamveld en de "Meedoen"-knop volledig zichtbaar en
   aanklikbaar zijn zonder horizontaal te hoeven scrollen.
3. Verwacht, zodra de ronde actief is, dat alle antwoordopties zichtbaar zijn
   zonder afgekapte tekst en zonder dat knoppen elkaar overlappen.
4. Selecteer een antwoord.
5. Verwacht dat zowel de ontvangstbevestiging als de "aantal antwoorden
   ontvangen"-indicator zichtbaar blijven binnen dit schermformaat.
6. Verwacht dat de ronde-uitslag (eigen verdiende punten, top 5 + eigen positie)
   leesbaar is zonder horizontaal scrollen.

**Verwacht resultaat:** de volledige kernflow — join tot ronde-uitslag — blijft
bruikbaar op het kleinste geteste schermformaat; geen afgekapte of onbereikbare
interactieve elementen.

---

## 5. Host speelt mee zonder dat de bedieningsbalk de antwoordinterface verdringt

**Doel:** bewijzen dat een host die zelf meespeelt de inklapbare bedieningsbalk kan
in- en uitklappen, en dat de antwoordinterface bij een ingeklapte balk niet
kleiner of drukker oogt dan bij een gewone speler — conform GAME-FLOW.md
§Hostbediening ("een host die meespeelt moet de bediening kunnen inklappen zodat
de antwoordinterface niet kleiner of onrustiger wordt").

**Betrokken route(s):** `/host/{code}`.

**Implementatieprerequisite:** een gerenderde hostbedieningsbalk (`host-controls-
state.mjs` gekoppeld aan zichtbare, aanklikbare knoppen) náást hetzelfde gerenderde
spelscherm als scenario 3 — twee UI-onderdelen die nu allebei alleen als state-
module bestaan, nooit samen gerenderd.

**Voorwaarden:**
- Host-sessie met meespelen aan (host heeft dus ook een eigen `playerId`, net als
  een gewone speler).
- Viewport op hetzelfde klein formaat als scenario 4 (375×667) — daar is het risico
  op overlap tussen bedieningsbalk en antwoordinterface het grootst.
- Gemockte transportlaag levert dezelfde actieve ronde als scenario 3/4.

**Stappen:**
1. Navigeer naar `/host/{code}` tijdens een actieve ronde, met de bedieningsbalk in
   uitgeklapte staat.
2. Verwacht dat zowel de hostbediening (start/pauze/hervat/volgende/vergrendel/
   kick/beëindig/rematch, voor zover van toepassing in deze fase) als de
   antwoordopties zichtbaar zijn.
3. Klap de bedieningsbalk in.
4. Verwacht dat de antwoordopties na het inklappen dezelfde afmeting en positie
   innemen als de antwoordopties van een gewone speler op `/game/{code}` in
   dezelfde viewport (vergelijk met de layout uit scenario 4) — geen zichtbare
   compressie of extra drukte.
5. Verwacht dat de ingeklapte bedieningsbalk geen ruimte inneemt die
   antwoordknoppen verdringt, verkleint of laat overlappen.
6. Klap de bedieningsbalk weer uit.
7. Verwacht dat de hostbediening opnieuw volledig bruikbaar is, zonder dat de
   pagina herladen hoefde te worden.

**Verwacht resultaat:** met ingeklapte bedieningsbalk is de antwoordinterface van
een meespelende host functioneel en visueel gelijkwaardig aan die van een gewone
speler; de balk zelf blijft altijd bereikbaar via in-/uitklappen.

---

## 6. Kernflow zonder centraal scherm

**Doel:** bewijzen dat de volledige hoofdroute — homepage tot en met eindpodium —
functioneert met uitsluitend host- en spelertoestellen, zonder dat `/screen/{code}`
op enig moment nodig is (GAME-FLOW.md §Hoofdroute: "Een laptop, televisie, beamer
of centraal scherm komt in deze route niet voor.").

**Betrokken route(s):** `/`, `/j/{inviteId}`, `/host/{code}`, `/game/{code}`.
Expliciet buiten dit scenario: `/screen/{code}`.

**Implementatieprerequisite:** de zwaarste van de zes — de volledige, geïntegreerde
kernflow (homepage, lobby met QR, spelscherm, tussenstand, eindpodium) daadwerkelijk
gerenderd en gekoppeld aan alle onderliggende `client/flow`-modules tegelijk. Dit
scenario is realistisch pas uitvoerbaar nadat scenario's 1–5 elk al individueel
werken.

**Voorwaarden:**
- Twee onafhankelijke browsercontexten: één voor de host, één voor een speler.
- Gemockte transportlaag die create, join, start, minimaal één volledige ronde en
  finish ondersteunt.
- De test controleert actief dat `/screen/{code}` niet wordt opgevraagd — niet
  enkel dat die route toevallig ongebruikt blijft.

**Stappen:**
1. Navigeer in de hostcontext naar `/`, kies "Snel starten" met meespelen aan.
2. Verwacht navigatie naar `/host/{code}` met een zichtbare lobby, QR-code en
   deel-link.
3. Open in de spelercontext `/j/{inviteId}` (afgeleid van de link/QR uit stap 2) en
   rond de joinflow af (naamveld overslaan of invullen, "Meedoen").
4. Verwacht dat beide contexten de lobby met een live, gesynchroniseerde
   deelnemerslijst zien, elk op hun eigen route (`/host/{code}` respectievelijk
   `/game/{code}`).
5. Start de game vanuit de hostcontext.
6. Verwacht dat beide contexten doorschakelen naar de vraagfase, elk op hun eigen
   route, zonder dat op enig moment `/screen/{code}` bezocht is.
7. Doorloop minimaal één ronde: antwoord geven in de spelercontext, ronde-uitslag
   afwachten in beide contexten.
8. Verwacht dat tussenstand en (na de laatste ronde) het eindpodium in beide
   contexten zichtbaar zijn, nog altijd zonder dat `/screen/{code}` is opgevraagd.

**Verwacht resultaat:** de kernflow van homepage tot eindpodium is volledig te
doorlopen met alleen host- en spelertoestellen; geen enkel moment vereist een
derde, centraal scherm.

---

## Wat hier expliciet buiten valt

Deze scenario's dekken wat Chromium/WebKit-**emulatie** daadwerkelijk kan bewijzen.
De volgende punten uit DEPLOYMENT-AND-TESTING.md §Testlagen → Browser/E2E staan hier
bewust niet in, en horen bij DT4b
([`prompts/DT4b-device-matrix.md`](prompts/DT4b-device-matrix.md)) — een handmatig
in te vullen runbook/checklist op echte toestellen, nooit geautomatiseerde code:

- **Schermlock en ontgrendelen.** Een browser-engine kan geen echte OS-schermlock
  simuleren of het gedrag van een toestel dat daadwerkelijk vergrendeld en weer
  ontgrendeld wordt nabootsen; dat vereist een fysiek toestel.
- **Native share sheet.** De "Delen"-actie opent een OS-niveau UI buiten de
  browser-engine om; Playwright bestuurt de browser, niet het besturingssysteem
  eromheen. (Alleen de "kopieer join-link"-fallback binnen de pagina zelf zou
  losstaand emuleerbaar zijn, maar de eigenlijke share sheet niet — vandaar dat
  "native share" hier volledig buiten scope blijft in plaats van gedeeltelijk
  meegenomen te worden.)
- **Echte Safari/iPhone.** Playwright's WebKit-engine is geen exacte vervanging
  voor Mobile Safari op een echt toestel; render- en API-verschillen die alleen op
  een fysieke iPhone optreden, bewijst deze emulatie niet.
- **Trage 4G op een echt toestel.** Netwerk-throttling binnen een
  browser-emulatie meet iets anders dan een daadwerkelijk gethrottelde mobiele
  verbinding op fysieke hardware; dat verschil is precies waarom dit bij DT4b
  hoort in plaats van hier als "netwerk vertragen"-stap te worden toegevoegd.

Zolang Deel 2 van [`prompts/DT4a-playwright-e2e.md`](prompts/DT4a-playwright-e2e.md)
niet is geautoriseerd (`deps`-akkoord voor Playwright), blijven de zes scenario's
hierboven pseudocode; er bestaat geen enkel bestand onder `tests/e2e/` met code —
die map bevat vooralsnog uitsluitend `.gitkeep`.
