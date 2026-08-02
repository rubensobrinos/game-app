// tests/load/l2-l3-multi-room-scale.js
//
// k6-script voor load-evidence-matrix.md rijen 9 en 10 (DT5, Deel 2):
//   - rij 9:  L2 — 20 rooms × 50 spelers ("1.000 gelijktijdige spelers").
//   - rij 10: L3 — 200 rooms × 50 spelers (knelpuntanalyse na CDN/schaalwerk).
//
// BELANGRIJK — dit script levert zelf GEEN pass/fail-oordeel voor L2/L3. De
// matrix is daar expliciet over: "het doel is hier expliciet
// 'knelpuntanalyse', geen pass/fail-getal" (rij 10) en "vereist ook dat de
// kernmetrics ... binnen bereik blijven — dat lees je af in observability,
// niet in de k6-samenvatting alleen" (rij 9). Dit script genereert dus de
// last (ROOMS × PLAYERS_PER_ROOM gelijktijdige spelers, elk één ronde) en
// bewaakt alleen de ruwe schaal-/foutthresholds (verbindingssucces,
// ack-succes) — de eigenlijke analyse (event-loop lag, Redis-latency,
// geheugengroei) moet ernaast in `/metrics`/observability worden afgelezen,
// niet uit de k6-output.
//
// EXPLICIET NIET VANDAAG UITGEVOERD: L2/L3 vereisen sowieso eerst een
// omgeving-/providercheck (load-evidence-matrix.md §L2/L3), los van elk
// deps-/uitvoeringsakkoord — zie DT-PROGRESS.md. Dit bestand bestaat om
// Deel 2 (scripts schrijven) compleet te maken, niet als beweerd bewijs dat
// L2/L3 al gedraaid zijn.
//
// Deelt de Engine.IO-/Socket.IO-framing met
// `l1-event-latency-and-answer-peak.js` via `support/socketio-wire.js` —
// alleen de opzet (meerdere rooms i.p.v. één) verschilt hier genoeg om een
// eigen bestand te rechtvaardigen in plaats van een derde configuratielaag
// bovenop het L1-script te stapelen.

import ws from 'k6/ws';
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import { encodeConnect, encodePong, encodeEvent, decodeFrame, pickAnswerPayload } from './support/socketio-wire.js';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const WS_URL = BASE_URL.replace(/^http/, 'ws');
const ROOMS = Number(__ENV.ROOMS || 20); // L2-doel; ROOMS=200 voor L3
const PLAYERS_PER_ROOM = Number(__ENV.PLAYERS_PER_ROOM || 50);
const TOTAL_PLAYERS = ROOMS * PLAYERS_PER_ROOM;
const HARD_TIMEOUT_MS = Number(__ENV.HARD_TIMEOUT_MS || 45000);

export const options = {
  scenarios: {
    multi_room: {
      executor: 'per-vu-iterations',
      vus: TOTAL_PLAYERS,
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION || '120s',
    },
  },
  thresholds: {
    // Ruwe schaal-/foutthresholds, geen inhoudelijk oordeel (zie kopcommentaar).
    socket_connect_success: ['rate>0.99'],
    round_started_received: ['rate>0.99'],
    answer_ack_success: ['rate>0.99'],
  },
};

const ackLatency = new Trend('answer_ack_latency_ms', true);
const connectSuccess = new Rate('socket_connect_success');
const roundStartedReceived = new Rate('round_started_received');
const answerAckSuccess = new Rate('answer_ack_success');

const CREATE_BODY = { config: { preset: 'quick_start', language: 'nl' } };

/**
 * Maakt ROOMS rooms aan, elk met PLAYERS_PER_ROOM deelnemers, over echte
 * REST-calls. Loopt sequentieel (k6 `setup()` is één VU) — bij ROOMS=200 ×
 * PLAYERS_PER_ROOM=50 is dat 10.000 HTTP-calls vóór de eerste VU start; dat
 * is bewust, `setup()` telt niet mee als loadtestlast, alleen als
 * testfixture.
 */
export function setup() {
  const rooms = [];
  for (let r = 0; r < ROOMS; r += 1) {
    const createRes = http.post(
      `${BASE_URL}/api/v1/games`,
      JSON.stringify({ ...CREATE_BODY, hostParticipates: true, displayName: `Host R${r} (loadtest)` }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (createRes.status !== 201) {
      throw new Error(`setup: room ${r} aanmaken faalde (${createRes.status}): ${createRes.body}`);
    }
    const host = createRes.json();
    const participants = [{ sessionToken: host.sessionToken, playerId: host.playerId, role: 'host' }];

    for (let p = 1; p < PLAYERS_PER_ROOM; p += 1) {
      const joinRes = http.post(
        `${BASE_URL}/api/v1/games/join`,
        JSON.stringify({ inviteId: host.inviteId, displayName: `R${r}S${p} (loadtest)`, joinSource: 'code' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (joinRes.status !== 200) {
        throw new Error(`setup: room ${r} join #${p} faalde (${joinRes.status}): ${joinRes.body}`);
      }
      const player = joinRes.json();
      participants.push({ sessionToken: player.sessionToken, playerId: player.playerId, role: 'player' });
    }
    rooms.push({ gameCode: host.gameCode, participants });
  }

  return { wsUrl: WS_URL, rooms };
}

export default function (data) {
  const roomIndex = Math.floor((__VU - 1) / PLAYERS_PER_ROOM);
  const playerIndexInRoom = (__VU - 1) % PLAYERS_PER_ROOM;
  const room = data.rooms[roomIndex];
  const me = room.participants[playerIndexInRoom];
  const isHost = playerIndexInRoom === 0;

  const url = `${data.wsUrl}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, {}, function (socket) {
    let answerSentAt = 0;
    let answered = false;

    socket.setTimeout(function () {
      socket.close();
    }, HARD_TIMEOUT_MS);

    socket.on('message', function (raw) {
      const frame = decodeFrame(raw);

      if (frame.kind === 'engine-open') {
        socket.send(encodeConnect({ sessionToken: me.sessionToken, protocolVersion: 'v1' }));
        return;
      }
      if (frame.kind === 'engine-ping') {
        socket.send(encodePong());
        return;
      }
      if (frame.kind === 'sio-connect') {
        connectSuccess.add(1);
        if (isHost) {
          socket.send(encodeEvent('game:start', { actionId: 'act_start_loadtest', payload: {} }, 0));
        }
        return;
      }
      if (frame.kind === 'sio-connect-error') {
        connectSuccess.add(0);
        socket.close();
        return;
      }
      if (frame.kind === 'sio-event') {
        if (frame.event === 'round:started' && !answered) {
          roundStartedReceived.add(1);
          const answer = pickAnswerPayload(frame.envelope.payload);
          answerSentAt = Date.now();
          answered = true;
          socket.send(
            encodeEvent(
              'round:answer',
              {
                actionId: `act_answer_${me.playerId}`,
                payload: { roundId: frame.envelope.payload.roundId, answer, clientAnsweredAt: answerSentAt },
              },
              1,
            ),
          );
          return;
        }
        if (frame.event === 'round:progress' && isHost) {
          if (frame.envelope.payload.answeredCount === frame.envelope.payload.eligiblePlayerCount) {
            socket.send(encodeEvent('game:finish', { actionId: 'act_finish_loadtest', payload: {} }, 2));
          }
          return;
        }
        if (frame.event === 'game:finished') {
          socket.close();
        }
        return;
      }
      if (frame.kind === 'sio-ack' && frame.id === 1 && answered) {
        answerAckSuccess.add(1);
        ackLatency.add(Date.now() - answerSentAt);
      }
    });

    socket.on('error', function () {
      connectSuccess.add(0);
    });
  });

  check(res, { 'socket-handshake succesvol (HTTP 101)': (r) => r && r.status === 101 });
}
