/**
 * ascii-dither-motion.js — Hero structural dither animation
 * V4: Sparse high-res dither forming RECOGNIZABLE OBJECTS.
 * 3 modes: Face/Profile, Neural Topology, Circuit Architecture.
 * Floyd-Steinberg-inspired sparse dither for photorealistic ASCII effect.
 * 
 * 100×36 character grid, 8×14px per char, ~5-8% fill.
 */
(function () {
  var W = 100;       // character columns
  var H = 36;        // character rows
  var CPX = 8;       // pixels per char X
  var CPY = 14;      // pixels per char Y
  var CANVAS_W = W * CPX;   // 800
  var CANVAS_H = H * CPY;   // 504

  var CHAR_SET = ' .:-=+*#%@█▓▒░';
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  var canvas, ctx;
  var time = 0;
  var mode = 0;
  var modeTimer = 0;
  var modeNames = ['PORTRAIT', 'NEURAL TOPOLOGY', 'CIRCUIT'];

  function initAsciiDitherMotion(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.id = 'ascii-dither-canvas';
    canvas.style.cssText = [
      'width:100%;max-width:800px;',
      'image-rendering:pixelated;',
      'background:#0a0e15;',
      'border:1px solid #1a2530;',
      'border-radius:10px;',
      'display:block;margin:0 auto;',
      'box-shadow:0 0 60px rgba(0,180,148,0.08), 0 0 140px rgba(0,180,148,0.03);'
    ].join('');
    container.appendChild(canvas);

    ctx = canvas.getContext('2d', { alpha: false });
    setTimeout(function () { time = Math.random() * 10; draw(); }, 120);
  }

  // ─── DENSITY FIELDS ──────────────────────────────────────

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  /** Circle density: 1 at center, falling off to 0 at radius */
  function circle(x, y, cx, cy, r) {
    var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    return d < r ? clamp(1 - d / r) : 0;
  }

  /** Soft circle with falloff */
  function softCircle(x, y, cx, cy, r, hardness) {
    var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    if (d > r * 1.3) return 0;
    var t = d / r;
    return clamp(Math.exp(-t * t * (hardness || 4)) * 0.85);
  }

  /** Line segment density */
  function line(x, y, x1, y1, x2, y2, width) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return circle(x, y, x1, y1, width);
    var t = clamp(((x - x1) * dx + (y - y1) * dy) / (len * len));
    var px = x1 + t * dx, py = y1 + t * dy;
    var d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
    return d < width ? clamp(1 - d / width) : 0;
  }

  /** Ellipse density */
  function ellipse(x, y, cx, cy, rx, ry) {
    var dx = (x - cx) / rx, dy = (y - cy) / ry;
    var d = Math.sqrt(dx * dx + dy * dy);
    return d < 1 ? clamp(1 - d) : 0;
  }

  // ─── MODE 0: PORTRAIT (abstract face profile facing right) ─
  function densityPortrait(x, y) {
    var v = 0;
    var cx = W / 2 - 2;
    var cy = H / 2 + 1;

    // Head oval
    v += ellipse(x, y, cx - 4, cy, 16, 22) * 0.65;

    // Forehead dome
    v += softCircle(x, y, cx - 4, cy - 12, 11, 3) * 0.5;

    // Eye socket (dense)
    v += softCircle(x, y, cx + 2, cy - 6, 3.5, 6) * 0.75;
    // Eye pupil (very dense highlight)
    v += circle(x, y, cx + 3, cy - 6, 1.2) * 0.9;

    // Nose bridge
    v += line(x, y, cx + 6, cy - 10, cx + 8, cy + 1, 1.0) * 0.5;
    // Nose tip
    v += circle(x, y, cx + 9, cy + 2, 2.0) * 0.55;

    // Mouth line
    v += line(x, y, cx + 5, cy + 8, cx + 9, cy + 7, 0.8) * 0.5;

    // Jaw contour
    v += line(x, y, cx + 8, cy + 5, cx + 3, cy + 14, 0.9) * 0.45;
    v += line(x, y, cx + 3, cy + 14, cx - 6, cy + 12, 0.9) * 0.4;

    // Chin
    v += softCircle(x, y, cx - 2, cy + 16, 4, 3) * 0.4;

    // Cheekbone highlight
    v += softCircle(x, y, cx - 1, cy + 1, 6, 4) * 0.25;

    // Neck
    v += line(x, y, cx - 4, cy + 17, cx - 4, cy + 26, 2.5) * 0.35;

    return clamp(v);
  }

  // ─── MODE 1: NEURAL NETWORK TOPOLOGY ────────────────────
  function densityNeural(x, y) {
    var v = 0;
    var layers = 5;
    var nodesPerLayer = [5, 7, 8, 6, 4];

    // Pre-compute node positions
    var nodes = [];
    for (var l = 0; l < layers; l++) {
      var lx = 12 + l * 19;
      var nCount = nodesPerLayer[l];
      for (var n = 0; n < nCount; n++) {
        var ny = H / 2 - (nCount - 1) * 4.5 / 2 + n * 4.5;
        nodes.push({ x: lx, y: ny, layer: l });
      }
    }

    // Draw nodes
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      // Pulse activation
      var activation = 0;
      var wavePos = (time * 2.2 + node.layer * 0.6) % (layers + 2);
      if (Math.abs(wavePos - node.layer) < 1.0) {
        activation = (1 - Math.abs(wavePos - node.layer)) * 0.7;
      }
      v += softCircle(x, y, node.x, node.y, 2.2, 5) * (0.55 + activation);
    }

    // Draw connections (sparse lines between adjacent layers)
    var drawnConns = 0;
    for (var l = 0; l < layers - 1; l++) {
      var srcNodes = nodes.filter(function (n) { return n.layer === l; });
      var dstNodes = nodes.filter(function (n) { return n.layer === l + 1; });
      for (var si = 0; si < srcNodes.length; si++) {
        for (var di = 0; di < dstNodes.length; di++) {
          // Only draw ~40% of connections (sparse)
          var hash = (si * 7 + di * 13 + l * 31) % 10;
          if (hash > 3) continue;
          drawnConns++;
          // Activation pulse on connection
          var waveOnConn = (time * 2.2 + l * 0.6) % (layers + 1);
          var connActivation = (Math.abs(waveOnConn - l) < 0.8) ? 0.3 : 0;
          v += line(x, y, srcNodes[si].x, srcNodes[si].y, dstNodes[di].x, dstNodes[di].y, 0.6) * (0.35 + connActivation);
        }
      }
    }

    return clamp(v);
  }

  // ─── MODE 2: CIRCUIT ARCHITECTURE ────────────────────────
  function densityCircuit(x, y) {
    var v = 0;
    var cx = W / 2;
    var cy = H / 2;

    // Main IC block (center rectangle)
    var icLeft = cx - 10, icRight = cx + 10;
    var icTop = cy - 8, icBottom = cy + 8;
    if (x > icLeft && x < icRight && y > icTop && y < icBottom) {
      // IC body outline
      var edgeDist = Math.min(x - icLeft, icRight - x, y - icTop, icBottom - y);
      if (edgeDist < 1.5) {
        v += clamp(1 - edgeDist / 1.5) * 0.65;
      }
      // Internal texture (faint grid)
      var gridX = Math.abs((x - icLeft) % 5 - 2.5);
      var gridY = Math.abs((y - icTop) % 5 - 2.5);
      if (gridX < 0.5 && gridY < 0.5) {
        v += 0.2;
      }
    }

    // Pins coming out of IC (top and bottom)
    for (var p = 0; p < 8; p++) {
      var px = icLeft + 2.5 + p * 2.8;
      // Top pins
      v += line(x, y, px, icTop, px, icTop - 5, 0.7) * 0.55;
      v += circle(x, y, px, icTop - 5.5, 1.2) * 0.7;
      // Bottom pins
      var bpx = icLeft + 2.5 + p * 2.8;
      v += line(x, y, bpx, icBottom, bpx, icBottom + 5, 0.7) * 0.55;
      v += circle(x, y, bpx, icBottom + 5.5, 1.2) * 0.7;
    }

    // Horizontal bus traces
    for (var t = 0; t < 3; t++) {
      var ty = cy - 14 + t * 6;
      v += line(x, y, 3, ty, cx - 14, ty, 0.5) * 0.4;
      v += line(x, y, cx + 14, ty, W - 3, ty, 0.5) * 0.4;
    }

    // Corner routing (45° traces from IC to bus)
    for (var r = 0; r < 2; r++) {
      var sign = r === 0 ? -1 : 1;
      var sx = cx + sign * 15;
      var sy = cy - 12;
      var ex = cx + sign * 25;
      var ey = cy - 20;
      // 45° routing: first horizontal then diagonal
      v += line(x, y, sx, sy, sx, sy - 3, 0.5) * 0.4;
      v += line(x, y, sx, sy - 3, ex, ey, 0.5) * 0.4;
      v += line(x, y, ex, ey, ex, ey - 4, 0.5) * 0.4;
    }

    // Via pads (small circles on traces)
    var vias = [
      [8, cy - 14], [8, cy - 8], [8, cy - 2],
      [W - 8, cy - 14], [W - 8, cy - 8], [W - 8, cy - 2],
      [cx - 14, cy + 16], [cx + 14, cy + 16]
    ];
    for (var vi = 0; vi < vias.length; vi++) {
      v += circle(x, y, vias[vi][0], vias[vi][1], 1.4) * 0.6;
    }

    return clamp(v);
  }

  // ─── DENSITY DISPATCH ────────────────────────────────────
  function getDensity(x, y) {
    if (mode === 0) return densityPortrait(x, y);
    if (mode === 1) return densityNeural(x, y);
    return densityCircuit(x, y);
  }

  // ─── RENDER ──────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = '#0a0e15';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle atmospheric background
    var imageData = ctx.createImageData(CANVAS_W, CANVAS_H);
    var data = imageData.data;
    for (var py = 0; py < CANVAS_H; py += 3) {
      var y = Math.floor(py / CPY);
      for (var px = 0; px < CANVAS_W; px += 3) {
        var x = Math.floor(px / CPX);
        var d = getDensity(x, y);
        var gray = Math.floor(Math.max(6, Math.min(255, d * 120)));
        var i = (py * CANVAS_W + px) * 4;
        data[i] = gray * 0.06;
        data[i + 1] = gray * 0.15;
        data[i + 2] = gray * 0.18;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Sparse character overlay — Bayer dither with high threshold
    ctx.font = (CPY - 2) + 'px "JetBrains Mono", "Fira Code", "Courier New", monospace';
    ctx.textBaseline = 'top';

    var drawn = 0;

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var d = getDensity(x, y);

        // High-pass filter: only draw where density exceeds threshold
        var bayerVal = BAYER[y % 4][x % 4] / 16;
        var threshold = 0.52 + bayerVal * 0.20;

        if (d < threshold) continue;

        var idx = Math.floor((d - threshold) / (1 - threshold) * (CHAR_SET.length - 1));
        idx = Math.max(1, Math.min(CHAR_SET.length - 1, idx));
        var char = CHAR_SET[idx];

        // Color: brighter teal for denser areas
        var lum = d;
        var r = 0;
        var g = Math.floor(90 + lum * 155);
        var bVal = Math.floor(80 + lum * 165);
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bVal + ')';

        ctx.fillText(char, x * CPX, y * CPY);
        drawn++;
      }
    }

    // Mode label
    ctx.fillStyle = 'rgba(0,180,148,0.45)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillText(modeNames[mode], CPX, CANVAS_H - CPY / 2);

    // Time + mode cycling
    time += 0.018;
    modeTimer++;
    if (modeTimer > 450) {
      mode = (mode + 1) % 3;
      modeTimer = 0;
    }

    requestAnimationFrame(draw);
  }

  window.initAsciiDitherMotion = initAsciiDitherMotion;
})();
