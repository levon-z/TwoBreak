/* Project 03 · TwoBreak: the missing page is made of little squares, and you get to break it.
   Three games: breakout through "404", breakout through "ERROR" (Robo is the O), or shoot a marching 404 apart.
   It plays itself until you move your mouse (or drag a finger) over it; then you take over.
   Used on /play/ and on every 404 page of the site. */
(function () {
  'use strict';
  var GAMES = ['404-breakout', 'error-breakout', '404-invaders'];
  var LINES = {
    '404-breakout': '( THIS PAGE DOESN’T EXIST. PLAY ANYWAY. )',
    'error-breakout': '( BUILD FAILED. ROBO IS ON IT. )',
    '404-invaders': '( THE 404 IS ATTACKING. DEFEND THE PAGE. )'
  };
  var CELL = 12, DOT = 10, SPEED = 10;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function css(name, fallback) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }

  function robo(x, cx, cy, k) {
    x.lineWidth = 20 * k; x.beginPath(); x.arc(cx, cy, 108 * k, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 13 * k; x.beginPath(); x.moveTo(cx, cy - 118 * k); x.lineTo(cx, cy - 156 * k); x.stroke();
    x.beginPath(); x.arc(cx, cy - 172 * k, 20 * k, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.roundRect(cx - 142 * k, cy - 33 * k, 24 * k, 66 * k, 9 * k); x.fill();
    x.beginPath(); x.roundRect(cx + 118 * k, cy - 33 * k, 24 * k, 66 * k, 9 * k); x.fill();
    x.beginPath(); x.roundRect(cx - 86 * k, cy - 58 * k, 172 * k, 92 * k, 44 * k); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 14 * k;
    [cx - 40 * k, cx + 40 * k].forEach(function (ex) {
      x.beginPath(); x.moveTo(ex - 18 * k, cy - 30 * k); x.lineTo(ex + 18 * k, cy + 6 * k);
      x.moveTo(ex + 18 * k, cy - 30 * k); x.lineTo(ex - 18 * k, cy + 6 * k); x.stroke();
    });
    x.strokeStyle = '#000'; x.lineWidth = 10 * k; x.beginPath(); x.arc(cx, cy + 86 * k, 26 * k, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
  }

  function Game(app) {
    var box = app.querySelector('.tb-stagebox'), cv = app.querySelector('.tb-canvas'), g = cv.getContext('2d');
    var win = app.querySelector('.tb-win'), hint = app.querySelector('.tb-hint');
    var chips = Array.prototype.slice.call(app.querySelectorAll('[data-game]'));
    var BG = css('--paper', '#f3efe8'), INK = css('--ink', '#24231f'), RUST = css('--rust', '#a8582a'), MUTED = css('--graphite', '#6d6a62');
    var MONO = '"IBM Plex Mono", Consolas, monospace';
    var W, H, S, game, cols, rows, alive, total, left, balls, bullets, debris, drops, pad, ship, tick, spread, nextDrop, won, cy, F;
    var pointerX = null, lastUser = 0, running = false, visible = true, raf = 0, acc = 0, prev = 0, keys = {};

    function pick() {
      var want = app.getAttribute('data-game') || 'auto';
      if (GAMES.indexOf(want) >= 0) return want;
      var last = null; try { last = localStorage.getItem('tc-twobreak'); } catch (e) {}
      var pool = GAMES.filter(function (x) { return x !== last; });
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function layout() {
      var r = box.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      if (r.width >= r.height) { W = 1600; H = Math.round(1600 * r.height / r.width); } else { W = 900; H = Math.round(900 * r.height / r.width); }
      S = cv.width / W;
    }

    function build() {
      var m = document.createElement('canvas'); m.width = W; m.height = H; var x = m.getContext('2d');
      x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineCap = 'round'; x.textAlign = 'center'; x.textBaseline = 'middle';
      cy = Math.round(H * (W > H ? 0.42 : 0.36));
      if (game === 'error-breakout') {
        F = Math.min(300, (W - 60) / 4.6); var sp = F * 0.82;
        x.font = '900 ' + F + 'px "Arial Black", "Segoe UI Black", sans-serif';
        var xs = [-2.2, -1.2, -0.2, 0.95, 2.1].map(function (v) { return W / 2 + v * sp - sp * 0.05; });
        x.fillText('E', xs[0], cy); x.fillText('R', xs[1], cy); x.fillText('R', xs[2], cy); x.fillText('R', xs[4], cy);
        robo(x, xs[3], cy, F / 300);
      } else {
        F = Math.min(330, (W - 60) / 2.7);
        x.font = '900 ' + F + 'px "Arial Black", "Segoe UI Black", sans-serif';
        x.fillText('4', W / 2 - F * 0.86, cy); x.fillText('4', W / 2 + F * 0.86, cy);
        robo(x, W / 2, cy, F / 330);
      }
      var d = x.getImageData(0, 0, W, H).data;
      cols = Math.floor(W / CELL); rows = Math.floor(H / CELL); alive = new Uint8Array(cols * rows); total = 0;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var i = ((Math.round(r * CELL + CELL / 2)) * W + Math.round(c * CELL + CELL / 2)) * 4;
        if (d[i + 3] > 128 && d[i] < 128) { alive[r * cols + c] = 1; total++; }
      }
      left = total;
    }

    function start(which) {
      game = which || pick();
      try { localStorage.setItem('tc-twobreak', game); } catch (e) {}
      chips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-game') === game)); });
      layout(); build();
      balls = []; bullets = []; debris = []; drops = []; tick = 0; spread = 1; won = false; nextDrop = 90;
      pad = { x: W / 2, w: W > H ? 210 : 190, y: H - (W > H ? 70 : 110) };
      ship = { x: W / 2, y: H - (W > H ? 56 : 90), kick: 0 };
      if (game !== '404-invaders') serve();
      if (win) win.hidden = true;
      draw();
    }

    function serve() { var a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; balls.push({ x: pad.x, y: pad.y - 14, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, tr: [] }); }
    function setSpeed(b) {
      var m = Math.hypot(b.vx, b.vy) || 1; b.vx *= SPEED / m; b.vy *= SPEED / m;
      if (Math.abs(b.vy) < SPEED * 0.32) { b.vy = (b.vy < 0 ? -1 : 1) * SPEED * 0.32; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(SPEED * SPEED - b.vy * b.vy); }
    }
    // the invaders march sideways and slowly come down
    function march() {
      if (game !== '404-invaders') return { x: 0, y: 0 };
      var s = Math.floor(tick / 27), side = [0, 1, 2, 3, 4, 3, 2, 1, 0, -1, -2, -3, -4, -3, -2, -1][s % 16];
      return { x: side * CELL * 2, y: Math.min(8, Math.floor(tick / 96)) * CELL };
    }
    function cellAt(x, y, m) { var c = Math.floor((x - m.x) / CELL), r = Math.floor((y - m.y) / CELL); return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c; }

    function blast(x, y, R, m, vx, vy) {
      for (var yy = y - R; yy <= y + R; yy += CELL) for (var xx = x - R; xx <= x + R; xx += CELL) {
        var i = cellAt(xx, yy, m); if (i < 0 || alive[i] !== 1 || Math.hypot(xx - x, yy - y) > R) continue;
        alive[i] = 2; left--;
        var cx = m.x + (i % cols) * CELL + CELL / 2, cyy = m.y + Math.floor(i / cols) * CELL + CELL / 2;
        debris.push({ x: cx, y: cyy, vx: vx * 0.15 + (Math.random() - 0.5) * 4, vy: vy * 0.1 - Math.random() * 3.5, rot: 0, vr: (Math.random() - 0.5) * 0.25, life: 0 });
        if (total - left >= nextDrop) {
          nextDrop += game === '404-invaders' ? 160 : 130;
          if (game === '404-invaders' ? spread < 5 : balls.length < 16) drops.push({ x: cx, y: cyy, vy: 1, n: game === '404-invaders' ? (spread === 1 ? 3 : 5) : 3 });
        }
      }
    }

    function aiTarget() {
      var best = null, i, b, c;
      if (game === '404-invaders') {
        if (drops.length) return drops[0].x;
        var m = march(), by = -1e9;
        for (c = 0; c < cols; c++) for (var r = rows - 1; r >= 0; r--) if (alive[r * cols + c] === 1) {
          var x = m.x + c * CELL + CELL / 2, sc = r * CELL - Math.abs(x - ship.x) * 0.25; if (sc > by) { by = sc; best = x; } break;
        }
        return best;
      }
      var when = 1e9;
      for (i = 0; i < balls.length; i++) { b = balls[i];
        if (b.vy > 0 && b.y < pad.y) { var k = (pad.y - b.y) / b.vy; if (k < when) { when = k; var px = b.x + b.vx * k; while (px < 10 || px > W - 10) px = px < 10 ? 20 - px : 2 * (W - 10) - px; best = px; } } }
      for (i = 0; i < drops.length; i++) { c = drops[i]; if (c.y < pad.y) { var k2 = (pad.y - c.y) / c.vy; if (k2 < when + 10) { when = k2; best = c.x; } } }
      return best;
    }

    function userPlays() { return pointerX != null && performance.now() - lastUser < 4000; }

    function step() {
      tick++;
      // arrow keys (or A / D) steer, just like the mouse
      var steer = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
      if (steer) { pointerX = (game === '404-invaders' ? ship : pad).x + steer * 40; lastUser = performance.now(); }
      var m = march(), user = userPlays(), target = user ? pointerX : aiTarget();
      var who = game === '404-invaders' ? ship : pad, lim = user ? 60 : 16;
      if (target != null) who.x += Math.max(-lim, Math.min(lim, target - who.x)) * (user ? 0.5 : 1);
      var half = game === '404-invaders' ? 60 : pad.w / 2 + 10;
      who.x = Math.max(half, Math.min(W - half, who.x));
      var i, b, s;
      if (game === '404-invaders') {
        if (!won && tick % 8 === 0 && (user || (target != null && Math.abs(target - ship.x) < 60))) {
          var sp = spread === 1 ? [0] : spread === 3 ? [-0.13, 0, 0.13] : [-0.24, -0.12, 0, 0.12, 0.24];
          sp.forEach(function (a) { bullets.push({ x: ship.x, y: ship.y - 30, vx: Math.sin(a) * 17, vy: -Math.cos(a) * 17 }); });
          ship.kick = 3;
        }
        for (i = 0; i < bullets.length; i++) { b = bullets[i];
          for (s = 0; s < 3 && !b.dead; s++) { b.x += b.vx / 3; b.y += b.vy / 3;
            var ci = cellAt(b.x, b.y, m); if (ci >= 0 && alive[ci] === 1) { b.dead = true; blast(b.x, b.y, 14 + Math.random() * 10, m, 0, -4); } }
          if (b.y < 0 || b.x < 0 || b.x > W) b.dead = true; }
        bullets = bullets.filter(function (x) { return !x.dead; });
        if (ship.kick) ship.kick--;
      } else {
        for (i = 0; i < balls.length; i++) { b = balls[i];
          b.tr.push([b.x, b.y]); if (b.tr.length > 10) b.tr.shift();
          for (s = 0; s < 3; s++) {
            var py = b.y; b.x += b.vx / 3; b.y += b.vy / 3;
            if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx); } if (b.x > W - 10) { b.x = W - 10; b.vx = -Math.abs(b.vx); }
            if (b.y < 10) { b.y = 10; b.vy = Math.abs(b.vy); }
            if (b.vy > 0 && py <= pad.y - 10 && b.y >= pad.y - 10 && Math.abs(b.x - pad.x) < pad.w / 2 + 10) {
              var a = -Math.PI / 2 + (b.x - pad.x) / (pad.w / 2); b.vx = Math.cos(a) * SPEED; b.vy = Math.sin(a) * SPEED; setSpeed(b); b.y = pad.y - 10; }
            var hit = false, fx = false, fy = false;
            for (var yy = b.y - 12; yy <= b.y + 12; yy += 6) for (var xx = b.x - 12; xx <= b.x + 12; xx += 6) {
              var j = cellAt(xx, yy, m); if (j < 0 || alive[j] !== 1) continue;
              var cx = (j % cols) * CELL + CELL / 2, cyy = Math.floor(j / cols) * CELL + CELL / 2;
              if (Math.hypot(Math.max(Math.abs(b.x - cx) - 6, 0), Math.max(Math.abs(b.y - cyy) - 6, 0)) > 10) continue;
              hit = true; blast(cx, cyy, 16 + Math.random() * 8, m, b.vx, b.vy);
              if (Math.abs(b.x - cx) > Math.abs(b.y - cyy)) fx = true; else fy = true;
            }
            if (hit) {
              if (Math.random() < 0.6) { if (fx) b.vx = -b.vx; if (fy) b.vy = -b.vy; }
              var an = Math.atan2(b.vy, b.vx) + (Math.random() - 0.5) * 0.12; b.vx = Math.cos(an) * SPEED; b.vy = Math.sin(an) * SPEED; setSpeed(b);
            }
          }
          // while it plays itself the floor bounces; once you play, a missed ball is gone
          if (b.y > H - 10) { if (user) b.lost = true; else { b.y = H - 10; b.vy = -Math.abs(b.vy); } }
        }
        balls = balls.filter(function (x) { return !x.lost; });
        if (!balls.length && !won) serve();
      }
      for (i = 0; i < drops.length; i++) { var c = drops[i];
        c.y += c.vy; c.vy = Math.min(c.vy + 0.18, 5);
        var catcher = game === '404-invaders' ? { x: ship.x, y: ship.y - 30, w: 120 } : { x: pad.x, y: pad.y, w: pad.w };
        if (!c.caught && c.y + 15 >= catcher.y && c.y - 15 <= catcher.y + 16 && Math.abs(c.x - catcher.x) < catcher.w / 2 + 26) {
          c.caught = true;
          if (game === '404-invaders') spread = c.n;
          else { var add = [];
            balls.slice(0, Math.max(0, Math.floor((16 - balls.length) / 2))).forEach(function (bb) { [-0.45, 0.45].forEach(function (da) {
              var aa = Math.atan2(bb.vy, bb.vx) + da; add.push({ x: bb.x, y: bb.y, vx: Math.cos(aa) * SPEED, vy: Math.sin(aa) * SPEED, tr: [] }); }); });
            balls = balls.concat(add); }
        }
      }
      drops = drops.filter(function (x) { return !x.caught && x.y < H + 40; });
      for (i = 0; i < debris.length; i++) { var dd = debris[i]; dd.x += dd.vx; dd.y += dd.vy; dd.vy += 0.35; dd.vx *= 0.995; dd.rot += dd.vr; dd.life++; }
      debris = debris.filter(function (x) { return x.y < H + 30 && x.life < 140; });
      if (!won && left <= Math.max(3, total * 0.004)) { won = true; if (win) win.hidden = false; }
    }

    function draw() {
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = BG; g.fillRect(0, 0, cv.width, cv.height);
      g.setTransform(S, 0, 0, S, 0, 0);
      var m = march(), fade = won ? 0.12 : 1, i;
      g.globalAlpha = fade; g.fillStyle = INK;
      for (i = 0; i < alive.length; i++) if (alive[i] === 1) g.fillRect(m.x + (i % cols) * CELL + 1, m.y + Math.floor(i / cols) * CELL + 1, DOT, DOT);
      g.font = '500 ' + (W > H ? 22 : 21) + 'px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
      var line = LINES[game], subY = game === '404-invaders' ? cy - F * 0.82 : cy + F * 0.7;
      if (W > H) g.fillText(line, W / 2, subY);
      else { var k = line.indexOf('. '); g.fillText(line.slice(0, k + 1), W / 2, subY); g.fillText(line.slice(k + 2), W / 2, subY + 32); }
      for (i = 0; i < debris.length; i++) { var d = debris[i]; g.globalAlpha = fade * Math.max(0, 1 - d.life / 110);
        g.save(); g.translate(d.x, d.y); g.rotate(d.rot); g.fillRect(-5, -5, 10, 10); g.restore(); }
      g.globalAlpha = fade;
      for (i = 0; i < drops.length; i++) { var c = drops[i]; g.fillStyle = RUST; g.beginPath(); g.roundRect(c.x - 28, c.y - 16, 56, 32, 6); g.fill();
        g.fillStyle = BG; g.font = '500 19px ' + MONO; g.fillText('×' + c.n, c.x, c.y + 1); }
      g.fillStyle = INK;
      if (game === '404-invaders') {
        for (i = 0; i < bullets.length; i++) { var b = bullets[i]; g.fillStyle = INK; g.fillRect(b.x - 3, b.y - 12, 6, 24); g.globalAlpha = fade * 0.12; g.fillRect(b.x - 3, b.y + 12, 6, 26); g.globalAlpha = fade; }
        g.fillStyle = INK;
        ['....X....', '....X....', '..XXXXX..', '.X.....X.', 'XX.X.X.XX', '.X.....X.', '..XXXXX..'].forEach(function (row, r) {
          for (var cc = 0; cc < row.length; cc++) if (row[cc] === 'X') {
            if (r === 0) g.fillStyle = RUST; g.fillRect(ship.x - 54 + cc * CELL + 1, ship.y - 42 + r * CELL + 1 + (ship.kick ? 3 : 0), DOT, DOT); g.fillStyle = INK; } });
      } else {
        g.lineCap = 'round';
        for (i = 0; i < balls.length; i++) { var bl = balls[i], tr = bl.tr.concat([[bl.x, bl.y]]);
          for (var t = 1; t < tr.length; t++) { g.globalAlpha = fade * (0.05 + 0.09 * t / tr.length); g.strokeStyle = INK; g.lineWidth = 20 * t / tr.length;
            g.beginPath(); g.moveTo(tr[t - 1][0], tr[t - 1][1]); g.lineTo(tr[t][0], tr[t][1]); g.stroke(); }
          g.globalAlpha = fade; g.fillStyle = INK; g.beginPath(); g.arc(bl.x, bl.y, 10, 0, Math.PI * 2); g.fill(); }
        g.beginPath(); g.roundRect(pad.x - pad.w / 2, pad.y, pad.w, 16, 8); g.fill();
      }
      g.globalAlpha = 1;
      if (hint) hint.classList.toggle('tb-hint-gone', pointerX != null || won);
    }

    // a fixed 60 Hz game, drawn on every animation frame, only while it is on screen
    function loop(now) {
      raf = 0; if (!running || !visible) return;
      acc += Math.min(100, now - prev); prev = now;
      while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
      draw(); raf = requestAnimationFrame(loop);
    }
    function go() { if (!raf && running && visible) { prev = performance.now(); raf = requestAnimationFrame(loop); } }

    function toLogical(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
    function take(e) { pointerX = toLogical(e); lastUser = performance.now(); if (!running) { running = true; go(); } }
    cv.addEventListener('pointermove', take);
    cv.addEventListener('pointerdown', function (e) { take(e); if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); });
    // keys work when the game has focus, or when it fills the middle of the screen and you are not typing somewhere
    var KEYS = { arrowleft: 1, arrowright: 1, a: 1, d: 1 };
    function inView() { var r = box.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4; }
    window.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase(), t = e.target;
      if (!KEYS[k] || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.activeElement !== cv && !inView()) return;
      e.preventDefault(); keys[k] = true; lastUser = performance.now();
      if (!running) { running = true; go(); }
    });
    window.addEventListener('keyup', function (e) { delete keys[(e.key || '').toLowerCase()]; });
    window.addEventListener('blur', function () { keys = {}; });
    chips.forEach(function (b) { b.addEventListener('click', function () { start(b.getAttribute('data-game')); running = true; go(); }); });
    Array.prototype.slice.call(app.querySelectorAll('.tb-again')).forEach(function (b) { b.addEventListener('click', function () { start(game); running = true; go(); }); });
    var rt = 0; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { start(game); }, 150); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; go(); }).observe(box);

    start();
    // with "reduce motion" it waits for you; otherwise it starts playing itself
    running = !reduce; go();
  }

  function boot() { Array.prototype.slice.call(document.querySelectorAll('.tb-app')).forEach(function (el) { Game(el); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
