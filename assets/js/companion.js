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
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash"; // DeepSeek V4 Flash (fast, 284B total / 13B active params)

const PROFILE_CONTEXT = `
You are a browser-local demo assistant on Ashesh Kaji's personal website.
You are not Ashesh. You are not fine-tuned on private data. You should answer only from this factual profile context and from the visible website content.
If asked about something not present in this context, say clearly that you do not know from the available website context.
Do not invent roles, achievements, publications, links, dates, or personal facts.

Factual profile context:
- Ashesh Kaji is pursuing an MS in Computer Engineering at NYU Tandon School of Engineering, expected 01/2026 to 12/2027.
- Ashesh completed a BS with Honors in Cognitive Science at UC San Diego, specializing in Machine Learning and Neural Computation, 09/2021 to 06/2025.
- Work includes Consulting AI Engineer at SageX Global, AI Engineer at UniQreate, and Undergraduate Research Assistant at UC San Diego.
- Technical areas: Python, PyTorch, Rust, LLMs, RAG, NLP, MLOps, Azure, AWS, Docker, Git, Linux/CLI, SQL, vector databases, WebAssembly, FPGA/hardware.
- Research: neuroimaging, iron metabolism, NAFLD, neurodegenerative disorders.
- Public links: GitHub ashesh8500, LinkedIn ashesh-kaji-b5a3161b9, email ashesh8500@gmail.com.
`;

/* ── Inference mode ── */
let inferenceMode = sessionStorage.getItem("hermes_inference_mode") || "bonsai"; // "bonsai" | "deepseek"
let dsApiKey = sessionStorage.getItem("ds_api_key") || null;
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
  COMPANION.dsKeySection = document.getElementById("dsKeySection");
  COMPANION.dsKeyInput = document.getElementById("dsApiKeyInput");
  COMPANION.dsKeyBtn = document.getElementById("dsKeyConnectBtn");
  COMPANION.dsKeyStatus = document.getElementById("dsKeyStatus");

  if (!COMPANION.avatar) return;

  /* ── Init toggle to match saved mode ── */
  setToggleUI(inferenceMode);
  updateStatusDisplay();
  if (COMPANION.dsKeySection) {
    COMPANION.dsKeySection.style.display = inferenceMode === "deepseek" ? "flex" : "none";
  }

  /* ── Events ── */
  COMPANION.avatar.addEventListener("click", () => {
    if (panelOpen) closePanel();
    else openPanel();
  });

  COMPANION.closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closePanel();
  });

  COMPANION.toggle?.addEventListener("click", () => {
    const newMode = inferenceMode === "bonsai" ? "deepseek" : "bonsai";
    setInferenceMode(newMode);
  });

  COMPANION.sendBtn?.addEventListener("click", sendMessage);
  COMPANION.input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  COMPANION.dsKeyBtn?.addEventListener("click", connectDeepSeek);

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
  COMPANION.speech.classList.add("visible");
  speechTimeout = setTimeout(() => {
    COMPANION.speech?.classList.remove("visible");
  }, duration);
}

function hideSpeech() {
  clearTimeout(speechTimeout);
  COMPANION.speech?.classList.remove("visible");
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
  COMPANION.wrapper?.classList.add("panel-open");
  document.body.classList.add("companion-panel-open");
  setCompanionState("listening");
  setTimeout(() => COMPANION.input?.focus(), 350);
}

function closePanel() {
  panelOpen = false;
  COMPANION.panel?.classList.remove("open");
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

  /* Show/hide DeepSeek key section */
  if (COMPANION.dsKeySection) {
    COMPANION.dsKeySection.style.display = mode === "deepseek" ? "flex" : "none";
  }

  /* Adjust input placeholder */
  if (COMPANION.input) {
    if (mode === "bonsai") {
      COMPANION.input.placeholder = "Ask about Ashesh — local Bonsai";
    } else {
      COMPANION.input.placeholder = dsApiKey
        ? "Ask about Ashesh — DeepSeek V4 Flash"
        : "Paste DeepSeek key below to enable API chat";
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
   DEEPSEEK KEY MANAGEMENT
   ══════════════════════════════════════════════════════ */

async function connectDeepSeek() {
  const input = COMPANION.dsKeyInput;
  const key = (input?.value || "").trim();
  if (!key) {
    setDsKeyStatus("error", "Paste your DeepSeek API key");
    return;
  }

  setDsKeyStatus("connecting", "Verifying…");
  if (COMPANION.dsKeyBtn) COMPANION.dsKeyBtn.disabled = true;

  try {
    const resp = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
        thinking: { type: "disabled" },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.statusText);
      throw new Error(`DeepSeek ${resp.status}: ${err.slice(0, 200)}`);
    }
  } catch (err) {
    setDsKeyStatus("error", `Failed: ${err.message}`);
    if (COMPANION.dsKeyBtn) COMPANION.dsKeyBtn.disabled = false;
    return;
  }

  dsApiKey = key;
  sessionStorage.setItem("ds_api_key", key);
  if (input) input.value = "";
  setDsKeyStatus("connected", "Connected ✓");
  if (COMPANION.dsKeyBtn) {
    COMPANION.dsKeyBtn.textContent = "✓ connected";
    COMPANION.dsKeyBtn.className = "ds-key-btn connected";
  }
  if (COMPANION.input) {
    COMPANION.input.placeholder = "Ask about Ashesh — DeepSeek V4 Flash";
    COMPANION.input.disabled = false;
  }
  showSpeech("🌐 DeepSeek V4 Flash is ready!", 3000);
}

function setDsKeyStatus(kind, text) {
  if (COMPANION.dsKeyStatus) {
    COMPANION.dsKeyStatus.textContent = text;
    COMPANION.dsKeyStatus.className = `ds-key-status ${kind}`;
  }
}

/* ══════════════════════════════════════════════════════
   MESSAGE SENDING
   ══════════════════════════════════════════════════════ */

function sendMessage() {
  if (isGenerating) return;
  const text = (COMPANION.input?.value || "").trim();
  if (!text) return;

  addMessage("user", text);
  if (COMPANION.input) COMPANION.input.value = "";

  if (inferenceMode === "bonsai") {
    sendBonsaiMessage(text);
  } else {
    sendDeepSeekMessage(text);
  }
}

function sendBonsaiMessage(text) {
  /* Use the shared Bonsai worker + callback system */
  if (!window._bonsaiWorker) {
    if (typeof window.initModel === "function") {
      addMessage("system", "Loading Bonsai model...");
      setCompanionState("thinking");
      window.initModel().then(ok => {
        if (ok && window._bonsaiWorker) {
          _doBonsaiGenerate(text);
        } else {
          addMessage("system", "Bonsai failed to load. Switch to DeepSeek mode (🌐 toggle) or check WebGPU support.");
          setCompanionState("error");
          showSpeech("⚠️ Bonsai unavailable — try API mode", 4000);
          setTimeout(() => setCompanionState("idle"), 4000);
        }
      });
    } else {
      addMessage("system", "Bonsai model system not available. Switch to DeepSeek mode (🌐 toggle).");
    }
    return;
  }
  _doBonsaiGenerate(text);
}

function _doBonsaiGenerate(text) {
  if (!window._bonsaiWorker) return;

  isGenerating = true;
  accumulatedText = "";
  currentBubble = addMessage("assistant", "", true);
  setCompanionState("thinking");
  showSpeech("", 0);

  /* Register one-shot callback */
  const callback = (data) => {
    if (data.type === "start") {
      setCompanionState("speaking");
    } else if (data.type === "update") {
      if (currentBubble) currentBubble.innerHTML = renderText(data.accumulated);
      scrollMessages();
    } else if (data.type === "complete") {
      if (currentBubble && !accumulatedText) {
        currentBubble.innerHTML = renderText(data.text);
      }
      isGenerating = false;
      currentBubble = null;
      if (companionState === "speaking") setCompanionState("idle");
      /* Remove self from callbacks */
      window.__bonsaiTokenCallbacks = window.__bonsaiTokenCallbacks.filter(cb => cb !== callback);
    } else if (data.type === "error") {
      addMessage("system error", `Bonsai error: ${escapeHtml(data.message || "unknown")}`);
      isGenerating = false;
      currentBubble = null;
      setCompanionState("error");
      showSpeech("⚠️ Bonsai error — try API mode", 4000);
      setTimeout(() => setCompanionState("idle"), 4000);
      window.__bonsaiTokenCallbacks = window.__bonsaiTokenCallbacks.filter(cb => cb !== callback);
    }
  };

  window.__bonsaiTokenCallbacks.push(callback);

  window._bonsaiWorker.postMessage({
    type: "generate",
    data: [
      { role: "system", content: PROFILE_CONTEXT },
      { role: "user", content: text },
    ],
  });
}

async function sendDeepSeekMessage(text) {
  if (!dsApiKey) {
    addMessage("system", "DeepSeek API key not connected. Paste your key below.");
    return;
  }

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
        "Authorization": `Bearer ${dsApiKey}`,
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

function addMessage(role, content, returnBubble = false) {
  if (!COMPANION.messages) return null;

  const row = document.createElement("div");
  const normRole = role.includes("user") ? "user" : role.includes("error") ? "error" : role.includes("system") ? "system" : "assistant";
  row.className = `cp-message ${normRole}`;

  const avatar = document.createElement("div");
  avatar.className = `cp-avatar ${normRole}`;
  avatar.textContent = normRole === "user" ? "YOU" : normRole === "system" ? "⚡" : "DS";

  const bubble = document.createElement("div");
  bubble.className = `cp-bubble ${normRole}`;
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
  dsApiKey = sessionStorage.getItem("ds_api_key") || null;
  inferenceMode = sessionStorage.getItem("hermes_inference_mode") || "bonsai";
  
  if (dsApiKey) {
    /* Auto-connect if key exists */
    setDsKeyStatus("connected", "Connected ✓");
    if (COMPANION.dsKeyBtn) {
      COMPANION.dsKeyBtn.textContent = "✓ connected";
      COMPANION.dsKeyBtn.className = "ds-key-btn connected";
      COMPANION.dsKeyBtn.disabled = true;
    }
    if (COMPANION.input) {
      COMPANION.input.disabled = false;
      if (inferenceMode === "deepseek") {
        COMPANION.input.placeholder = "Ask about Ashesh — DeepSeek V4 Flash";
      }
    }
  }
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
