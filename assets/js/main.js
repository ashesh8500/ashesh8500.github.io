/**
 * main.js — v23 — monumental editorial
 * - chapter tracking and progress
 * - restrained custom cursor for fine pointers
 * - magnetic controls and project aperture parallax
 * - local time and hero reveal
 * - curated systems only; no assistant or repository feed
 */

const D = {};

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function boot() {
  D.markChapter = qs('#markChapter');
  D.progressFill = qs('#progressFill');
  D.localTime = qs('#localTime');
  D.currentFocus = qs('#currentFocus');
  D.hero = qs('#thesis');
  D.heroAccum = qs('#heroScrollAccum');
  D.footerTime = qs('#footerTime');

  initTime();
  initReveal();
  initChapters();
  initCursor();
  initMagnetic();
  initSystemsHover();
  initAnchors();

  if (window.__field && window.__field.clearSystem) {
    window.__field.clearSystem();
  }
}

function initTime() {
  function updateTime() {
    try {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(now);
      if (D.localTime) D.localTime.textContent = fmt;
      if (D.footerTime) D.footerTime.textContent = fmt + ' ET · ' + now.getFullYear();
    } catch (error) {
      // The page remains usable if Intl or the requested timezone is unavailable.
    }
  }

  updateTime();
  window.setInterval(updateTime, 30000);
}

function initReveal() {
  if (!D.hero) return;
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      D.hero.classList.add('reveal-in');
    });
  });
}

function initChapters() {
  const sections = qsa('.chapter, .hero');
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(function () {
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = documentHeight > 0 ? (scrollY / documentHeight) * 100 : 0;

      if (D.progressFill) D.progressFill.style.width = percent.toFixed(2) + '%';
      if (D.heroAccum) D.heroAccum.textContent = percent.toFixed(0) + '% ACCUM';

      let activeId = 'thesis';
      sections.forEach(function (section) {
        if (scrollY >= section.offsetTop - 140) activeId = section.id || activeId;
      });

      const labels = {
        thesis: 'thesis',
        selected: 'selected projects',
        signal: 'current work',
        trajectory: 'experience and education',
        archive: 'research and materials'
      };
      const activeLabel = labels[activeId] || activeId;
      if (D.markChapter) D.markChapter.textContent = activeLabel;
      if (D.currentFocus) D.currentFocus.textContent = activeLabel;

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initCursor() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reducedMotion) return;

  const dot = document.createElement('div');
  const ring = document.createElement('div');
  const shape = document.createElement('span');
  const label = document.createElement('span');

  dot.className = 'site-cursor-dot';
  ring.className = 'site-cursor-ring';
  shape.className = 'site-cursor-shape';
  label.className = 'site-cursor-label';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  shape.appendChild(label);
  ring.appendChild(shape);
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mouseX = -80;
  let mouseY = -80;
  let ringX = -80;
  let ringY = -80;
  let visible = false;

  function setMode(target) {
    const feature = target && target.closest('.system-row, .shelf-card');
    const interactive = target && target.closest('a, button, [role="button"]');
    const pdf = target && target.closest('a[href$=".pdf"]');

    ring.classList.toggle('is-feature', Boolean(feature));
    ring.classList.toggle('is-link', Boolean(interactive) && !feature);

    if (feature) label.textContent = feature.classList.contains('system-row') ? 'OPEN' : 'VIEW';
    else if (pdf) label.textContent = 'PDF';
    else label.textContent = '';
  }

  function render() {
    ringX += (mouseX - ringX) * 0.17;
    ringY += (mouseY - ringY) * 0.17;
    dot.style.transform = 'translate3d(' + mouseX + 'px,' + mouseY + 'px,0)';
    ring.style.transform = 'translate3d(' + ringX + 'px,' + ringY + 'px,0)';
    window.requestAnimationFrame(render);
  }

  document.addEventListener('pointermove', function (event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (!visible) {
      visible = true;
      dot.classList.add('is-visible');
      ring.classList.add('is-visible');
    }
  }, { passive: true });

  document.addEventListener('pointerover', function (event) {
    setMode(event.target);
  }, { passive: true });

  document.addEventListener('pointerdown', function () {
    ring.classList.add('is-down');
  }, { passive: true });

  document.addEventListener('pointerup', function () {
    ring.classList.remove('is-down');
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', function () {
    visible = false;
    dot.classList.remove('is-visible');
    ring.classList.remove('is-visible');
  });

  window.addEventListener('blur', function () {
    visible = false;
    dot.classList.remove('is-visible');
    ring.classList.remove('is-visible');
  });

  document.body.classList.add('cursor-ready');
  render();
}

function initMagnetic() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reducedMotion) return;

  qsa('[data-mag]').forEach(function (element) {
    const inner = element.querySelector('.btn-text');

    element.addEventListener('pointermove', function (event) {
      const rect = element.getBoundingClientRect();
      const offsetX = (event.clientX - (rect.left + rect.width / 2)) * 0.16;
      const offsetY = (event.clientY - (rect.top + rect.height / 2)) * 0.18;
      element.style.transform = 'translate3d(' + offsetX + 'px,' + offsetY + 'px,0)';
      if (inner) inner.style.transform = 'translate3d(' + (offsetX * 0.26) + 'px,' + (offsetY * 0.26) + 'px,0)';
    });

    element.addEventListener('pointerleave', function () {
      element.style.transform = '';
      if (inner) inner.style.transform = '';
    });
  });
}

function initSystemsHover() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  qsa('.system-row').forEach(function (row) {
    const system = row.dataset.system;
    const aperture = row.querySelector('.ap-canvas');

    function activate() {
      if (window.__field && window.__field.setSystem) window.__field.setSystem(system);
      row.classList.add('field-active');
    }

    function clear() {
      if (window.__field && window.__field.clearSystem) window.__field.clearSystem();
      row.classList.remove('field-active');
      if (aperture) aperture.style.transform = '';
    }

    row.addEventListener('mouseenter', activate);
    row.addEventListener('mouseleave', clear);
    row.addEventListener('focusin', activate);
    row.addEventListener('focusout', clear);

    if (finePointer && !reducedMotion && aperture) {
      row.addEventListener('pointermove', function (event) {
        const rect = row.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 5;
        aperture.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      });
    }

    row.addEventListener('click', function (event) {
      const link = row.querySelector('.sys-link');
      if (!link || event.target.closest('a')) return;
      window.location.href = link.getAttribute('href');
    });

    row.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('a')) return;
      const link = row.querySelector('.sys-link');
      if (!link) return;
      event.preventDefault();
      window.location.href = link.getAttribute('href');
    });
  });
}

function initAnchors() {
  qsa('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
      window.history.replaceState(null, '', id);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
