/**
 * ascii-bg.js
 * Fine Hermes-teal ordered dither plus ASCII motion for the whole page.
 * The animation is deliberately quiet: a moving signal field, not a novelty toy.
 */

(function () {
  const CHARS = "   ..,,::;i1tfLCG08@";
  const BAYER_8 = [
    [0, 48, 12, 60, 3, 51, 15, 63],
    [32, 16, 44, 28, 35, 19, 47, 31],
    [8, 56, 4, 52, 11, 59, 7, 55],
    [40, 24, 36, 20, 43, 27, 39, 23],
    [2, 50, 14, 62, 1, 49, 13, 61],
    [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58, 6, 54, 9, 57, 5, 53],
    [42, 26, 38, 22, 41, 25, 37, 21],
  ];

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CELL_W = 6;
  const CELL_H = 9;
  const TARGET_FPS = reducedMotion ? 4 : 24;

  let canvas;
  let ctx;
  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let dpr = 1;
  let frame = 0;
  let lastDraw = 0;
  let mouseX = -999;
  let mouseY = -999;
  let targetMouseX = -999;
  let targetMouseY = -999;

  function init() {
    canvas = document.createElement("canvas");
    canvas.id = "ascii-bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = [
      "position:fixed",
      "inset:0",
      "width:100vw",
      "height:100vh",
      "z-index:0",
      "pointer-events:none",
      "background:#061111",
      "opacity:0.92",
    ].join(";");
    document.body.prepend(canvas);

    ctx = canvas.getContext("2d", { alpha: false });
    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave, { passive: true });
    requestAnimationFrame(draw);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CELL_W);
    rows = Math.ceil(height / CELL_H);
  }

  function onMouseMove(event) {
    targetMouseX = event.clientX / CELL_W;
    targetMouseY = event.clientY / CELL_H;
  }

  function onMouseLeave() {
    targetMouseX = -999;
    targetMouseY = -999;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(edge0, edge1, value) {
    const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
  }

  function sourceValue(x, y, t) {
    const nx = x / Math.max(cols, 1);
    const ny = y / Math.max(rows, 1);
    const cx = cols * 0.67 + Math.sin(t * 0.21) * cols * 0.06;
    const cy = rows * 0.45 + Math.cos(t * 0.17) * rows * 0.08;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let v = 0;

    v += Math.sin(x * 0.075 + t * 0.55) * 0.2;
    v += Math.cos(y * 0.115 - t * 0.41) * 0.16;
    v += Math.sin((x + y) * 0.045 + t * 0.31) * 0.13;

    const ring = Math.sin(dist * 0.34 - t * 1.16) * 0.5 + 0.5;
    v += ring * smoothstep(44, 0, dist) * 0.46;

    const sweep = Math.sin(angle * 3 + t * 0.68 + dist * 0.045) * 0.5 + 0.5;
    v += sweep * smoothstep(62, 8, dist) * 0.22;

    const shelf = Math.sin((ny * 7.0 + t * 0.12) * Math.PI);
    v += Math.max(0, shelf) * 0.12 * smoothstep(0.18, 0.88, nx);

    const quietHeroLeft = (1 - smoothstep(0.14, 0.58, nx)) * smoothstep(0.08, 0.68, ny) * (1 - smoothstep(0.78, 1, ny));
    v -= quietHeroLeft * 0.22;

    const mdx = x - mouseX;
    const mdy = y - mouseY;
    const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
    v += smoothstep(18, 0, mDist) * 0.34;

    return clamp(v * 0.72 + 0.28, 0, 1);
  }

  function draw(timestamp) {
    requestAnimationFrame(draw);
    if (timestamp - lastDraw < 1000 / TARGET_FPS) return;
    lastDraw = timestamp;

    mouseX += (targetMouseX - mouseX) * 0.1;
    mouseY += (targetMouseY - mouseY) * 0.1;

    const t = frame * 0.036;
    frame += 1;

    ctx.fillStyle = "#061111";
    ctx.fillRect(0, 0, width, height);

    ctx.font = CELL_H + "px JetBrains Mono, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "top";

    for (let y = 0; y < rows; y += 1) {
      const py = y * CELL_H;
      for (let x = 0; x < cols; x += 1) {
        const threshold = (BAYER_8[y & 7][x & 7] + 0.5) / 64;
        const value = sourceValue(x, y, t);
        const dithered = clamp(value + (threshold - 0.5) * 0.34, 0, 1);
        const charIndex = Math.floor(dithered * (CHARS.length - 1));
        const char = CHARS[charIndex];

        if (char === " " || dithered < 0.26) continue;

        const warm = Math.max(0, dithered - 0.72);
        const green = Math.floor(92 + dithered * 118);
        const blue = Math.floor(88 + dithered * 88 + warm * 28);
        const red = Math.floor(8 + dithered * 22 + warm * 32);
        const alpha = 0.16 + dithered * 0.54;

        ctx.fillStyle = "rgba(" + red + "," + green + "," + blue + "," + alpha.toFixed(3) + ")";
        ctx.fillText(char, x * CELL_W, py);
      }
    }

    ctx.fillStyle = "rgba(6, 17, 17, 0.18)";
    ctx.fillRect(0, 0, width, height);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
