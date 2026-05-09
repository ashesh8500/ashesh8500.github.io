/**
 * ascii-bg.js — Photorealistic flower dither animation
 * V8: Offscreen procedural orchid → Floyd-Steinberg dither → scaled dot rendering.
 * Purple/violet halftone aesthetic. Dots rendered directly — no character grid loss.
 */
(function () {
  var CELL_W = 5;
  var CELL_H = 10;
  var OFF_W = 600;
  var OFF_H = 840;
  var DITHER_SKIP = 3;

  var canvas, ctx;
  var offCanvas, offCtx;
  var ditherCanvas, ditherCtx;
  var cols, rows, width, height;
  var time = 0;
  var mouseX = -100, mouseY = -100;
  var targetMouseX = -100, targetMouseY = -100;
  var animId;
  var frameSkip = 0;
  var ditherImgData = null; // cached ImageData for the dithered output

  // Pollen particles (rendered separately)
  var pollen = [];

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    canvas.style.cssText = [
      'position:fixed;top:0;left:0;width:100vw;height:100vh;',
      'z-index:0;pointer-events:none;opacity:0.82;',
      'background:#08090d;image-rendering:pixelated;'
    ].join('');
    document.body.prepend(canvas);

    ctx = canvas.getContext('2d', { alpha: false });

    offCanvas = document.createElement('canvas');
    offCanvas.width = OFF_W;
    offCanvas.height = OFF_H;
    offCtx = offCanvas.getContext('2d', { alpha: true });

    ditherCanvas = document.createElement('canvas');
    ditherCanvas.width = OFF_W;
    ditherCanvas.height = OFF_H;
    ditherCtx = ditherCanvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', function () {
      targetMouseX = -100; targetMouseY = -100;
    });

    for (var i = 0; i < 50; i++) {
      pollen.push(spawnPollen());
    }

    time = 55;
    animate();
  }

  function spawnPollen(flowerCX, flowerCY, flowerR) {
    var cx = flowerCX || OFF_W / 2;
    var cy = flowerCY || OFF_H * 0.22;
    var r = flowerR || 120;
    var angle = Math.random() * Math.PI * 2;
    var dist = r * (0.3 + Math.random() * 1.2);
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.2 - Math.random() * 0.6,
      life: 0.3 + Math.random() * 0.9,
      size: 0.5 + Math.random() * 1.2
    };
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
    // Force re-dither on next frame
    ditherImgData = null;
  }

  function onMouseMove(e) {
    targetMouseX = e.clientX / CELL_W;
    targetMouseY = e.clientY / CELL_H;
  }

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  // ─── OFFSCREEN FLOWER RENDERING ──────────────────────────

  function drawPetal(cx, cy, angle, length, width, color1, color2, color3) {
    offCtx.save();
    offCtx.translate(cx, cy);
    offCtx.rotate(angle);

    var hw = width / 2;
    var baseW = hw * 0.35;
    var tipW = hw * 0.15;

    offCtx.beginPath();
    offCtx.moveTo(baseW * -1, -2);
    offCtx.bezierCurveTo(-hw * 0.9, length * 0.15, -hw * 0.95, length * 0.55, -tipW, length * 0.82);
    offCtx.bezierCurveTo(-tipW * 0.3, length * 0.95, tipW * 0.3, length * 0.95, tipW, length * 0.82);
    offCtx.bezierCurveTo(hw * 0.95, length * 0.55, hw * 0.9, length * 0.15, baseW, -2);
    offCtx.closePath();

    var grad = offCtx.createLinearGradient(0, -2, 0, length * 0.85);
    grad.addColorStop(0, color1);
    grad.addColorStop(0.25, color2);
    grad.addColorStop(0.55, color3);
    grad.addColorStop(0.85, color2);
    grad.addColorStop(1, color3);
    offCtx.fillStyle = grad;
    offCtx.fill();

    offCtx.restore();
  }

  function drawLip(cx, cy, angle, length, width, color1, color2, color3) {
    offCtx.save();
    offCtx.translate(cx, cy);
    offCtx.rotate(angle);

    var hw = width / 2;
    offCtx.beginPath();
    offCtx.moveTo(-hw * 0.3, -2);
    offCtx.bezierCurveTo(-hw * 0.7, length * 0.1, -hw * 1.1, length * 0.35, -hw * 0.95, length * 0.5);
    offCtx.bezierCurveTo(-hw * 0.8, length * 0.6, -hw * 0.4, length * 0.55, -hw * 0.15, length * 0.6);
    offCtx.bezierCurveTo(-hw * 0.05, length * 0.5, hw * 0.05, length * 0.5, hw * 0.15, length * 0.6);
    offCtx.bezierCurveTo(hw * 0.4, length * 0.55, hw * 0.8, length * 0.6, hw * 0.95, length * 0.5);
    offCtx.bezierCurveTo(hw * 1.1, length * 0.35, hw * 0.7, length * 0.1, hw * 0.3, -2);
    offCtx.closePath();

    var grad = offCtx.createLinearGradient(0, -2, 0, length * 0.65);
    grad.addColorStop(0, color1);
    grad.addColorStop(0.2, color2);
    grad.addColorStop(0.5, color3);
    grad.addColorStop(1, color3);
    offCtx.fillStyle = grad;
    offCtx.fill();

    offCtx.restore();
  }

  function renderFlower(bloom, breathing, sway) {
    offCtx.clearRect(0, 0, OFF_W, OFF_H);
    offCtx.fillStyle = '#08090d';
    offCtx.fillRect(0, 0, OFF_W, OFF_H);

    var fx = OFF_W / 2 + sway * 0.4;
    var fy = OFF_H * 0.22; // bloom in upper third, above hero card
    var scale = 1 + breathing * 0.04;

    var petLen = 82 + bloom * 142;
    var petWid = 27 + bloom * 45;

    var darkP  = 'rgba(55,20,90,1.0)';
    var midP   = 'rgba(130,80,190,1.0)';
    var lightP = 'rgba(200,160,240,1.0)';
    var lightP2 = 'rgba(225,195,255,1.0)';
    var darkL  = 'rgba(60,25,95,1.0)';
    var midL   = 'rgba(145,90,200,1.0)';
    var lightL = 'rgba(210,170,245,1.0)';

    offCtx.save();
    offCtx.translate(fx, fy);
    offCtx.scale(scale, scale);
    offCtx.translate(-fx, -fy);

    // Back petals
    drawPetal(fx, fy, -Math.PI/2, petLen * 0.95, petWid * 0.9, darkP, midP, lightP2);
    drawPetal(fx, fy, -Math.PI/2 + 0.25, petLen * 0.7, petWid * 0.6, darkP, midP, lightP);
    drawPetal(fx, fy, -Math.PI/2 - 0.25, petLen * 0.7, petWid * 0.6, darkP, midP, lightP);

    // Lateral petals
    drawPetal(fx, fy, -1.2, petLen * 0.85, petWid * 1.05, darkP, midP, lightP);
    drawPetal(fx, fy, 1.2 - Math.PI, petLen * 0.85, petWid * 1.05, darkP, midP, lightP);

    // Front petals
    drawPetal(fx, fy, -0.75, petLen * 0.8, petWid * 0.9, darkP, midP, lightP2);
    drawPetal(fx, fy, 0.75 - Math.PI, petLen * 0.8, petWid * 0.9, darkP, midP, lightP2);

    // Lip
    drawLip(fx, fy + 18, Math.PI/2 + 0.15, petLen * 0.5, petWid * 1.3, darkL, midL, lightL);

    // Column
    offCtx.save();
    offCtx.translate(fx, fy - 12);
    offCtx.rotate(-Math.PI/2);
    offCtx.beginPath();
    offCtx.ellipse(0, petLen * 0.25 * 0.35, petWid * 0.32 * 0.55, petLen * 0.25 * 0.4, 0, 0, Math.PI * 2);
    var colGrad = offCtx.createLinearGradient(0, 0, 0, petLen * 0.25 * 0.7);
    colGrad.addColorStop(0, 'rgba(100,45,140,1.0)');
    colGrad.addColorStop(0.5, 'rgba(140,80,185,1.0)');
    colGrad.addColorStop(1, 'rgba(185,130,225,1.0)');
    offCtx.fillStyle = colGrad;
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(0, 0, petWid * 0.3 * 0.25, 0, Math.PI * 2);
    offCtx.fillStyle = 'rgba(235,210,255,0.9)';
    offCtx.fill();
    offCtx.restore();

    // Stem
    var stemTop = fy + petLen * 0.45;
    var stemLen = OFF_H * 0.30; // shortened to avoid hero card
    offCtx.beginPath();
    offCtx.moveTo(fx - 3 + sway * 0.2, stemTop);
    offCtx.bezierCurveTo(fx - 1 + sway * 0.3, stemTop + stemLen * 0.3, fx - 2 + sway * 0.5, stemTop + stemLen * 0.7, fx + sway * 0.6, stemTop + stemLen);
    offCtx.lineWidth = 7;
    offCtx.strokeStyle = 'rgba(80,40,120,0.9)';
    offCtx.stroke();

    // Stem highlight
    offCtx.beginPath();
    offCtx.moveTo(fx - 2 + sway * 0.2, stemTop);
    offCtx.bezierCurveTo(fx + sway * 0.3, stemTop + stemLen * 0.3, fx - 1 + sway * 0.5, stemTop + stemLen * 0.7, fx - 1 + sway * 0.6, stemTop + stemLen);
    offCtx.lineWidth = 2.7;
    offCtx.strokeStyle = 'rgba(140,100,190,0.55)';
    offCtx.stroke();

    // Leaves
    for (var l = 0; l < 2; l++) {
      var lx = fx + sway * 0.3;
      var ly = stemTop + 27 + l * 45;
      var sign = l === 0 ? 1 : -1;
      offCtx.save();
      offCtx.translate(lx, ly);
      offCtx.rotate(sign * 0.55);
      offCtx.beginPath();
      offCtx.ellipse(sign * 27, 0, 45, 10, 0, 0, Math.PI * 2);
      var leafGrad = offCtx.createLinearGradient(sign * 27, -10, sign * 27, 10);
      leafGrad.addColorStop(0, 'rgba(70,35,100,0.95)');
      leafGrad.addColorStop(0.4, 'rgba(110,70,150,0.85)');
      leafGrad.addColorStop(0.7, 'rgba(90,55,130,0.80)');
      leafGrad.addColorStop(1, 'rgba(55,30,85,0.95)');
      offCtx.fillStyle = leafGrad;
      offCtx.fill();
      offCtx.beginPath();
      offCtx.moveTo(sign * -18, 0);
      offCtx.lineTo(sign * 72, 0);
      offCtx.lineWidth = 1.0;
      offCtx.strokeStyle = 'rgba(130,90,180,0.5)';
      offCtx.stroke();
      offCtx.restore();
    }

    // Ground
    var groundY = stemTop + stemLen + 5;
    var grdGrad = offCtx.createLinearGradient(0, groundY - 8, 0, groundY + 15);
    grdGrad.addColorStop(0, 'rgba(8,9,13,0)');
    grdGrad.addColorStop(0.3, 'rgba(30,20,50,0.35)');
    grdGrad.addColorStop(1, 'rgba(8,9,13,0)');
    offCtx.fillStyle = grdGrad;
    offCtx.fillRect(0, groundY - 8, OFF_W, 23);

    offCtx.fillStyle = 'rgba(130,90,170,0.3)';
    for (var g = 0; g < 12; g++) {
      var gx = fx - 45 + g * 8 + Math.sin(g * 1.3) * 5;
      offCtx.beginPath();
      offCtx.arc(gx, groundY + Math.random() * 6, 1 + Math.random() * 1.5, 0, Math.PI * 2);
      offCtx.fill();
    }
  }

  // ─── FLOYD-STEINBERG DITHERING ───────────────────────────

  function computeDither() {
    var imgData = offCtx.getImageData(0, 0, OFF_W, OFF_H);
    var pixels = imgData.data;
    var len = OFF_W * OFF_H;

    var gray = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var r = pixels[i * 4];
      var g = pixels[i * 4 + 1];
      var b = pixels[i * 4 + 2];
      var a = pixels[i * 4 + 3] / 255;
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255 * a;
    }

    // Build ImageData for dither output
    var dithData = ditherCtx.createImageData(OFF_W, OFF_H);

    for (var y = 0; y < OFF_H; y++) {
      for (var x = 0; x < OFF_W; x++) {
        var idx = y * OFF_W + x;
        var old = gray[idx];
        var isOn = old > 0.15 ? 1 : 0;
        var error = old - isOn;

        // Purple color for "on" dots, dark for "off"
        if (isOn) {
          // Brighter purple palette
          var bright = Math.min(1, old * 1.5);
          var r = Math.floor(110 + bright * 130);
          var g = Math.floor(45 + bright * 110);
          var b = Math.floor(155 + bright * 100);
          dithData.data[idx * 4] = r;
          dithData.data[idx * 4 + 1] = g;
          dithData.data[idx * 4 + 2] = b;
          dithData.data[idx * 4 + 3] = 255;
        } else {
          dithData.data[idx * 4] = 8;
          dithData.data[idx * 4 + 1] = 9;
          dithData.data[idx * 4 + 2] = 13;
          dithData.data[idx * 4 + 3] = 255;
        }

        // Distribute error
        var e7 = error * 7 / 16;
        var e3 = error * 3 / 16;
        var e5 = error * 5 / 16;
        var e1 = error * 1 / 16;
        if (x + 1 < OFF_W)         gray[idx + 1]         += e7;
        if (y + 1 < OFF_H) {
          if (x - 1 >= 0)           gray[idx + OFF_W - 1] += e3;
                                    gray[idx + OFF_W]     += e5;
          if (x + 1 < OFF_W)        gray[idx + OFF_W + 1] += e1;
        }
      }
    }
    return dithData;
  }

  // ─── RENDER TO MAIN CANVAS ───────────────────────────────

  function draw() {
    mouseX += (targetMouseX - mouseX) * 0.10;
    mouseY += (targetMouseY - mouseY) * 0.10;

    var bloomRaw = Math.sin(time * 0.07) * 0.5 + 0.5;
    var bloom = bloomRaw < 0.5
      ? 2 * bloomRaw * bloomRaw
      : 1 - Math.pow(-2 * bloomRaw + 2, 2) / 2;

    var breathing = Math.sin(time * 0.18) * 0.5 + 0.5;
    var sway = Math.sin(time * 0.09) * 3 + Math.sin(time * 0.055) * 2;

    // Re-dither every N frames
    if (ditherImgData === null || frameSkip % DITHER_SKIP === 0) {
      renderFlower(bloom, breathing, sway);
      ditherImgData = computeDither();
    }
    frameSkip++;

    // Clear and draw dither image scaled to fill
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, width, height);

    // Draw dithered flower centered, scaled to maintain aspect ratio
    var scaleX = width / OFF_W;
    var scaleY = height / OFF_H;
    var scale = Math.min(scaleX, scaleY * 1.05);
    var dw = OFF_W * scale;
    var dh = OFF_H * scale;
    var dx = (width - dw) / 2;
    var dy = (height - dh) / 2;

    // Put dither data onto dither canvas, then draw scaled
    ditherCtx.putImageData(ditherImgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ditherCanvas, 0, 0, OFF_W, OFF_H, dx, dy, dw, dh);

    // ── Render pollen as soft glowing dots ──
    var offFX = OFF_W / 2 + sway * 0.4;
    var offFY = OFF_H * 0.22;
    for (var pi = 0; pi < pollen.length; pi++) {
      var pp = pollen[pi];
      pp.life -= 0.002;
      pp.x += pp.vx;
      pp.y += pp.vy;
      pp.vx += (Math.random() - 0.5) * 0.04;
      pp.vy += -0.002;
      pp.vx += 0.0008 * (sway / 3);

      if (pp.life <= 0 || pp.y < -10 || pp.y > OFF_H + 10 || pp.x < -10 || pp.x > OFF_W + 10) {
        var fresh = spawnPollen(offFX, offFY, 120);
        pp.x = fresh.x;
        pp.y = fresh.y;
        pp.vx = fresh.vx;
        pp.vy = fresh.vy;
        pp.life = fresh.life;
      }

      // Map pollen position from offscreen coords to screen coords
      var sx = dx + (pp.x / OFF_W) * dw;
      var sy = dy + (pp.y / OFF_H) * dh;
      var alpha = pp.life * 0.5;
      if (alpha < 0.02) continue;

      ctx.fillStyle = 'rgba(200,160,240,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, pp.size * 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Subtle edge vignette overlay ──
    var vignetteGrad = ctx.createRadialGradient(width/2, height/2, width * 0.3, width/2, height/2, width * 0.8);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(0.75, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(8,9,13,0.4)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, width, height);

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
