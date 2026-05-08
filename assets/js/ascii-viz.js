/**
 * ascii-viz.js — High-resolution "swarm of bees" ASCII particle system
 * Deep learning architectures + autonomous driving sensor data vibes
 * Teal-green academic aesthetic. Pure JS, requestAnimationFrame, ~120 particles.
 */

(function () {
  const COLS = 78;
  const ROWS = 26;
  const PARTICLES = 118;

  const CHARS = ['·', '•', '○', '●', '◦', '◉', '`', "'", '~', '·'];
  const TEAL = '#00d4aa';

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  }

  function createParticles() {
    const pts = [];
    for (let i = 0; i < PARTICLES; i++) {
      pts.push({
        x: Math.random() * COLS,
        y: Math.random() * ROWS,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.4,
        life: 60 + Math.random() * 80,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        phase: Math.random() * Math.PI * 2
      });
    }
    return pts;
  }

  let particles = createParticles();
  let frame = 0;
  let mode = 0; // 0 = neural swarm, 1 = lidar swarm

  function updateParticles() {
    const time = frame * 0.03;

    for (let p of particles) {
      // Base swarm motion (bees-like)
      p.vx += (Math.random() - 0.5) * 0.08;
      p.vy += (Math.random() - 0.5) * 0.06;

      // Gentle attraction to center (keeps swarm together)
      const cx = COLS / 2 + Math.sin(time * 0.7) * 8;
      const cy = ROWS / 2 + Math.cos(time * 0.6) * 4;
      p.vx += (cx - p.x) * 0.0008;
      p.vy += (cy - p.y) * 0.0009;

      // Mode-specific behavior
      if (mode === 0) {
        // Neural swarm: occasional horizontal layer alignment + firing
        const layerY = Math.floor((Math.sin(time * 0.4 + p.phase) + 1) * (ROWS / 4)) + 4;
        if (Math.abs(p.y - layerY) < 1.5) {
          p.vy *= 0.3;
          p.vx += (Math.sin(time * 2 + p.x) - 0.5) * 0.4;
        }
        // Occasional connection pulses
        if (Math.random() < 0.006) p.vx *= 2.2;
      } else {
        // LiDAR swarm: radial outward + depth fade
        const dx = p.x - COLS / 2;
        const dy = p.y - ROWS / 2 - 2;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx += (dx / dist) * 0.025;
        p.vy += (dy / dist) * 0.025;
        if (dist < 6) { p.vx *= 0.6; p.vy *= 0.6; }
      }

      // Velocity damping + bounds
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 1) { p.x = 1; p.vx = Math.abs(p.vx); }
      if (p.x > COLS - 2) { p.x = COLS - 2; p.vx = -Math.abs(p.vx); }
      if (p.y < 1) { p.y = 1; p.vy = Math.abs(p.vy); }
      if (p.y > ROWS - 2) { p.y = ROWS - 2; p.vy = -Math.abs(p.vy); }

      p.life -= 0.6;
      if (p.life < 0) {
        // Respawn
        p.x = Math.random() * COLS;
        p.y = Math.random() * ROWS;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = (Math.random() - 0.5) * 0.4;
        p.life = 70 + Math.random() * 90;
        p.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        p.phase = Math.random() * Math.PI * 2;
      }
    }

    // Switch mode every ~9 seconds
    if (frame % 540 === 0) {
      mode = 1 - mode;
      // Gentle burst on mode change
      for (let p of particles) {
        p.vx += (Math.random() - 0.5) * 1.8;
        p.vy += (Math.random() - 0.5) * 1.4;
      }
    }
  }

  function renderGrid() {
    const grid = createGrid();

    // Draw particles
    for (let p of particles) {
      const ix = Math.floor(p.x);
      const iy = Math.floor(p.y);
      if (ix >= 0 && ix < COLS && iy >= 0 && iy < ROWS) {
        grid[iy][ix] = p.char;
      }
    }

    // Occasional faint connection lines (neural vibe)
    if (mode === 0 && Math.random() < 0.35) {
      const a = particles[Math.floor(Math.random() * particles.length)];
      const b = particles[Math.floor(Math.random() * particles.length)];
      const dx = Math.floor(b.x - a.x);
      const dy = Math.floor(b.y - a.y);
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      if (steps > 3 && steps < 22) {
        for (let i = 1; i < steps; i++) {
          const x = Math.floor(a.x + (dx * i) / steps);
          const y = Math.floor(a.y + (dy * i) / steps);
          if (x > 0 && x < COLS - 1 && y > 0 && y < ROWS - 1 && grid[y][x] === ' ') {
            grid[y][x] = '·';
          }
        }
      }
    }

    // Convert grid to string
    return grid.map(row => row.join('')).join('\n');
  }

  function createAsciiViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const pre = document.createElement('pre');
    pre.className = 'ascii-viz';
    pre.style.fontSize = '10.8px';
    pre.style.lineHeight = '1.02';
    pre.style.letterSpacing = '0.4px';
    pre.style.padding = '18px 20px';
    pre.style.minHeight = '268px';

    container.appendChild(pre);

    function loop() {
      frame++;
      updateParticles();
      const text = renderGrid();
      const label = mode === 0 
        ? `NEURAL SWARM — ${PARTICLES} particles · layer pulses`
        : `LiDAR POINT CLOUD — ${PARTICLES} points · radial sweep`;
      pre.innerHTML = text + `\n<span class="frame-label">${label}</span>`;
      requestAnimationFrame(loop);
    }

    // Seed a nice initial formation
    setTimeout(() => {
      for (let i = 0; i < 18; i++) {
        particles[i].x = COLS / 2 + (i % 6 - 2.5) * 3.5;
        particles[i].y = 6 + Math.floor(i / 6) * 4.5;
        particles[i].vx = (Math.random() - 0.5) * 0.3;
      }
    }, 120);

    requestAnimationFrame(loop);
  }

  window.initAsciiViz = createAsciiViz;
})();