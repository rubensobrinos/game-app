# Prompt — T2-1: Semantische kleurtokens

Onderdeel van [`README.md`](README.md). **Dit is de enige prompt hier met een
tijdslot: hij hoort nu, niet later.**

## Brondocument

`05-DESIGN-SYSTEM.md` §2.1 (Kleurenrollen) en §2.2 (Contrastregels).

## Wat er nu staat

`frontend/css/base.css` definieert dertien kleurtokens met **presentatieve**
namen: `--bg`, `--surface`, `--surface2`, `--border`, `--accent`,
`--accent-light`, `--accent-glow`, `--success`, `--success-bg`, `--error`,
`--error-bg`, `--text`, `--text-muted`, plus `--gold`. Het lichte thema
overschrijft er negen.

`05` §2.1 vraagt om **rolnamen**: wat iets betekent, niet hoe het eruitziet.
Zeventien rollen staan daar met naam genoemd.

Dat verschil is niet cosmetisch. `--surface2` zegt niets over wanneer je het
gebruikt, dus wordt het gebruikt waar het toevallig goed uitkomt — vandaag als
inputachtergrond, als hostbalkknop én als disabled-vlak. Zodra één van die drie
een andere tint nodig heeft, is er geen token om te wijzigen zonder de andere
twee te raken.

## Waarom nu en niet later

Thema 1, 3 en 4 zijn aan het inlezen en hebben nog nauwelijks CSS geschreven.
Elke regel die zij vanaf nu tegen `--bg` schrijven maakt deze hernoeming
duurder. Vandaag is het één pas door twee bestanden; over een week is het een
conflict met vier gelijktijdige schrijvers.

## Wat dit is

1. **Rollen invoeren** conform `05` §2.1. Minimaal deze afbeelding, met de
   bestaande waarden ongewijzigd — dit is een hernoeming, geen herkleuring:

   | Nu | Rol |
   | --- | --- |
   | `--bg` | `--color-bg-canvas` |
   | `--surface` | `--color-surface-1` |
   | `--surface2` | `--color-surface-2` |
   | `--border` | `--color-border-subtle` |
   | `--text` | `--color-text-primary` |
   | `--text-muted` | `--color-text-muted` |
   | `--accent` | `--color-accent-primary` |
   | `--accent-light` | `--color-accent-primary-hover` |
   | `--accent-glow` | `--color-focus-glow` |
   | `--success` | `--color-success` |
   | `--error` | `--color-danger` |
   | `--gold` | `--color-accent-competition` |

2. **De ontbrekende rollen toevoegen** die `05` §2.1 noemt en wij niet hebben:
   `--color-bg-arena`, `--color-surface-elevated`, `--color-border-strong`,
   `--color-text-secondary`, `--color-accent-primary-active`,
   `--color-warning`, `--color-overlay`. Geef ze een waarde die past in het
   bestaande palet; vind je geen zinnige toepassing, laat de rol dan wég in
   plaats van hem op een willekeurige tint te zetten — een ongebruikte rol is
   erger dan een ontbrekende.

3. **`--color-accent-competition` echt invoeren.** Goud bestaat nu alleen als
   inline fallback (`var(--gold, #f59e0b)`) in `components.css` en ontbreekt in
   het lichte thema volledig. Podium, rank en score horen hem te gebruiken.

4. **Alle gebruiken meenemen** in `base.css` en `components.css`. Er blijft
   geen enkele oude naam over.

## Regels

- **Waarden niet wijzigen.** Dit is een hernoeming. De contrastcorrecties die
  thema 5 in `58eba07` op het lichte thema deed blijven exact zoals ze zijn —
  ga die niet "meteen even" opnieuw afstemmen.
- **Geen aliassen achterlaten.** Geen `--bg: var(--color-bg-canvas)` als
  overgangsmaatregel: dan staan er twee namen voor één ding en kiest iedere
  volgende schrijver de verkeerde.
- **Eén commit.** Een half doorgevoerde hernoeming is slechter dan geen.
- Meld het in `HANDOFF-UI.md` zodra het geland is, met de mappingtabel, zodat
  thema 1, 3 en 4 hun eerste CSS meteen goed schrijven.

## Definition of done

- `grep -rn "var(--bg\|var(--surface\|var(--accent\|var(--text-muted"
  frontend/` geeft nul treffers.
- Beide thema's zien er identiek uit als vóór de wijziging — screenshot van
  home, lobby en spelscherm in donker én licht, vóór en na, naast elkaar
  gelegd.
- `node --test frontend/ client/` blijft groen.
- De mappingtabel staat in `HANDOFF-UI.md`.
