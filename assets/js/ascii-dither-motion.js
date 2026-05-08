/**
 * ascii-dither-motion.js — Hero ASCII dither animation
 * V3: Fixed canvas sizing (10×16px per char = 760×352 internal),
 * 3-mode neural/LiDAR/dataflow, bold characters, spark particles, mode labels.
 */
(function () {
  var WIDTH = 76;   // characters wide
  var HEIGHT = 22;  // characters tall
  var CHAR_PX_W = 10;
  var CHAR_PX_H = 16;
  var CANVAS_W = WIDTH * CHAR_PX_W;   // 760
  var CANVAS_H = HEIGHT * CHAR_PX_H;  // 352

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
  var particles = [];

  function initAsciiDitherMotion(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.id = 'ascii-dither-canvas';
    canvas.style.cssText = [
      'width:100%;max-width:760px;',
      'image-rendering:pixelated;',
      'background:#0a0e15;',
      'border:1px solid #1e2a38;',
      'border-radius:10px;',
      'display:block;margin:0 auto;',
      'box-shadow:0 0 80px rgba(0,180,148,0.14), 0 0 180px rgba(0,180,148,0.06), 0 0 20px rgba(0,180,148,0.04);'
    ].join('');
    container.appendChild(canvas);

    ctx = canvas.getContext('2d', { alpha: false });

    for (var i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.35,
        life: 0.3 + Math.random() * 0.7,
        char: CHAR_SET[8 + Math.floor(Math.random() * 4)]
      });
    }

    setTimeout(function () {
      time = Math.random() * 10;
      draw();
    }, 100);
  }

  function getSource(x, y) {
    var cx = WIDTH / 2;
    var cy = HEIGHT / 2;
    var v = 0;

    if (mode === 0) {
      // NEURAL CASCADE
      var layer = Math.floor((y / HEIGHT) * 7);
      v = Math.sin((x * 0.8 + time * 1.6) + layer * 1.1) * 0.5 + 0.5;
      v += Math.sin((y * 1.3 - time * 0.8) + x * 0.25) * 0.32;
      var pulse = Math.sin(time * 2.4 + layer * 0.7);
      if (Math.abs(pulse) > 0.82) v += 0.55;
      if (Math.abs(Math.sin(time * 3.1 + x * 0.15)) > 0.9) v += 0.4;
    } else if (mode === 1) {
      // LiDAR POINT CLOUD
      var dx = x - cx;
      var dy = y - cy - 2;
      var dist = Math.sqrt(dx * dx + dy * dy);
      v = Math.max(0, 1 - dist / 20);
      v += Math.sin(dist * 1.4 - time * 3.2) * 0.38;
      v += (Math.random() - 0.5) * 0.12;
      var bb = 8;
      if (Math.abs(x - cx) < bb && Math.abs(y - cy) < bb) {
        v += 0.22 * (1 - Math.max(Math.abs(x - cx), Math.abs(y - cy)) / bb);
      }
    } else {
      // DATAFLOW
      v = Math.sin(x * 1.2 + time * 0.9) * 0.35 + 0.38;
      for (var stream = 0; stream < 5; stream++) {
        var sx = 8 + stream * 15 + Math.sin(time * 0.5 + stream) * 4;
        var distX = Math.abs(x - sx);
        if (distX < 4) {
          var streamY = (y + time * 2.5 + stream * 3) % (HEIGHT + 8) - 4;
          if (streamY > 0 && streamY < HEIGHT) {
            v += (1 - distX / 4) * 0.5 * (1 - Math.abs(y - streamY) / 4);
          }
        }
      }
      v += Math.sin(y * 0.7 - time * 1.4) * 0.2;
      if (Math.random() < 0.08) v += 0.45;
    }

    // Particle contributions
    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      var pdx = x - p.x;
      var pdy = y - p.y;
      var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist < 3) {
        v += (1 - pdist / 3) * p.life * 0.45;
      }
    }

    var edgeDist = Math.min(x, y, WIDTH - x - 1, HEIGHT - y - 1);
    var vignette = Math.min(1, edgeDist / 5);
    v *= 0.6 + vignette * 0.4;

    return Math.max(0.02, Math.min(1, v));
  }

  function updateParticles() {
    var cx = WIDTH / 2;
    var cy = HEIGHT / 2;

    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      p.life -= 0.004;

      if (mode === 0) {
        p.vy *= 0.94;
        p.vx += (Math.sin(time * 1.5 + p.x * 0.2) - 0.5) * 0.06;
        if (Math.random() < 0.02) p.vx *= 2.5;
      } else if (mode === 1) {
        var dx = p.x - cx;
        var dy = p.y - cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx += (dx / dist) * 0.03;
        p.vy += (dy / dist) * 0.03;
      } else {
        p.vy += 0.01;
        p.vx += (Math.sin(time * 2 + p.y * 0.3) - 0.5) * 0.04;
      }

      p.vx *= 0.97;
      p.vy *= 0.97;
      p.x += p.vx;
      p.y += p.vy;

      if (p.life <= 0 || p.x < 0 || p.x > WIDTH || p.y < 0 || p.y > HEIGHT) {
        if (mode === 2) {
          p.x = 5 + Math.random() * (WIDTH - 10);
          p.y = -2;
          p.vy = 0.5 + Math.random() * 1.0;
        } else {
          p.x = Math.random() * WIDTH;
          p.y = Math.random() * HEIGHT;
        }
        p.vx = (Math.random() - 0.5) * 0.4;
        p.vy = (Math.random() - 0.5) * 0.3;
        p.life = 0.4 + Math.random() * 0.6;
      }
    }

    if (particles.length < 55 && Math.random() < 0.3) {
      particles.push({
        x: mode === 2 ? 5 + Math.random() * (WIDTH - 10) : Math.random() * WIDTH,
        y: mode === 2 ? -2 : Math.random() * HEIGHT,
        vx: (Math.random() - 0.5) * 0.5,
        vy: mode === 2 ? 0.4 + Math.random() * 0.8 : (Math.random() - 0.5) * 0.3,
        life: 0.3 + Math.random() * 0.7,
        char: CHAR_SET[7 + Math.floor(Math.random() * 5)]
      });
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0e15';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    updateParticles();

    // Draw pixel-atmosphere background
    var imageData = ctx.createImageData(CANVAS_W, CANVAS_H);
    var data = imageData.data;

    for (var py = 0; py < CANVAS_H; py += 2) {
      var y = Math.floor(py / CHAR_PX_H);
      for (var px = 0; px < CANVAS_W; px += 2) {
        var x = Math.floor(px / CHAR_PX_W);
        var brightness = getSource(x, y);
        var gray = Math.floor(Math.max(8, Math.min(255, brightness * 255)));
        var i = (py * CANVAS_W + px) * 4;
        data[i] = gray * 0.08;
        data[i + 1] = gray * 0.18;
        data[i + 2] = gray * 0.20;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw crisp ASCII characters
    ctx.font = (CHAR_PX_H - 2) + 'px "JetBrains Mono", "Fira Code", "Courier New", monospace';
    ctx.textBaseline = 'top';

    var drawnCount = 0;
    var maxChars = 1100;

    for (var y = 0; y < HEIGHT; y++) {
      for (var x = 0; x < WIDTH; x++) {
        if (drawnCount >= maxChars) break;

        var brightness = getSource(x, y);
        var bayerVal = BAYER[y % 4][x % 4] / 16;
        var dithered = brightness + (bayerVal - 0.5) * 0.55;
        var idx = Math.floor(dithered * (CHAR_SET.length - 1));
        var char = CHAR_SET[Math.max(0, Math.min(CHAR_SET.length - 1, idx))];

        if (char !== ' ' && char !== '.') {
          drawnCount++;
          var lum = idx / (CHAR_SET.length - 1);
          var r = 0;
          var g = Math.floor(100 + lum * 145);
          var bVal = Math.floor(90 + lum * 150);
          ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bVal + ')';
          ctx.fillText(char, x * CHAR_PX_W, y * CHAR_PX_H);
        }
      }
    }

    // Mode label
    var modeNames = ['NEURAL CASCADE', 'LiDAR POINT CLOUD', 'DATA FLOW'];
    ctx.fillStyle = 'rgba(0,180,148,0.50)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillText(modeNames[mode] + '   ·   ▸◂▸', CHAR_PX_W, CANVAS_H - CHAR_PX_H / 2);

    time += 0.02;
    modeTimer++;

    if (modeTimer > 500) {
      mode = (mode + 1) % 3;
      modeTimer = 0;
      for (var pi = 0; pi < particles.length; pi++) {
        particles[pi].vx += (Math.random() - 0.5) * 2;
        particles[pi].vy += (Math.random() - 0.5) * 2;
      }
    }

    requestAnimationFrame(draw);
  }

  window.initAsciiDitherMotion = initAsciiDitherMotion;
})();
