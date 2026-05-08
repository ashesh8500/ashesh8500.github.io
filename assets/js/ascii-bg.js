/**
 * ascii-bg.js — Full-page animated ASCII background canvas
 * Dither + ASCII + Motion stack across entire viewport
 * 
 * A living, breathing ASCII particle-field backdrop that flows behind all
 * page content. Subtle enough to read on top of, beautiful enough to stare at.
 * Neural architecture + LiDAR sensor fusion vibes in Hermes teal.
 */

(function () {
  const CHAR_SET = '  .,:-=+*#█▓▒░';
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const CELL_W = 9;
  const CELL_H = 15;

  let canvas, ctx;
  let cols, rows, width, height;
  let time = 0;
  let animId;

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      z-index: 0;
      pointer-events: none;
      opacity: 0.62;
      background: #08090d;
      image-rendering: pixelated;
    `;
    document.body.prepend(canvas);

    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    window.addEventListener('resize', resize);
    animate();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(width / CELL_W);
    rows = Math.floor(height / CELL_H);
  }

  function sourceValue(x, y) {
    const mx = cols / 2;
    const my = rows / 2;
    let v = 0;

    // Large-scale Perlin-like organic flow
    v += Math.sin(x * 0.18 + time * 0.4) * Math.cos(y * 0.12 + time * 0.35) * 0.5;
    v += Math.cos((x + y) * 0.09 - time * 0.5) * 0.35;
    v += Math.sin(y * 0.22 - time * 0.3) * 0.25;

    // Neural layer alignment pulses (horizontal bands)
    const layerPhase = Math.sin(time * 0.25);
    for (let layer = 0; layer < 5; layer++) {
      const layerY = my - 12 + layer * 6 + layerPhase * 8;
      const distToLayer = Math.abs(y - layerY);
      if (distToLayer < 5) {
        v += (1 - distToLayer / 5) * 0.35 * (0.6 + 0.4 * Math.sin(time * 2 + layer));
      }
    }

    // LiDAR radial sweep (rotating point cloud density)
    const dx = x - mx;
    const dy = y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const sweepAngle = (time * 0.4) % (Math.PI * 2);
    const angleDist = Math.min(Math.abs(angle - sweepAngle), Math.PI * 2 - Math.abs(angle - sweepAngle));
    if (dist < 18 && angleDist < 0.6) {
      v += (1 - angleDist / 0.6) * (1 - dist / 18) * 0.4;
    }
    // Point cloud dots
    v += (1 - dist / 24) * 0.15 * (0.7 + 0.3 * Math.sin(dist * 1.5 - time * 2));

    // Particle swarm: organic micro-motion
    v += Math.sin(x * 0.8 + y * 0.6 + time * 1.2) * 0.12;
    v += Math.cos(x * 0.45 - y * 0.35 + time * 0.9) * 0.1;

    // Normalize to 0-1
    return Math.max(0, Math.min(1, v * 0.65 + 0.35));
  }

  function draw() {
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, width, height);

    ctx.font = CELL_H + 'px "JetBrains Mono", "Fira Code", "Cascadia Code", monospace';
    ctx.textBaseline = 'top';

    for (let y = 0; y < rows; y++) {
      const py = y * CELL_H;
      for (let x = 0; x < cols; x++) {
        const brightness = sourceValue(x, y);

        // Bayer dither
        const bayerVal = BAYER[y % 4][x % 4] / 16;
        const dithered = brightness + (bayerVal - 0.5) * 0.55;
        const idx = Math.floor(dithered * (CHAR_SET.length - 1));
        const char = CHAR_SET[Math.max(0, Math.min(CHAR_SET.length - 1, idx))];

        if (char === ' ') continue;

        // Color: Hermes teal gradient based on position and value
        const hue = 168; // teal
        const sat = 55 + brightness * 30;
        const light = 18 + idx * 5.5 + brightness * 8;
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;

        const px = x * CELL_W;
        ctx.fillText(char, px, py);
      }
    }

    time += 0.016;
    animId = requestAnimationFrame(draw);
  }

  function animate() {
    animId = requestAnimationFrame(draw);
  }

  // Wait for DOM + fonts
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();