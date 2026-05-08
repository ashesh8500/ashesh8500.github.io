/**
 * ascii-viz.js — Animated ASCII art for Deep Learning + Autonomous Driving sensors
 * Teal-green academic aesthetic. Pure JS, no deps. Fits static site.
 */

(function () {
  const FRAMES = {
    neural: [
`  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ INPUT   │────▶│ CONV    │────▶│ POOL    │
  │ 28×28×3 │     │ 3×3×64  │     │ 2×2     │
  └─────────┘     └─────────┘     └─────────┘
        │               │               │
        ▼               ▼               ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ DENSE   │◀────│ FLATTEN │◀────│ FC      │
  │ 512     │     │  4096   │     │ 1024    │
  └─────────┘     └─────────┘     └─────────┘`,
`  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ INPUT   │────▶│ CONV    │────▶│ POOL    │
  │ 28×28×3 │     │ 3×3×64  │     │ 2×2     │
  └─────────┘     └─────────┘     └─────────┘
        │               │               │
        ▼               ▼               ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ DENSE   │◀────│ FLATTEN │◀────│ FC      │
  │ 512     │     │  4096   │     │ 1024    │`,
`  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ INPUT   │════▶│ CONV    │════▶│ POOL    │
  │ 28×28×3 │     │ 3×3×64  │     │ 2×2     │
  └─────────┘     └─────────┘     └─────────┘
        │               │               │
        ▼               ▼               ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ DENSE   │◀════│ FLATTEN │◀════│ FC      │
  │ 512     │     │  4096   │     │ 1024    │`
    ],
    lidar: [
`      ╭────────────────────────────╮
   0° │      •     •   •     •     │  180°
      │   •    •      •   •    •   │
      │ •   •     •      •    •    │
      │   •   •    •   •     •   • │
   90°│      •     •   •     •     │  270°
      ╰────────────────────────────╯
         LiDAR 64-beam sweep  ·  120m`,
`      ╭────────────────────────────╮
   0° │   •     •     •     •      │  180°
      │  •   •    •   •    •   •   │
      │    •   •    •   •    •     │
      │ •   •    •   •    •   •    │
   90°│   •     •     •     •      │  270°
      ╰────────────────────────────╯
         LiDAR 64-beam sweep  ·  120m`,
`      ╭────────────────────────────╮
   0° │     •     •     •     •    │  180°
      │  •   •   •   •   •   •   • │
      │   •   •   •   •   •   •    │
      │ •   •   •   •   •   •   •  │
   90°│     •     •     •     •    │  270°
      ╰────────────────────────────╯
         LiDAR 64-beam sweep  ·  120m`
    ]
  };

  function createAsciiViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const pre = document.createElement('pre');
    pre.className = 'ascii-viz';
    pre.innerHTML = FRAMES.neural[0] + '\n<span class="frame-label">NEURAL NET — frame 1/3</span>';

    container.appendChild(pre);

    let mode = 'neural';
    let frameIdx = 0;
    let lastSwitch = Date.now();

    function render() {
      const now = Date.now();
      const frames = FRAMES[mode];
      
      if (now - lastSwitch > 2400) {
        frameIdx = (frameIdx + 1) % frames.length;
        if (frameIdx === 0) {
          // switch mode every 3 cycles
          mode = mode === 'neural' ? 'lidar' : 'neural';
          lastSwitch = now + 800;
        } else {
          lastSwitch = now;
        }
      }

      const label = mode === 'neural' 
        ? `NEURAL NET — frame ${frameIdx + 1}/${frames.length}` 
        : `LiDAR SWEEP — frame ${frameIdx + 1}/${frames.length}`;

      pre.innerHTML = frames[frameIdx] + `\n<span class="frame-label">${label}</span>`;
    }

    setInterval(render, 420);
    render();
  }

  window.initAsciiViz = createAsciiViz;
})();