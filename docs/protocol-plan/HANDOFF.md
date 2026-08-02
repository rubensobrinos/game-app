# HANDOFF — voor andere realisatiesessies

Deze map (`docs/protocol-plan/`) realiseert
[`docs/multiplayer/PROTOCOL.md`](../multiplayer/PROTOCOL.md) via `server/protocol/`.
Dit bestand beantwoordt vragen die andere sessies via `docs/` hebben achtergelaten, en
is zelf het kanaal terug — er is geen directe verbinding tussen deze sessie en die van
`server/rules/` / `server/data/` / `server/architecture/` / `client/flow/`.

Belangrijk: niets hieronder wijzigt `PROTOCOL.md` zelf. `PROTOCOL.md` is `public_api`,
ADR-plichtig — waar hieronder een keuze lijkt te worden gemaakt, is dat een voorstel of
een bevestiging van wat al uit bestaande tekst volgt, nooit een bindend besluit namens
de mens die dit document accordeert.

## 1. Aan `data-model-plan` — dank voor het antwoord op Open vragen §13/§14, één restvraag

[`HANDOFF.md` §2](../data-model-plan/HANDOFF.md) en §3 zijn verwerkt in
[`README.md`](README.md)'s Open vragen §13 en §14 (zie daar voor de volledige tekst).
Twee dingen expliciet terug:

- **§13 (`roundNumber`/`countdownEndsAt`):** jullie voorstel wacht zelf nog op
  bevestiging van `architecture-plan` (zie punt 2 hieronder — wij hebben dat
  doorgezet, niet zelf beantwoord). Tot die bevestiging er is, valideert PR4/PR5
  alleen de vórm van deze velden (`roundNumber: number`, `countdownEndsAt: number`),
  niet de aanname dat ze on-the-fly berekend worden.
- **§14 (`game:rematch`):** eens met jullie reset-/niet-reset-tabel. De ene restvraag
  die jullie zelf ook als open markeren — telt een `left: true`-speler uit de vórige
  match automatisch weer mee in de rematch-roster — blijft bij ons ook expliciet open.
  Wij lossen 'm niet zelf op (dat zou een `public_api`-aanname zijn over
  `game:rematch-started`'s payload); als niemand anders 'm oppakt, is dit een vraag
  voor de mens die `PROTOCOL.md`/`GAME-FLOW.md` accordeert.

## 2. Aan `architecture-plan` — bevestiging gevraagd (doorgezet vanuit `data-model-plan`)

`data-model-plan`'s [`HANDOFF.md` §2](../data-model-plan/HANDOFF.md) stelt voor dat
`countdownEndsAt` **geen** opgeslagen `DATA-MODEL.md`-veld wordt, maar een vluchtige,
berekende waarde (`serverTime + 3s`, `GAME-RULES.md` §Rondestructuur) die on-the-fly
wordt bepaald door wie de `LOBBY → COUNTDOWN`-transitie uitvoert — dat is jullie
`state-machine`-bouwsteen (AR1), niet `server/protocol/` of `server/data/`.

**Gevraagd:** bevestig of weerleg dit voorstel. Wij (protocol-plan) hebben er in de
tussentijd geen aanname over vastgelegd in `PR4`/`PR5` — die valideren alleen dat
`countdownEndsAt` in `game:started`'s payload een getal is, niet waar het vandaan komt
of wanneer het berekend wordt.

## 3. Aan `game-flow-plan` — status van jullie interfacevoorstel

[`protocol-interface-proposal.md`](../game-flow-plan/protocol-interface-proposal.md)
is gelezen. Geen van de 7 relevante vragen (§1–§7) is hier beantwoord — dat zijn
`public_api`-beslissingen (met name §1, de team-joinvolgorde-hoofdvraag) die wachten op
de mens die `PROTOCOL.md` accordeert, niet op ons. Wel verwerkt in
[`README.md`](README.md)'s Open vragen, zodat ze niet alleen in jullie document
bestaan:

- §5/§7 (pausedState-vorm, reason-enum) → Open vraag §2 (aangescherpt: nu twee losse
  deelvragen in plaats van één).
- §1–§3 (teamkeuze: joinvolgorde, identifier, bevestiging) → Open vraag §8.
- §4 (spectator-auth/subscription/projectie) → Open vraag §9.
- §6 (naamsuggestie/preview-endpoint vóór join) → nieuwe Open vraag §17.
- §8 (`joinSource` qr/shared_link) en §9 (`PRODUCT.md` vs. `DATA-MODEL.md`
  spelvorm-aantal) zijn door jullie zelf al gemarkeerd als "geen actie nodig" resp.
  "niet voor deze eigenaar" — wij nemen daar dus ook geen actie op.

**Status: alle 7 vragen blijven open**, wachten op een mens. Geen ETA van onze kant —
wij zijn niet de beslisser hierop.

## 4. Informationeel — geen actie nodig

- **`shared/product/hard-rules.mjs`/`mvp-scope-guard.mjs` gezien** —
  `product-plan`'s [`data-model-and-protocol-interface-proposal.md`](../product-plan/data-model-and-protocol-interface-proposal.md)
  §2a oppert deze te citeren in een contracttest die bevestigt dat de create/join-
  responses geen account-/e-mailveld bevatten. Optioneel, geen eis. Genoteerd als
  mogelijke verbetering voor een latere PR7-revisie (contracttest-suite); niet met
  terugwerkende kracht toegepast op de huidige PR7-uitvoering.
- **Moduleformaat wijkt af.** `server/protocol/` gebruikt native ES modules (`.mjs`,
  `export`); `server/rules/` en `server/data/` gebruiken CommonJS (`.js`,
  `module.exports`) — zelfde constatering als `game-rules-plan`'s en
  `data-model-plan`'s HANDOFF-bestanden al maken. Werkt nu los prima, moet
  gereconcilieerd worden zodra iets dit daadwerkelijk aan elkaar knoopt
  (`architecture-plan`'s serverskeleton-voorstel, AR5/AR6).
- **Locatie van `server/protocol/` is voorlopig**, net als `server/rules/`/
  `server/data/` — wacht op een bindend serverskeleton-voorstel uit
  `architecture-plan`.
- **Huidige status (zie [`PR-PROGRESS.md`](PR-PROGRESS.md) voor details):** PR0–PR3
  gebouwd en gecommit, 101/101 tests groen. PR4 (client-events), PR5 (server-events +
  snapshot), PR6 (reconnect) en PR8a (schriftelijk sessie/tokenvoorstel, geen code)
  draaien op het moment van schrijven parallel; PR7 (contracttests) volgt zodra die
  drie klaar zijn.
