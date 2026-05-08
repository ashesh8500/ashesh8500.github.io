/**
 * ascii-dither-motion.js
 * Dither + ASCII + Motion stack (inspired by praveenisomer Web ASCII section)
 * Real-time Bayer dithered particle field → rich ASCII characters
 * Neural architecture + LiDAR sensor vibes | Teal-green academic aesthetic
 */

(function () {
  const WIDTH = 92;
  const HEIGHT = 32;
  const CHAR_SET = ' .:-=+*#%@█▓▒░';
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  function createAsciiDither(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.cssText = `
      width: 100%;
      max-width: 820px;
      image-rendering: pixelated;
      background: #0a0d14;
      border: 1px solid #1e2430;
      border-radius: 8px;
      display: block;
      margin: 24px auto;
      box-shadow: 0 0 40px rgba(0,212,170,0.06);
    `;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textBaseline = 'top';

    let time = 0;
    let mode = 0; // 0 = neural, 1 = lidar

    function getSource(x, y) {
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      let v = 0;

      if (mode === 0) {
        // Neural cascade — layered horizontal waves + firing
        const layer = Math.floor((y / HEIGHT) * 6);
        v = Math.sin((x * 0.9 + time * 1.8) + layer * 1.2) * 0.5 + 0.5;
        v += Math.sin((y * 1.4 - time * 0.9) + x * 0.3) * 0.3;
        if (Math.abs(Math.sin(time * 2.2 + layer)) > 0.85) v += 0.6; // pulse
      } else {
        // LiDAR point cloud — radial + depth
        const dx = x - cx;
        const dy = y - cy - 3;
        const dist = Math.sqrt(dx * dx + dy * dy);
        v = Math.max(0, 1 - dist / 22);
        v += Math.sin(dist * 1.3 - time * 3.5) * 0.4;
        v += (Math.random() - 0.5) * 0.15; // sensor noise
      }
      return Math.max(0, Math.min(1, v));
    }

    function draw() {
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const imageData = ctx.createImageData(WIDTH, HEIGHT);
      const data = imageData.data;

      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          let brightness = getSource(x, y);

          // Bayer dither
          const bayerVal = BAYER[y % 4][x % 4] / 16;
          const dithered = brightness + (bayerVal - 0.5) * 0.6;
          const idx = Math.floor(dithered * (CHAR_SET.length - 1));

          const char = CHAR_SET[Math.max(0, Math.min(CHAR_SET.length - 1, idx))];
          const gray = Math.floor((CHAR_SET.indexOf(char) / (CHAR_SET.length - 1)) * 255 * 0.92 + 20);

          const i = (y * WIDTH + x) * 4;
          data[i] = gray * 0.75;       // R (teal tint)
          data[i + 1] = gray * 0.95;   // G
          data[i + 2] = gray * 0.88;   // B (teal-green)
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Overlay crisp ASCII text
      ctx.fillStyle = '#00d4aa';
      ctx.font = '9.5px JetBrains Mono, monospace';
      ctx.textBaseline = 'top';

      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const brightness = getSource(x, y);
          const bayerVal = BAYER[y % 4][x % 4] / 16;
          const dithered = brightness + (bayerVal - 0.5) * 0.6;
          const idx = Math.floor(dithered * (CHAR_SET.length - 1));
          const char = CHAR_SET[Math.max(0, Math.min(CHAR_SET.length - 1, idx))];

          if (char !== ' ') {
            ctx.fillText(char, x * 8.95, y * 9.8);
          }
        }
      }

      time += 0.018;
      if (Math.floor(time * 3) % 480 === 0) mode = 1 - mode;

      requestAnimationFrame(draw);
    }

    // Initial seed
    setTimeout(() => {
      time = Math.random() * 10;
      draw();
    }, 80);
  }

  window.initAsciiDitherMotion = createAsciiDither;
})();