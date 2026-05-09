/**
 * companion.js - floating site assistant for Ashesh Kaji's personal site
 *
 * A floating dither orb that expands into a chat panel. Supports local
 * Bonsai or the remote DeepSeek proxy.
 *
 * States: idle, listening, thinking, speaking, error
 */

const COMPANION = {};
const DEEPSEEK_ENDPOINT = "https://deepseek-proxy.ashesh8500.workers.dev";
const DEEPSEEK_MODEL = "deepseek-v4-flash"; // DeepSeek V4 Flash (fast, 284B total / 13B active params)
const ORB_CHARS = "  ..::ilLCG0@";
const ORB_BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const PROFILE_CONTEXT = `
You answer as Ashesh Kaji in first person on Ashesh Kaji's personal website.
Answer only from this factual profile context and from the visible website content.
If asked about something not present here, say clearly that I do not know from the published site context.
Do not invent roles, achievements, publications, links, dates, or personal facts.
Keep answers concise and factual.

── Profile ──
Name: Ashesh Kaji
GitHub: https://github.com/ashesh8500
LinkedIn: https://linkedin.com/in/ashesh-kaji-b5a3161b9
Email: ashesh8500@gmail.com
Resume: https://asheshkaji.com/resume.html

── Education ──
- MS in Computer Engineering, NYU Tandon School of Engineering (01/2026 – 12/2027 expected)
- BS with Honors in Cognitive Science (ML & Neural Computation), UC San Diego (09/2021 – 06/2025)
- International Baccalaureate Diploma, JV Parekh International School (2019–2021, score 39/45)

── Work ──
- Consulting AI Engineer, SageX Global (01/2026–present): AI tooling pipelines, LLM deployment, data transformation, production MLOps
- AI Engineer, SageX Global (09/2024–01/2026): LLMs, SLMs, RAG, semantic database memory retrieval, statistical mapping models. Stack: PyTorch, Azure, AWS, LangChain, MCP servers, multimodal data pipelines
- ML Intern, UniQreate (09/2023–07/2024): RAG product in production, Azure integration, serverless LLM deployment
- Undergraduate Research Assistant, UC San Diego Dr. Boyle's Lab (10/2022–06/2025): neuroimaging, iron metabolism, NAFLD, neurodegeneration, UK BioBank, ABCD study

── Projects (with links) ──
- System Optimization Methods: Portfolio allocation as layered system optimization — walk-forward validation, regime detection, attractiveness scoring with provenance-ledger tracking.
  URL: https://asheshkaji.com/projects/system-optimization-methods.html
  GitHub: https://github.com/ashesh8500/system-optimization-portfolio-research

- zkPHIRE: Programmable SumCheck Accelerator for ZKPs — hardware design for NYU Special Topics.
  GitHub: https://github.com/ashesh8500/zkphire

- RL Autonomous Driving: Deep RL for autonomous driving using CARLA simulator — policy gradients, DQN variants, sim-to-real transfer.
  GitHub: https://github.com/ashesh8500/fp185

- MediaSync: Fast, local-first Rust pipeline for photo/video libraries — SHA-256 dedup, legacy container transcoding to MP4, batched cloud upload via rclone/rsync with terminal UI.
  GitHub: https://github.com/ashesh8500/mediasync

- Apple Health Analyzer: Transform Apple Health export data into analyzable CSVs with biomarker visualization.
  GitHub: https://github.com/ashesh8500/apple_health_export

- Project Fractal: Portfolio backtesting and strategy evaluation framework in Rust.
  GitHub: https://github.com/ashesh8500/projectfractal

── Tech Stack ──
Languages: Python, Rust, C++, JavaScript/TypeScript, Shell
ML/AI: PyTorch, NumPy, Pandas, Scikit-Learn, LLMs, RAG, NLP, LangChain, vector databases, MCP servers, ACP
Cloud/Infra: Azure, AWS, Docker, Git, Linux/CLI, serverless deployment
Specialized: FPGA/hardware design, ZKP accelerators, WebAssembly, ONNX/WebGPU inference, quantized models

── This website ──
- Built with vanilla HTML/CSS/JS — no frameworks, no build step
- Hosted on GitHub Pages with custom domain asheshkaji.com
- Floating site assistant supports local Bonsai 1.7B (WebGPU) and remote DeepSeek V4 Flash (API, proxied via Cloudflare Worker)
- Research blog post: https://asheshkaji.com/projects/system-optimization-methods.html
`;

/* ── Inference mode ── */
let inferenceMode = sessionStorage.getItem("hermes_inference_mode") || "deepseek"; // "bonsai" | "deepseek"
let dsAbortController = null;
let isGenerating = false;
let currentBubble = null;
let accumulatedText = "";

/* ── Companion state ── */
let companionState = "idle"; // idle | listening | thinking | speaking | error
let speechTimeout = null;
let panelOpen = false;
let orbMode = "idle";
let orbBoost = 0;
let orbFrame = 0;

function bootCompanion() {
  COMPANION.avatar = document.getElementById("companionAvatar");
  COMPANION.wrapper = document.getElementById("companion");
  COMPANION.speech = document.getElementById("companionSpeech");
  COMPANION.panel = document.getElementById("chatPanel");
  COMPANION.closeBtn = document.getElementById("chatPanelClose");
  COMPANION.messages = document.getElementById("cpMessages");
  COMPANION.input = document.getElementById("cpInput");
  COMPANION.sendBtn = document.getElementById("cpSendBtn");
  COMPANION.toggle = document.getElementById("inferenceToggle");
  COMPANION.toggleThumb = document.getElementById("toggleThumb");
  COMPANION.labelLocal = document.querySelector('.toggle-label[data-mode="bonsai"]');
  COMPANION.labelAPI = document.querySelector('.toggle-label[data-mode="deepseek"]');
  COMPANION.statusLine = document.getElementById("cpStatusLine");
  COMPANION.modelBadge = document.getElementById("cpModelBadge");
  COMPANION.statusDot = document.getElementById("cpStatusDot");
  COMPANION.orbCanvas = document.getElementById("orbCanvas");
  COMPANION.suggestions = document.getElementById("cpSuggestions");

  if (!COMPANION.avatar) return;
  initOrb();

  /* ── Init toggle to match saved mode ── */
  setToggleUI(inferenceMode);
  updateStatusDisplay();

  /* ── Events ── */
  COMPANION.avatar.addEventListener("click", () => {
    if (panelOpen) closePanel();
    else openPanel();
  });

  if (COMPANION.closeBtn) {
    COMPANION.closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePanel();
    });
  }

  if (COMPANION.toggle) {
    COMPANION.toggle.addEventListener("click", () => {
      const newMode = inferenceMode === "bonsai" ? "deepseek" : "bonsai";
      setInferenceMode(newMode);
    });
  }

  /* ── Send button ── */
  if (COMPANION.sendBtn) {
    COMPANION.sendBtn.addEventListener("click", function(e) {
      e.preventDefault();
      companionSend();
    });
  } else {
    console.warn("[companion] cpSendBtn not found in DOM");
  }

  if (COMPANION.input) {
    COMPANION.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        companionSend();
      }
    });
  } else {
    console.warn("[companion] cpInput not found in DOM");
  }

  if (COMPANION.suggestions) {
    COMPANION.suggestions.querySelectorAll("[data-suggest]").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.getAttribute("data-suggest") || "";
        if (!prompt || isGenerating) return;
        pulseOrb("prompt");
        if (COMPANION.input) COMPANION.input.value = prompt;
        companionSend();
      });
    });
  }

  /* ── Keyboard shortcuts ── */
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openPanel();
    }
    if (e.key === "Escape" && panelOpen) {
      closePanel();
    }
  });

  /* ── Show initial greeting ── */
  setTimeout(() => showSpeech("Ask from site context.", 4200), 2600);

  /* ── Idle animations ── */
  startIdleCycle();
}

/* ══════════════════════════════════════════════════════
   COMPANION VISUAL
   ══════════════════════════════════════════════════════ */

function setCompanionState(state) {
  companionState = state;
  if (COMPANION.avatar) {
    COMPANION.avatar.className = `companion-avatar state-${state}`;
    if (orbMode === "suggesting" || orbBoost > 0.04) {
      COMPANION.avatar.classList.add("orb-active");
    }
  }
  if (state === "thinking" || state === "speaking" || state === "listening") {
    pulseOrb(state);
  } else if (state === "error") {
    pulseOrb("error");
  } else if (orbMode !== "suggesting") {
    orbMode = "idle";
  }
}

function showSpeech(text, duration = 4000) {
  if (!COMPANION.speech) return;
  clearTimeout(speechTimeout);
  pulseOrb("suggesting");
  COMPANION.speech.innerHTML = `<p>${escapeHtml(text)}</p>`;
  COMPANION.speech.removeAttribute("hidden");
  COMPANION.speech.classList.add("visible");
  speechTimeout = setTimeout(() => {
    COMPANION.speech?.classList.remove("visible");
    COMPANION.speech?.setAttribute("hidden", "");
    if (orbMode === "suggesting" && companionState === "idle") {
      orbMode = "idle";
      COMPANION.avatar?.classList.remove("orb-active");
    }
  }, duration);
}

function hideSpeech() {
  clearTimeout(speechTimeout);
  COMPANION.speech?.classList.remove("visible");
  COMPANION.speech?.setAttribute("hidden", "");
}

function startIdleCycle() {
  const idlePhrases = [
    "Press Cmd K for the assistant.",
    "Ask from published site context.",
    "Unknown details stay unknown.",
  ];
  let idx = 0;
  setInterval(() => {
    if (!panelOpen && companionState === "idle") {
      showSpeech(idlePhrases[idx], 3500);
      idx = (idx + 1) % idlePhrases.length;
    }
  }, 42000);
}

function pulseOrb(mode = "prompt") {
  orbMode = mode;
  orbBoost = Math.max(orbBoost, mode === "speaking" ? 1 : 0.72);
  COMPANION.avatar?.classList.add("orb-active");
}

function initOrb() {
  const canvas = COMPANION.orbCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const size = canvas.width || 144;
  const cell = 4;
  const cols = Math.ceil(size / cell);
  const rows = Math.ceil(size / cell);

  function draw() {
    orbFrame += 1;
    const t = orbFrame * 0.045;
    const active = companionState === "thinking" || companionState === "speaking" || orbMode === "suggesting";
    const speed = active ? 1.8 : 0.62;
    const intensity = active ? 0.72 : 0.34;
    orbBoost *= 0.94;
    if (orbBoost < 0.03 && !active) {
      orbBoost = 0;
      COMPANION.avatar?.classList.remove("orb-active");
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(2, 9, 9, 0.9)";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "7px JetBrains Mono, SFMono-Regular, monospace";
    ctx.textBaseline = "top";

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const px = x * cell + cell / 2;
        const py = y * cell + cell / 2;
        const dx = px - size / 2;
        const dy = py - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = size * 0.45;
        if (dist > radius) continue;

        const angle = Math.atan2(dy, dx);
        const ring = Math.sin(dist * 0.21 - t * speed * 2.1) * 0.5 + 0.5;
        const sweep = Math.sin(angle * 5 + t * speed + dist * 0.045) * 0.5 + 0.5;
        const bayer = ORB_BAYER[y & 3][x & 3] / 16;
        let value = (1 - dist / radius) * 0.54 + ring * 0.24 + sweep * 0.22;
        value += (bayer - 0.5) * 0.42;
        value += orbBoost * 0.22;
        value *= 0.58 + intensity;
        value = Math.max(0, Math.min(1, value));

        const idx = Math.max(0, Math.min(ORB_CHARS.length - 1, Math.floor(value * (ORB_CHARS.length - 1))));
        const char = ORB_CHARS[idx];
        if (char === " " && value < 0.28) continue;

        const alpha = Math.min(0.92, 0.18 + value * 0.72);
        const r = Math.floor(14 + value * 52);
        const g = Math.floor(96 + value * 134);
        const b = Math.floor(92 + value * 116);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillText(char, x * cell, y * cell);
      }
    }

    ctx.strokeStyle = active ? "rgba(66, 220, 205, 0.44)" : "rgba(66, 220, 205, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

/* ══════════════════════════════════════════════════════
   PANEL OPEN / CLOSE
   ══════════════════════════════════════════════════════ */

function openPanel() {
  panelOpen = true;
  hideSpeech();
  COMPANION.panel?.classList.add("open");
  COMPANION.panel?.removeAttribute("hidden");
  COMPANION.wrapper?.classList.add("panel-open");
  document.body.classList.add("companion-panel-open");
  setCompanionState("listening");
  setTimeout(() => COMPANION.input?.focus(), 350);
}

function closePanel() {
  panelOpen = false;
  COMPANION.panel?.classList.remove("open");
  COMPANION.panel?.setAttribute("hidden", "");
  COMPANION.wrapper?.classList.remove("panel-open");
  document.body.classList.remove("companion-panel-open");
  setCompanionState("idle");
}

/* ══════════════════════════════════════════════════════
   TOGGLE SWITCH
   ══════════════════════════════════════════════════════ */

function setInferenceMode(mode) {
  inferenceMode = mode;
  sessionStorage.setItem("hermes_inference_mode", mode);
  setToggleUI(mode);
  updateStatusDisplay();

  /* Adjust input placeholder */
  if (COMPANION.input) {
    if (mode === "bonsai") {
      COMPANION.input.placeholder = "Ask from site context - local";
    } else {
      COMPANION.input.placeholder = "Ask from site context - remote";
    }
  }

  showSpeech(mode === "bonsai" ? "Local mode selected." : "Remote mode selected.", 2200);
}

function setToggleUI(mode) {
  if (COMPANION.toggleThumb) {
    COMPANION.toggleThumb.className = `toggle-thumb ${mode}`;
  }
  if (COMPANION.labelLocal) {
    COMPANION.labelLocal.classList.toggle("active", mode === "bonsai");
  }
  if (COMPANION.labelAPI) {
    COMPANION.labelAPI.classList.toggle("active", mode === "deepseek");
  }
}

function updateStatusDisplay() {
  if (COMPANION.statusDot) {
    COMPANION.statusDot.className = `cp-status-dot ${inferenceMode}`;
  }
  if (COMPANION.statusLine) {
    COMPANION.statusLine.textContent = inferenceMode === "bonsai"
      ? "local Bonsai - WebGPU"
      : "site context - remote";
  }
  if (COMPANION.modelBadge) {
    COMPANION.modelBadge.textContent = inferenceMode === "bonsai" ? "local" : "remote";
    COMPANION.modelBadge.className = `cp-model-badge ${inferenceMode}`;
  }
}

/* ══════════════════════════════════════════════════════
   MESSAGE SENDING
   ══════════════════════════════════════════════════════ */

function companionSend() {
  if (isGenerating) return;
  const inputEl = COMPANION.input;
  if (!inputEl) {
    addMessage("system error", "Chat input missing. Please refresh.");
    return;
  }
  const text = (inputEl.value || "").trim();
  if (!text) return;
  pulseOrb("prompt");

  /* Echo user message */
  addMessage("user", text);
  inputEl.value = "";

  if (inferenceMode === "bonsai") {
    sendBonsaiMessage(text);
  } else {
    sendDeepSeekMessage(text);
  }
}

function sendBonsaiMessage(text) {
  /* ── Mirror page-based ask-section behavior exactly ── */
  if (!window.__bonsaiReady || !window._bonsaiWorker) {
    addMessage("system", "The real Bonsai model is not ready. No simulated answer.");
    addMessage("system", "Use the local loader in the assistant section, or switch this panel back to remote mode.");
    setCompanionState("error");
    showSpeech("Local model is not loaded.", 3000);
    setTimeout(() => setCompanionState("idle"), 3000);
    return;
  }

  /* Bonsai is ready — stream through worker */
  isGenerating = true;
  accumulatedText = "";
  currentBubble = addMessage("assistant", "", true);
  setCompanionState("thinking");

  var cb = function (data) {
    if (data.type === "start") {
      setCompanionState("speaking");
    } else if (data.type === "update") {
      if (currentBubble) currentBubble.innerHTML = renderText(data.accumulated);
      scrollMessages();
    } else if (data.type === "complete") {
      if (currentBubble && !currentBubble.textContent) {
        currentBubble.innerHTML = renderText(data.text);
      }
      isGenerating = false;
      currentBubble = null;
      setCompanionState("idle");
      window.__bonsaiTokenCallbacks = window.__bonsaiTokenCallbacks.filter(function (c) { return c !== cb; });
    } else if (data.type === "error") {
      addMessage("system error", "Bonsai error: " + escapeHtml(data.message || "unknown"));
      isGenerating = false;
      currentBubble = null;
      setCompanionState("error");
      showSpeech("Local model error.", 3000);
      setTimeout(function () { setCompanionState("idle"); }, 3000);
      window.__bonsaiTokenCallbacks = window.__bonsaiTokenCallbacks.filter(function (c) { return c !== cb; });
    }
  };

  window.__bonsaiTokenCallbacks.push(cb);
  window._bonsaiWorker.postMessage({
    type: "generate",
    data: [
      { role: "system", content: PROFILE_CONTEXT },
      { role: "user", content: text },
    ],
  });
}

async function sendDeepSeekMessage(text) {
  isGenerating = true;
  accumulatedText = "";
  currentBubble = addMessage("assistant", "", true);
  setCompanionState("thinking");
  hideSpeech();

  dsAbortController = new AbortController();

  try {
    const resp = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: PROFILE_CONTEXT },
          { role: "user", content: text },
        ],
        stream: true,
        max_tokens: 512,
        thinking: { type: "disabled" },
      }),
      signal: dsAbortController.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => resp.statusText);
      throw new Error(`DeepSeek ${resp.status}: ${errBody.slice(0, 300)}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    setCompanionState("speaking");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulatedText += delta;
            if (currentBubble) currentBubble.innerHTML = renderText(accumulatedText);
            scrollMessages();
          }
        } catch (_) { /* skip malformed chunks */ }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      addMessage("system", "Generation stopped.");
    } else {
      addMessage("system error", `DeepSeek API error: ${escapeHtml(err.message)}`);
      setCompanionState("error");
      showSpeech("Remote model error.", 4000);
      setTimeout(() => setCompanionState("idle"), 4000);
    }
  }

  isGenerating = false;
  currentBubble = null;
  if (companionState === "speaking" || companionState === "thinking") {
    setCompanionState("idle");
  }
  scrollMessages();
}

/* ══════════════════════════════════════════════════════
   MESSAGES UI
   ══════════════════════════════════════════════════════ */

function addMessage(role, content, returnBubble) {
  if (!COMPANION.messages) return null;
  if (returnBubble === undefined) returnBubble = false;

  var row = document.createElement("div");
  var normRole;
  if (role.indexOf("user") !== -1) normRole = "user";
  else if (role.indexOf("error") !== -1) normRole = "error";
  else if (role.indexOf("system") !== -1) normRole = "system";
  else normRole = "assistant";
  row.className = "cp-message " + normRole;

  var avatar = document.createElement("div");
  avatar.className = "cp-avatar " + normRole;
  avatar.textContent = normRole === "user" ? "YOU" : "AK";

  var bubble = document.createElement("div");
  bubble.className = "cp-bubble " + normRole;
  bubble.innerHTML = normRole === "user" ? escapeHtml(content) : renderText(content);

  row.appendChild(avatar);
  row.appendChild(bubble);
  COMPANION.messages.appendChild(row);
  scrollMessages();
  return bubble;
}

function scrollMessages() {
  if (COMPANION.messages) {
    COMPANION.messages.scrollTop = COMPANION.messages.scrollHeight;
  }
}

/* ══════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════ */

function renderText(text) {
  if (!text) return "";
  return String(text)
    .replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp|mdash);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ══════════════════════════════════════════════════════
   RESTORE SESSION KEY
   ══════════════════════════════════════════════════════ */

function restoreSession() {
  inferenceMode = sessionStorage.getItem("hermes_inference_mode") || "deepseek";
}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();
  bootCompanion();
});

/* Export for external access */
window.companionOpenPanel = openPanel;
window.companionClosePanel = closePanel;
window.companionSetMode = setInferenceMode;
