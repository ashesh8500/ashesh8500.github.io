/**
 * main.js — v14 — monumental editorial
 * - command palette (Cmd+K) single entry for assistant + nav
 * - chapter tracking: topbar indicator + progress + hero %
 * - magnetic buttons (data-mag)
 * - local time
 * - hero reveal
 * - system-row → field hooks
 * - palette assistant: remote DeepSeek via Cloudflare Worker
 * - NO github repo fetch — curated selected systems only
 */

const DEEPSEEK_ENDPOINT = "https://deepseek-proxy.ashesh8500.workers.dev";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

const PROFILE_CONTEXT = `
You are the project guide on Ashesh Kaji's personal website asheshkaji.com.
Refer to Ashesh in the third person; do not impersonate him or claim to speak on his behalf.
Answer only from the factual context below and from the visible website content.
If asked about something not in this context, say clearly that you do not know from the published site.
Do not invent roles, links, numbers, or private details. Keep answers concise.

Identity:
- Ashesh Kaji — MS Computer Engineering, NYU Tandon (2026–27). BS with Honors in Cognitive Science, ML & Neural Computation, UC San Diego (2021–25).

Selected work:
- Fractal Cognition: a continuously running paper-trading research system with observations, allocation, risk gates, execution plumbing, and an auditable decision journal.
- AuditLayer: competitive-intelligence software for wellness creators. Production product at auditlayermedia.com.
- Spatial Intelligence: runtime object association across viewpoint and pose noise using visual, geometric, and graph features, with strict-threshold evaluation. NYU WIRELESS.
- Systems Thesis: treating portfolio allocation as a layered optimization problem — walk-forward validation, regime detection, attractiveness, full provenance.

Trajectory:
- Consulting AI Engineer & AI Engineer at SageX Global (2024–present): LLM tooling, deployment, retrieval systems, MLOps.
- ML Intern at UniQreate (2023–24): production RAG, vector DBs, Azure, serverless local-model deployment.
- Undergrad Research Assistant at UC San Diego, Dr. Boyle's Lab (2022–25): neuroimaging, UK BioBank & ABCD.
- Links: GitHub github.com/ashesh8500 · email ashesh8500@gmail.com · résumé PDF /Ashesh_Kaji_Resume.pdf · archive /archive
- Stack: Python, Rust, PyTorch, TypeScript, Linux, Docker, WebGPU, FPGA, RL.
`;

const D = {};
const inferenceMode = 'deepseek';
let generating = false;
let bubbleEl = null;
let accumText = '';
let abortCtrl = null;

function qs(s, r = document) { return r.querySelector(s); }
function qsa(s, r = document) { return [...r.querySelectorAll(s)]; }

function boot() {
  // dom
  D.topbar = qs('#topbar');
  D.markMain = qs('#markMain');
  D.markChapter = qs('#markChapter');
  D.progressFill = qs('#progressFill');
  D.localTime = qs('#localTime');
  D.currentFocus = qs('#currentFocus');
  D.hero = qs('#thesis');
  D.heroAccum = qs('#heroScrollAccum');
  D.footerTime = qs('#footerTime');
  D.palette = qs('#palette');
  D.paletteBackdrop = qs('#paletteBackdrop');
  D.paletteInput = qs('#paletteInput');
  D.paletteChat = qs('#paletteChat');
  D.paletteChatLog = qs('#paletteChatLog');
  D.paletteModelBadge = qs('#paletteModelBadge');
  D.paletteStatus = qs('#paletteStatus');
  D.pfDot = qs('#pfDot');
  D.pfModel = qs('#pfModel');

  D.cmdTrigger = qs('#cmdTrigger');
  D.footerCmdBtn = qs('#footerCmdBtn');

  initTime();
  initReveal();
  initChapters();
  initMagnetic();
  initPalette();
  initSystemsHover();
  initAnchors();
  initFooterClock();
  syncModeUI();

  // expose legacy hooks
  window.companionOpenPanel = openPalette;
  window.__field?.clearSystem?.();


}

function initTime() {
  function updateTime() {
    try {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
      if (D.localTime) D.localTime.textContent = fmt;
      if (D.footerTime) D.footerTime.textContent = fmt + ' ET · ' + now.getFullYear();
    } catch { /* ignore */ }
  }
  updateTime();
  setInterval(updateTime, 30000);
}
function initFooterClock() { /* handled inside initTime */ }

function initReveal() {
  if (!D.hero) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      D.hero.classList.add('reveal-in');
    });
  });
}

function initChapters() {
  const sections = qsa('.chapter, .hero');
  const accumEl = D.heroAccum;
  const fill = D.progressFill;
  const markChapter = D.markChapter;
  const currentFocus = D.currentFocus;

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? (sy / docH) * 100 : 0;
      if (fill) fill.style.width = pct.toFixed(2) + '%';
      if (accumEl) accumEl.textContent = pct.toFixed(0) + '% ACCUM';

      // chapter active
      let activeId = 'thesis';
      for (const s of sections) {
        const top = s.offsetTop - 140;
        if (sy >= top) activeId = s.id || activeId;
      }
      const labelMap = {
        thesis: 'thesis', selected: 'selected systems', signal: 'current signal', trajectory: 'trajectory', archive: 'archive / research shelf'
      };
      if (markChapter) markChapter.textContent = labelMap[activeId] || activeId;
      if (currentFocus) currentFocus.textContent = labelMap[activeId] || activeId;

      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initMagnetic() {
  const els = qsa('[data-mag]');
  // skip on touch
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (!fine) return;
  els.forEach(el => {
    let bx = 0, by = 0;
    const t = el.querySelector('.btn-text') || el;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      bx = (e.clientX - cx) * 0.18;
      by = (e.clientY - cy) * 0.24;
      el.style.transform = `translate(${bx}px, ${by}px)`;
      if (t && t !== el) t.style.transform = `translate(${bx * 0.28}px, ${by * 0.28}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0,0)';
      if (t && t !== el) t.style.transform = 'translate(0,0)';
    });
  });
}

function initSystemsHover() {
  const rows = qsa('.system-row');
  rows.forEach(row => {
    const sys = row.dataset.system;
    const set = () => { window.__field?.setSystem?.(sys); row.classList.add('field-active'); };
    const clr = () => { window.__field?.clearSystem?.(); row.classList.remove('field-active'); };
    row.addEventListener('mouseenter', set);
    row.addEventListener('mouseleave', clr);
    row.addEventListener('focus', set);
    row.addEventListener('blur', clr);
    // click anywhere on row → follow primary link
    row.addEventListener('click', (e) => {
      const link = row.querySelector('.sys-link');
      if (!link) return;
      if (e.target.closest('a')) return;
      window.location.href = link.getAttribute('href');
    });
  });
}

function initAnchors() {
  qsa('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });
}

/* ─── PALETTE ─── */
function initPalette() {
  if (!D.palette || !D.paletteBackdrop || !D.paletteInput) return;

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  const open = () => openPalette();
  const close = () => closePalette();

  D.cmdTrigger?.addEventListener('click', open);
  D.footerCmdBtn?.addEventListener('click', open);
  D.paletteBackdrop.addEventListener('click', close);

  D.palette.addEventListener('click', (e) => {
    const jump = e.target.closest?.('[data-jump]');
    if (jump) {
      const id = jump.dataset.jump;
      close();
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const ask = e.target.closest?.('[data-ask]');
    if (ask) {
      const q = ask.dataset.ask;
      if (!q) return;
      D.paletteInput.value = q;
      submitAsk(q);
    }
  });

  D.paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = D.paletteInput.value.trim();
      if (v) submitAsk(v);
    }
    if (e.key === 'Escape') {
      if (generating && abortCtrl) { abortCtrl.abort(); }
      else close();
    }
  });

  // global hotkeys
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (D.palette.hidden) open();
      else close();
    }
    const tagEditable = isEditable(document.activeElement);
    if (e.key === '/' && !tagEditable && D.palette.hidden && !e.metaKey && !e.ctrlKey) {
      // don't hijack when typing
      // allow quick open via "/"
      e.preventDefault();
      open();
    }
    if (e.key === 'Escape' && !D.palette.hidden) {
      if (generating && abortCtrl) { abortCtrl.abort(); }
      else close();
    }
  });
}

function openPalette() {
  if (!D.palette) return;
  D.palette.hidden = false;
  D.paletteBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    D.paletteInput.focus();
    D.paletteInput.select();
  });
  // field compression for thinking state affordance
  window.__field?.setIntensity?.(0.86);
}

function closePalette() {
  if (!D.palette) return;
  D.palette.hidden = true;
  D.paletteBackdrop.hidden = true;
  document.body.style.overflow = '';
  if (generating && abortCtrl) {
    try { abortCtrl.abort(); } catch {}
  }
  window.__field?.setIntensity?.(1);
}

function addPaletteMessage(role, text, returnBubble) {
  if (!D.paletteChatLog) return null;
  D.paletteChat.hidden = false;
  D.paletteChatLog.hidden = false;
  const row = document.createElement('div');
  const norm = role.includes('user') ? 'user' : role.includes('system') && role.includes('error') ? 'error' : role.includes('system') ? 'system' : 'assistant';
  row.className = 'pc-msg ' + norm;
  const av = document.createElement('div');
  av.className = 'pc-av ' + norm;
  av.textContent = norm === 'user' ? 'YOU' : 'SITE';
  const bub = document.createElement('div');
  bub.className = 'pc-bubble ' + norm;
  bub.innerHTML = norm === 'user' ? esc(text) : renderMd(text);
  row.appendChild(av);
  row.appendChild(bub);
  D.paletteChatLog.appendChild(row);
  D.paletteChatLog.scrollTop = D.paletteChatLog.scrollHeight;
  if (D.paletteChatLog.parentElement) D.paletteChatLog.parentElement.scrollTop = D.paletteChatLog.parentElement.scrollHeight;
  return bub;
}

async function submitAsk(text) {
  if (generating) return;
  if (!text || !text.trim()) return;
  const t = text.trim();
  addPaletteMessage('user', t);
  D.paletteInput.value = '';
  return submitRemote(t);
}

function syncModeUI() {
  if (D.pfDot) D.pfDot.classList.add('on');
  if (D.pfModel) D.pfModel.textContent = 'remote ready — ' + DEEPSEEK_MODEL;
  if (D.paletteModelBadge) D.paletteModelBadge.textContent = inferenceMode;
  if (D.paletteStatus) D.paletteStatus.textContent = 'remote · published project context';
}

async function submitRemote(text) {
  generating = true;
  accumText = '';
  bubbleEl = addPaletteMessage('assistant', '');
  if (window.__field) window.__field.setIntensity(0.42);
  abortCtrl = new AbortController();

  try {
    const resp = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'system', content: PROFILE_CONTEXT }, { role: 'user', content: text }],
        stream: true,
        max_tokens: 640,
        thinking: { type: 'disabled' }
      }),
      signal: abortCtrl.signal
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => resp.statusText);
      throw new Error('DeepSeek ' + resp.status + ': ' + body.slice(0, 400));
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const tr = line.trim();
        if (!tr || !tr.startsWith('data: ')) continue;
        const data = tr.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumText += delta;
            if (bubbleEl) bubbleEl.innerHTML = renderMd(accumText);
            scrollChat();
          }
        } catch { /* skip */ }
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      addPaletteMessage('system', 'Generation stopped.');
    } else {
      addPaletteMessage('system error', 'Remote error: ' + esc(err.message || String(err)));
    }
  }
  generating = false;
  bubbleEl = null;
  abortCtrl = null;
  if (window.__field) window.__field.setIntensity(1);
}

function scrollChat() {
  if (!D.paletteChatLog) return;
  D.paletteChatLog.scrollTop = D.paletteChatLog.scrollHeight;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderMd(s) {
  if (!s) return '';
  return String(s)
    .replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp|mdash);)/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
