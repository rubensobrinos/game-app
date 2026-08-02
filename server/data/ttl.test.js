'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ROOM_TTL_SECONDS } = require('./ttl');

describe('ROOM_TTL_SECONDS #1', () => {
  test('#1 komt overeen met DATA-MODEL.md ("standaard room-TTL: 14.400 seconden")', () => {
    assert.strictEqual(ROOM_TTL_SECONDS, 14400);
  });
});
