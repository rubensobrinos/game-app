# Onderzoek: wat de toppers doen + kritische audit van onze eigen UI

**Door:** regie (Claude), 3 aug 2026. **Doel:** input voor het ontwerptraject,
samen te voegen met het werk van de ontwerpagent (die kreeg bewust géén
huidige-staat-info; dit document is de andere helft: waar stáán we en wat
doet de concurrentie).

---

## Deel 1 — Wat de besten in dit genre doen

### Kahoot — de maatstaf voor "samen in één ruimte"

- **Antwoorden hebben een identiteit.** Elk antwoord is een kleur + vorm
  (rood driehoek, blauw ruit, geel cirkel, groen vierkant). Dat is geen
  decoratie: het maakt antwoorden op afstand leesbaar ("ik koos geel!"),
  bespreekbaar en emotioneel. Niemand zegt "ik koos optie 2".
- **Het hostscherm is een podium, geen dashboard.** Grote code, muziek,
  spelers die binnenploppen met naam — de lobby bouwt spanning op vóór de
  eerste vraag. De teller ("23 spelers") is theater.
- **Rituelen en ritme.** Aftelmomenten (3-2-1), trommelgeluid tijdens de
  vraag, de reveal als climax, daarna de antwoordverdeling als staafdiagram
  (leermoment én roastmoment), dán pas het leaderboard. Elke ronde is een
  mini-verhaal met spanningsboog.
- **Streaks.** Antwoordreeksen worden gevierd ("3 op rij!") — goedkoop te
  bouwen, groot effect op betrokkenheid.
- Zwakte om van te leren: hosts hebben een account en voorbereiding nodig;
  het voelt als "een les starten", niet als "even een potje".

### Jackbox — de maatstaf voor frictieloos joinen

- **Join is heilig simpel:** één scherm, twee velden (roomcode + naam), één
  knop. Code is kort en wordt NOOIT verstopt — hij staat permanent op het
  gedeelde scherm.
- **De eerste speler is "VIP"** en mag starten — rolduidelijkheid zonder
  uitleg.
- **Wachten is nooit dood.** In de lobby kun je doodlen/reageren; je
  binnenkomst is zichtbaar op het grote scherm (naam + avatar popt op met
  geluid). Joinen = beloond worden.

### Quizizz / Blooket / Gimkit — de les over identiteit en beloning

- Quizizz: memes na elk antwoord, power-ups, rustiger tempo — bewijs dat
  het genre ook zonder klassikale druk werkt (vergelijk onze mockmodus en
  toekomstige async-ideeën).
- Blooket/Gimkit: spelers hebben een **karaktertje/avatar** en verdienen
  iets (munten, upgrades). De quiz is de motor, het spel eromheen is de
  verslaving. Voor ons (geen accounts) is de light-versie: leuke
  naamvoorstellen + een avatar/kleur per speler per potje.

### skribbl.io / GeoGuessr party — de maatstaf voor "geen drempel"

- skribbl: hele game in één scherm, join via link, nul uitleg nodig. Lelijk
  maar frictieloos — bewijs dat frictie belangrijker is dan mooi.
- GeoGuessr: kaart/wereld-esthetiek met premium uitstraling — het bewijs
  dat "geografie" een chique, volwassen look kan hebben (relevant: wij
  zitten in hetzelfde thema en mogen dus "wereldser" ogen dan een generieke
  quiz-app).

### Rode draad — wat "professioneel" hier concreet betekent

1. **Antwoord-identiteit** (kleur/vorm per optie), niet vier identieke repen.
2. **Ritueel per ronde**: aftellen → spanning → reveal → verdeling →
   leaderboard. Timing en volgorde zijn het product.
3. **Geluid** (aan/uit-knop!): lobby-loop, tik van de timer, reveal-stoot.
   Geen enkele topper is stil.
4. **Binnenkomst is een moment**: naam popt op, teller telt, evt. geluidje.
5. **Code permanent zichtbaar** op het gedeelde scherm, groot.
6. **Streaks en micro-vieringen**; confetti op het podium, niet overal.
7. **Wachten bestaat niet**: elk wachtscherm heeft iets te doen of te zien.

## Deel 2 — Kritische audit van onze huidige UI

Basis: live schouwing (potjes gespeeld op desktop + mobiele screenshots
producteigenaar) en de volledige CSS (`frontend/css/base.css` 598 regels,
`components.css` 210 regels, singleplayer `style.css`).

### De knoppen — "basic as hell", en dit is waarom precies

1. **Alles is dezelfde knop.** `.btn-primary`, `.btn-secondary`,
   `.gameplay-option` en `.podium-rematch` delen letterlijk één regelblok:
   `display:block; width:100%; padding:14px 20px; font-size:1.05rem;
   font-weight:600; border-radius:var(--r)`. Volle breedte, zelfde hoogte,
   zelfde radius, zelfde gewicht — van "Start de game" (het belangrijkste
   moment) tot "Toon code" (bijzaak). Er is geen visuele rangorde behalve
   paars vs. grijs. Dáárom voelt het als een AI-template: één komponent,
   negen contexten.
2. **De antwoordknoppen zijn de zwakste knoppen van het spel** — terwijl ze
   het spel zíjn. Vier identieke grijze repen met alleen een tekstlabel.
   Geen kleur- of vormidentiteit (zie Kahoot), geen indruk-animatie bij
   tikken, geen "verstuurd!"-microfeedback op de knop zelf (status staat
   eronder in een los tekstregeltje), reveal is een stille borderkleur-
   wissel. Het spannendste moment van de ronde heeft de saaiste pixels.
3. **States zijn half af.** Primary heeft hover-glow en active-scale(0.98);
   secondary/opties hebben ALLEEN een hover-bordercolor — geen active, en
   hover bestaat niet op touch, dus **op mobiel geven onze knoppen exact
   nul reactie bij aanraken** (tap-highlight is ook nog uitgezet). Disabled
   is overal hetzelfde `opacity:0.5`, of je nu "even wachten" of "mag niet"
   bedoelt.
4. **Geen loading-states.** Na "Snel starten" gebeurt er ~1 seconde niets
   zichtbaars (knop disabled, that's it). Geen spinner, geen tekstwissel
   ("Potje maken…"). Elke seconde zonder feedback voelt als een hapering.
5. **Typografische gelijkschakeling.** Alles 1.05rem/600. De timer (1.6rem)
   is kleiner dan de vlag breed is; het rondenummer fluistert; de code —
   het belangrijkste datagegeven van de lobby — heeft geen eigen
   typografisch moment (zit achter een knop, in gewone tekst).
6. **Gradient-inflatie.** ÉLKE h1/h2 krijgt dezelfde paars-blauwe gradient
   (`components.css` regel 20). Wat overal is, is nergens bijzonder —
   "Lobby" en "Meedoen" schreeuwen even hard als de merknaam.
7. **Emoji als identiteit.** 🌍 als logo, 🥇🥈🥉 op het podium, 🎉 op de
   menukaart. Werkt als placeholder, oogt als prototype. (De vlaggen zelf
   zijn échte assets — dat contrast maakt de emoji extra goedkoop.)

### De schermen — grootste gaten t.o.v. de toppers

| Moment | Toppers | Wij nu |
| --- | --- | --- |
| Lobby (host) | Podium: grote code, muziek, spelers ploppen binnen | Code achter knopje; lijst met (nu zelfs lege) naamrijen; stil |
| Ronde-start | Aftelritueel, geluid | Vraag staat er gewoon ineens |
| Reveal | Climax: kleur, geluid, antwoordverdeling | Bordertje wordt groen, tekstregel eronder |
| Tussen rondes | Leaderboard met beweging (stijgen/dalen) | Statische top-5-lijst |
| Podium | Confetti, opbouw 3→2→1, muziek | Nette lijst met emoji-medailles |
| Wachten | Nooit leeg (doodle, teller, muziek) | "Wachten tot de host start…" |

### Wat er al wél goed staat (behouden)

- Focus-ringen, aria-live, schermlezer-aankondigingen: boven genre-niveau.
- Tabular-nums op scores/timer, ellipsis op namen: juiste details.
- Anti-afkijk-principe (geen goed/fout vóór ronde-einde) zit diep in de
  architectuur — veel "juice" kan hier gewoon binnen.
- De flow zelf (30 sec naar een potje, geen account) is onze grootste troef
  en verslaat Kahoot op frictie. Dat moet het ontwerp gaan uitstralen.

## Deel 3 — Waar wij ons kunnen onderscheiden

1. **Snelste start van het genre.** Geen account, geen app, één tik. Maak
   dat zichtbaar: de landingspagina IS bijna de lobby.
2. **Wereld-esthetiek i.p.v. quiz-esthetiek.** Wij zijn géén generieke
   quizbouwer; alles gaat over de wereld. Een eigen visuele taal rond
   kaarten/vlaggen/reizen (GeoGuessr bewijst de markt) onderscheidt ons
   direct van het Kahoot-kleurenfeest.
3. **Huiskamer boven klaslokaal.** Kahoot ruikt naar school. Wij kunnen het
   verjaardags-/borrelspel zijn: toon, taal en podium-momenten daarop
   richten.
4. **Privacy als feature.** Geen accounts, geen tracking — in NL/EU een
   echt verkoopargument, ook richting scholen nota bene.
5. **Vlaggenkennis serieus nemen.** Echt-of-nep met gegenereerde vlaggen is
   uniek materiaal dat geen van de genoemde platforms heeft — daar zit een
   eigen gezicht in.

## Deel 4 — Concrete aanbevelingen, geordend

**Nu (klein, groot effect — kan zonder ontwerptraject):**
1. Antwoordopties: kleur/vorm-identiteit per positie + indruk-animatie +
   "✓ verstuurd" op de knop zelf.
2. Code + QR permanent groot in de host-lobby (stond al in FEEDBACK punt 2).
3. Active-states en loading-states op álle knoppen; tekstwissel op
   Snel starten ("Potje maken…").
4. Aftel-tik (3-2-1) vóór elke ronde — puur CSS/JS, geen geluid nodig om
   al te werken.
5. Gradient reserveren voor de merknaam; koppen gewoon wit/ink.

**Met het ontwerptraject (de agent-briefing dekt dit):**
6. Volledig stijlsysteem (zie briefing §7.2) met knop-hiërarchie:
   hero / primair / secundair / stil.
7. Reveal- en leaderboard-choreografie (antwoordverdeling tonen!).
8. Geluidslaag met één aan/uit-schakelaar (host bepaalt).
9. Speler-identiteit per potje: kleur/avatar bij je naam.
10. Echte assets voor logo/medailles i.p.v. emoji.

**Bewust NIET doen:**
- Punten/economie/accounts nabouwen (Blooket-territorium, botst met onze
  frictie-belofte).
- Confetti op elk scherm — vieren alleen op het podium en bij streaks.

## Bronnen

- https://www.builtinchicago.org/articles/jackbox-games-design-party-pack
- https://explore.st-aug.edu/exp/jackbox-tv-join-explained-how-a-simple-code-unlocks-a-world-of-party-games
- https://www.teachfloor.com/blog/blooket-vs-gimkit-vs-kahoot--vs-quizizz
- https://slideswith.com/blog/blooket-vs-kahoot-vs-gimkit-vs-quizizz
- https://transcript.study/blog/kahoot-vs-blooket-vs-quizizz
- https://mobisoftinfotech.com/resources/blog/microinteractions-ui-ux-design-trends-examples
- https://pixune.com/blog/game-ui-design/
- https://support.kahoot.com/hc/en-us/articles/32601683697053-New-Kahoot-features-and-updates
- Eigen schouwing: live potjes op play.aseso.nl (desktop + mobiel) en de
  volledige frontend-CSS.
