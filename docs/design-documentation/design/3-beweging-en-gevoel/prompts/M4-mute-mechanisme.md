# Prompt — M4: Voorkeurlaag voor mute (zonder zichtbare schakelaar, nog geen geluid)

Onderdeel van [`README.md`](README.md), fase M4. Vereist niets — onafhankelijk
van `M0`–`M3` en van `O-008`.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §5 (Beheer): "iedere speler heeft lokale
mute; voorkeur blijft lokaal bewaard." `08-ACCESSIBILITY-AND-RESILIENCE.md`
§2.5: "lokale mute; geen status alleen auditief." `11-DESIGN-QA-CHECKLIST.md`
K: "Is geluid uitschakelbaar en niet essentieel?"

## Scope herzien ná review — geen placebo-toggle

**De vorige versie van deze prompt liet een zichtbare schakelaar bouwen die
niets doet.** Terechte review: een control tonen die de gebruiker kan
bedienen zonder enig waarneembaar effect is geen professionele afwerking,
ook al is de intentie (voorkeur alvast klaarzetten) goed. Herziene scope:

1. **Bouw en test nu:** `preferences.mjs`'s `loadMuted`/`saveMuted`, met de
   voorkeur beschikbaar voor wat er later mee gedaan wordt.
2. **Bouw nu geen zichtbare schakelaar in `app-menu.mjs`.** Die komt pas
   zodra er minstens één echt audiosignaal is dat de schakelaar iets laat
   doen (onderdeel van de latere, `O-008`-afhankelijke geluidsarchitectuur,
   niet van deze prompt).

## Gedeelde, veilige storage-write — aangescherpt ná review

**Feitelijke fout in de vorige versie:** die claimde dat stil falen bij een
gooiende storage "het bestaande patroon" was, alsof `saveLang`/`saveTheme`
dat al deden. Geverifieerd in `preferences.mjs`: beide roepen
`storage.setItem()` rechtstreeks aan, zonder `try/catch` — een gooiende
storage (bv. privacy-modus, vol quotum) laat die twee dus gewoon een
exception opgooien. Er was dus geen bestaand patroon om te volgen.

**Kies hier expliciet, geen stille aanname:** introduceer één gedeelde
`safeSet(storage, key, value)`-helper binnen `preferences.mjs`, gebruikt door
`saveLang`, `saveTheme` én het nieuwe `saveMuted` — alle drie voorkeuren
gelijk behandeld, in plaats van `saveMuted` alleen robuust te maken en de
andere twee inconsistent te laten. Dit is een kleine, in scope passende
refactor van bestaande code, geen nieuw mechanisme.

```js
function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Een gooiende storage (privacy-modus, vol quotum) mag de rest van de
    // UI niet blokkeren — de voorkeur blijft dan gewoon niet bewaard.
  }
}
```

## Wat dit is

1. `loadMuted(storage)`/`saveMuted(storage, muted)`, zelfde vorm als
   `loadTheme`/`saveTheme` (valideren op boolean, `loadMuted` faalt stil bij
   een gooiende storage — al bestaand patroon via `safeGet`).
2. `saveLang`/`saveTheme` omgezet naar `safeSet` (zie boven) — bestaande
   tests (`preferences.test.mjs`) blijven slagen, geen gedragswijziging bij
   een normaal werkende storage, wél bij een gooiende.
3. **Geen menusectie, geen `<audio>`, geen mixer.** Toekomstig geluidswerk
   (zodra `O-008` besloten is) leest deze voorkeur en bouwt op dat moment ook
   de zichtbare control — met een eigen, dan pas relevante eis: een
   toegankelijke naam die verder gaat dan alleen `aria-pressed` (bv. een
   duidelijk label "Geluid" i.p.v. alleen een iconknop), zoals de review
   terecht aangeeft. Dat is werk voor die latere prompt, niet voor deze.

## Regels

- Geen zichtbare UI in deze prompt — uitsluitend de voorkeurlaag.
- `safeSet` raakt `saveLang`/`saveTheme`'s foutgedrag (nu: laat een exception
  door; straks: faalt stil) — dat is een bewuste, kleine gedragswijziging,
  geen toevallige bijvangst; noem 'm expliciet in de commit/PR, niet verstopt
  in een grotere diff.

## Definition of done

- `loadMuted`/`saveMuted` + `safeSet`-refactor getest in `preferences.test.mjs`,
  inclusief een gooiende storage voor alle drie voorkeuren (niet alleen de
  nieuwe).
- Geen menuwijziging, geen nieuwe DOM — dit is uitsluitend
  `frontend/js/preferences.mjs` + zijn tests.
- `PROGRESS.md`: "Mute-mechanisme" blijft niveau 0 voor de *zichtbare*
  control (die bestaat bewust nog niet), maar de toelichting noemt de
  voorkeurlaag als klaar-en-getest voor wanneer geluid er is.
