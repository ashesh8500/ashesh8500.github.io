/**
 * main.js — v30
 * Chapter tracking, custom cursor, magnetic controls, time.
 */

const D = {};

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function boot() {
  D.markChapter = qs("#markChapter");
  D.progressFill = qs("#progressFill");
  D.localTime = qs("#localTime");
  D.hero = qs("#intro");
  D.footerTime = qs("#footerTime");

  initTime();
  initReveal();
  initChapters();
  initCursor();
  initMagnetic();
  initAnchors();
}

function initTime() {
  function updateTime() {
    try {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      if (D.localTime) D.localTime.textContent = fmt;
      if (D.footerTime) D.footerTime.textContent = fmt + " ET";
    } catch (_) {
      /* Intl unavailable */
    }
  }
  updateTime();
  window.setInterval(updateTime, 30000);
}

function initReveal() {
  if (!D.hero) return;
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      D.hero.classList.add("reveal-in");
    });
  });
}

function initChapters() {
  const sections = qsa("main .section, .hero");
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = documentHeight > 0 ? (scrollY / documentHeight) * 100 : 0;
      if (D.progressFill) D.progressFill.style.width = percent.toFixed(2) + "%";

      let activeId = "intro";
      sections.forEach(function (section) {
        if (scrollY >= section.offsetTop - 140) activeId = section.id || activeId;
      });

      const labels = {
        intro: "",
        work: "work",
        now: "now",
        path: "path",
        links: "elsewhere",
      };
      if (D.markChapter) D.markChapter.textContent = labels[activeId] || activeId;
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initCursor() {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  const dot = document.createElement("div");
  const ring = document.createElement("div");
  const shape = document.createElement("span");
  const label = document.createElement("span");
  dot.className = "site-cursor-dot";
  ring.className = "site-cursor-ring";
  shape.className = "site-cursor-shape";
  label.className = "site-cursor-label";
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
    const interactive = target && target.closest("a, button, [role='button']");
    const pdf = target && target.closest('a[href$=".pdf"]');
    ring.classList.toggle("is-link", Boolean(interactive));
    if (pdf) label.textContent = "PDF";
    else if (interactive) label.textContent = "GO";
    else label.textContent = "";
  }

  function render() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    dot.style.transform = "translate3d(" + mouseX + "px," + mouseY + "px,0)";
    ring.style.transform = "translate3d(" + ringX + "px," + ringY + "px,0)";
    window.requestAnimationFrame(render);
  }

  document.addEventListener(
    "pointermove",
    function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!visible) {
        visible = true;
        dot.classList.add("is-visible");
        ring.classList.add("is-visible");
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "pointerover",
    function (event) {
      setMode(event.target);
    },
    { passive: true }
  );

  document.addEventListener(
    "pointerdown",
    function () {
      ring.classList.add("is-down");
    },
    { passive: true }
  );
  document.addEventListener(
    "pointerup",
    function () {
      ring.classList.remove("is-down");
    },
    { passive: true }
  );

  document.documentElement.addEventListener("mouseleave", function () {
    visible = false;
    dot.classList.remove("is-visible");
    ring.classList.remove("is-visible");
  });

  document.body.classList.add("cursor-ready");
  render();
}

function initMagnetic() {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  qsa("[data-mag]").forEach(function (element) {
    const inner = element.querySelector(".btn-text");
    element.addEventListener("pointermove", function (event) {
      const rect = element.getBoundingClientRect();
      const ox = (event.clientX - (rect.left + rect.width / 2)) * 0.16;
      const oy = (event.clientY - (rect.top + rect.height / 2)) * 0.18;
      element.style.transform = "translate3d(" + ox + "px," + oy + "px,0)";
      if (inner) inner.style.transform = "translate3d(" + ox * 0.26 + "px," + oy * 0.26 + "px,0)";
    });
    element.addEventListener("pointerleave", function () {
      element.style.transform = "";
      if (inner) inner.style.transform = "";
    });
  });
}

function initAnchors() {
  qsa('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      window.history.replaceState(null, "", id);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
