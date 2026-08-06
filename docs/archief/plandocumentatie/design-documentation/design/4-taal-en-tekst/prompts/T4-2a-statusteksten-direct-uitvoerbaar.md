# Prompt — T4-2a: Statusteksten die direct uitvoerbaar waren

**Status: uitgevoerd.** Afgesplitst van de oorspronkelijke T4-2 ná
reviewfeedback — dit deel had geen open productbesluit nodig, T4-2b wel.
Onderdeel van [`../PROGRESS.md`](../PROGRESS.md), thema 4.

## 1 — Loadingstatus bij Snel starten

`views/home.mjs`: nieuwe sleutel `home.creating` ("Potje maken…"), getoond
zolang `state.status === 'creating'`, `aria-live="polite"`.

## 2 — Lege lobby

`views/lobby.mjs`: bij `model.playerCount === 0` verschijnt nu
`lobby.emptyTitle` ("Nog niemand binnen") + `lobby.emptyHint` ("Laat iemand
de QR scannen om te beginnen.") **in plaats van** de spelerstelling + lege
lijst, niet ernaast.

## 3 — Reconnect: hersteld-bevestiging + antwoord-geruststelling

Beide vroegen een preciezer statusmodel dan "gebruik hetzelfde patroon als
`showFeedback`" (reviewfeedback punt 5) — dat is nu uitgewerkt in
`session-shell.mjs`:

- **`connection.connected`** ("We zijn weer verbonden."): getoond 3s ná een
  overgang naar `connected` die ván `disconnected`/`reconnecting` kwam —
  **nooit** bij de allereerste verbinding (`wasDown`-check vóór de
  reducertransitie, want ná de transitie is `reconnect.status` altijd al
  `'connected'` en vertelt niks meer over waar het vandaan kwam). Een nieuwe
  disconnect annuleert een nog lopende hersteld-timer altijd eerst
  (`cancelRecoveredMessage()`) i.p.v. te stapelen. Opgeruimd in zowel
  `destroy()` als `terminate()`.
- **`connection.answerSaved`** ("Je antwoord blijft bewaard."): getoond
  **naast** (eigen element, niet in plaats van) de disconnected-tekst, en
  uitsluitend als `roundModel.answerStatus === 'accepted'` — niet op basis
  van de fase alleen (reviewfeedback punt 3: fase bewijst niet dat dít
  antwoord is aangekomen; `sending`/`rejected` tonen 'm dus terecht niet).

## Regels

- Geen enkele van deze drie teksten vervangt een bestaande — ze zijn additief.
- `connection.answerSaved` leunt op T4-3's `hydrateFromSnapshot`-fix: zonder
  die fix was `answerStatus` ná een reconnect onbetrouwbaar en zou deze
  geruststelling af en toe onterecht verschijnen of wegvallen.

## Definition of done — behaald

- Handmatig geverifieerd (directe testharnas met `createMockTransport()`):
  `home.creating` verschijnt tijdens het aanmaken, de lege lobby toont de
  juiste tekst i.p.v. "0 spelers".
- De hersteld-/geruststellingslogica is geverifieerd via codepad-doorloop +
  het ontbreken van foutmeldingen tijdens normale sessies (een TDZ-bug in de
  variabele-declaratievolgorde kwam hierbij zelf aan het licht en is
  gefixt — de mock kan een echte disconnect niet simuleren, dus een
  end-to-end herstel-scenario blijft ongetest tot de echte transportlaag
  hiervoor gebruikt wordt).
- `node --test` (372 tests) groen.
- `PROGRESS.md` §4 (loadingstatus), §6-host (lege lobby), §13 (hersteld +
  geruststelling) naar niveau 1–2.
