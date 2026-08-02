/**
 * @file PR10 — tests voor `preview-endpoint.mjs`.
 * @see docs/protocol-plan/prompts/PR10-preview-endpoint.md.
 *
 * Herzien naar het al gebouwde `previewInvite()`-contract
 * (`docs/integration-plan/HANDOFF.md`, INT-8): uitsluitend `inviteId`, geen
 * `gameCode`-variant meer; de succesrespons is de volledige
 * `previewInvite()`-vorm (`roomId`, `suggestedName`, `phase`, `locked`,
 * `allowLateJoin`, `playerCount`, `maxPlayers`), niet de eerdere kale
 * `{ suggestedName }`.
 *
 * Gebruikt bewust een via de échte generator (`generateInviteId()` uit
 * `server/architecture/room-codes.js`) opgewekte `inviteId`, en toetst
 * expliciet dat die waarde ook door de échte `isValidInviteId()` komt — geen
 * handgeschreven voorbeeldstring. Een eerdere versie gebruikte
 * `"N4x7pQm2K8tW"` (12 tekens, ~72 bits): dat voorbeeld komt niet door
 * `isValidInviteId()` (ondergrens 16 tekens/96 bits) — hergebruikt hieronder
 * als regressietest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreviewRequest, validatePreviewResponse } from './preview-endpoint.mjs';
import { generateInviteId, isValidInviteId } from '../architecture/room-codes.js';

const realInviteId = generateInviteId();

test('fixture-sanity: de via generateInviteId() opgewekte inviteId komt door isValidInviteId()', () => {
  assert.equal(isValidInviteId(realInviteId), true);
  assert.equal(realInviteId.length, 22);
});

test('validatePreviewRequest: een via generateInviteId() opgewekte, geldige inviteId → ok:true', () => {
  assert.deepEqual(
    validatePreviewRequest({ inviteId: realInviteId }),
    { ok: true, value: { inviteId: realInviteId } },
  );
});

test('validatePreviewRequest: inviteId ontbreekt → INVITE_INVALID', () => {
  assert.deepEqual(validatePreviewRequest({}), { ok: false, code: 'INVITE_INVALID' });
});

test('validatePreviewRequest: gameCode wordt niet meer geaccepteerd (geen inviteId) → INVITE_INVALID', () => {
  // gameCode bestaat niet meer als locator voor dit endpoint (INT-8) — alleen
  // inviteId telt, dus dit gedraagt zich identiek aan "ontbrekende inviteId".
  assert.deepEqual(
    validatePreviewRequest({ gameCode: '482917' }),
    { ok: false, code: 'INVITE_INVALID' },
  );
});

test('validatePreviewRequest: inviteId korter dan de echte ondergrens (12 tekens) → INVITE_INVALID', () => {
  const tooShortInviteId = 'N4x7pQm2K8tW';
  assert.equal(isValidInviteId(tooShortInviteId), false);
  assert.deepEqual(
    validatePreviewRequest({ inviteId: tooShortInviteId }),
    { ok: false, code: 'INVITE_INVALID' },
  );
});

test('validatePreviewRequest: query is geen object → INVITE_INVALID', () => {
  assert.deepEqual(validatePreviewRequest('not-an-object'), { ok: false, code: 'INVITE_INVALID' });
});

function buildValidPreviewResponse(overrides = {}) {
  return {
    roomId: 'room_01J...',
    suggestedName: 'Vlugge Vos',
    phase: 'LOBBY',
    locked: false,
    allowLateJoin: true,
    playerCount: 23,
    maxPlayers: 100,
    ...overrides,
  };
}

test('validatePreviewResponse: de volledige, geldige previewInvite()-vorm → ok:true', () => {
  assert.deepEqual(
    validatePreviewResponse(buildValidPreviewResponse()),
    { ok: true, value: buildValidPreviewResponse() },
  );
});

test('validatePreviewResponse: suggestedName als getal → ok:false', () => {
  assert.equal(validatePreviewResponse(buildValidPreviewResponse({ suggestedName: 42 })).ok, false);
});

test('validatePreviewResponse: suggestedName langer dan de naamlimiet (20 zichtbare tekens) → NAME_TOO_LONG', () => {
  const result = validatePreviewResponse(buildValidPreviewResponse({ suggestedName: 'a'.repeat(21) }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NAME_TOO_LONG');
});

test('validatePreviewResponse: roomId ontbreekt → ok:false', () => {
  const body = buildValidPreviewResponse();
  delete body.roomId;
  assert.equal(validatePreviewResponse(body).ok, false);
});

test('validatePreviewResponse: phase geen string → ok:false', () => {
  assert.equal(validatePreviewResponse(buildValidPreviewResponse({ phase: 42 })).ok, false);
});

test('validatePreviewResponse: locked geen boolean → ok:false', () => {
  assert.equal(validatePreviewResponse(buildValidPreviewResponse({ locked: 'false' })).ok, false);
});

test('validatePreviewResponse: allowLateJoin geen boolean → ok:false', () => {
  assert.equal(validatePreviewResponse(buildValidPreviewResponse({ allowLateJoin: 1 })).ok, false);
});

test('validatePreviewResponse: playerCount negatief → ok:false', () => {
  assert.equal(validatePreviewResponse(buildValidPreviewResponse({ playerCount: -1 })).ok, false);
});

test('validatePreviewResponse: maxPlayers = 0 → ok:false (moet >= 1 zijn)', () => {
  assert.equal(validatePreviewResponse(buildValidPreviewResponse({ maxPlayers: 0 })).ok, false);
});

test('validatePreviewResponse: body met extra sessionToken-veld → ok:false', () => {
  assert.equal(
    validatePreviewResponse(buildValidPreviewResponse({ sessionToken: 'abc123' })).ok,
    false,
  );
});

test('validatePreviewResponse: body met extra playerId-veld → ok:false', () => {
  assert.equal(
    validatePreviewResponse(buildValidPreviewResponse({ playerId: 'p1' })).ok,
    false,
  );
});

test('validatePreviewResponse: body is geen object → ok:false', () => {
  assert.equal(validatePreviewResponse('not-an-object').ok, false);
});
