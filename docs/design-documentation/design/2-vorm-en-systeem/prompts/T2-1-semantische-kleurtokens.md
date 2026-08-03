# Prompt — T2-1: Semantische kleurtokens

Onderdeel van [`README.md`](README.md). **Dit is de enige prompt hier met een
tijdslot: hij hoort nu, niet later.**

_Herzien ná review. De eerste versie telde twee keer verkeerd, verzon een
rolnaam die in geen enkel document staat, en baseerde stap 3 op een gat dat
thema 5 al had gedicht._

## Brondocument

`05-DESIGN-SYSTEM.md` §2.1 (Kleurenrollen), §2.2 (Contrastregels) en §2.6
(Borders en schaduw). `02-DESIGN-PRINCIPLES.md` `P12`.

## Wat er nu staat

`frontend/css/base.css` definieert veertien kleurtokens met **presentatieve**
namen. Het lichte thema overschrijft er dertien: acht in het oorspronkelijke
blok, plus vijf die thema 5 in `58eba07` toevoegde nadat een echte
WCAG-berekening liet zien dat `--accent-light`, `--error`, `--success` en
`--gold` daar als tekst onder AA zakten.

`05` §2.1 vraagt om **rolnamen**: wat iets betekent, niet hoe het eruitziet.
Er staan er negentien.

Dat verschil is niet cosmetisch. `--surface2` zegt niets over wanneer je het
gebruikt, dus wordt het gebruikt waar het toevallig goed uitkomt — vandaag als
inputachtergrond, als hostbalkknop én als disabled-vlak. Zodra één van die drie
een andere tint nodig heeft, is er geen token om te wijzigen zonder de andere
twee te raken.

## Waarom nu en niet later

Thema 1, 3 en 4 hebben nog nauwelijks CSS geschreven. Elke regel die zij vanaf
nu tegen `--bg` schrijven maakt deze hernoeming duurder. Vandaag is het één pas
door twee bestanden; over een week een conflict met vier schrijvers.

## Wat dit is

1. **Rollen invoeren** conform `05` §2.1, met de bestaande waarden
   ongewijzigd — dit is een hernoeming, geen herkleuring:

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
   | `--success` | `--color-success` |
   | `--error` | `--color-danger` |
   | `--gold` | `--color-accent-competition` |

2. **`--accent-glow` is een apart geval en mag géén focusrol worden.**
   De eerste versie van deze prompt mapte hem naar `--color-focus-glow`. Die
   naam bestaat niet in §2.1, en erger: §2.6 zegt expliciet *"focusring is niet
   hetzelfde als decoratieve glow"*. Die twee samenvoegen is precies wat de
   spec verbiedt.

   Dus: `--accent-glow` wordt `--color-accent-glow` (decoratief, gebruikt door
   `.btn-primary:hover` en `.field-input:focus`), én er komt een **echte**
   `--color-focus` bij, want die staat wél in §2.1 en er hangt van alles
   vanaf — `05` §2.2 ("focusring zichtbaar op alle surfaces") en `08` §2.3
   ("focusring contrasteert tegen dark en light"). Vandaag gebruikt de
   focusring `var(--text)`; die verwijzing wordt `var(--color-focus)`.

3. **De overige ontbrekende rollen toevoegen** die §2.1 noemt:
   `--color-bg-arena`, `--color-surface-elevated`, `--color-border-strong`,
   `--color-text-secondary`, `--color-accent-primary-active`,
   `--color-warning`, `--color-overlay`.

   Twee daarvan zijn **niet optioneel**, ook al gebruiken we ze nog niet:
   - `--color-warning` — `P12` wijst die toe aan "waarschuwing: tijd of
     aandacht", en `T2-3` bouwt in deze zelfde set de timerurgentie. Zonder
     deze rol grijpt die prompt naar `--error`, wat `P12` juist verbiedt.
   - `--color-overlay` — er draaien al drie overlays met een hardgecodeerde
     `rgba(0,0,0,…)`.

   Voor de overige vijf geldt: vind je geen toepassing, laat ze weg. Een
   ongebruikte rol is erger dan een ontbrekende.

4. **Twee tokens hebben géén rol in §2.1: `--success-bg` en `--error-bg`.**
   Dat is een echt gat in het brondocument, geen vergissing van ons — ze worden
   gebruikt door `.gameplay-option.is-correct`, `.field-error` en de
   sessiebanner. Voorstel: `--color-success-surface` en
   `--color-danger-surface`, in dezelfde stijl. **Meld dit als afwijking**
   (`00` §6 punt 9) in plaats van er stil een naam voor te kiezen.

5. **Alle gebruiken meenemen** in `base.css` en `components.css`.

6. **Hardgecodeerde kleuren die buiten het tokensysteem vallen**, met naam
   genoemd zodat ze niet stilzwijgend blijven staan: de merkgradient in
   `.brand-title` (`#a855f7` → `#60a5fa`), `color: #fff` op `.btn-primary`, en
   de witte achtergrond onder de QR. De eerste twee horen bij `O-003` (zie
   `T2-7`) en blijven dus staan; de QR-achtergrond moet wit blijven om
   scanbaar te zijn. Documenteer ze als bewuste uitzonderingen.

## Regels

- **Waarden niet wijzigen.** Dit is een hernoeming. De contrastcorrecties die
  thema 5 in `58eba07` op het lichte thema deed blijven exact zoals ze zijn.
- **Nieuwe rollen die een waarde krijgen zijn de enige uitzondering** — en die
  waarde moet AA halen in beide thema's (`05` §2.2), berekend zoals thema 5
  het deed en niet geschat.
- **Geen aliassen achterlaten.** Geen `--bg: var(--color-bg-canvas)` als
  overgangsmaatregel: dan staan er twee namen voor één ding.
- **Eén commit.** Een half doorgevoerde hernoeming is slechter dan geen.
- Meld het in `HANDOFF-UI.md` zodra het geland is, met de mappingtabel.

## Definition of done

- Deze grep geeft nul treffers:
  ```
  grep -rnE "var\(--(bg|surface|surface2|border|accent|accent-light|accent-glow|success|success-bg|error|error-bg|text|text-muted|gold)\)" frontend/
  ```
  (de eerste versie greep alleen op vier prefixen en liet `--border`, `--text`,
  `--success`, `--error` en `--gold` ongemoeid — een half doorgevoerde
  hernoeming haalde die DoD gewoon)
- Beide thema's zien er identiek uit als vóór de wijziging, behalve waar een
  nieuwe rol bewust iets toevoegt — screenshot van home, lobby en spelscherm in
  donker én licht, vóór en na.
- De focusring gebruikt `--color-focus` en is nog steeds zichtbaar op elke
  surface in beide thema's.
- `node --test frontend/ client/` blijft groen.
- De mappingtabel én de twee afwijkingen (punt 4 en 6) staan in
  `HANDOFF-UI.md`.
