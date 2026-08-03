// views/flag-renderer.mjs — S09 (Echt of Nep, `real_or_fake_flag`). Tekent
// een `kind: "generated"`-vraag (`shared/content/flag-spec.mjs`'s
// `{pattern, palette}`) op canvas. Poort van de singleplayer-app se
// `generateFakeFlag`/`drawFakeStar` (`app.js`) — dezelfde renderer onder de
// naam `flag-renderer-1` die `PROTOCOL.md` al noemt, niet een nieuwe,
// afwijkende tekenaar voor dezelfde spec. Puur canvas-tekenwerk, geen state.

function drawFakeStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Tekent `spec` (`{pattern, palette}`) op `canvas`. Onbekend `pattern` tekent
 * niets extra's bovenop de basisvulling — geen throw, want een latere
 * uitbreiding van `FLAG_PATTERNS` (shared/content/flag-spec.mjs) mag deze
 * renderer niet laten crashen; hooguit een kalere vlag tonen.
 */
export function renderFlagSpec(canvas, spec) {
  const W = 480;
  const H = 300;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const [c1, c2, c3] = spec.palette;

  ctx.clearRect(0, 0, W, H);

  switch (spec.pattern) {
    case 'hstripes': {
      const cols = [c1, c2, c3 || c1];
      const h = H / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, W, h); });
      break;
    }
    case 'vstripes': {
      const cols = [c1, c2, c3 || c1];
      const w = W / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w, H); });
      break;
    }
    case 'hstripes-star': {
      const cols = [c1, c2, c3 || c1];
      const h = H / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, W, h); });
      drawFakeStar(ctx, W / 2, H / 2, H * 0.17, c3 ? c1 : c2);
      break;
    }
    case 'vstripes-star': {
      const cols = [c1, c2, c3 || c1];
      const w = W / cols.length;
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w, H); });
      drawFakeStar(ctx, W / 2, H / 2, H * 0.17, c3 ? c2 : c1);
      break;
    }
    case 'cross': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c2;
      const cw = W * 0.13;
      ctx.fillRect((W - cw) / 2, 0, cw, H);
      ctx.fillRect(0, (H - cw) / 2, W, cw);
      break;
    }
    case 'nordic': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      const cw = Math.round(W * 0.10);
      const cx = Math.round(W * 0.35);
      ctx.fillStyle = c2;
      ctx.fillRect(cx - cw / 2, 0, cw, H);
      ctx.fillRect(0, (H - cw) / 2, W, cw);
      if (c3) {
        const inner = Math.round(cw * 0.36);
        ctx.fillStyle = c3;
        ctx.fillRect(cx - inner / 2, 0, inner, H);
        ctx.fillRect(0, (H - inner) / 2, W, inner);
      }
      break;
    }
    case 'left-block': {
      ctx.fillStyle = c3 || c2; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c2; ctx.fillRect(0, 0, W * 0.30, H);
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W * 0.15, H);
      break;
    }
    case 'diagonal': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(0, H);
      ctx.closePath(); ctx.fill();
      if (c3) drawFakeStar(ctx, W * 0.38, H * 0.38, H * 0.17, c3);
      break;
    }
    case 'chevron': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H / 2);
      ctx.fillStyle = c2; ctx.fillRect(0, H / 2, W, H / 2);
      if (c3) {
        ctx.fillStyle = c3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(W * 0.40, H / 2); ctx.lineTo(0, H);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'saltire': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      const diag = Math.sqrt(W * W + H * H);
      const cw = W * 0.14;
      const ang = Math.atan2(H, W);
      ctx.fillStyle = c2;
      [ang, -ang].forEach((a) => {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(a);
        ctx.fillRect(-diag / 2, -cw / 2, diag, cw);
        ctx.restore();
      });
      if (c3) {
        const inner = cw * 0.35;
        ctx.fillStyle = c3;
        [ang, -ang].forEach((a) => {
          ctx.save();
          ctx.translate(W / 2, H / 2);
          ctx.rotate(a);
          ctx.fillRect(-diag / 2, -inner / 2, diag, inner);
          ctx.restore();
        });
      }
      break;
    }
    case 'quartered': {
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, W / 2, H / 2);
      ctx.fillRect(W / 2, H / 2, W / 2, H / 2);
      ctx.fillStyle = c2;
      ctx.fillRect(W / 2, 0, W / 2, H / 2);
      ctx.fillRect(0, H / 2, W / 2, H / 2);
      if (c3) {
        const lw = W * 0.025;
        ctx.fillStyle = c3;
        ctx.fillRect((W - lw) / 2, 0, lw, H);
        ctx.fillRect(0, (H - lw) / 2, W, lw);
      }
      break;
    }
    case 'sunburst': {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      const rays = 16;
      const rayLen = Math.max(W, H);
      const wedge = (2 * Math.PI) / rays;
      ctx.fillStyle = c2;
      for (let i = 0; i < rays; i += 2) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rayLen, i * wedge - Math.PI / 2, (i + 1) * wedge - Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = c3 || c1;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, H * 0.22, 0, 2 * Math.PI);
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
      break;
    }
  }
}
