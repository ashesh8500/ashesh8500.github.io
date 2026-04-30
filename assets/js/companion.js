/**
 * companion.js — Video-game-style AI companion for Ashesh Kaji's web world
 * 
 * A floating avatar that lives alongside the user as they scroll.
 * Expands into a chat panel. Supports local Bonsai (WebGPU) and
 * DeepSeek V4 Flash (API proxy) with an inference toggle switch.
 * 
 * States: idle, listening, thinking, speaking, error
 */

const COMPANION = {};
const DEEPSEEK_ENDPOINT = "https://deepseek-proxy.ashesh8500.workers.dev";
const DEEPSEEK_MODEL = "deepseek-v4-flash"; // DeepSeek V4 Flash (fast, 284B total / 13B active params)

const PROFILE_CONTEXT = `
You are a browser-local demo assistant on Ashesh Kaji's personal website.
You are not Ashesh. Answer only from this factual profile context and from the visible website content.
If asked about something not present here, say clearly that you do not know from the available website context.
Do not invent roles, achievements, publications, links, dates, or personal facts.

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
- Floating AI companion (this chat) supports local Bonsai 1.7B (WebGPU) and remote DeepSeek V4 Flash (API, proxied via Cloudflare Worker)
- Research blog post: https://asheshkaji.com/projects/system-optimization-methods.html
`;

/* ── Inference mode ── */
let inferenceMode = sessionStorage.getItem("hermes_inference_mode") || "bonsai"; // "bonsai" | "deepseek"
let dsAbortController = null;
let isGenerating = false;
let currentBubble = null;
let accumulatedText = "";

/* ── Companion state ── */
let companionState = "idle"; // idle | listening | thinking | speaking | error
let speechTimeout = null;
let panelOpen = false;

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

  if (!COMPANION.avatar) return;

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
  setTimeout(() => showSpeech("Hey! Ask me anything about Ashesh.", 5000), 2000);

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
  }
}

function showSpeech(text, duration = 4000) {
  if (!COMPANION.speech) return;
  clearTimeout(speechTimeout);
  COMPANION.speech.innerHTML = `<p>${escapeHtml(text)}</p>`;
  COMPANION.speech.removeAttribute("hidden");
  COMPANION.speech.classList.add("visible");
  speechTimeout = setTimeout(() => {
    COMPANION.speech?.classList.remove("visible");
    COMPANION.speech?.setAttribute("hidden", "");
  }, duration);
}

function hideSpeech() {
  clearTimeout(speechTimeout);
  COMPANION.speech?.classList.remove("visible");
  COMPANION.speech?.setAttribute("hidden", "");
}

function startIdleCycle() {
  const idlePhrases = [
    "👋 Ask me about Ashesh's work!",
    "💡 Press ⌘K to chat",
    "⚡ I run locally or via API",
    "🔬 Try asking about NYU research",
    "🦀 Rust, Python, ML, and more!",
  ];
  let idx = 0;
  setInterval(() => {
    if (!panelOpen && companionState === "idle") {
      showSpeech(idlePhrases[idx], 3500);
      idx = (idx + 1) % idlePhrases.length;
    }
  }, 15000);
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
      COMPANION.input.placeholder = "Ask about Ashesh — local Bonsai";
    } else {
      COMPANION.input.placeholder = "Ask about Ashesh — DeepSeek V4 Flash";
    }
  }

  showSpeech(mode === "bonsai" ? "⚡ Switched to local Bonsai" : "🌐 Switched to DeepSeek V4 Flash", 2500);
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
      ? "Local Bonsai 1.7B · WebGPU"
      : "DeepSeek V4 Flash · API";
  }
  if (COMPANION.modelBadge) {
    COMPANION.modelBadge.textContent = inferenceMode === "bonsai" ? "local" : "api";
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
    addMessage("system", "Options: click ⚡ Load real Bonsai in the Ask Me section below, or switch the toggle above to 🌐 DeepSeek API mode and paste your key.");
    setCompanionState("error");
    showSpeech("⚠️ Bonsai not loaded", 3000);
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
      showSpeech("⚠️ Bonsai error", 3000);
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
  showSpeech("", 0); // hide any existing speech

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
      showSpeech("⚠️ API error — check connection", 4000);
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
  avatar.textContent = normRole === "user" ? "YOU" : normRole === "system" ? "⚡" : "DS";

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
  inferenceMode = sessionStorage.getItem("hermes_inference_mode") || "bonsai";
}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  bootCompanion();
  restoreSession();
});

/* Export for external access */
window.companionOpenPanel = openPanel;
window.companionClosePanel = closePanel;
window.companionSetMode = setInferenceMode;
