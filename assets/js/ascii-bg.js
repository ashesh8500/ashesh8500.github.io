/**
 * ascii-bg.js — Full-page animated ASCII background canvas
 * Dither + ASCII + Motion + Cursor Interaction
 * 
 * Computer Modern typeset aesthetic × Hermes teal.
 * Sparse, elegant particle field that breathes. Not a block — a living backdrop.
 * Cursor creates a subtle ripple of light through the character field.
 */

(function () {
  const CHAR_SET = '  ·•◦◉○●';
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const CELL_W = 7;
  const CELL_H = 12;

  let canvas, ctx;
  let cols, rows, width, height;
  let time = 0;
  let mouseX = -100, mouseY = -100;
  let targetMouseX = -100, targetMouseY = -100;
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
      opacity: 0.78;
      background: #08090d;
      image-rendering: auto;
    `;
    document.body.prepend(canvas);

    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', () => { targetMouseX = -100; targetMouseY = -100; });
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

  function onMouseMove(e) {
    targetMouseX = e.clientX / CELL_W;
    targetMouseY = e.clientY / CELL_H;
  }

  function sourceValue(x, y) {
    const mx = cols / 2;
    const my = rows / 2;
    let v = 0;

    // Large organic Perlin-like flow — sparse, elegant waves
    v += Math.sin(x * 0.14 + time * 0.35) * Math.cos(y * 0.1 + time * 0.3) * 0.45;
    v += Math.cos((x + y) * 0.07 - time * 0.4) * 0.3;

    // Neural layer alignment — gentle horizontal bands
    const layerPhase = Math.sin(time * 0.2);
    for (let layer = 0; layer < 4; layer++) {
      const layerY = my - 14 + layer * 7 + layerPhase * 10;
      const distToLayer = Math.abs(y - layerY);
      if (distToLayer < 5) {
        v += (1 - distToLayer / 5) * 0.28 * (0.5 + 0.5 * Math.sin(time * 1.5 + layer * 0.8));
      }
    }

    // LiDAR radial sweep
    const dx = x - mx;
    const dy = y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const sweepAngle = (time * 0.3) % (Math.PI * 2);
    const angleDist = Math.min(Math.abs(angle - sweepAngle), Math.PI * 2 - Math.abs(angle - sweepAngle));
    if (dist < 16 && angleDist < 0.5) {
      v += (1 - angleDist / 0.5) * (1 - dist / 16) * 0.35;
    }
    v += (1 - dist / 22) * 0.1 * (0.6 + 0.4 * Math.sin(dist * 1.2 - time * 1.8));

    // Micro particle motion
    v += Math.sin(x * 0.7 + y * 0.5 + time * 1.0) * 0.08;
    v += Math.cos(x * 0.4 - y * 0.3 + time * 0.7) * 0.06;

    // Cursor interaction — gentle ripple of light
    const mdx = x - mouseX;
    const mdy = y - mouseY;
    const mouseDist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mouseDist < 16) {
      v += (1 - mouseDist / 16) * 0.35;
    }

    return Math.max(0, Math.min(1, v * 0.55 + 0.28));
  }

  function draw() {
    // Smooth mouse follow
    mouseX += (targetMouseX - mouseX) * 0.12;
    mouseY += (targetMouseY - mouseY) * 0.12;

    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, width, height);

    ctx.font = CELL_H + 'px "JetBrains Mono", "Fira Code", monospace';
    ctx.textBaseline = 'top';

    for (let y = 0; y < rows; y++) {
      const py = y * CELL_H;
      for (let x = 0; x < cols; x++) {
        const brightness = sourceValue(x, y);

        // Bayer dither
        const bayerVal = BAYER[y % 4][x % 4] / 16;
        const dithered = brightness + (bayerVal - 0.5) * 0.5;
        const idx = Math.floor(dithered * (CHAR_SET.length - 1));
        const char = CHAR_SET[Math.max(0, Math.min(CHAR_SET.length - 1, idx))];

        // Sparse: skip very dim characters
        if (char === ' ' && dithered < 0.35) continue;

        // Color: Hermes teal, brightness-mapped
        const hue = 170;
        const sat = 45 + brightness * 35;
        const light = 15 + idx * 4.5 + brightness * 6;

        // Cursor proximity boosts lightness
        const mdx = x - mouseX;
        const mdy = y - mouseY;
        const cursorDist = Math.sqrt(mdx * mdx + mdy * mdy);
        const cursorBoost = cursorDist < 14 ? (1 - cursorDist / 14) * 18 : 0;

        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light + cursorBoost}%)`;

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();