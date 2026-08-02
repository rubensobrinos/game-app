'use strict';

// Testsuite voor de join-code- en inviteId-module.
//
// Spec: docs/multiplayer/ARCHITECTURE.md, sectie "## Join-code en inviteId" (zes cijfers,
// cryptografisch random, uniek onder actieve rooms, nooit oplopend; inviteId >= 96 bits,
// base64url, lookup via hashindex) en docs/multiplayer/DATA-MODEL.md, secties "## Room" en
// "## Redis-sleutels" (`room:code:{code}`, `room:invite:{inviteHash}`; de code is
// gebruiksgemak, de inviteId is de primaire, moeilijk te raden toegang).
//
// Alleen node:test + node:assert. Geschreven vanuit de spec: room-codes.js is bewust niet
// gelezen, zodat deze suite een onafhankelijke controle is. Geen enkele test raakt de
// systeemklok — geen Date.now(), geen timer, geen setTimeout; ook de uitputtingstest werkt met
// een aanroepteller in plaats van met tijd. FLAKINESS-BUDGET: elke statistische drempel is zo
// gekozen dat een correcte generator met kans < 1e-9 per toets faalt, opgeteld ~1,3e-8 per
// volledige run — bij 1000 CI-runs per dag ordegrootte één vals alarm per 200 jaar. Per test
// staat de onderbouwing erbij.

const { test } = require('node:test');
const assert = require('node:assert');
const { Buffer } = require('node:buffer');
const {
  generateGameCode, generateInviteId, hashInviteId, isValidGameCode, isValidInviteId,
} = require('./room-codes');

const SIX_DIGITS = /^[0-9]{6}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
// Canonieke SHA-256-digeststring: 64 hex, of base64(url) van 32 bytes.
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const SHA256_B64 = /^[A-Za-z0-9+/_-]{43}=?$/;
const CODE_SAMPLE_SIZE = 20_000;
const UNIQUE_CODE_SAMPLE_SIZE = 3_000;
const INVITE_SAMPLE_SIZE = 5_000;
const PAIR_SAMPLE_SIZE = 1_000;
/** isTaken die alles accepteert: de generator krijgt geen enkele afwijzing. */
const acceptAll = () => false;
/** Eén keer bemonsteren en hergebruiken; dat scheelt 20k generaties per test. */
function memoSample(size, make) {
  let cache = null;
  return () => (cache ??= Array.from({ length: size }, make));
}
const codes = memoSample(CODE_SAMPLE_SIZE, () => generateGameCode({ isTaken: acceptAll }));
const invites = memoSample(INVITE_SAMPLE_SIZE, () => generateInviteId());
const chiSquare = (counts, expected) =>
  counts.reduce((sum, observed) => sum + ((observed - expected) ** 2) / expected, 0);
/** Lengte van het gedeelde begin (fromEnd=false) of einde (fromEnd=true) van a en b. */
function affixLength(a, b, fromEnd) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && (fromEnd ? a[a.length - 1 - i] === b[b.length - 1 - i] : a[i] === b[i])) i += 1;
  return i;
}

test('generateGameCode levert altijd exact zes cijfers als string, en die valideert', () => {
  for (const code of codes()) {
    assert.strictEqual(typeof code, 'string');
    assert.strictEqual(code.length, 6);
    assert.match(code, SIX_DIGITS);
    assert.strictEqual(isValidGameCode(code), true, `eigen uitvoer afgekeurd: ${code}`);
  }
});

test('leidende nullen blijven behouden — een code is nooit een getal', () => {
  // P(geen enkele code < 100000 in 20.000 trekkingen) = 0,9^20000 ≈ 10^-915.
  const leading = codes().filter((code) => code[0] === '0');
  assert.ok(leading.length > 0, 'geen enkele code met leidende nul in de steekproef');
  for (const code of leading) {
    assert.strictEqual(code.length, 6, 'code met leidende nul is ingekort');
    assert.notStrictEqual(code, String(Number(code)), 'code is als getal behandeld');
  }
});

test('isTaken wordt gerespecteerd: afgewezen codes komen niet terug', () => {
  // Bewust hooguit vijf afwijzingen: de grootte van het retry-budget staat niet in de spec en
  // wordt hier dus niet vastgepind — alleen dát er opnieuw wordt getrokken telt, plus de
  // uitputtingstest hieronder.
  for (const rejectCount of [1, 2, 3, 5]) {
    const rejected = new Set();
    const candidates = [];
    // Eenmaal afgewezen blijft afgewezen, zodat een toevallig herhaalde kandidaat (1e-6 per
    // paar) de assertie niet alsnog kan laten omslaan.
    const isTaken = (candidate) => {
      candidates.push(candidate);
      if (rejected.has(candidate)) return true;
      if (rejected.size < rejectCount) return rejected.add(candidate) && true;
      return false;
    };
    const code = generateGameCode({ isTaken });
    assert.match(code, SIX_DIGITS, `ongeldige code na ${rejectCount} afwijzingen`);
    assert.strictEqual(rejected.size, rejectCount, `verwacht ${rejectCount} afwijzingen`);
    assert.strictEqual(rejected.has(code), false, 'een afgewezen code werd toch teruggegeven');
    assert.ok(candidates.length > rejectCount, 'isTaken niet opnieuw bevraagd na afwijzing');
    for (const c of candidates) assert.match(c, SIX_DIGITS, 'isTaken kreeg een misvormde kandidaat');
  }
});

test('uitputting: isTaken altijd true faalt gedefinieerd en loopt niet oneindig door', () => {
  // Timeout-vrij: een teller in de callback verbreekt een eventuele oneindige lus. De grens ligt
  // ver boven elk realistisch retry-budget, dus een correcte implementatie raakt hem nooit.
  const GUARD_LIMIT = 100_000;
  const guard = new Error('GUARD: isTaken vaker dan GUARD_LIMIT aangeroepen');
  let calls = 0;
  const isTaken = () => {
    calls += 1;
    if (calls > GUARD_LIMIT) throw guard;
    return true;
  };
  let [returned, thrown] = [undefined, null];
  try {
    returned = generateGameCode({ isTaken });
  } catch (error) {
    thrown = error;
  }
  assert.notStrictEqual(thrown, guard, 'generateGameCode zoekt door zonder eigen stopcriterium');
  assert.ok(calls > 1, 'generateGameCode probeerde het niet opnieuw na een afwijzing');
  // Gedefinieerd falen = een echte Error met boodschap werpen óf expliciet niets teruggeven;
  // wat niet mag is alsnog een code teruggeven die isTaken heeft afgewezen.
  if (thrown !== null) {
    assert.ok(thrown instanceof Error && typeof thrown.message === 'string' && thrown.message,
      'uitputting moet een Error met boodschap werpen, geen kale waarde');
  } else {
    assert.ok(returned === null || returned === undefined, 'bij uitputting mag er geen code komen');
  }
});

test('duplicaten: hard nul mét een wetende isTaken, verjaardagsverwachting zonder', () => {
  // Bezetting blijft 0,3% van 10^6, dus zelfs een krap retry-budget hoeft hier vrijwel nooit
  // opnieuw te trekken: dit deel is hard, niet statistisch.
  const issued = new Set();
  for (let i = 0; i < UNIQUE_CODE_SAMPLE_SIZE; i += 1) {
    const code = generateGameCode({ isTaken: (candidate) => issued.has(candidate) });
    assert.strictEqual(issued.has(code), false, 'duplicaat ondanks een isTaken die hem kende');
    issued.add(code);
  }
  assert.strictEqual(issued.size, UNIQUE_CODE_SAMPLE_SIZE);

  // Zonder wetende isTaken: zes cijfers is maar 10^6 ruimte, dus bij 20.000 trekkingen mét
  // teruglegging is het verwachte aantal botsingen C(20000,2)/10^6 ≈ 200 (sd ≈ 14) — nul
  // duplicaten eisen zou fout zijn. De grens 500 ligt ~21 sd boven de verwachting (p < 1e-40)
  // en pakt wél een generator die maar een fractie van de ruimte gebruikt: bij 100.000
  // bereikbare codes zouden het er al ~2000 zijn.
  const collisions = CODE_SAMPLE_SIZE - new Set(codes()).size;
  assert.ok(collisions <= 500, `te veel duplicaten: ${collisions} (verwacht ≈ 200)`);
});

// VERDELING / MODULO-BIAS — drempelkeuze. Alle grenzen hieronder zijn bovenstaartwaarden van
// de chi-kwadraatverdeling met p < 1e-9 per toets, numeriek bepaald via de geregulariseerde
// onvolledige gammafunctie: df=9 → x=60 geeft p=1,34e-9 (zes cijferposities + één totaal = 7
// toetsen) en df=19 → x=85 geeft p=2,52e-10 (twintig waardebuckets); samen ~9,7e-9 per run.
// Een gebruikelijke 0,05- of 0,01-grens zou 1 op 20 respectievelijk 1 op 100 runs laten falen
// en is hier onbruikbaar. De prijs van de ruime grens is onderscheidend vermogen: ~2% afwijking
// per cijfer (zoals `randomByte % 10`, dat cijfers 0-5 op 26/256 zet en 6-9 op 25/256) haalt
// met 120.000 cijfertrekkingen een chi2 van gemiddeld ~53 en wordt in ongeveer een derde van
// de runs gepakt. Grove bias — ontbrekend cijfer, afgekapt bereik, niet-uniforme eerste
// positie, `random % 1000000` op een te kleine bron — gaat er altijd ver overheen. Dat is de
// bewuste ruil: nooit vals alarm boven maximale gevoeligheid.

test('verdeling: elke cijferpositie en het totaal zijn uniform (chi-kwadraat, df=9)', () => {
  const sample = codes();
  const totals = new Array(10).fill(0);
  for (let position = 0; position < 6; position += 1) {
    const counts = new Array(10).fill(0);
    for (const code of sample) counts[code.charCodeAt(position) - 48] += 1;
    for (let digit = 0; digit < 10; digit += 1) {
      assert.ok(counts[digit] > 0, `cijfer ${digit} komt nooit voor op positie ${position}`);
      totals[digit] += counts[digit];
    }
    const stat = chiSquare(counts, sample.length / 10);
    assert.ok(stat < 60, `positie ${position}: chi2=${stat.toFixed(1)} ≥ 60 (${counts.join(',')})`);
  }
  const stat = chiSquare(totals, (sample.length * 6) / 10);
  assert.ok(stat < 60, `chi2=${stat.toFixed(1)} ≥ 60 over 120.000 cijfertrekkingen`);
});

test('verdeling: geen bucket in de waarderuimte is oververtegenwoordigd (20 buckets)', () => {
  const sample = codes();
  const BUCKETS = 20;
  const width = 1_000_000 / BUCKETS;
  const counts = new Array(BUCKETS).fill(0);
  for (const code of sample) counts[Math.floor(Number(code) / width)] += 1;
  const expected = sample.length / BUCKETS; // 1000, sd = sqrt(n·p·(1-p)) ≈ 30,8
  const stat = chiSquare(counts, expected);
  assert.ok(stat < 85, `chi2=${stat.toFixed(1)} ≥ 85 over de waardebuckets (${counts.join(',')})`);
  // Losse bucketgrens naast de chi-kwadraat: ±20% is ±6,5 sd, tweezijdig p ≈ 1,7e-10 per bucket
  // en ~3,4e-9 over twintig buckets. Modulo-bias op de volledige waarde (`random % 1000000`)
  // toont zich hier als een structureel zware onderkant.
  for (let i = 0; i < BUCKETS; i += 1) {
    assert.ok(counts[i] >= expected * 0.8 && counts[i] <= expected * 1.2,
      `bucket ${i} (${i * width}-${(i + 1) * width - 1}) telt ${counts[i]}, verwacht ${expected}`);
  }
});

test('generateInviteId is URL-veilig en draagt minimaal 96 bits', () => {
  for (const id of invites()) {
    assert.strictEqual(typeof id, 'string');
    assert.match(id, BASE64URL, 'inviteId bevat tekens buiten het base64url-alfabet');
    for (const char of ['+', '/', '=']) assert.strictEqual(id.includes(char), false, char);
    assert.strictEqual(encodeURIComponent(id), id, 'inviteId verandert door URL-encoding');
    // 96 bits = 12 bytes = 16 base64url-tekens zonder padding.
    assert.ok(id.length >= 16, `inviteId van ${id.length} tekens draagt minder dan 96 bits`);
    assert.ok(Buffer.from(id, 'base64url').length >= 12, `gedecodeerd korter dan 12 bytes: ${id}`);
    assert.strictEqual(isValidInviteId(id), true, `eigen uitvoer afgekeurd: ${id}`);
  }
  // Bij >= 96 bits is de verjaardagskans op één botsing in 5000 trekkingen
  // C(5000,2)/2^96 ≈ 1,6e-22, dus nul duplicaten is hier een harde eis.
  assert.strictEqual(new Set(invites()).size, INVITE_SAMPLE_SIZE, 'duplicate inviteId');
});

test('opeenvolgende inviteIds delen geen voorspelbaar prefix of suffix', () => {
  const sample = invites();
  let [maxPrefix, maxSuffix, sharedThree] = [0, 0, 0];
  for (let i = 1; i <= PAIR_SAMPLE_SIZE; i += 1) {
    assert.notStrictEqual(sample[i], sample[i - 1]);
    const prefix = affixLength(sample[i - 1], sample[i], false);
    const suffix = affixLength(sample[i - 1], sample[i], true);
    maxPrefix = Math.max(maxPrefix, prefix);
    maxSuffix = Math.max(maxSuffix, suffix);
    if (prefix >= 3 || suffix >= 3) sharedThree += 1;
  }
  // Absolute grens: zelfs bij het kleinst denkbare alfabet (16 symbolen, hex) is P(affix >= 11)
  // per paar 1,5e-13, dus ~3e-10 over 1000 paren en twee kanten.
  assert.ok(maxPrefix <= 10, `twee opeenvolgende inviteIds delen ${maxPrefix} beginkarakters`);
  assert.ok(maxSuffix <= 10, `twee opeenvolgende inviteIds delen ${maxSuffix} eindkarakters`);
  // Systematische grens: een vast versie-, teller- of timestampaffix raakt 100% van de paren;
  // toevallig is dat bij 16 symbolen 0,024%, dus 5% ligt astronomisch ver van de nulhypothese
  // én pakt elk vast affix van 3 tekens of langer.
  assert.ok(sharedThree < PAIR_SAMPLE_SIZE * 0.05,
    `${sharedThree} van ${PAIR_SAMPLE_SIZE} paren delen 3+ tekens — vast affix?`);
  assert.ok(new Set(sample.slice(0, PAIR_SAMPLE_SIZE).map((id) => id[0])).size >= 4,
    'te weinig variatie in het eerste teken');

  // Niet oplopend (spec: "nooit oplopend"): onder toeval is de fractie lexicografisch
  // stijgende opvolgers 0,5 met sd = 0,5/sqrt(4999) ≈ 0,0071, dus de band [0,35; 0,65] ligt
  // 21 sd van het midden. Een monotone bron (ULID, teller, timestampprefix) komt op ~1,0 uit.
  let ascending = 0;
  for (let i = 1; i < sample.length; i += 1) if (sample[i] > sample[i - 1]) ascending += 1;
  const fraction = ascending / (sample.length - 1);
  assert.ok(fraction > 0.35 && fraction < 0.65,
    `${(fraction * 100).toFixed(1)}% van de opeenvolgende inviteIds is lexicografisch groter`);
});

const [PEPPER_A, PEPPER_B] = ['pepper-a-20260801', 'pepper-b-20260801'];
const INVITE_1 = 'q3Zr9Vt1XyB7nM4kL0pW2s';
const INVITE_2 = 'q3Zr9Vt1XyB7nM4kL0pW2t'; // één teken verschil met INVITE_1

test('hashInviteId is deterministisch en levert een SHA-256-digest van vaste lengte', () => {
  const first = hashInviteId(INVITE_1, PEPPER_A);
  for (let i = 0; i < 10; i += 1) assert.strictEqual(hashInviteId(INVITE_1, PEPPER_A), first);
  for (const id of invites().slice(0, 200)) {
    assert.strictEqual(hashInviteId(id, PEPPER_A), hashInviteId(id, PEPPER_A), 'hash instabiel');
  }
  // Vaste digestlengte, getoetst met twee géldige inviteIds van verschillende lengte.
  const short = hashInviteId('N4x7pQm2K8tWq3Zr', PEPPER_A); // 16 tekens
  const long = hashInviteId('Rg9tS2xQvB4nZ7yH1cJdE6uK0mA3wX8pL5tN2rQvB4c', PEPPER_B); // 43 tekens
  for (const hash of [first, short, long]) {
    assert.strictEqual(typeof hash, 'string');
    assert.ok(SHA256_HEX.test(hash) || SHA256_B64.test(hash), `geen SHA-256-digest: ${hash}`);
  }
  assert.strictEqual(first.length, short.length, 'digestlengte hangt af van de invoerlengte');
  assert.strictEqual(short.length, long.length, 'digestlengte hangt af van de invoerlengte');
});

test('een andere pepper geeft een andere hash — de pepper doet echt mee', () => {
  assert.notStrictEqual(hashInviteId(INVITE_1, PEPPER_A), hashInviteId(INVITE_1, PEPPER_B));
  assert.notStrictEqual(hashInviteId(INVITE_1, 'pepper-1'), hashInviteId(INVITE_1, 'pepper-2'));
  for (const id of invites().slice(0, 200)) {
    assert.notStrictEqual(hashInviteId(id, PEPPER_A), hashInviteId(id, PEPPER_B),
      'de pepper heeft geen invloed op de hash');
  }
});

test('de hash bevat de inviteId (en de pepper) niet als substring', () => {
  // De hash staat in Redis-keynamen (`room:invite:{inviteHash}`); als de capability daar
  // letterlijk in terugkomt, is de hele hashindex zinloos.
  for (const id of invites().slice(0, 200)) {
    const hash = hashInviteId(id, PEPPER_A);
    assert.strictEqual(hash.toLowerCase().includes(id.toLowerCase()), false,
      'inviteId lekt in de hash');
    assert.strictEqual(hash.includes(PEPPER_A), false, 'pepper lekt letterlijk in de hash');
    assert.notStrictEqual(hash, id);
  }
});

test('verschillende inviteIds geven verschillende hashes', () => {
  const base = hashInviteId(INVITE_1, PEPPER_A);
  const near = hashInviteId(INVITE_2, PEPPER_A);
  assert.notStrictEqual(base, near);
  assert.ok(affixLength(base, near, false) < base.length / 2, 'geen avalanche bij 1 teken verschil');
  const sample = invites().slice(0, 2000);
  const hashes = new Set(sample.map((id) => hashInviteId(id, PEPPER_A)));
  assert.strictEqual(hashes.size, sample.length, 'hashbotsing binnen 2000 verschillende inviteIds');
});

/** Vijandige invoer die geen van beide validators mag laten werpen. */
const HOSTILE = [
  ['null', null], ['undefined', undefined], ['getal 482917', 482917], ['getal 0', 0],
  ['NaN', NaN], ['Infinity', Infinity], ['-0', -0], ['BigInt 482917n', 482917n],
  ['true', true], ['false', false], ['leeg object', {}], ['lege array', []], ['Map', new Map()],
  ['array met geldige code', ['482917']], ['Symbol (werpt bij ToString)', Symbol('482917')],
  ['functie', () => '482917'], ['Date', new Date(0)], ['RegExp', /^\d{6}$/],
  ['object met toString → geldige code', { toString: () => '482917' }],
  ['boxed String-object', Object('482917')], ['lege string', ''],
  ['object zonder prototype', Object.assign(Object.create(null), { code: '482917' })],
  ['string met NUL-byte', '4829 1'], ['zeer lange cijferstring (100k)', '1'.repeat(100_000)],
  ['zeer lange base64url-string (100k)', 'a'.repeat(100_000)],
];
/** Alleen deze rij is voor isValidInviteId een grensgeval qua lengtebeleid. */
const INVITE_AMBIGUOUS = 'zeer lange base64url-string (100k)';
/** Codes die geldig zijn, inclusief leidende nullen. */
const VALID_CODES = ['000000', '000001', '012345', '007007', '100000', '482917', '999999'];

// Codes die afgewezen moeten worden. Veel rijen zijn precies zes tekens lang en zijn vallen
// voor een validator die op Number()/parseInt leunt in plaats van op het cijferalfabet:
// Number(' 48291'), Number('+48291'), Number('4829e1'), Number('0x1234') en Number('      ')
// geven allemaal een keurig getal terug.
const INVALID_CODES = [
  ['vijf cijfers', '12345'], ['zeven cijfers', '1234567'], ['één cijfer', '4'],
  ['letter in de code', '48291a'], ['hoofdletter O in plaats van 0', '48291O'],
  ['leidende spatie', ' 48291'], ['volgspatie', '48291 '], ['spatie in het midden', '482 17'],
  ['zes cijfers met spaties eromheen', ' 482917 '], ['tab', '\t48291'], ['newline', '48291\n'],
  ['non-breaking space', ' 48291'], ['zero-width space', '48291​'],
  ['plusteken', '+48291'], ['minteken', '-48291'], ['punt', '48291.'],
  ['exponentnotatie', '4829e1'], ['hexnotatie', '0x1234'], ['binaire notatie', '0b1010'],
  ['octale notatie', '0o1234'], ['underscore-scheiding', '482_17'], ['zes spaties', '      '],
  ['fullwidth cijfers', '４８２９１７'],
  ['Arabisch-Indische cijfers', '٤٨٢٩١٧'],
  ['Devanagari-cijfers', '४८२९१७'],
  ['wiskundig vette cijfers', '\u{1D7D2}\u{1D7D8}\u{1D7D0}\u{1D7D7}\u{1D7CF}\u{1D7D5}'],
];

// inviteIds die geldig zijn: base64url, minimaal 16 tekens (96 bits).
const VALID_INVITES = [
  'N4x7pQm2K8tWq3Zr', 'q3Zr9Vt1XyB7nM4kL0pW2s', '-_-_-_-_-_-_-_-_', 'AAAAAAAAAAAAAAAA',
  'ZmFrZS1pbnZpdGUtaWQtdmFsdWUtMDAx', 'Rg9tS2xQvB4nZ7yH1cJdE6uK0mA3wX8pL5tN2rQvB4c',
];

/** Te kort (< 96 bits), buiten base64url, whitespace of unicode-lookalike. */
const INVALID_INVITES = [
  ['één teken', 'a'], ['vier tekens', 'abcd'], ['acht tekens (48 bits)', 'abcdefgh'],
  ['plusteken', 'N4x7pQm2K8tWq3Z+'], ['slash', 'N4x7pQm2K8tWq3Z/'],
  ['padding =', 'N4x7pQm2K8tWq3Zr='], ['dubbele padding', 'N4x7pQm2K8tWq3Z=='],
  ['spatie in het midden', 'N4x7pQm2 K8tWq3Zr'], ['leidende spatie', ' N4x7pQm2K8tWq3Zr'],
  ['volgspatie', 'N4x7pQm2K8tWq3Zr '], ['newline', 'N4x7pQm2K8tWq3Zr\n'],
  ['tab', 'N4x7pQm2\tK8tWq3Zr'], ['punt', 'N4x7pQm2.K8tWq3Zr'], ['procent', 'N4x7pQm2%K8tWq3Zr'],
  ['vraagteken', 'N4x7pQm2?K8tWq3Zr'], ['hekje', 'N4x7pQm2#K8tWq3Zr'],
  ['ampersand', 'N4x7pQm2&K8tWq3Zr'], ['dubbele punt', 'N4x7pQm2:K8tWq3Zr'],
  ['NUL-byte', 'N4x7pQm2 K8tWq3Zr'], ['zero-width space', 'N4x7pQm2​K8tWq3Zr'],
  ['accent é', 'N4x7pQm2éK8tWq3Zr'], ['Cyrillische х (U+0445)', 'N4x7pQm2K8tWq3Zх'],
  ['Griekse Ν (U+039D)', 'Ν4x7pQm2K8tWq3Zr'], ['fullwidth Ｎ', 'Ｎ4x7pQm2K8tWq3Zr'],
  ['emoji', 'N4x7pQm2\u{1F389}K8tWq3Zr'],
];

test('validators werpen nooit op vijandige input en geven altijd een boolean', () => {
  const validators = [['isValidGameCode', isValidGameCode], ['isValidInviteId', isValidInviteId]];
  for (const [label, value] of HOSTILE) {
    for (const [name, validate] of validators) {
      let result;
      assert.doesNotThrow(() => { result = validate(value); }, `${name} wierp op: ${label}`);
      assert.strictEqual(typeof result, 'boolean', `${name} gaf geen boolean op: ${label}`);
    }
    // Geen van deze waarden is een zescijferige codestring, en op het lengte-grensgeval na
    // evenmin een geldige inviteId.
    assert.strictEqual(isValidGameCode(value), false, `isValidGameCode accepteerde: ${label}`);
    if (label !== INVITE_AMBIGUOUS) {
      assert.strictEqual(isValidInviteId(value), false, `isValidInviteId accepteerde: ${label}`);
    }
  }
});

test('isValidGameCode accepteert geldige codes en wijst alles daarbuiten af', () => {
  for (const code of VALID_CODES) assert.strictEqual(isValidGameCode(code), true, code);
  for (const [label, value] of INVALID_CODES) {
    assert.strictEqual(isValidGameCode(value), false, `ten onrechte geaccepteerd: ${label}`);
  }
});

test('isValidInviteId accepteert base64url-inviteIds en wijst alles daarbuiten af', () => {
  for (const id of VALID_INVITES) assert.strictEqual(isValidInviteId(id), true, id);
  for (const [label, value] of INVALID_INVITES) {
    assert.strictEqual(isValidInviteId(value), false, `ten onrechte geaccepteerd: ${label}`);
  }
});

test('meta: fixturetabellen zijn intern consistent en hebben unieke labels', () => {
  for (const rows of [HOSTILE, INVALID_CODES, INVALID_INVITES]) {
    assert.ok(rows.length > 0);
    assert.strictEqual(new Set(rows.map(([l]) => l)).size, rows.length, 'dubbel label');
  }
  assert.ok(HOSTILE.some(([l]) => l === INVITE_AMBIGUOUS), 'INVITE_AMBIGUOUS niet in HOSTILE');
  const valids = [...VALID_CODES, ...VALID_INVITES];
  assert.strictEqual(new Set(valids).size, valids.length, 'dubbele geldige fixture');
  // De verwachte uitkomst van elke rij volgt al uit de spec zelf, los van de implementatie.
  for (const code of VALID_CODES) assert.match(code, SIX_DIGITS);
  for (const id of VALID_INVITES) assert.ok(id.length >= 16 && BASE64URL.test(id), id);
  for (const [label, v] of INVALID_CODES) assert.doesNotMatch(v, SIX_DIGITS, label);
  for (const [label, v] of INVALID_INVITES) {
    assert.ok(!BASE64URL.test(v) || v.length < 16, `niet echt ongeldig: ${label}`);
  }
});
