# Echte-device-/handmatige matrix (DT4b)

Onderdeel van [`README.md`](README.md), fase DT4b, uitgevoerd volgens
[`prompts/DT4b-device-matrix.md`](prompts/DT4b-device-matrix.md). Bron:
[`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen → Browser/E2E (regels 306–319) en §Assets (regel 199, "Delen"/QR-actie).

Dit is **geen uitvoerbare code en wordt dat ook nooit**. Playwright (of enige andere
browser-automatiseringstool) kan app-switch, schermlock, native share sheets, echt
Safari/iPhone-gedrag en echte trage-4G-netwerkcondities niet betrouwbaar bewijzen —
zie ook `e2e-playwright-scenarios.md` voor het deel dat
wél geautomatiseerd kan worden (DT4a). Dit document is het complement daarvan: een
runbook/checklist die een mens met een echt toestel doorloopt. Er is geen "groen" of
"rood" build-resultaat, alleen een handmatig ingevulde uitkomst per rij.

## Hoe te gebruiken

Dit document wordt **niet nu** ingevuld. De kolommen "laatst uitgevoerd" en
"uitkomst" staan bij aanmaak leeg en blijven dat totdat iemand de betreffende rij
daadwerkelijk op een echt toestel uitvoert.

- Voer het scenario uit op het genoemde (of gelijkwaardige) toestel/browser.
- Vul pas ná afloop "laatst uitgevoerd" in (datum, bijv. `2026-08-02`) en "uitkomst"
  (bijv. `geslaagd`, `gefaald — <korte reden>`, of `geblokkeerd — <reden>`).
- Bij een gefaalde rij: verwijs in de uitkomst-cel naar een issue/notitie in plaats
  van details in de tabel te proppen — de tabel moet scanbaar blijven.
- Een scenario dat ooit slaagde, kan later opnieuw falen (regressie). Overschrijf de
  cel dan met de nieuwste ronde; oudere uitkomsten horen in gitgeschiedenis, niet in
  meerdere kolommen naast elkaar.
- Dit document dekt alleen wat DT4a niet kan bewijzen. Voor routes/navigatie,
  refresh, responsive viewports en andere emuleerbare scenario's: zie
  `e2e-playwright-scenarios.md`.

## Matrix

| Scenario | Toestel/browser | Stappen | Verwacht resultaat | Laatst uitgevoerd | Uitkomst |
| --- | --- | --- | --- | --- | --- |
| App-switch en terugkeer tijdens een actieve ronde | Echte iPhone, Safari | 1. Join een actieve room als speler tijdens een lopende ronde. 2. Schakel via de app-switcher naar een andere app (bijv. Berichten) terwijl de ronde-timer loopt. 3. Wacht enkele seconden tot ruim binnen de rondeduur. 4. Keer terug naar de browser-tab/PWA. | App hervat dezelfde ronde zonder crash of blanco scherm; timer/fase klopt met de werkelijk verstreken tijd; een nog niet gegeven antwoord kan alsnog gegeven worden als de ronde nog actief is; socketverbinding herstelt (of state komt via snapshot) zonder dat de speler een foutmelding op het scherm houdt. |  |  |
| App-switch en terugkeer tijdens een actieve ronde | Echte Android, Chrome | Zelfde stappen als hierboven, op Android/Chrome. | Zelfde verwacht resultaat als hierboven. |  |  |
| Schermlock en ontgrendelen | Echte iPhone, Safari | 1. Join een actieve room als speler. 2. Druk tijdens een lopende ronde op de zijknop om het scherm te vergrendelen. 3. Wacht enkele seconden. 4. Ontgrendel het toestel en keer terug naar de browser/PWA. | Zelfde als bij app-switch: ronde/fase/timer kloppen na ontgrendelen, geen crash, geen permanente foutmelding; als de ronde inmiddels afgelopen is, toont de app de uitslag in plaats van een vastgelopen ronde-scherm. |  |  |
| Schermlock en ontgrendelen | Echte Android, Chrome | Zelfde stappen als hierboven, op Android/Chrome. | Zelfde verwacht resultaat als hierboven. |  |  |
| Native share sheet openen vanuit de "Delen"-actie | Echte iPhone, Safari | 1. Open de room als host of speler. 2. Tik op de "Delen"-actie voor de QR/joinUrl. 3. Observeer of het native iOS-share sheet opent (niet een custom in-app dialoog die alleen op desktop werkt). 4. Deel (of annuleer) naar een echte doel-app (bijv. Berichten) en controleer de gedeelde link. | Native share sheet opent; gedeelde link/joinUrl is correct en werkt bij het openen door de ontvanger; annuleren laat de app in een consistente staat achter (geen hangende overlay). |  |  |
| Native share sheet openen vanuit de "Delen"-actie | Echte Android, Chrome | Zelfde stappen als hierboven, op Android/Chrome. | Zelfde verwacht resultaat als hierboven, met het Android-share sheet. |  |  |
| Gedrag op een trage/gethrottelde 4G-verbinding | Echte iPhone, Safari, mobiel netwerk (geen wifi), eventueel met "trage 4G"/laag-databandbreedte-instelling of een fysiek zwak signaalgebied | 1. Schakel wifi uit; gebruik een echte mobiele verbinding met merkbaar hoge latency/lage bandbreedte (niet gesimuleerd via devtools). 2. Join een room via QR/link. 3. Speel minimaal één volledige ronde, inclusief het moment waarop het volgende-ronde-beeld preload volgens `DEPLOYMENT-AND-TESTING.md` §Assets. 4. Beoordeel laadtijd, antwoord-latency en of de UI duidelijk maakt dat er gewacht wordt. | App blijft bruikbaar: laadtijden zijn merkbaar maar niet blokkerend te lang voor een pilotcontext, er is zichtbare loading-/wachtfeedback in plaats van een bevroren scherm, een te laat verstuurd antwoord door netwerkvertraging geeft een begrijpelijke foutmelding in plaats van een silent fail. |  |  |
| Gedrag op een trage/gethrottelde 4G-verbinding | Echte Android, Chrome, mobiel netwerk (geen wifi) | Zelfde stappen als hierboven, op Android/Chrome. | Zelfde verwacht resultaat als hierboven. |  |  |
| Host speelt mee op een klein scherm zonder dat de bedieningsbalk de antwoordinterface verdringt | Echte iPhone (kleinste beschikbare/oudste model in het testpark, bijv. iPhone SE-formaat), Safari, portrait | 1. Start een room met `hostParticipates: true` op het kleinste beschikbare echte toestel. 2. Doorloop minimaal één ronde als hostspeler. 3. Controleer of de hostbedieningsbalk (lock/kick/volgende etc.) en de antwoordopties beide volledig zichtbaar en aanklikbaar zijn, zonder overlap of afgekapte elementen. 4. Herhaal in landscape indien relevant voor het spelvorm. | Bedieningsbalk en antwoordinterface overlappen niet en verdringen elkaar niet; alle antwoordopties zijn volledig zichtbaar en met de duim bedienbaar; geen element valt buiten beeld of onder de systeem-UI (notch/home-indicator). |  |  |
| Host speelt mee op een klein scherm zonder dat de bedieningsbalk de antwoordinterface verdringt | Echte Android (klein/budget-formaat toestel indien beschikbaar), Chrome, portrait | Zelfde stappen als hierboven, op Android/Chrome. | Zelfde verwacht resultaat als hierboven. |  |  |

## Buiten scope van dit document

- Alles wat DT4a (`e2e-playwright-scenarios.md`) al emuleerbaar dekt: routes/
  navigatie, refresh op een gesimuleerde transportlaag, responsive viewports zonder
  fysiek toestel.
- Load- en chaostests (DT5/DT6) — dit document gaat over UX/gedrag op één echt
  toestel, niet over serverbelasting of infrastructuurfalen.
- Handmatige pilots met meerdere echte spelers tegelijk (Pilot A/B in
  `DEPLOYMENT-AND-TESTING.md` §Handmatige pilots vóór launch) — dit document is
  single-tester-per-rij; de pilots zijn een apart, breder moment.
