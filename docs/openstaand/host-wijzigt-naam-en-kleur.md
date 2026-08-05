# Host wijzigt naam of kleur van een ander

`renamePlayer` en `recolorPlayer` werken alleen voor jezelf. Als host kun je
iemand wél verwijderen maar niet hernoemen — terwijl dat precies is wat je wil
als iemand "Speler 7" heet of een onleesbare naam kiest.

Zelfde regels als voor de speler zelf: alleen in `LOBBY`, naamnormalisatie
ongewijzigd. De limiet van één hernoeming per speler geldt **niet** voor de
host — anders kan hij een fout van de speler niet herstellen.

Halve dag. Raakt `room-lifecycle.mjs`, het protocol en de hostbalk.
