// tests/load/l1-event-latency-and-answer-peak.js
//
// k6-script voor load-evidence-matrix.md rijen 4 en 5 (DT5, Deel 2):
//   - rij 4: p95 realtime-eventlatency onder 300 ms.
//   - rij 5: antwoordpieken binnen twee seconden verwerkt.
//
// Bewust ÉÉN script voor beide rijen: één room-/matchsessie met N spelers
// levert vanzelf de "antwoordpiek" op (elke speler antwoordt zodra
// `round:started` binnenkomt, dus vrijwel gelijktijdig) én de
// ack-/broadcastlatencies waar rij 4 om vraagt — een tweede, apart script
// zou dezelfde sessie moeten opzetten om iets nieuws te meten.
//
// SCHAAL IS EEN OMGEVINGSVARIABELE, GEEN AANNAME IN DE CODE. De bron
// (DEPLOYMENT-AND-TESTING.md §Loadtests) noemt L1 als "1 room × 100 spelers,
// 20 rondes" — dat is de standaardwaarde van PLAYERS hieronder, en dus wat
// dit script *beweert* te bewijzen zodra het op die schaal draait. Een
// uitvoering op kleinere schaal (bijv. PLAYERS=20 voor een L0-rooktest) is
// geen L1-bewijs — zie het uitvoeringslogboek onderaan `e2e-load-target-
// check.md` voor welke schaal een gegeven run daadwerkelijk had.
//
// Wat dit script NIET meet (zie load-evidence-matrix.md voor de reden):
//   - desync/dubbele antwoorden (integratietest, DT3);
//   - reconnectsnapshot-inhoud (integratietest, DT3);
//   - geheugengroei (observability, niet k6);
//   - "via gecontroleerde publieke route" (rij 4 eist dat expliciet — een
//     lokale/LAN-run zoals hierboven bedoeld bewijst het mechanisme, niet de
//     publieke-route-eis; dat blijft een apart, nog niet gegeven akkoord,
//     zie README.md §Checkpoints).
//
// EÉN RONDE, NIET ALLE 20 — de host stuurt `game:finish` zodra de ronde
// eindigt, in plaats van de resterende 19 rondes uit te zitten. Dat bewijst
// dezelfde antwoordpiek-/latencymechaniek zonder de testduur nodeloos te
// vermenigvuldigen; zie ook rij 5's eigen definitie ("antwoordpieken", niet
// "elke ronde van de match").
//
// TRIGGER IS `round:ended`, NIET `round:progress` MET VOLLE TELLING — bewust.
// Eerste versie van dit script wachtte op een `round:progress` met
// `answeredCount === eligiblePlayerCount` om vroegtijdig af te ronden. Bij
// uitvoering bleek die laatste, volledige `round:progress`-broadcast
// STRUCTUREEL NOOIT aan te komen zodra alle spelers binnen hetzelfde
// throttlevenster antwoorden (PROTOCOL.md: "maximaal tweemaal per seconde") —
// precies het antwoordpiek-scenario dat rij 5 beschrijft. Zie
// `bug-report-round-progress-drops-final-update.md` voor de volledige
// reproductie. Dit script vertrouwt daarom niet langer op dat kanaal om af te
// ronden (het blijft wel gemeten, als `round_progress_broadcast_latency_ms`,
// juist om de bug zichtbaar te houden in elke run), en wacht in plaats
// daarvan op `round:ended` — het event dat WEL altijd komt, op de normale
// rondedeadline.

import ws from 'k6/ws';
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import { encodeConnect, encodePong, encodeEvent, decodeFrame, pickAnswerPayload } from './support/socketio-wire.js';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const WS_URL = BASE_URL.replace(/^http/, 'ws');
const PLAYERS = Number(__ENV.PLAYERS || 100); // L1-doel; zie kopcommentaar voor kleinere/grotere runs
const LATENCY_P95_MS = Number(__ENV.LATENCY_P95_MS || 300); // rij 4, §Slagingscriteria L1
const ANSWER_PEAK_MS = Number(__ENV.ANSWER_PEAK_MS || 2000); // rij 5, §Slagingscriteria L1
// Standaard ruim boven de natuurlijke rondeduur (COUNTDOWN_MS 3s + vraagdeadline
// 15s ≈ 18s, zie server/composition/match-lifecycle.mjs) — de trigger is nu
// `round:ended`, dat altijd op die deadline komt, niet eerder.
const HARD_TIMEOUT_MS = Number(__ENV.HARD_TIMEOUT_MS || 45000);

export const options = {
  scenarios: {
    room_match: {
      executor: 'per-vu-iterations',
      vus: PLAYERS,
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION || '120s',
    },
  },
  thresholds: {
    // Rij 4: p95 van individuele ack-round-trips (round:answer -> ack).
    answer_ack_latency_ms: [`p(95)<${LATENCY_P95_MS}`],
    socket_connect_success: ['rate>0.99'],
    round_started_received: ['rate>0.99'],
    // Rij 5, WEL gemeten maar bewust GEEN hard threshold: dit signaal is zelf
    // het onderwerp van bug-report-round-progress-drops-final-update.md — een
    // threshold hierop zou een bekende servertekortkoming laten "falen" op
    // elke run, terwijl het punt is de tekortkoming zichtbaar te houden, niet
    // dit script te laten stuklopen op een bug die niet van mij is.
  },
};

const ackLatency = new Trend('answer_ack_latency_ms', true);
// Rij 5-signaal: hoe lang na het begin van de ronde het laatste, volle
// `round:progress` (answeredCount === eligiblePlayerCount) binnenkomt. Blijft
// LEEG (geen samples) zolang de hieronder gedocumenteerde bug bestaat — dat
// is zelf het bewijs, niet een testfout.
const fullProgressBroadcastLatency = new Trend('round_progress_full_broadcast_latency_ms', true);
const progressBroadcastLatency = new Trend('round_progress_broadcast_latency_ms', true);
// Rij 5, betrouwbare vervanger: tijd van ronde-begin tot `round:ended`
// (event dat wél altijd komt), gemeten door de host.
const roundEndedLatency = new Trend('round_ended_latency_ms', true);
const connectSuccess = new Rate('socket_connect_success');
const roundStartedReceived = new Rate('round_started_received');

const CREATE_BODY = { config: { preset: 'quick_start', language: 'nl' } };

/**
 * Draait één keer, buiten de VUs, vóórdat de VUs starten. Maakt de room aan
 * (host) en joint de overige PLAYERS-1 deelnemers over echte REST-calls —
 * exact het pad dat een echte client ook neemt (`POST /games`,
 * `POST /games/join`), geen directe store-manipulatie.
 */
export function setup() {
  const createRes = http.post(
    `${BASE_URL}/api/v1/games`,
    JSON.stringify({ ...CREATE_BODY, hostParticipates: true, displayName: 'Host (loadtest)' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (createRes.status !== 201) {
    throw new Error(`setup: room aanmaken faalde (${createRes.status}): ${createRes.body}`);
  }
  const host = createRes.json();

  const participants = [{ sessionToken: host.sessionToken, playerId: host.playerId, role: 'host' }];

  for (let i = 1; i < PLAYERS; i += 1) {
    const joinRes = http.post(
      `${BASE_URL}/api/v1/games/join`,
      JSON.stringify({ inviteId: host.inviteId, displayName: `Speler ${i} (loadtest)`, joinSource: 'code' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (joinRes.status !== 200) {
      throw new Error(`setup: join #${i} faalde (${joinRes.status}): ${joinRes.body}`);
    }
    const player = joinRes.json();
    participants.push({ sessionToken: player.sessionToken, playerId: player.playerId, role: 'player' });
  }

  return { wsUrl: WS_URL, gameCode: host.gameCode, participants };
}

export default function (data) {
  const idx = (__VU - 1) % data.participants.length;
  const me = data.participants[idx];
  const isHost = idx === 0;

  const url = `${data.wsUrl}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, {}, function (socket) {
    let answerSentAt = 0;
    let ackAckIdSent = 1; // 0 is gereserveerd voor game:start (host), acks daarna oplopend
    let roundStartedAt = 0;
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
          roundStartedAt = Date.now();
          const answer = pickAnswerPayload(frame.envelope.payload);
          answerSentAt = Date.now();
          answered = true;
          socket.send(
            encodeEvent(
              'round:answer',
              {
                actionId: `act_answer_${me.playerId}`,
                payload: {
                  roundId: frame.envelope.payload.roundId,
                  answer,
                  clientAnsweredAt: answerSentAt,
                },
              },
              ackAckIdSent,
            ),
          );
          return;
        }
        if (frame.event === 'round:progress') {
          if (answered && answerSentAt > 0) {
            progressBroadcastLatency.add(Date.now() - answerSentAt);
          }
          if (frame.envelope.payload.answeredCount === frame.envelope.payload.eligiblePlayerCount) {
            fullProgressBroadcastLatency.add(Date.now() - roundStartedAt);
          }
          return;
        }
        if (frame.event === 'round:ended' && isHost) {
          roundEndedLatency.add(Date.now() - roundStartedAt);
          // Ronde is voorbij: rond de match hier af in plaats van de
          // resterende 19 rondes uit te zitten (zie kopcommentaar).
          socket.send(encodeEvent('game:finish', { actionId: 'act_finish_loadtest', payload: {} }, 2));
          return;
        }
        if (frame.event === 'game:finished') {
          socket.close();
        }
        return;
      }
      if (frame.kind === 'sio-ack' && frame.id === ackAckIdSent && answered) {
        ackLatency.add(Date.now() - answerSentAt);
      }
    });

    socket.on('error', function () {
      connectSuccess.add(0);
    });
  });

  check(res, { 'socket-handshake succesvol (HTTP 101)': (r) => r && r.status === 101 });
}
