// views/rounda-flag.mjs — de Rounda-Flag warm-up ("Wave Run"), aangeleverd
// door de producteigenaar als standalone HTML (3 aug 2026, "de game is af")
// en hier verbatim geport naar het view-patroon: `createRoundaFlagView({root,
// t})` → `{destroy()}`. Spellogica en tuning zijn van de producteigenaar en
// worden hier NIET aangepast — alleen de verpakking is anders:
//   - geen eigen pagina/telefoonframe: alleen de spelkaart (canvas + score);
//   - kleuren gelijkgetrokken met de 1c-merkloden (lime #d8ff3e i.p.v.
//     #d4ff24, cyaan #4ad2ff, magenta #ff3ea5 — zelfde tinten, merkvast);
//   - listeners/rAF netjes opgeruimd in destroy() (view-patroon);
//   - reduced motion: geen doorlopende attract-animatie — één stilstaand
//     beeld tot de speler zelf start (06 §7-discipline, zelfde lijn als de
//     rad-warm-up);
//   - best-score blijft in localStorage ('rounda-flag-best', ongewijzigd).
// De rad-warm-up (rounda.mjs) blijft bestaan voor de kleine wachtmomenten
// (reconnect/pauze); dit is de lobbygame.

const TAU = Math.PI * 2;
const PLAYER_ANGLE = -Math.PI / 2;
const PLAYER_WIDTH = 22;
const RUNNER_MOTION_SHARE = 0.5;
const WORLD_MOTION_SHARE = 0.5;
const DEMO_BAR_COUNT = 128;
const DEMO_BAR_WIDTH = 3;
const HAZARD_MIN_HEIGHT = 30;
const HAZARD_MAX_HEIGHT = 38;
const HAZARD_WIDTH = 5.67;
const CLOSED_RING = true;

const colors = {
  bg: '#101016',
  lime: '#d8ff3e',
  muted: '#60606d',
  cyan: '#4ad2ff',
  red: '#ff4d67',
};

export function createRoundaFlagView({ root, t = (k) => k }) {
  root.textContent = '';

  const card = document.createElement('div');
  card.className = 'rounda-flag-card';
  const label = document.createElement('span');
  label.className = 'rounda-flag-label';
  label.textContent = 'WARM-UP';
  const scoreEl = document.createElement('span');
  scoreEl.className = 'rounda-flag-score';
  // Feedback 4 aug (punt 11): score en record niet naast elkaar als één
  // "code" — score rechtsboven, record apart, klein en grijs linksonder.
  const recordEl = document.createElement('span');
  recordEl.className = 'rounda-flag-record';
  const canvas = document.createElement('canvas');
  canvas.className = 'rounda-flag-canvas';
  canvas.setAttribute('aria-label', t('rounda.flagAria'));
  const hint = document.createElement('p');
  hint.className = 'rounda-flag-hint';
  card.append(label, scoreEl, recordEl, canvas, hint);
  root.appendChild(card);

  const ctx = canvas.getContext('2d');
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 1;
  let h = 1;
  let dpr = 1;
  let world = { x: 0, y: 0, r: 132 };
  let lastTime = 0;
  let state = 'menu';
  let scroll = 0;
  let speed = 118;
  let jump = 0;
  let jumpV = 0;
  let distance = 0;
  let nextObstacleAt = 440;
  let obstacles = [];
  let hazards = [];
  let nextHazardAt = 0;
  let sparks = [];
  let runTime = 0;
  let shake = 0;
  let flagScore = 0;
  let best = Number(readBest() || 0);
  let upgradedHazards = false;
  let destroyed = false;
  let rafId = null;
  let gameoverAt = 0; // korte tik-cooldown: de dood-tik mag niet meteen herstarten

  renderScore();
  renderHint();

  function readBest() {
    try {
      return window.localStorage?.getItem('rounda-flag-best');
    } catch {
      return 0; // privémodus zonder storage: gewoon zonder record spelen
    }
  }

  function saveBest() {
    try {
      window.localStorage?.setItem('rounda-flag-best', String(best));
    } catch {
      // idem — geen record kunnen bewaren is geen spelfout
    }
  }

  function pad(value) {
    return String(Math.max(0, Math.floor(value))).padStart(3, '0').slice(-3);
  }

  function renderScore() {
    scoreEl.textContent = pad(flagScore);
    recordEl.textContent = best > 0 ? `RECORD ${pad(best)}` : '';
  }

  function renderHint() {
    if (state === 'gameover') {
      hint.textContent = t('rounda.flagOver').replace('{n}', String(flagScore));
      return;
    }
    hint.textContent = state === 'menu' ? t('rounda.flagStart') : t('rounda.flagJump');
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(280, Math.floor(rect.width));
    h = Math.max(240, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    world.r = Math.min(w * 0.204, h * 0.196, 88);
    world.r = Math.max(70, world.r);
    world.x = w * 0.5;
    world.y = h * 0.56;

    if (state !== 'playing') {
      seedPreviewTrack();
      if (reduceMotion) draw(); // stilstaand beeld actueel houden
    }
  }

  function seedPreviewTrack() {
    obstacles = [];
    const spacing = demoBarSpacing();
    for (let i = 0; i < DEMO_BAR_COUNT; i += 1) {
      obstacles.push(createDemoBar(i, i * spacing));
    }
    nextObstacleAt = DEMO_BAR_COUNT * spacing;
  }

  function demoBarSpacing() {
    return (world.r * TAU) / DEMO_BAR_COUNT;
  }

  function resetGame() {
    state = 'playing';
    scroll = 0;
    speed = 118;
    jump = 0;
    jumpV = 0;
    distance = 0;
    flagScore = 0;
    nextObstacleAt = 70;
    obstacles = [];
    hazards = [];
    sparks = [];
    runTime = 0;
    shake = 0;
    upgradedHazards = false;
    renderScore();
    renderHint();
    seedPreviewTrack();
    resetHazardQueue();
  }

  function resetHazardQueue() {
    const circumference = world.r * TAU;
    hazards = [];
    nextHazardAt = circumference * 0.7;
    scheduleHazards();
  }

  function scheduleHazards() {
    const circumference = world.r * TAU;
    const futureHazards = hazards.filter((hazard) => hazard.d - scroll > 0);

    if (futureHazards.length === 0 && nextHazardAt < scroll + circumference * 1.15) {
      hazards.push({
        d: nextHazardAt,
        height: randomHazardHeight(),
        passed: false,
        fade: 0,
      });
      nextHazardAt += circumference * nextHazardGap();
    }
  }

  function randomHazardHeight() {
    return HAZARD_MIN_HEIGHT + Math.random() * (HAZARD_MAX_HEIGHT - HAZARD_MIN_HEIGHT);
  }

  function nextHazardGap() {
    if (!upgradedHazards) return 1;
    return 0.5 + Math.random() * 0.38;
  }

  function createDemoBar(index, atDistance) {
    const wave =
      Math.sin(index * 0.19) * 12 +
      Math.sin(index * 0.47 + 1.6) * 8 +
      Math.sin(index * 1.37) * 4;
    const height = 12 + Math.max(0, wave * 0.65) + ((index * 17) % 6);

    return {
      d: atDistance,
      height: Math.min(30, height),
      width: DEMO_BAR_WIDTH,
      passed: false,
      cap: false,
    };
  }

  function requestJump() {
    if (state === 'menu' || (state === 'gameover' && performance.now() - gameoverAt > 450)) {
      resetGame();
      if (reduceMotion && rafId === null) {
        rafId = requestAnimationFrame(loop); // reduced motion: loop start pas hier
      }
      return;
    }

    if (state !== 'playing') return;
    if (jump < 3) {
      jumpV = 404;
      burst();
    }
  }

  function burst() {
    for (let i = 0; i < 7; i += 1) {
      sparks.push({
        x: runnerPosition().x + (Math.random() - 0.5) * 14,
        y: runnerPosition().y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 62,
        vy: 28 + Math.random() * 38,
        life: 0.22 + Math.random() * 0.24,
        color: Math.random() > 0.5 ? colors.cyan : colors.lime,
      });
    }
  }

  function update(dt) {
    runTime += dt;

    if (state === 'playing') {
      speed += dt * 0.9;
      scroll += speed * dt;
      distance += speed * dt;

      jumpV -= 1270 * dt;
      jump += jumpV * dt;
      if (jump < 0) {
        jump = 0;
        jumpV = 0;
      }

      scheduleHazards();
      for (const hazard of hazards) {
        if (hazard.passed) {
          const away = scroll - hazard.d;
          const fadeDelay = world.r * TAU * 0.12;
          if (away > fadeDelay) hazard.fade = Math.max(0, hazard.fade - dt * 1.25);
        } else hazard.fade = Math.min(1, hazard.fade + dt * 1.8);
      }
      hazards = hazards.filter((hazard) => !hazard.passed || hazard.fade > 0);

      for (const hazard of hazards) {
        if (hazard.passed) continue;
        const offset = hazard.d - scroll;
        const hitWindow = HAZARD_WIDTH * 1.5 + PLAYER_WIDTH * 0.44;
        const cleared = jump > hazard.height * 0.52;
        if (Math.abs(offset) < hitWindow && !cleared) {
          // Vlag geraakt = af (producteigenaar, 3 aug: "niet meer kunnen
          // doodgaan is niet de bedoeling"). Run stopt, score blijft staan,
          // tik start een nieuwe run.
          hazard.passed = true;
          hazard.missed = true;
          shake = 0.3;
          state = 'gameover';
          gameoverAt = performance.now();
          renderHint();
          continue;
        }

        if (!hazard.passed && offset < -hitWindow) {
          hazard.passed = true;
          flagScore += 1;
          if (flagScore > best) {
            best = flagScore;
            saveBest();
          }
          renderScore();
          speed += 7.5;
          if (!upgradedHazards) {
            upgradedHazards = true;
            nextHazardAt = scroll + world.r * TAU * nextHazardGap();
          }
        }
      }
    }

    for (const spark of sparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 78 * dt;
      spark.life -= dt;
    }

    sparks = sparks.filter((spark) => spark.life > 0);
    shake = Math.max(0, shake - dt);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 10);
    }

    // Producteigenaar (3 aug): cirkel, poppetje én vlaggen 20% kleiner.
    // Als één uniforme schaal rond het middelpunt — de physics, timing en
    // botsingen blijven exact gelijk, alleen het beeld krimpt.
    ctx.translate(world.x, world.y);
    ctx.scale(0.8, 0.8);
    ctx.translate(-world.x, -world.y);

    drawObstacles();
    drawHazards();
    drawRunner();
    drawSparks();
    ctx.restore();
  }

  function terrainRadius(angle) {
    return world.r
      + Math.sin(angle * 4.2 + 0.5) * 1.8
      + Math.sin(angle * 9.1 - 0.8) * 1.2;
  }

  function drawObstacles() {
    const circumference = world.r * TAU;
    const worldTravel = scroll * WORLD_MOTION_SHARE;
    for (const obstacle of obstacles) {
      const wrappedDistance = CLOSED_RING
        ? ((obstacle.d - worldTravel) % circumference + circumference) % circumference
        : obstacle.d - worldTravel;
      const angle = PLAYER_ANGLE + wrappedDistance / world.r;
      drawEqualizerObstacle(angle, obstacle);
    }
  }

  function barLiveHeight(obstacle) {
    const phase = obstacle.d / demoBarSpacing();
    const waveTime = runTime * 0.8;
    const beat = (Math.sin(waveTime * 3.1) + 1) * 0.5;
    const rolling =
      Math.sin(phase * 0.32 - waveTime * 2.1) * 0.55 +
      Math.sin(phase * 0.91 + waveTime * 1.35) * 0.3 +
      Math.sin(phase * 1.87 - waveTime * 3.4) * 0.15;
    const peakA = Math.pow(Math.max(0, Math.sin(phase * 0.18 - waveTime * 1.55)), 5) * 32;
    const peakB = Math.pow(Math.max(0, Math.sin(phase * 0.27 + waveTime * 1.15 + 1.7)), 7) * 24;
    const audioLift = Math.pow(Math.max(0, rolling), 1.35) * 28;
    const bassKick = beat > 0.84 ? (beat - 0.84) * 38 : 0;
    return (9 + audioLift + peakA + peakB + bassKick) * 0.4896;
  }

  function drawEqualizerObstacle(angle, obstacle) {
    const base = world.r + 12;
    const inner = base;
    // Producteigenaar: de 20%-verkleining geldt voor cirkel/poppetje/vlaggen,
    // NIET voor de equalizer-uitslag — ×1.25 compenseert de scèneschaal van
    // 0.8, zodat de balken weer hun oorspronkelijke hoogte dansen.
    const liveHeight = barLiveHeight(obstacle) * 1.25;
    const outer = base + liveHeight;
    const x1 = world.x + Math.cos(angle) * inner;
    const y1 = world.y + Math.sin(angle) * inner;
    const x2 = world.x + Math.cos(angle) * outer;
    const y2 = world.y + Math.sin(angle) * outer;

    ctx.save();
    ctx.strokeStyle = 'rgba(216,255,62,0.72)';
    ctx.lineWidth = obstacle.width;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(216,255,62,0.16)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (obstacle.cap) {
      ctx.fillStyle = colors.lime;
      ctx.beginPath();
      ctx.arc(x2, y2, obstacle.width * 0.58, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHazards() {
    const circumference = world.r * TAU;
    const worldTravel = scroll * WORLD_MOTION_SHARE;

    for (const hazard of hazards) {
      const offset = hazard.d - scroll;
      if (!hazard.passed && (offset < -circumference * 0.16 || offset > circumference * 1.05)) continue;

      const angle = PLAYER_ANGLE + (hazard.d - worldTravel) / world.r;
      drawHazardBar(angle, hazard);
    }
  }

  function drawHazardBar(angle, hazard) {
    const inner = world.r + 12;
    const outer = inner + hazard.height;
    const x1 = world.x + Math.cos(angle) * inner;
    const y1 = world.y + Math.sin(angle) * inner;
    const x2 = world.x + Math.cos(angle) * outer;
    const y2 = world.y + Math.sin(angle) * outer;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;
    const flagW = 19.84;
    const flagH = 13.23;

    ctx.save();
    ctx.globalAlpha = hazard.fade ?? 1;
    ctx.strokeStyle = hazard.missed ? 'rgba(255,77,103,0.9)' : colors.lime;
    ctx.lineWidth = HAZARD_WIDTH;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(216,255,62,0.52)';
    ctx.shadowBlur = 13;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = hazard.missed ? 'rgba(255,77,103,0.9)' : colors.lime;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 + tx * flagW - nx * 2, y2 + ty * flagW - ny * 2);
    ctx.lineTo(x2 + tx * flagW - nx * flagH, y2 + ty * flagW - ny * flagH);
    ctx.lineTo(x2 - nx * flagH, y2 - ny * flagH);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(16,16,22,0.58)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x2 + tx * 3 - nx * 2.5, y2 + ty * 3 - ny * 2.5);
    ctx.quadraticCurveTo(
      x2 + tx * 9 - nx * 6,
      y2 + ty * 9 - ny * 6,
      x2 + tx * 14 - nx * 4.5,
      y2 + ty * 14 - ny * 4.5
    );
    ctx.stroke();

    ctx.fillStyle = 'rgba(16,16,22,0.62)';
    ctx.beginPath();
    ctx.arc(x2 + tx * 7 - nx * 6, y2 + ty * 7 - ny * 6, 1.6, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function runnerPosition() {
    const angle = PLAYER_ANGLE + (scroll * RUNNER_MOTION_SHARE) / world.r;
    const radius = terrainRadius(angle) + 38 + jump;
    return {
      angle,
      x: world.x + Math.cos(angle) * radius,
      y: world.y + Math.sin(angle) * radius,
    };
  }

  function drawRunner() {
    const runner = runnerPosition();
    const stride = Math.sin(runTime * (state === 'playing' ? 18 : 6));

    ctx.save();
    ctx.translate(runner.x, runner.y);
    ctx.rotate(runner.angle + Math.PI / 2);

    ctx.shadowColor = 'rgba(74,210,255,0.65)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = colors.cyan;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = colors.cyan;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, 14);
    ctx.lineTo(-14 - stride * 4, 26);
    ctx.moveTo(6, 14);
    ctx.lineTo(15 + stride * 4, 25);
    ctx.stroke();

    ctx.fillStyle = '#101016';
    ctx.beginPath();
    ctx.arc(4, -3, 2.3, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawSparks() {
    for (const spark of sparks) {
      ctx.globalAlpha = Math.max(0, spark.life * 3);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(time) {
    if (destroyed) return;
    const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt);
    draw();
    // Reduced motion: alleen doorlopen zolang er echt gespeeld wordt — de
    // attract-stand is dan een stilstaand beeld (geen ambient animatie).
    if (reduceMotion && state !== 'playing') {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function onKeydown(event) {
    if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]')) {
      return; // nooit het typen in (bv.) het naamveld kapen
    }
    event.preventDefault();
    requestJump();
    renderHint();
  }

  function onPointerDown() {
    requestJump();
    renderHint();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeydown);
  canvas.addEventListener('pointerdown', onPointerDown);
  resize();
  if (reduceMotion) {
    update(0);
    draw();
  } else {
    rafId = requestAnimationFrame(loop);
  }

  return {
    destroy() {
      destroyed = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeydown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      root.textContent = '';
    },
  };
}
