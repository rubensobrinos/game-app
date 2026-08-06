# Hoger/lager en Hoofdsteden aanzetten

Besluit 49 (producteigenaar, 6 aug 2026). Twee games die in de regellaag al
bestaan maar nergens gekozen kunnen worden.

## Waar ze nu staan

| Schakel | Hoger/lager | Hoofdsteden |
| --- | --- | --- |
| Vraagselectie (`question-selection.js`) | ✅ | ✅ |
| Validatie (`validators.js`, `round.js`) | ✅ | ✅ |
| Contentbron (`FILLED_GAME_TYPES`) | ❌ | ❌ |
| Spelscherm (`gameplay.mjs`) | ✅ | ❌ |
| Uitslag (`scoreboard.mjs`, `round-model.mjs`) | ✅ | ❌ |
| Mock | ❌ | ❌ |

Hoger/lager is dus bijna klaar: alleen de contentbron en de mock. Hoofdsteden
heeft daarnaast een spelscherm nodig — het is een gewone meerkeuzevraag met
tekst in plaats van een vlag, dus dicht bij `flags_mc`.

## De omgekeerde hoofdstedenvraag

De producteigenaar wil naast *"Wat is de hoofdstad van Peru?"* ook *"Lima hoort
bij welk land?"* — en vindt die tweede sterker, omdat je dan de kaart in je
hoofd moet hebben in plaats van een naam te herkennen.

`countries.data.mjs` heeft `capital` per land in nl/en/es, plus
`capitalAliases`. Dezelfde data, andersom gelezen. Of dit één gameType met twee
richtingen wordt of twee aparte, is aan de bouwer — leg de keuze vast.

## De regel die je niet mag overslaan

`PLAYABLE_GAME_TYPES` in `shared/content/game-catalog.mjs` is een
**ketenuitspraak**. Een gameType mag daar pas in als vraagselectie,
contentbron, spelscherm, uitslag én mock hem aankunnen. Precies dit ging eerder
mis bij `real_or_fake_flag`: de carrousel bood hem aan, de contentbron kon hem
niet bouwen, en de room bleef stil in COUNTDOWN staan.
