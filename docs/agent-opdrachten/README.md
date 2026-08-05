# Agent-opdrachten — mobiele UX-ronde (5 aug 2026)

Vier pakketten, vier agents, één doel: **Rounda moet op een telefoon te spelen
zijn zonder te scrollen of te zoeken.** De 58 feedbackpunten van de
producteigenaar zijn verdeeld over de mappen `A/` t/m `D/`.

**Lead en reviewer: regie (Claude).** De producteigenaar stuurt de agents aan;
review loopt via de lead. Deze map is de enige bron voor wat er moet gebeuren.

---

## 1. Het ruimtebudget — het contract waar alles aan hangt

De harde eisen (punt 1, 33, 58) zijn niet te beoordelen met "ziet er compacter
uit". Ze zijn daarom vertaald naar **pixels**, gemeten op de screenshots van de
producteigenaar (iPhone, 3× schaal, dus ±10%).

**Referentie: 390 × 844 CSS-px (iPhone 13/14/15), Safari met adresbalk.**
Bruikbare hoogte: **≈ 650 px**.

### Gemeten vandaag (spelscherm)

| Gebied | Nu | Budget | Verschil |
| --- | --- | --- | --- |
| Codebalk + marge | ~70 | **44** | −26 |
| Losse rij pauze/⋯ | ~55 | **0** (rij verdwijnt) | −55 |
| Ruimte tot "RONDE x/10" | ~55 | **16** | −39 |
| Vlag | ~230 | **200** | −30 |
| **Inhoud begint op** | **~180** | **≤ 60** | **−120** |
| Vier antwoorden (4 × 67) | 268 | 268 | — |

Vier antwoorden moeten uiterlijk op **380 px** beginnen om binnen 650 te
passen. Ze beginnen nu op ~535. **Er moet ~155 px terug**, en die zit vrijwel
volledig in de chrome — daarom is pakket A blokkerend.

### De tokens

Pakket A zet deze als CSS-variabelen in `base.css` (`:root`). B, C en D lezen
ze en verzinnen geen eigen waarden:

```css
--chrome-h:        44px;  /* codebalk incl. alles wat erin zit */
--chrome-gap:      16px;  /* ruimte onder de chrome */
--media-max-h:    200px;  /* vlag, contour, elk vraagbeeld */
--answer-h:        56px;  /* één antwoordpil */
--answer-gap:      11px;
```

**Wie meer ruimte nodig heeft, vraagt het aan bij A.** Stilzwijgend over
budget gaan is een afgekeurde review, ook als het scherm er mooi uitziet.

## 2. Wie bezit welk bestand

Vier agents in twee stylesheets is de snelste weg naar een merge-hel. Daarom:

| Bestand | Eigenaar | De rest |
| --- | --- | --- |
| `frontend/css/base.css` (`:root`-tokens, `#app-header`) | **A** | niet aankomen |
| `frontend/css/rounda-1c.css` — chrome-sectie | **A** | niet aankomen |
| `frontend/css/rounda-1c.css` — eigen sectie onderaan | ieder | alleen je eigen blok |
| `frontend/js/views/room-header.mjs`, `app-menu.mjs` | **A** | via A |
| `frontend/js/views/home.mjs`, `lobby.mjs` | **C** | via C |
| `frontend/js/views/gameplay.mjs`, `scoreboard.mjs`, `podium.mjs` | **D** | via D |
| `frontend/js/views/hostbar.mjs` | **D** (inhoud), **A** (plaatsing) | overleg |
| `frontend/locales/*.mjs` | ieder, **alleen toevoegen** | nooit een bestaande sleutel wijzigen |
| `docs/STATUS.md`, `DECISIONS.md`, `PROTOCOL.md` | **lead** | aanleveren in je handover |

Iedere agent sluit zijn CSS af in een eigen blok:

```css
/* ══ PAKKET C — home & lobby (agent C) ══ */
```

## 3. Werkafspraken

- **Nederlands**, in code en commits. Commentaar legt uit *waarom*, niet *wat*.
- `npm test` moet groen blijven. Rood inleveren mag, mét uitleg — stilletjes
  een test aanpassen zodat hij weer groen wordt, mag niet.
- **Vóór elke commit:** `devkit check-autonomy --staged` (max 15 bestanden).
- **Niet pushen.** De lead pusht.
- Cachebust `?v=1cX` in `frontend/index.html` ophogen bij CSS-wijzigingen —
  **A doet dat als laatste**, anders overschrijven jullie elkaar.
- Raak `server/` niet aan tenzij je briefing het expliciet zegt.

## 4. De besluiten waar je niet omheen mag

Deze staan vast en zijn geen kwestie van smaak. Wie ertegenin gaat, krijgt dat
in de review terug:

| Besluit | Wat het betekent |
| --- | --- |
| **40D** | Mix en Typen staan zichtbaar-uitgeschakeld tot typed answers bestaat. **Niet aanzetten.** |
| **D-018** | Code + QR blijven het hele potje zichtbaar. Compacter mag; wéghalen niet (behalve op het eindscherm, zie A) |
| **32** | Eén gameType per match |
| **Doelbeeld C** | "Antwoord automatisch tonen" is serverwerk, geen CSS-toggle |
| **Positief** | Punten 6, 12, 26, 28, 29, 30 vond de producteigenaar goed. **Niet verbeteren.** |

## 5. Reviewprotocol

Elk pakket heeft **drie stoppunten**. Bij elk stoppunt lever je:

1. de diff (`git diff` of de commits, ongepusht);
2. de volledige uitslag van `npm test`;
3. de afvinklijst uit je briefing, met per punt één zin: wat je deed, of het
   klaar is, en zo niet waarom;
4. **één screenshot per gewijzigd scherm op 390 × 844.** Lukt dat niet, meld
   dat dan expliciet in plaats van het weg te laten.

De lead toetst op: het ruimtebudget, de besluiten hierboven, of je binnen je
eigen bestanden bent gebleven, en of je geen "positief"-punt hebt verbouwd.

## 6. Volgorde

```
A ──┬── (stoppunt 1: budget + één rij chrome) ──┬── A2 ── A3
    │                                            │
    │                              C1 ── C2 ── C3
    │                              D1 ── D2 ── D3
B ──┴── B1 ── B2 ── B3   (raakt de chrome niet, kan meteen)
```

**A stoppunt 1 is blokkerend voor C en D.** B kan direct beginnen.
