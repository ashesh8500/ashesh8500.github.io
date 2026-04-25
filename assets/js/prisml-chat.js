/**
 * prisml-chat.js — global Bonsai drawer for Ashesh Kaji's web world
 *
 * Full transparency policy:
 * - This script never fabricates a fallback answer.
 * - It only sends messages after the real Bonsai 1.7B q1 ONNX model reports ready.
 * - If WebGPU/model loading/generation fails, the drawer shows the exact failure.
 */

let worker = null;
let modelReady = false;
let loadingStarted = false;
let isGenerating = false;
let currentAssistantBubble = null;
let accumulatedText = "";
let lastSmokeResult = null;

const PROFILE_CONTEXT = `
You are a browser-local demo assistant on Ashesh Kaji's personal website.
You are not Ashesh. You are not fine-tuned on private data. You should answer only from this factual profile context and from the visible website content.
If asked about something not present in this context, say clearly that you do not know from the available website context.
Do not invent roles, achievements, publications, links, dates, or personal facts.

Factual profile context:
- Ashesh Kaji is pursuing an MS in Computer Engineering at NYU Tandon School of Engineering, expected 01/2026 to 12/2028.
- Ashesh completed a BS with Honors in Cognitive Science at UC San Diego, specializing in Machine Learning and Neural Computation, 09/2021 to 06/2025.
- Work includes AI Engineer at UniQreate, Artificial Intelligence Engineer and Machine Learning Intern at SageX Global, Instructional Assistant for COGS 18 at UC San Diego, and Undergraduate Research Assistant in Dr. Mary Boyle's Lab at UC San Diego.
- Technical areas shown on the site include Python, PyTorch, Rust, LLMs, RAG, NLP, MLOps, Scikit-Learn, NumPy, Pandas, Azure, AWS, Docker, Git, Linux/CLI, SQL, vector databases, WebAssembly, FPGA/hardware, Statsmodels, and Seaborn.
- Research background includes neuroimaging, iron metabolism, NAFLD, neurodegenerative disorders, UK BioBank data, ABCD study data, and metal exposure from vapes.
- Public links shown on the site: GitHub ashesh8500, LinkedIn ashesh-kaji-b5a3161b9, email ashesh8500@gmail.com, and a local resume page.
`;

const D = {};

function getDom() {
  D.drawer = document.getElementById("agentDrawer");
  D.backdrop = document.getElementById("agentBackdrop");
  D.askSection = document.getElementById("ask");
  D.openButtons = document.querySelectorAll("[data-agent-open]");
  D.closeButtons = document.querySelectorAll("[data-agent-close]");
  D.messages = document.getElementById("chatMessages");
  D.input = document.getElementById("chatInput");
  D.loadBtn = document.getElementById("chatLoadBtn");
  D.smokeBtn = document.getElementById("chatSmokeBtn");
  D.statusDot = document.getElementById("chatStatusDot");
  D.statusText = document.getElementById("chatStatusText");
  D.modelInfo = document.getElementById("chatModelInfo");
  D.progress = document.getElementById("chatProgress");
  D.progressFill = document.getElementById("chatProgressFill");
  D.diagnostics = document.getElementById("chatDiagnostics");
}

function boot() {
  getDom();
  if (!D.messages || !D.input || !D.loadBtn) return;

  D.openButtons.forEach((button) => button.addEventListener("click", openAgent));
  D.closeButtons.forEach((button) => button.addEventListener("click", closeAgent));
  D.backdrop?.addEventListener("click", closeAgent);
  D.loadBtn.onclick = initModel;
  if (D.smokeBtn) D.smokeBtn.onclick = runSmokeTest;
  D.input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openAgent();
    }
    if (event.key === "Escape" && D.drawer?.classList.contains("open")) {
      closeAgent();
    }
  });

  setStatus("idle", "Real Bonsai not loaded yet", "not loaded");
  setDiagnostics("idle", "No model has been loaded. Click Load real Bonsai to attempt WebGPU + q1 ONNX inference.");

  const params = new URLSearchParams(window.location.search);
  if (params.get("agent") === "open") {
    openAgent();
  }

  if (params.has("bonsai-smoke")) {
    openAgent();
    setTimeout(() => runSmokeTest(), 250);
  }
}

function openAgent(event) {
  event?.preventDefault?.();
  getDom();
  D.drawer?.classList.add("open");
  D.backdrop?.classList.add("open");
  document.body.classList.add("agent-open");
  if (!D.drawer && D.askSection) D.askSection.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => (modelReady ? D.input?.focus() : D.loadBtn?.focus()), 100);
}

function closeAgent() {
  D.drawer?.classList.remove("open");
  D.backdrop?.classList.remove("open");
  document.body.classList.remove("agent-open");
}

async function initModel() {
  getDom();
  openAgent();

  if (modelReady) {
    D.input?.focus();
    return true;
  }
  if (loadingStarted) return false;
  loadingStarted = true;

  setStatus("loading", "Creating module worker", "worker");
  setDiagnostics("loading", "Creating a module Web Worker for real local inference. No fallback is enabled.");
  setProgress(2, true);
  D.loadBtn.disabled = true;
  D.loadBtn.textContent = "loading...";
  if (D.smokeBtn) D.smokeBtn.disabled = true;

  try {
    worker = new Worker(new URL("assets/js/prisml-worker.js", window.location.href), { type: "module" });
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (err) => {
      const message = err.message || "Module worker crashed.";
      surfaceHardFailure("worker", message);
    };
    worker.postMessage({ type: "check" });
    return await waitForReadyOrError(180000);
  } catch (err) {
    surfaceHardFailure("worker_create", err.message || String(err));
    return false;
  }
}

function handleWorkerMessage(e) {
  const d = e.data || {};
  switch (d.status) {
    case "webgpu_ok":
      setStatus("loading", `WebGPU OK — ${d.data}`, "webgpu ✓");
      setDiagnostics("webgpu", `WebGPU adapter accepted. Loading onnx-community/Bonsai-1.7B-ONNX with dtype=q1, device=webgpu.`);
      addMessage("system", `WebGPU available: <code>${escapeHtml(d.data || "adapter detected")}</code>. Loading the real Bonsai 1.7B q1 ONNX model now.`);
      setProgress(8, true);
      worker.postMessage({ type: "load", data: "1.7b" });
      break;

    case "loading":
      setStatus("loading", d.data || "Loading Bonsai", "loading");
      setDiagnostics("loading", d.data || "Loading model artifacts.");
      break;

    case "progress_total": {
      const pct = Math.max(0, Math.min(100, Number(d.progress || 0)));
      const loaded = formatBytes(d.loaded);
      const total = formatBytes(d.total);
      setProgress(pct, true);
      setStatus("loading", `Downloading Bonsai ${pct.toFixed(1)}%`, `${loaded}/${total}`);
      setDiagnostics("download", `Downloading/caching real model artifacts: ${pct.toFixed(1)}% (${loaded} / ${total}).`);
      break;
    }

    case "ready":
      modelReady = true;
      loadingStarted = false;
      setProgress(100, false);
      setStatus("online", "Real Bonsai 1.7B q1 is running locally", "real model");
      setDiagnostics("ready", `Model ready: ${d.model || "onnx-community/Bonsai-1.7B-ONNX"}; dtype=${d.dtype || "q1"}; device=${d.device || "webgpu"}.`);
      D.input.disabled = false;
      D.input.placeholder = "Ask about Ashesh — answers are constrained to visible site context";
      D.loadBtn.disabled = false;
      D.loadBtn.textContent = "send";
      D.loadBtn.onclick = sendMessage;
      if (D.smokeBtn) D.smokeBtn.disabled = false;
      addMessage("system", "Model ready. This is real browser-local Bonsai inference, not a canned simulation. If the model does not know something from the site context, it should say so.");
      window.__bonsaiReady = true;
      window.dispatchEvent(new CustomEvent("bonsai-ready"));
      break;

    case "start":
      isGenerating = true;
      accumulatedText = "";
      currentAssistantBubble = addMessage("assistant", "", true);
      setStatus("generating", "Bonsai generating", "streaming");
      break;

    case "update":
      accumulatedText += d.output || "";
      if (currentAssistantBubble) currentAssistantBubble.innerHTML = renderText(accumulatedText);
      if (d.tps != null) setStatus("generating", `Bonsai generating · ${Number(d.tps).toFixed(1)} tok/s`, `${d.numTokens || 0} tok`);
      scrollMessages();
      break;

    case "complete":
      isGenerating = false;
      setStatus("online", "Real Bonsai 1.7B q1 is running locally", "ready");
      if (d.output && currentAssistantBubble && !accumulatedText.trim()) {
        currentAssistantBubble.innerHTML = renderText(d.output);
      }
      currentAssistantBubble = null;
      window.__bonsaiLastOutput = accumulatedText || d.output || "";
      window.dispatchEvent(new CustomEvent("bonsai-complete", { detail: { output: window.__bonsaiLastOutput } }));
      break;

    case "reset_done":
      setDiagnostics("reset", "Conversation KV cache was reset.");
      break;

    case "error":
      surfaceHardFailure(d.phase || "model", d.data || "Unknown Bonsai failure");
      break;

    default:
      setDiagnostics("worker-message", `Unrecognized worker status: ${JSON.stringify(d)}`);
  }
}

function waitForReadyOrError(timeoutMs) {
  return new Promise((resolve) => {
    if (modelReady) return resolve(true);
    const done = (value) => {
      window.removeEventListener("bonsai-ready", onReady);
      window.removeEventListener("bonsai-error", onError);
      clearTimeout(timer);
      resolve(value);
    };
    const onReady = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => {
      surfaceHardFailure("timeout", `Timed out after ${Math.round(timeoutMs / 1000)}s while loading Bonsai.`);
      done(false);
    }, timeoutMs);
    window.addEventListener("bonsai-ready", onReady, { once: true });
    window.addEventListener("bonsai-error", onError, { once: true });
  });
}

function surfaceHardFailure(phase, message) {
  loadingStarted = false;
  modelReady = false;
  isGenerating = false;
  setProgress(0, false);
  setStatus("error", "Bonsai is not running", "failed");
  setDiagnostics("error", `[${phase}] ${message}`);
  if (D.input) {
    D.input.disabled = true;
    D.input.placeholder = "Bonsai failed to load — no simulated answers are available";
  }
  if (D.loadBtn) {
    D.loadBtn.disabled = false;
    D.loadBtn.textContent = "retry real model";
    D.loadBtn.onclick = () => {
      worker?.terminate?.();
      worker = null;
      initModel();
    };
  }
  if (D.smokeBtn) D.smokeBtn.disabled = false;
  addMessage("system error", `Bonsai did not run. No answer will be simulated.<br><code>${escapeHtml(`[${phase}] ${message}`)}</code>`);
  window.__bonsaiError = { phase, message };
  window.dispatchEvent(new CustomEvent("bonsai-error", { detail: window.__bonsaiError }));
}

function sendMessage() {
  getDom();
  if (!modelReady || !worker) {
    addMessage("system error", "The real Bonsai model is not ready. I will not fabricate a response. Click “Load real Bonsai” and wait for the ready state.");
    return;
  }
  if (isGenerating) return;
  const text = (D.input.value || "").trim();
  if (!text) return;

  addMessage("user", text);
  D.input.value = "";

  worker.postMessage({
    type: "generate",
    data: [
      { role: "system", content: PROFILE_CONTEXT },
      { role: "user", content: text },
    ],
  });
}

async function runSmokeTest() {
  getDom();
  openAgent();
  lastSmokeResult = null;
  setDiagnostics("smoke", "Starting Bonsai smoke test: WebGPU check → model load → one constrained generation.");
  addMessage("system", "Smoke test started. This will only pass if the real Bonsai model reaches ready and generates tokens.");

  const loaded = modelReady || await initModel();
  if (!loaded) {
    lastSmokeResult = { ok: false, reason: "model_not_ready", error: window.__bonsaiError || null };
    window.__bonsaiSmokeResult = lastSmokeResult;
    return lastSmokeResult;
  }

  const output = await new Promise((resolve) => {
    const onComplete = (event) => {
      window.removeEventListener("bonsai-error", onError);
      resolve(event.detail?.output || "");
    };
    const onError = () => {
      window.removeEventListener("bonsai-complete", onComplete);
      resolve("");
    };
    window.addEventListener("bonsai-complete", onComplete, { once: true });
    window.addEventListener("bonsai-error", onError, { once: true });
    D.input.value = "In one short sentence, what is Ashesh studying at NYU?";
    sendMessage();
    setTimeout(() => resolve(window.__bonsaiLastOutput || ""), 120000);
  });

  const ok = Boolean(output && output.trim().length > 0);
  lastSmokeResult = { ok, output, ready: modelReady, model: "onnx-community/Bonsai-1.7B-ONNX", dtype: "q1", device: "webgpu" };
  window.__bonsaiSmokeResult = lastSmokeResult;
  setDiagnostics(ok ? "smoke-pass" : "smoke-fail", ok ? `Smoke test passed. Generated ${output.length} chars.` : "Smoke test failed: no generated text received.");
  addMessage("system", ok ? "Smoke test passed: real Bonsai generated a response." : "Smoke test failed: no generated text received. No simulated answer was used.");
  return lastSmokeResult;
}

function setStatus(kind, text, modelInfo) {
  getDom();
  D.statusDot && (D.statusDot.className = `chat-status-dot ${kind}`);
  if (D.statusText) D.statusText.textContent = text;
  if (D.modelInfo) D.modelInfo.textContent = modelInfo || "Bonsai";
}

function setProgress(percent, visible) {
  getDom();
  if (!D.progress || !D.progressFill) return;
  D.progress.hidden = !visible;
  D.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function setDiagnostics(label, message) {
  getDom();
  if (!D.diagnostics) return;
  const now = new Date().toLocaleTimeString();
  D.diagnostics.textContent = `[${now}] ${label}: ${message}`;
}

function addMessage(role, content, returnBubble = false) {
  getDom();
  if (!D.messages) return null;

  const normalizedRole = role.includes("user") ? "user" : role.includes("error") ? "system error" : role.includes("system") ? "system" : "assistant";
  const row = document.createElement("div");
  row.className = `chat-message ${normalizedRole.replace(" ", "-")}`;

  const avatar = document.createElement("div");
  avatar.className = `chat-avatar ${normalizedRole.includes("user") ? "user" : normalizedRole.includes("system") ? "system" : "assistant"}`;
  avatar.textContent = normalizedRole.includes("user") ? "YOU" : normalizedRole.includes("system") ? "i" : "B";

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${normalizedRole.replace(" ", "-")}`;
  bubble.innerHTML = normalizedRole.includes("user") ? escapeHtml(content) : renderText(content);

  row.appendChild(avatar);
  row.appendChild(bubble);
  D.messages.appendChild(row);
  scrollMessages();
  return returnBubble ? bubble : bubble;
}

function scrollMessages() {
  if (D.messages) D.messages.scrollTop = D.messages.scrollHeight;
}

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

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 MB";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
  return `${(value / 1e6).toFixed(0)} MB`;
}

window.initModel = initModel;
window.sendMessage = sendMessage;
window.runBonsaiSmokeTest = runSmokeTest;

document.addEventListener("DOMContentLoaded", boot);
