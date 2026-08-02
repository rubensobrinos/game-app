// De drie harde productregels uit `docs/multiplayer/PRODUCT.md`, §"Harde
// productregels", letterlijk overgenomen. Deze regels gaan boven alle andere
// afspraken in de specificatie — zie het brondocument voor de volledige context.
//
// Zie `docs/product-plan/README.md` (bouwsteen `hard-rules`) en
// `docs/product-plan/prompts/PD1-hard-rules-and-scope-guard.md` voor de herkomst
// en de testverplichtingen van deze module.
export const HARD_RULES = [
  {
    id: 'no-mandatory-account',
    text: 'Iedere gebruiker kan binnen enkele seconden een game starten of joinen zonder account, e-mailadres of andere verplichte registratie.',
  },
  {
    id: 'always-visible-name',
    text: 'Iedere speler heeft tijdens het spel een zichtbare naam. Zelf invullen is optioneel; bij een leeg veld genereert de server direct een unieke naam. Een host hoeft alleen een spelersnaam te hebben wanneer die zelf meespeelt.',
  },
  {
    id: 'own-phone-only',
    text: 'Elke rol werkt volledig op een eigen telefoon. Een laptop, televisie, beamer of centraal scherm mag de ervaring verbeteren, maar is nooit vereist.',
  },
];
