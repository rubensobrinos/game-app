'use strict';

// RoomPresentation-vorm (optioneel) uit docs/multiplayer/DATA-MODEL.md
// ("Optionele RoomPresentation") — volledig gegeven, geen open vraag. Laagste
// prioriteit van de vijf DM3-entiteiten; PRODUCT.md merkt groepsvlag/badge
// expliciet aan als latere uitbreiding.

/**
 * @typedef {{
 *   roomId: string,
 *   groupName: string,
 *   badgeSpec: object,
 *   badgeAssetUrl: string | null,
 * }} RoomPresentation
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
}

/**
 * Werpt TypeError als value niet aan de RoomPresentation-vorm voldoet.
 * @param {unknown} value
 */
function assertRoomPresentationShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`RoomPresentation must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.roomId, 'roomId');
  assertNonEmptyString(value.groupName, 'groupName');

  if (
    typeof value.badgeSpec !== 'object' ||
    value.badgeSpec === null ||
    Array.isArray(value.badgeSpec) ||
    Object.getPrototypeOf(value.badgeSpec) !== Object.prototype
  ) {
    throw new TypeError(`badgeSpec must be a plain object, got: ${JSON.stringify(value.badgeSpec)}`);
  }

  if (value.badgeAssetUrl !== null) {
    assertNonEmptyString(value.badgeAssetUrl, 'badgeAssetUrl');
  }
}

module.exports = { assertRoomPresentationShape };
