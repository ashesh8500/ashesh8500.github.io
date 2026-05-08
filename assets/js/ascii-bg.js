/**
 * ascii-bg.js — Full-page animated ASCII dither background
 * V3: Bigger cells (11×18), brighter characters, more sparse, stronger vignette
 * True Bayer-dithered character field. Neural + LiDAR vibes.
 */
(function () {
  var CHAR_SET = ' .:-=+*#%@█▓▒░';
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  var CELL_W = 12;
  var CELL_H = 19;

  var canvas, ctx;
  var cols, rows, width, height;
  var time = 0;
  var mouseX = -100, mouseY = -100;
  var targetMouseX = -100, targetMouseY = -100;
  var animId;
  var sparkField = [];

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    canvas.style.cssText = [
      'position:fixed;top:0;left:0;width:100vw;height:100vh;',
      'z-index:0;pointer-events:none;opacity:0.75;',
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

  function sourceValue(x, y) {
    var mx = cols / 2;
    var my = rows / 2;
    var v = 0;

    // Large organic flow
    v += Math.sin(x * 0.12 + time * 0.31) * Math.cos(y * 0.09 + time * 0.27) * 0.48;
    v += Math.cos((x + y) * 0.06 - time * 0.37) * 0.32;
    v += Math.sin(x * 0.18 - y * 0.13 + time * 0.23) * 0.22;

    // Neural layers
    var layerPhase = Math.sin(time * 0.18);
    for (var layer = 0; layer < 4; layer++) {
      var layerY = my - 14 + layer * 7 + layerPhase * 10;
      var distToLayer = Math.abs(y - layerY);
      if (distToLayer < 5) {
        var luma = 1 - distToLayer / 5;
        v += luma * 0.28 * (0.5 + 0.5 * Math.sin(time * 1.3 + layer * 0.9));
      }
    }

    // LiDAR sweep
    var dx = x - mx;
    var dy = y - my;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx);
    var sweepAngle = (time * 0.25) % (Math.PI * 2);
    var angleDist = Math.min(Math.abs(angle - sweepAngle), Math.PI * 2 - Math.abs(angle - sweepAngle));
    if (dist < 18 && angleDist < 0.5) {
      v += (1 - angleDist / 0.5) * (1 - dist / 18) * 0.32;
    }
    v += (1 - dist / 24) * 0.10 * (0.5 + 0.5 * Math.sin(dist * 1.1 - time * 1.5));

    // Micro motion
    v += Math.sin(x * 0.55 + y * 0.42 + time * 0.8) * 0.06;
    v += Math.cos(x * 0.32 - y * 0.28 + time * 0.6) * 0.05;

    // Cursor
    var mdx = x - mouseX;
    var mdy = y - mouseY;
    var mouseDist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mouseDist < 18) {
      v += (1 - mouseDist / 18) * 0.38;
    }

    // Edge vignette
    var edgeDist = Math.min(x, y, cols - x - 1, rows - y - 1);
    var vignette = Math.min(1, edgeDist / 5);
    v *= 0.65 + vignette * 0.35;

    return Math.max(0.05, Math.min(1, v * 0.55 + 0.24));
  }

  function draw() {
    mouseX += (targetMouseX - mouseX) * 0.10;
    mouseY += (targetMouseY - mouseY) * 0.10;

    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, width, height);

    ctx.font = CELL_H + 'px "JetBrains Mono", "Fira Code", "Courier New", monospace';
    ctx.textBaseline = 'top';

    // Spark bursts
    if (Math.random() < 0.03) {
      sparkField.push({
        x: Math.random() * cols,
        y: Math.random() * rows,
        life: 1.0,
        radius: 3 + Math.random() * 6
      });
    }
    for (var s = sparkField.length - 1; s >= 0; s--) {
      sparkField[s].life -= 0.015;
      if (sparkField[s].life <= 0) sparkField.splice(s, 1);
    }

    var totalCells = rows * cols;
    var targetDraw = Math.floor(totalCells * 0.55); // sparser: only draw ~55% of cells

    for (var y = 0; y < rows; y++) {
      var py = y * CELL_H;
      for (var x = 0; x < cols; x++) {
        var brightness = sourceValue(x, y);

        var bayerVal = BAYER[y % 4][x % 4] / 16;
        var dithered = brightness + (bayerVal - 0.5) * 0.5;
        var idx = Math.floor(dithered * (CHAR_SET.length - 1));
        var char = CHAR_SET[Math.max(0, Math.min(CHAR_SET.length - 1, idx))];

        // Spark boost
        var sparkBoost = 0;
        for (var si = 0; si < sparkField.length; si++) {
          var sp = sparkField[si];
          var sdx = x - sp.x;
          var sdy = y - sp.y;
          var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sdist < sp.radius) {
            sparkBoost += (1 - sdist / sp.radius) * sp.life * 0.55;
          }
        }

        // Skip very dim empty cells (sparser rendering)
        if (char === ' ' && dithered < 0.32 && sparkBoost < 0.08) continue;
        // Skip some medium cells for a sparser, more elegant look
        if (idx < 3 && Math.random() < 0.25) continue;

        // Brighter color range
        var hue = 170;
        var sat = 38 + brightness * 42;
        var light = 16 + idx * 5 + brightness * 6 + sparkBoost * 26;

        // Cursor proximity
        var mdx = x - mouseX;
        var mdy = y - mouseY;
        var cursorDist = Math.sqrt(mdx * mdx + mdy * mdy);
        var cursorBoost = cursorDist < 14 ? (1 - cursorDist / 14) * 20 : 0;

        ctx.fillStyle = 'hsl(' + hue + ', ' + sat + '%, ' + (light + cursorBoost) + '%)';

        var px = x * CELL_W;
        ctx.fillText(char, px, py);
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
