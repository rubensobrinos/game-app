'use strict';

// country-adjectives.js — stap 3 uit docs/openstaand/spelersidentiteit.md,
// uitgevoerd volgens docs/openstaand/landcontent.md (besluit 47: zestig
// landen, niet 230).
//
// CONTENTGRENS (zelfde grens als identity-render.js): dit bestand bevat
// UITSLUITEND data, geen grammatica en geen renderlogica. Voor de vraag "welke
// vorm hoort bij welk woordgeslacht, in welke volgorde, en wat bij een
// ontbrekende vorm" zie identity-render.js — dat bestand blijft ongemoeid.
//
// FORMAAT (vastgelegd in landcontent.md): per iso2-sleutel (dezelfde sleutel
// als shared/content/countries.data.mjs) een vorm per taal. Een kale string is
// een vorm die niet naar woordgeslacht verbuigt (Engels altijd; in het Spaans
// de landen waarvan het bijvoeglijk naamwoord op -í, -a of -e eindigt, zoals
// "canadiense" of "belga"). Een object hoort bij een taal waar de vorm wél van
// het woordgeslacht afhangt: nl `de`/`het`, es `m`/`f`.
//
// Een ontbrekend land of een ontbrekende sleutel is geen fout — de renderer
// valt terug op de "uit"-vorm (bv. "Koe uit Bulgarije"). Dit bestand mag dus
// groeien zonder dat er ergens anders iets hoeft te veranderen.
//
// Welke zestig: de volledige `easy`-schijf (30 landen, stuk voor stuk
// wereldwijd herkenbaar) plus de dertig bekendste uit de `medium`-schijf van
// shared/content/countries.data.mjs, op herkenbaarheid gekozen — dit is een
// speelspel, geen aardrijkskundetoets (landcontent.md).

/**
 * @typedef {string | { de?: string, het?: string }} NlAdjectiveForm
 * @typedef {string | { m?: string, f?: string }} EsAdjectiveForm
 * @typedef {{ nl: NlAdjectiveForm, en: string, es: EsAdjectiveForm }} CountryAdjective
 */

/** @type {Record<string, CountryAdjective>} */
const countryAdjectives = {
  ae: {
    nl: { de: 'Emiratische', het: 'Emiratisch' },
    en: 'Emirati',
    es: 'emiratí',
  },
  ar: {
    nl: { de: 'Argentijnse', het: 'Argentijns' },
    en: 'Argentinian',
    es: { m: 'argentino', f: 'argentina' },
  },
  at: {
    nl: { de: 'Oostenrijkse', het: 'Oostenrijks' },
    en: 'Austrian',
    es: { m: 'austríaco', f: 'austríaca' },
  },
  au: {
    nl: { de: 'Australische', het: 'Australisch' },
    en: 'Australian',
    es: { m: 'australiano', f: 'australiana' },
  },
  bd: {
    nl: { de: 'Bangladese', het: 'Bangladees' },
    en: 'Bangladeshi',
    es: 'bangladesí',
  },
  be: {
    nl: { de: 'Belgische', het: 'Belgisch' },
    en: 'Belgian',
    es: 'belga',
  },
  bg: {
    nl: { de: 'Bulgaarse', het: 'Bulgaars' },
    en: 'Bulgarian',
    es: { m: 'búlgaro', f: 'búlgara' },
  },
  br: {
    nl: { de: 'Braziliaanse', het: 'Braziliaans' },
    en: 'Brazilian',
    es: { m: 'brasileño', f: 'brasileña' },
  },
  ca: {
    nl: { de: 'Canadese', het: 'Canadees' },
    en: 'Canadian',
    es: 'canadiense',
  },
  ch: {
    nl: { de: 'Zwitserse', het: 'Zwitsers' },
    en: 'Swiss',
    es: { m: 'suizo', f: 'suiza' },
  },
  cl: {
    nl: { de: 'Chileense', het: 'Chileens' },
    en: 'Chilean',
    es: { m: 'chileno', f: 'chilena' },
  },
  co: {
    nl: { de: 'Colombiaanse', het: 'Colombiaans' },
    en: 'Colombian',
    es: { m: 'colombiano', f: 'colombiana' },
  },
  cn: {
    nl: { de: 'Chinese', het: 'Chinees' },
    en: 'Chinese',
    es: { m: 'chino', f: 'china' },
  },
  cu: {
    nl: { de: 'Cubaanse', het: 'Cubaans' },
    en: 'Cuban',
    es: { m: 'cubano', f: 'cubana' },
  },
  cz: {
    nl: { de: 'Tsjechische', het: 'Tsjechisch' },
    en: 'Czech',
    es: { m: 'checo', f: 'checa' },
  },
  de: {
    nl: { de: 'Duitse', het: 'Duits' },
    en: 'German',
    es: { m: 'alemán', f: 'alemana' },
  },
  dk: {
    nl: { de: 'Deense', het: 'Deens' },
    en: 'Danish',
    es: { m: 'danés', f: 'danesa' },
  },
  eg: {
    nl: { de: 'Egyptische', het: 'Egyptisch' },
    en: 'Egyptian',
    es: { m: 'egipcio', f: 'egipcia' },
  },
  es: {
    nl: { de: 'Spaanse', het: 'Spaans' },
    en: 'Spanish',
    es: { m: 'español', f: 'española' },
  },
  fi: {
    nl: { de: 'Finse', het: 'Fins' },
    en: 'Finnish',
    es: { m: 'finlandés', f: 'finlandesa' },
  },
  fr: {
    nl: { de: 'Franse', het: 'Frans' },
    en: 'French',
    es: { m: 'francés', f: 'francesa' },
  },
  gb: {
    nl: { de: 'Britse', het: 'Brits' },
    en: 'British',
    es: { m: 'británico', f: 'británica' },
  },
  gr: {
    nl: { de: 'Griekse', het: 'Grieks' },
    en: 'Greek',
    es: { m: 'griego', f: 'griega' },
  },
  hr: {
    nl: { de: 'Kroatische', het: 'Kroatisch' },
    en: 'Croatian',
    es: 'croata',
  },
  hu: {
    nl: { de: 'Hongaarse', het: 'Hongaars' },
    en: 'Hungarian',
    es: { m: 'húngaro', f: 'húngara' },
  },
  id: {
    nl: { de: 'Indonesische', het: 'Indonesisch' },
    en: 'Indonesian',
    es: { m: 'indonesio', f: 'indonesia' },
  },
  ie: {
    nl: { de: 'Ierse', het: 'Iers' },
    en: 'Irish',
    es: { m: 'irlandés', f: 'irlandesa' },
  },
  il: {
    nl: { de: 'Israëlische', het: 'Israëlisch' },
    en: 'Israeli',
    es: 'israelí',
  },
  in: {
    nl: { de: 'Indiase', het: 'Indiaas' },
    en: 'Indian',
    es: { m: 'indio', f: 'india' },
  },
  ir: {
    nl: { de: 'Iraanse', het: 'Iraans' },
    en: 'Iranian',
    es: 'iraní',
  },
  is: {
    nl: { de: 'IJslandse', het: 'IJslands' },
    en: 'Icelandic',
    es: { m: 'islandés', f: 'islandesa' },
  },
  it: {
    nl: { de: 'Italiaanse', het: 'Italiaans' },
    en: 'Italian',
    es: { m: 'italiano', f: 'italiana' },
  },
  jm: {
    nl: { de: 'Jamaicaanse', het: 'Jamaicaans' },
    en: 'Jamaican',
    es: { m: 'jamaicano', f: 'jamaicana' },
  },
  jp: {
    nl: { de: 'Japanse', het: 'Japans' },
    en: 'Japanese',
    es: { m: 'japonés', f: 'japonesa' },
  },
  ke: {
    nl: { de: 'Keniaanse', het: 'Keniaans' },
    en: 'Kenyan',
    es: { m: 'keniano', f: 'keniana' },
  },
  kr: {
    nl: { de: 'Zuid-Koreaanse', het: 'Zuid-Koreaans' },
    en: 'South Korean',
    es: { m: 'surcoreano', f: 'surcoreana' },
  },
  kw: {
    nl: { de: 'Koeweitse', het: 'Koeweits' },
    en: 'Kuwaiti',
    es: 'kuwaití',
  },
  ma: {
    nl: { de: 'Marokkaanse', het: 'Marokkaans' },
    en: 'Moroccan',
    es: 'marroquí',
  },
  mx: {
    nl: { de: 'Mexicaanse', het: 'Mexicaans' },
    en: 'Mexican',
    es: { m: 'mexicano', f: 'mexicana' },
  },
  ng: {
    nl: { de: 'Nigeriaanse', het: 'Nigeriaans' },
    en: 'Nigerian',
    es: { m: 'nigeriano', f: 'nigeriana' },
  },
  nl: {
    nl: { de: 'Nederlandse', het: 'Nederlands' },
    en: 'Dutch',
    es: { m: 'neerlandés', f: 'neerlandesa' },
  },
  no: {
    nl: { de: 'Noorse', het: 'Noors' },
    en: 'Norwegian',
    es: { m: 'noruego', f: 'noruega' },
  },
  nz: {
    nl: { de: 'Nieuw-Zeelandse', het: 'Nieuw-Zeelands' },
    en: 'New Zealand',
    es: { m: 'neozelandés', f: 'neozelandesa' },
  },
  pe: {
    nl: { de: 'Peruaanse', het: 'Peruaans' },
    en: 'Peruvian',
    es: { m: 'peruano', f: 'peruana' },
  },
  ph: {
    nl: { de: 'Filipijnse', het: 'Filipijns' },
    en: 'Filipino',
    es: { m: 'filipino', f: 'filipina' },
  },
  pk: {
    nl: { de: 'Pakistaanse', het: 'Pakistaans' },
    en: 'Pakistani',
    es: 'paquistaní',
  },
  pl: {
    nl: { de: 'Poolse', het: 'Pools' },
    en: 'Polish',
    es: { m: 'polaco', f: 'polaca' },
  },
  pt: {
    nl: { de: 'Portugese', het: 'Portugees' },
    en: 'Portuguese',
    es: { m: 'portugués', f: 'portuguesa' },
  },
  ro: {
    nl: { de: 'Roemeense', het: 'Roemeens' },
    en: 'Romanian',
    es: { m: 'rumano', f: 'rumana' },
  },
  ru: {
    nl: { de: 'Russische', het: 'Russisch' },
    en: 'Russian',
    es: { m: 'ruso', f: 'rusa' },
  },
  sa: {
    nl: { de: 'Saoedische', het: 'Saoedisch' },
    en: 'Saudi',
    es: 'saudí',
  },
  se: {
    nl: { de: 'Zweedse', het: 'Zweeds' },
    en: 'Swedish',
    es: { m: 'sueco', f: 'sueca' },
  },
  sg: {
    nl: { de: 'Singaporese', het: 'Singaporees' },
    en: 'Singaporean',
    es: 'singapurense',
  },
  sk: {
    nl: { de: 'Slowaakse', het: 'Slowaaks' },
    en: 'Slovak',
    es: { m: 'eslovaco', f: 'eslovaca' },
  },
  th: {
    nl: { de: 'Thaise', het: 'Thais' },
    en: 'Thai',
    es: { m: 'tailandés', f: 'tailandesa' },
  },
  tr: {
    nl: { de: 'Turkse', het: 'Turks' },
    en: 'Turkish',
    es: { m: 'turco', f: 'turca' },
  },
  ua: {
    nl: { de: 'Oekraïense', het: 'Oekraïens' },
    en: 'Ukrainian',
    es: { m: 'ucraniano', f: 'ucraniana' },
  },
  us: {
    nl: { de: 'Amerikaanse', het: 'Amerikaans' },
    en: 'American',
    es: 'estadounidense',
  },
  vn: {
    nl: { de: 'Vietnamese', het: 'Vietnamees' },
    en: 'Vietnamese',
    es: 'vietnamita',
  },
  za: {
    nl: { de: 'Zuid-Afrikaanse', het: 'Zuid-Afrikaans' },
    en: 'South African',
    es: { m: 'sudafricano', f: 'sudafricana' },
  },
};

module.exports = { countryAdjectives };
