// shared/content/microstate-aspects.data.mjs — punt 1.14 ("de 51 uitgerekte
// landen"), vervolg op opdracht E (docs/openstaand/raad-het-land.md).
//
// build-shapes.mjs haalt zijn verhouding (breedte/hoogte) voor 175 van de 225
// contouren uit `data/shapes.js`. Voor de resterende 51 kende geen enkele bron
// in deze repo een verhouding — ze bleven `stretched: true`. `data/shapes.js`
// zélf komt uit `build/world.geo.json` ("johan/world.geo.json", ISO3-ids), en
// dat bestand is nooit gecommit; het is bovendien Natural Earth 110m-
// resolutie, dat structureel GEEN microstaten/eilandgebieden bevat — dit
// terugzetten had dus sowieso niets opgeleverd voor precies déze 51 (geverifieerd:
// de gecombineerde `countries.geo.json` én de losse per-land bestanden in die
// GitHub-repo bevatten 179/180 landen, geen enkele overlapt met de 51).
//
// BRON: geoBoundaries.org, release "gbOpen", laag ADM0 (souvereine grens per
// land), opgehaald 2026-08-06 via hun publieke API
// (https://www.geoboundaries.org/api/current/gbOpen/{ISO3}/ADM0/, met de
// `simplifiedGeometryGeoJSON`-downloadlink uit het antwoord). 45 van de 51
// landen zijn daar aanwezig; de resterende 6 (ax/Åland, hk/Hongkong,
// je/Jersey, mo/Macau, pm/Saint-Pierre-en-Miquelon, sx/Sint Maarten) staan er
// niet in en blijven `stretched: true`.
//
// WAAROM ALLEEN HET GROOTSTE LANDDEEL, NIET DE VOLLEDIGE SOEVEREINE SPREIDING:
// elk van deze 51 landen staat in `data/geo-countries.js` als ÉÉN ENKELE ring
// (geverifieerd voor alle 45 — nul uitzonderingen), nooit als een verspreide
// eilandengroep. Een verhouding uit de volledige soevereine grens (bv.
// Mauritius incl. Rodrigues, 560 km verderop) drukt die ene ring dan plat tot
// een onherkenbare streep — visueel gecontroleerd (Playwright-render van tien
// landen naast elkaar) vóórdat hiervoor gekozen werd: "volledig" maakte
// Mauritius/Kiribati/Micronesië/Tonga/Antigua tot vrijwel onzichtbare linten,
// "grootste landdeel" bleef een herkenbare vlek, dicht bij de huidige
// (uitgerekte) vorm. Voor de zes al vierkante microstaten (Vaticaanstad,
// Monaco, San Marino, ...) maakt het geen verschil — daar is er maar één ring.
// Berekening (identiek aan build-shapes.mjs's `ontrek()`/root-`build-shapes.js`):
// per land de ring met het grootste oppervlak (shoelace-formule) uit de
// simplified GeoJSON, lengtegraad gecorrigeerd met cos(midden-breedtegraad),
// dan breedte/hoogte van die ene ring se omhullende.
//
// GEEN GEOMETRIE OVERGENOMEN: alleen dit ene afgeleide getal per land is hier
// vastgelegd, geen padstrings of coördinaten van geoBoundaries — de VORM blijft
// van `data/geo-countries.js` komen, zoals altijd. De bronlicenties van
// geoBoundaries lopen uiteen (Public Domain, CC BY 2.5/3.0/4.0, ODbL 1.0 —
// zie de eigen ADM0-metadata per land op geoboundaries.org); relevant voor wie
// ooit de brongeometrie zelf wil overnemen, niet voor een enkel verhoudingsgetal.
//
// GEEN GENERATORSCRIPT IN DE REPO: dit bestand is met de hand overgenomen uit
// een eenmalige netwerkbevraging (geen van de andere build-*.mjs-scripts in
// deze map heeft netwerktoegang nodig, en dit moest dat wél — zelfde
// precedent als `data/shapes.js` zelf, dat ook zonder zijn brongenerator in de
// repo staat). Wijzigt de bovenstroom (geoBoundaries publiceert een nieuwe
// release), dan is dit bestand met de hand te verversen — niet vaker nodig
// dan `data/shapes.js` zelf ververst wordt.
export const MICROSTATE_ASPECTS = {
  ad: 1.223, // AND — Andorra (Public Domain)
  ag: 1.271, // ATG — Antigua and Barbuda (Public Domain)
  ai: 1.699, // AIA — Anguilla (CC BY 4.0)
  as: 2.039, // ASM — American Samoa (CC BY 4.0)
  aw: 0.911, // ABW — Aruba (CC BY 4.0)
  bb: 0.775, // BRB — Barbados (CC BY 2.5)
  bh: 0.383, // BHR — Bahrain (ODbL 1.0)
  cv: 0.775, // CPV — Cabo Verde (ODbL 1.0)
  cw: 1.166, // CUW — Curaçao (CC BY 4.0)
  dm: 0.535, // DMA — Dominica (CC BY 2.5)
  fm: 1.096, // FSM — Micronesia (Fed. States of) (CC BY 3.0 IGO)
  fo: 0.662, // FRO — Faroe Islands (CC BY 4.0)
  gd: 0.792, // GRD — Grenada (ODbL 1.0)
  gg: 1.219, // GGY — Guernsey (CC BY 4.0)
  gi: 0.508, // GIB — Gibraltar (CC BY 4.0)
  gu: 0.806, // GUM — Guam (CC BY 4.0)
  im: 0.778, // IMN — Isle of Man (CC BY 4.0)
  ki: 1.122, // KIR — Kiribati (ODbL 1.0)
  km: 0.494, // COM — Comoros (ODbL 1.0)
  kn: 1.137, // KNA — Saint Kitts and Nevis (CC BY 2.5)
  ky: 2.364, // CYM — Cayman Islands (CC BY 4.0)
  lc: 0.5, // LCA — Saint Lucia (Public Domain)
  li: 0.501, // LIE — Liechtenstein (ODbL 1.0)
  mc: 0.819, // MCO — Monaco (ODbL 1.0)
  mh: 2.914, // MHL — Marshall Islands (ODbL 1.0)
  mp: 0.685, // MNP — Northern Mariana Islands (CC BY 4.0)
  ms: 0.623, // MSR — Montserrat (CC BY 4.0)
  mu: 0.864, // MUS — Mauritius (ODbL 1.0)
  mv: 0.417, // MDV — Maldives (CC BY 4.0)
  nr: 0.98, // NRU — Nauru (ODbL 1.0)
  pf: 1.224, // PYF — French Polynesia (CC BY 4.0)
  pw: 0.706, // PLW — Palau (ODbL 1.0)
  sc: 0.703, // SYC — Seychelles (ODbL 1.0)
  sg: 1.679, // SGP — Singapore (ODbL 1.0)
  sh: 1.213, // SHN — Saint Helena (CC BY 4.0)
  sm: 0.826, // SMR — San Marino (ODbL 1.0)
  st: 0.762, // STP — Sao Tome and Principe (ODbL 1.0)
  tc: 1.032, // TCA — Turks and Caicos Islands (CC BY 4.0)
  to: 1.437, // TON — Tonga (ODbL 1.0)
  tv: 0.832, // TUV — Tuvalu (ODbL 1.0)
  va: 1.285, // VAT — Holy See (Public Domain)
  vc: 0.615, // VCT — Saint Vincent and the Grenadines (ODbL 1.0)
  vg: 1.966, // VGB — British Virgin Islands (CC BY 4.0)
  vi: 2.957, // VIR — United States Virgin Islands (CC BY 4.0)
  ws: 1.678, // WSM — Samoa (ODbL 1.0)
};
