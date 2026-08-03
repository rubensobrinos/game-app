# Voortgang — 4. Taal en tekst

**Eigenaar:** _nog toe te wijzen_
**Documenten:** `09-CONTENT-AND-MICROCOPY.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie J · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `18b2d53`

Dit gebied laat zich anders meten dan de andere vier: je kunt de huidige tekst
letterlijk naast de voorgeschreven tekst leggen. Daarom staan hieronder geen
omschrijvingen van wat er mist, maar de twee zinnen naast elkaar.

## Infrastructuur

Wat de teksten mogelijk maakt. Hier zit onze kracht.

| Onderdeel | Niveau | Stand |
|---|---|---|
| Drietalige dekking | 2 | NL, EN en ES zijn compleet en lopen niet uit de pas — elke sleutel bestaat in alle drie. Nieuwe schermen voegen ze samen toe. |
| Sleutelvorm | 2 | Semantisch (`lobby.start`, `error.GAME_NOT_FOUND`), geen Nederlandse zinnen als sleutel. Volgt `09` §14. |
| Pluralisatie | 2 | `tCount()` kiest tussen `.one` en `.other` en vult `{n}` in. Nu alleen op het spelersaantal; elke volgende telbare tekst hoort hem te gebruiken. |
| Foutcodedekking | 2 | Alle codes uit `PROTOCOL.md` hebben een eigen tekst met vervolgstap. Geen generieke melding waar de oorzaak bekend is. |

## Losse teksten

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Startknop landing | 1 | `Snel starten` | `Start direct een game` |
| Code-invoer | 1 | `Meedoen met code` | `Meedoen` (label los: `Voer de gamecode in`) |
| Naamvraag | 1 | `Jouw naam (optioneel)` | `Hoe noemen we je?` |
| Joinknop | 2 | `Meedoen` | `Ik doe mee` — dicht genoeg, zelfde register |
| Revanche | 1 | `Nog een keer!` | `Revanche` |
| Wachten in lobby | 1 | `Wachten tot de host start…` | `De host start zo` |
| Antwoord bevestigd | 1 | `Antwoord ontvangen` | `Verstuurd ✓` |
| Wachten op anderen | 1 | `3/7 beantwoord` | `Wachten op 4 spelers…` |
| Resultaat juist | 1 | `Goed!` | `JUIST` als resultaatstempel |
| Startknop lobby | 2 | `Start Rounda` | wijkt bewust af van `Start game — N spelers` (`D-020`) |

## Ontbrekende teksten

| Waar | Niveau | Wat `09` voorschrijft |
|---|---|---|
| Laadstatussen | 0 | `Potje maken…`, `Gamecode controleren…`, `Je wordt toegevoegd…` — wij tonen niets of alleen een uitgeschakelde knop. |
| Lege lobby | 0 | `Nog niemand binnen` + `Laat iemand de QR scannen om te beginnen.` — wij tonen alleen `0 spelers`. |
| Sociale headlines | 0 | Een volledige templateset (`Lisa was de enige met het juiste antwoord.`). Bestaat niet. |
| Belofte op de landing | 0 | `Geen account. Geen download. Iedereen speelt op zijn eigen telefoon.` |
| Game beëindigd | 0 | Vier eigen teksten per oorzaak (host stopte, verlopen, technisch, verwijderd). |

## Verboden prototypecopy

`09` §15 verbiedt negen formuleringen. Stand:

| Term | Stand |
|---|---|
| `Game App` | ✅ weg — nu Rounda |
| `Submit`, `Success`, `Loading…`, `Error 500` | ✅ komen niet voor |
| `Awaiting host action`, `Session initialized`, `User joined room` | ✅ komen niet voor |
| `Show code` | ❌ **staat er nog** — `Toon code` in de lobby. Vervalt zodra `room-header.mjs` is ingehangen (`D-018`). |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal | 5 | 7 | 7 | 0 |

De infrastructuur staat, de teksten niet. Dat is goed nieuws: wat hier ontbreekt
is schrijfwerk in drie talen, geen bouwwerk. Grootste enkele winst zijn de
laadstatussen — die staan in de roadmap op fase 1, hoge impact, lage complexiteit.
