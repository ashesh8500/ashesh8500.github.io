/**
 * ascii-bg.js — Full-page structural ASCII dither background
 * V5: Large-scale hex lattice, neural pathways, concentric rings.
 * High signal at structure points, near-zero background. Clean sparse dither.
 */
(function () {
  var CHAR_SET = ' .:-=+*#%@█▓▒░';
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  var CELL_W = 7;
  var CELL_H = 12;

  var canvas, ctx;
  var cols, rows, width, height;
  var time = 0;
  var mouseX = -100, mouseY = -100;
  var targetMouseX = -100, targetMouseY = -100;
  var animId;

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    canvas.style.cssText = [
      'position:fixed;top:0;left:0;width:100vw;height:100vh;',
      'z-index:0;pointer-events:none;opacity:0.58;',
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

  function density(x, y) {
    var mx = cols / 2;
    var my = rows / 2;
    var v = 0;

    // --- LARGE HEXAGONAL LATTICE (4-5 across) ---
    var hexW = cols / 5.0;
    var hexH = hexW * 0.87;
    var hy = Math.round(y / hexH);
    var hx = Math.round((x - (hy % 2) * hexW * 0.5) / hexW);
    var hcx = hx * hexW + (hy % 2) * hexW * 0.5;
    var hcy = hy * hexH;
    var hdx = x - hcx;
    var hdy = y - hcy;
    var hdist = Math.sqrt(hdx*hdx + hdy*hdy);
    var hr = hexW * 0.42;

    // Bright node at center
    if (hdist < hr * 0.32) v += 0.75;
    // Faint ring around node
    if (hdist > hr * 0.55 && hdist < hr * 1.05) v += 0.30;

    // --- NEURAL PATHWAYS (sweeping sine waves) ---
    for (var p = 0; p < 5; p++) {
      var baseY = my - 12 + p * 6;
      var sweep = Math.sin((x / cols) * Math.PI * 3.5 + time * 0.10 + p) * 10;
      var py = baseY + sweep;
      v += line(x, y, 0, py, cols, py, 2.2) * 0.55;
    }

    // --- CONCENTRIC RINGS ---
    var dxc = x - mx;
    var dyc = y - my;
    var distC = Math.sqrt(dxc*dxc + dyc*dyc);
    for (var r = 0; r < 3; r++) {
      var rr = 16 + r * 11;
      var ringDist = Math.abs(distC - rr);
      if (ringDist < 2.0) v += (1 - ringDist/2.0) * 0.45;
    }

    // --- VERTICAL DATA COLUMNS ---
    for (var c = 0; c < 6; c++) {
      var colX = mx - 28 + c * 11;
      v += line(x, y, colX, 0, colX, rows, 1.5) * 0.30;
    }

    // --- CURSOR ---
    var mdx = x - mouseX;
    var mdy = y - mouseY;
    var mouseDist = Math.sqrt(mdx*mdx + mdy*mdy);
    if (mouseDist < 18) v += (1 - mouseDist/18) * 0.55;

    return clamp(v);
  }

  function draw() {
    mouseX += (targetMouseX - mouseX) * 0.10;
    mouseY += (targetMouseY - mouseY) * 0.10;

    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, width, height);

    ctx.font = (CELL_H - 1) + 'px "JetBrains Mono", "Fira Code", "Courier New", monospace';
    ctx.textBaseline = 'top';

    for (var y = 0; y < rows; y++) {
      var py = y * CELL_H;
      for (var x = 0; x < cols; x++) {
        var d = density(x, y);

        // Edge vignette
        var edgeDist = Math.min(x, y, cols - x - 1, rows - y - 1);
        var vignette = Math.min(1, edgeDist / 6);
        d *= 0.4 + vignette * 0.6;

        // Bayer dither
        var bayerVal = BAYER[y % 4][x % 4] / 16;
        var threshold = 0.42 + bayerVal * 0.15;
        var dithered = d + (bayerVal - 0.5) * 0.22;

        if (dithered < threshold) continue;

        var idx = Math.floor((dithered - threshold) / (1 - threshold) * (CHAR_SET.length - 1));
        idx = Math.max(1, Math.min(CHAR_SET.length - 1, idx));
        var char = CHAR_SET[idx];

        // Cursor boost
        var mdx = x - mouseX;
        var mdy = y - mouseY;
        var cursorDist = Math.sqrt(mdx*mdx + mdy*mdy);
        var cursorBoost = cursorDist < 10 ? (1 - cursorDist/10) * 22 : 0;

        var hue = 170;
        var sat = 30 + d * 40;
        var light = 12 + idx * 4 + d * 4 + cursorBoost;
        ctx.fillStyle = 'hsl(' + hue + ', ' + sat + '%, ' + light + '%)';

        ctx.fillText(char, x * CELL_W, py);
      }
    }

    time += 0.015;
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
