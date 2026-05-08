/**
 * ascii-bg.js — Flower blooming in photorealistic shaded ASCII dither
 * V6: Single smooth visual flow — a flower blooming, living in the background canvas.
 * 8-petal flower, stem, leaves, floating pollen. Subtle teal, no glow.
 * High particle density for shaded photorealistic dither effect.
 *
 * The entire visual experience lives here. No separate hero panel needed.
 */
(function () {
  var CHAR_SET = ' .:-=+*#%@█▓▒░';
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  var CELL_W = 6;
  var CELL_H = 11;

  var canvas, ctx;
  var cols, rows, width, height;
  var time = 0;
  var mouseX = -100, mouseY = -100;
  var targetMouseX = -100, targetMouseY = -100;
  var animId;

  // Pollen particles
  var pollen = [];

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    canvas.style.cssText = [
      'position:fixed;top:0;left:0;width:100vw;height:100vh;',
      'z-index:0;pointer-events:none;opacity:0.72;',
      'background:#08090d;image-rendering:auto;'
    ].join('');
    document.body.prepend(canvas);

    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', function () {
      targetMouseX = -100; targetMouseY = -100;
    });

    // Seed pollen
    for (var i = 0; i < 40; i++) {
      pollen.push({
        x: (0.3 + Math.random() * 0.4) * 0, // will be set per frame
        y: 0,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.5,
        life: Math.random(),
        char: CHAR_SET[1 + Math.floor(Math.random() * 4)]
      });
    }

    // Seed initial time for a nice bloom state on load
    time = 55; // near full bloom
    animate();
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(width / CELL_W);
    rows = Math.floor(height / CELL_H);
  }

  function onMouseMove(e) {
    targetMouseX = e.clientX / CELL_W;
    targetMouseY = e.clientY / CELL_H;
  }

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  function circle(x, y, cx, cy, r) {
    var d = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
    return d < r ? clamp(1 - d/r) : 0;
  }

  function line(x, y, x1, y1, x2, y2, w) {
    var dx = x2-x1, dy = y2-y1;
    var len = Math.sqrt(dx*dx+dy*dy);
    if (len < 0.01) return circle(x,y,x1,y1,w);
    var t = clamp(((x-x1)*dx + (y-y1)*dy) / (len*len));
    var px = x1 + t*dx, py = y1 + t*dy;
    var d = Math.sqrt((x-px)*(x-px) + (y-py)*(y-py));
    return d < w ? clamp(1 - d/w) : 0;
  }

  function softCircle(x, y, cx, cy, r, hard) {
    var d = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
    if (d > r * 1.4) return 0;
    var t = d / r;
    return clamp(Math.exp(-t * t * (hard || 3)) * 0.8);
  }

  // ─── FLOWER ──────────────────────────────────────────────

  /**
   * Full flower density field — petals, center, stem, leaves, ground.
   * bloom: 0 (closed bud) → 1 (fully open).
   * sway: gentle horizontal offset from wind.
   */
  function flowerDensity(x, y, bloom, sway) {
    var v = 0;
    var N = 8;

    // Flower position — lower-center of screen
    var fx = cols / 2 + sway;
    var fy = rows * 0.42; // upper half

    var petalLen = 4 + bloom * 17;
    var petalWid = 0.8 + bloom * 2.8;
    var spreadAngle = (1 - bloom) * 0.70; // tight when closed, wide when open

    // ── Petals ──
    for (var i = 0; i < N; i++) {
      var baseAngle = -Math.PI / 2 + (i / N) * Math.PI * 2; // top petal first
      var angle = baseAngle + (i - N/2) * spreadAngle * 0.15;

      // Petal ellipse center (offset outward from flower center)
      var pcx = fx + Math.cos(angle) * petalLen * 0.35;
      var pcy = fy + Math.sin(angle) * petalLen * 0.35;
      var prx = petalLen * 0.52;
      var pry = petalWid;

      // Rotate into petal local coords
      var dx = x - pcx;
      var dy = y - pcy;
      var cosA = Math.cos(-angle);
      var sinA = Math.sin(-angle);
      var lx = dx * cosA - dy * sinA; // along petal length
      var ly = dx * sinA + dy * cosA; // across petal width

      var ed = Math.sqrt((lx*lx)/(prx*prx) + (ly*ly)/(pry*pry));
      if (ed < 1.05) {
        // 3D shading: brighter toward tip (+lx), darker at base (-lx)
        // Also darker at edges (|ly| large)
        var tipShade = clamp((lx / prx + 0.8) * 0.65); // 0.15 at base, 0.85 at tip
        var edgeShade = 1 - Math.abs(ly) / pry * 0.4; // 0.6 at edge, 1.0 at center
        var shade = tipShade * edgeShade;
        var falloff = ed < 1 ? (1 - ed) : (1 - (ed - 1) / 0.05) * 0.3;
        v += Math.max(0, falloff * shade * 0.95);
      }
    }

    // ── Flower center (dense, darker) ──
    var centerR = 1.5 + bloom * 2.0;
    v += circle(x, y, fx, fy, centerR) * 0.65;

    // Inner ring (slightly brighter)
    v += circle(x, y, fx, fy, centerR * 0.55) * 0.30;

    // ── Stem ──
    var stemTop = fy + centerR + 1;
    var stemLen = 18 + bloom * 6;
    var stemBot = stemTop + stemLen;
    // Gentle curve
    var stemMidX = fx + sway * 0.4;
    v += line(x, y, fx, stemTop, stemMidX, stemTop + stemLen * 0.5, 1.2) * 0.45;
    v += line(x, y, stemMidX, stemTop + stemLen * 0.5, fx + sway * 0.6, stemBot, 1.1) * 0.42;

    // ── Leaves ──
    for (var l = 0; l < 2; l++) {
      var ly = stemTop + 4 + l * 7;
      var sign = l === 0 ? 1 : -1;
      var leafCx = fx + sway * 0.3 + sign * 5;
      var leafCy = ly;
      var leafRx = 5.5;
      var leafRy = 1.8;
      var leafAngle = sign * 0.6;

      var ldx = x - leafCx;
      var ldy = y - leafCy;
      var lcos = Math.cos(-leafAngle);
      var lsin = Math.sin(-leafAngle);
      var llx = ldx * lcos - ldy * lsin;
      var lly = ldx * lsin + ldy * lcos;

      var led = Math.sqrt((llx*llx)/(leafRx*leafRx) + (lly*lly)/(leafRy*leafRy));
      if (led < 1) {
        // Leaf vein — brighter center line
        var veinBoost = Math.abs(lly) < 0.7 ? 0.5 : 0;
        v += (1 - led) * (0.35 + veinBoost) * 0.9;
      }
    }

    // ── Ground ──
    var groundY = stemBot + 2;
    if (Math.abs(y - groundY) < 1.8) {
      v += (1 - Math.abs(y - groundY) / 1.8) * 0.22;
    }
    // Ground texture dots
    for (var g = 0; g < 6; g++) {
      var gx = fx - 15 + g * 6 + Math.sin(g * 1.7) * 3;
      v += softCircle(x, y, gx, groundY + 1, 2.5, 2) * 0.18;
    }

    return clamp(v);
  }

  // ─── POLLEN ──────────────────────────────────────────────

  function updatePollen(bloom, sway) {
    var fx = cols / 2 + sway;
    var fy = rows * 0.42;

    for (var i = 0; i < pollen.length; i++) {
      var p = pollen[i];
      p.life -= 0.003;
      p.x += p.vx;
      p.y += p.vy;
      p.vx += (Math.random() - 0.5) * 0.04;
      p.vy += -0.003; // slight upward buoyancy

      // Wind sway
      p.vx += 0.001 * (sway / 3);

      if (p.life <= 0 || p.y < -5 || p.y > rows + 5 || p.x < -5 || p.x > cols + 5) {
        // Respawn near flower
        p.x = fx + (Math.random() - 0.5) * 8;
        p.y = fy + (Math.random() - 0.5) * 6;
        p.vx = (Math.random() - 0.5) * 0.3 + 0.002 * sway;
        p.vy = -0.15 - Math.random() * 0.5;
        p.life = 0.5 + Math.random() * 0.8;
        p.char = CHAR_SET[1 + Math.floor(Math.random() * 3)];
      }
    }
  }

  // ─── AMBIENT BACKGROUND ──────────────────────────────────

  /**
   * Subtle environmental texture — soft ground, faint atmosphere,
   * gentle vignette. No competing structures — the flower is the star.
   */
  function ambientDensity(x, y) {
    var v = 0;
    var mx = cols / 2;
    var my = rows / 2;

    // Very faint ground gradient
    var groundLevel = rows * 0.72;
    if (y > groundLevel - 8 && y < groundLevel + 4) {
      var gd = (y - groundLevel) / 8;
      v += Math.exp(-gd * gd * 2) * 0.12;
    }

    // Faint atmospheric haze — slightly brighter in center
    var dxc = x - mx;
    var dyco = y - my;
    var dc = Math.sqrt(dxc*dxc + dyco*dyco);
    v += Math.exp(-dc / 30) * 0.08;

    // Faint vertical light rays from flower
    var fx = mx;
    var fy = rows * 0.42;
    var fdx = Math.abs(x - fx);
    if (y < fy && fdx < 8) {
      v += (1 - fdx/8) * (1 - y/fy) * 0.10;
    }

    return clamp(v);
  }

  // ─── RENDER ──────────────────────────────────────────────

  function draw() {
    mouseX += (targetMouseX - mouseX) * 0.10;
    mouseY += (targetMouseY - mouseY) * 0.10;

    // Bloom cycle: slow sine wave, ~12s per cycle
    var bloomRaw = Math.sin(time * 0.085) * 0.5 + 0.5;
    // Smooth easing — spend more time fully open
    var bloom = bloomRaw < 0.5
      ? 2 * bloomRaw * bloomRaw
      : 1 - Math.pow(-2 * bloomRaw + 2, 2) / 2;

    // Gentle sway
    var sway = Math.sin(time * 0.12) * 2.5 + Math.sin(time * 0.07) * 1.5;

    updatePollen(bloom, sway);

    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, width, height);

    ctx.font = (CELL_H - 1) + 'px "JetBrains Mono", "Fira Code", "Courier New", monospace';
    ctx.textBaseline = 'top';

    for (var y = 0; y < rows; y++) {
      var py = y * CELL_H;
      for (var x = 0; x < cols; x++) {
        // Combine flower + ambient densities
        var fd = flowerDensity(x, y, bloom, sway);
        var ad = ambientDensity(x, y);
        var d = Math.max(fd, ad * 0.6);

        // Pollen contribution
        for (var pi = 0; pi < pollen.length; pi++) {
          var p = pollen[pi];
          var pdx = x - p.x;
          var pdy = y - p.y;
          var pdist = Math.sqrt(pdx*pdx + pdy*pdy);
          if (pdist < 2.5) {
            d += (1 - pdist/2.5) * p.life * 0.5;
          }
        }

        // Edge vignette
        var edgeDist = Math.min(x, y, cols - x - 1, rows - y - 1);
        var vignette = Math.min(1, edgeDist / 5);
        d *= 0.5 + vignette * 0.5;

        // Bayer dither — lower threshold = more particles = richer shading
        var bayerVal = BAYER[y % 4][x % 4] / 16;
        var threshold = 0.22 + bayerVal * 0.09;
        var dithered = d + (bayerVal - 0.5) * 0.16;

        if (dithered < threshold) continue;

        var range = 1 - threshold;
        var t = (dithered - threshold) / range;
        var idx = Math.floor(t * (CHAR_SET.length - 1));
        idx = Math.max(1, Math.min(CHAR_SET.length - 1, idx));
        var char = CHAR_SET[idx];

        // Subtle teal color — muted, no glow
        var hue = 170;
        var sat = 22 + t * 18;    // 22-40% saturation
        var light = 15 + t * 12;  // 15-27% lightness

        // Cursor proximity — subtle brightening
        var mdx = x - mouseX;
        var mdy = y - mouseY;
        var cursorDist = Math.sqrt(mdx*mdx + mdy*mdy);
        var cursorBoost = cursorDist < 10 ? (1 - cursorDist/10) * 10 : 0;

        ctx.fillStyle = 'hsl(' + hue + ', ' + sat + '%, ' + (light + cursorBoost) + '%)';
        ctx.fillText(char, x * CELL_W, py);
      }
    }

    time += 0.018;
    animId = requestAnimationFrame(draw);
  }

  function animate() {
    animId = requestAnimationFrame(draw);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
