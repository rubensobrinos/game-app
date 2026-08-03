# Prompt — T2-6: Leaderboard-rij met bewegingskolom

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S15`).

## Brondocument

`05-DESIGN-SYSTEM.md` §10 (Leaderboard row). `04-SCREEN-SPECIFICATIONS.md`
`S15`. `08-ACCESSIBILITY-AND-RESILIENCE.md` §2.2 ("rankmovement krijgt tekst
`twee plaatsen gestegen`").

## Wat er nu staat

`views/scoreboard.mjs` rendert per speler een rij met naam en score, tabulaire
cijfers, eigen rij met accentrand. Dat werkt.

Wat ontbreekt is de vierde kolom uit `05` §10: **beweging**. `↑2`, `↓1`, `—`.
Zonder die kolom is een tussenstand een lijst; mét is het een wedstrijd. De
audit noemt dit als het verschil tussen "statische top vijf" en "bewegend
leaderboard", en de roadmap zet reveal/leaderboard op *zeer hoge* impact.

Er is ook geen rankkolom: de positie is impliciet de volgorde. `05` §10 wil een
vaste rankkolom, want bij een gedeelde plaats klopt "de zoveelste rij" niet
meer.

## Wat dit is

1. **Rankkolom, vast van breedte.** Cijfers rechts uitgelijnd, tabulair, zodat
   `#1` en `#12` niet verspringen.

2. **Bewegingskolom** met symbool én tekst. `↑2` is de visuele vorm; een
   screenreader hoort `twee plaatsen gestegen` (`08` §2.2). Kleur is
   ondersteunend, nooit de enige drager (`08` §2.3) — een stijger is niet
   alleen groen, hij heeft een pijl en een getal.

3. **Drie toestanden:** gestegen, gedaald, gelijk. Gelijk krijgt `—` en niet
   niets, anders lijkt een lege cel op ontbrekende data.

4. **Eigen rij herkenbaar** met het accent plus het label `Jij` — dat bestaat
   al, laat het staan.

5. **De component rekent niets uit.** Hij krijgt `{ rank, name, score, delta }`
   binnen en tekent. Waar `delta` vandaan komt is een modelvraag voor thema 1
   (`standings-model.mjs` kent nu geen vorige stand).

## Regels

- **Geen rankanimatie hier.** Rijen die naar hun nieuwe positie bewegen is
  `E11` en dus thema 3. Deze prompt levert de rij mét bewegingskolom; de
  animatie hangt thema 3 eraan.
- **Geen tie-regel verzinnen.** `S15` zegt dat een gedeelde plaats een expliciet
  productbesluit is en dat besluit is niet genomen. De component moet twee
  rijen met dezelfde rank kúnnen tonen; welke rank dat is bepaalt het model.
  Meld het als open punt in plaats van er een aanname in te bouwen.
- Namen blijven via `textContent`.

## Definition of done

- Een tussenstand van tien spelers met stijgers, dalers en gelijkblijvers,
  gerenderd in beide thema's — screenshot.
- Twee rijen met dezelfde rank breken de layout niet.
- Een screenreader leest voor een stijger de zin, niet het symbool.
- `#1` en `#12` staan verticaal uitgelijnd.
- De component staat in `HANDOFF-UI.md` met zijn aanroep en met de open vraag
  over de tie-regel erbij.
