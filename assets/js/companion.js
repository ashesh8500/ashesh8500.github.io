/**
 * companion.js — v30
 * Floating Bayer-dithered orb + unicode progress meter + remote site assistant.
 * States: idle | listening | thinking | speaking | error
 */

(function () {
  const DEEPSEEK_ENDPOINT = "https://deepseek-proxy.ashesh8500.workers.dev";
  const DEEPSEEK_MODEL = "deepseek-v4-flash";

  // Rich dither charset for HQ orb (density ramp)
  const ORB_CHARS = " ··‥:-=+*#%@█";
  const ORB_BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  const PROFILE_CONTEXT = `You answer as Ashesh Kaji in first person on Ashesh Kaji's personal website.
Answer only from this factual profile context and from the visible website content.
If asked about something not present here, say clearly that you do not know from the published site context.
Do not invent roles, achievements, publications, links, dates, or personal facts.
Keep answers concise and natural.

── Profile ──
Name: Ashesh Kaji
Email: ashesh8500@gmail.com
GitHub: https://github.com/ashesh8500
LinkedIn: https://linkedin.com/in/ashesh-kaji-b5a3161b9
Site: https://asheshkaji.com
Résumé: https://asheshkaji.com/Ashesh_Kaji_Resume.pdf

── Education ──
- MS in Computer Engineering, NYU Tandon School of Engineering (01/2026 – 12/2027 expected)
- BS with Honors in Cognitive Science (ML & Neural Computation), UC San Diego (09/2021 – 06/2025)

── Work ──
- Consulting AI Engineer, SageX Global (01/2026–present)
- AI Engineer, SageX Global (09/2024–01/2026): LLM/SLM workflows, RAG, multimodal pipelines
- ML Intern, UniQreate (09/2023–07/2024): production RAG, Azure, local-model deployment
- Undergraduate Research Assistant, UC San Diego, Dr. Mary Boyle's Lab (10/2022–06/2025): UK Biobank & ABCD neuroimaging

── Projects ──
- Fractal Cognition: paper-trading research infrastructure with auditable decision journal. Profitability not established.
- AuditLayer: competitive-intelligence software for wellness creators (https://auditlayermedia.com). Technical cofounder.
- Spatial Intelligence: object association under pose noise at NYU WIRELESS (https://github.com/ashesh8500/habitat)
- Systems Thesis: 60-arm walk-forward portfolio optimization study (https://asheshkaji.com/portfolio/systemopt/)

── Stack ──
Python, Rust, PyTorch, TypeScript, Docker, Azure, AWS, vector DBs, RAG, WebGPU/ONNX, FPGA basics
Languages: English, Gujarati, Hindi
`;

  const el = {};
  let companionState = "idle";
  let panelOpen = false;
  let isGenerating = false;
  let currentBubble = null;
  let accumulatedText = "";
  let speechTimeout = null;
  let abortController = null;
  let orbFrame = 0;
  let orbBoost = 0;
  let meterTick = 0;

  function boot() {
    el.wrapper = document.getElementById("companion");
    el.avatar = document.getElementById("companionAvatar");
    el.canvas = document.getElementById("orbCanvas");
    el.speech = document.getElementById("companionSpeech");
    el.panel = document.getElementById("chatPanel");
    el.closeBtn = document.getElementById("chatPanelClose");
    el.messages = document.getElementById("cpMessages");
    el.input = document.getElementById("cpInput");
    el.sendBtn = document.getElementById("cpSendBtn");
    el.suggestions = document.getElementById("cpSuggestions");
    el.meterBar = document.getElementById("orbMeterBar");
    el.meterLabel = document.getElementById("orbMeterLabel");
    el.statusLine = document.getElementById("cpStatusLine");
    el.openAssistant = document.getElementById("openAssistant");
    el.heroAsk = document.getElementById("heroAsk");

    if (!el.avatar || !el.canvas) return;

    el.avatar.addEventListener("click", function () {
      if (panelOpen) closePanel();
      else openPanel();
    });
    el.closeBtn?.addEventListener("click", function (e) {
      e.stopPropagation();
      closePanel();
    });
    el.sendBtn?.addEventListener("click", sendMessage);
    el.input?.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    el.suggestions?.querySelectorAll("[data-suggest]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!el.input) return;
        el.input.value = btn.getAttribute("data-suggest") || "";
        sendMessage();
      });
    });
    el.openAssistant?.addEventListener("click", openPanel);
    el.heroAsk?.addEventListener("click", openPanel);

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (panelOpen) closePanel();
        else openPanel();
      }
      if (e.key === "Escape" && panelOpen) closePanel();
    });

    initOrb();
    updateMeter();
    window.setTimeout(function () {
      showSpeech("Ask from published context.", 4200);
    }, 2200);
    startIdleHints();
  }

  function setCompanionState(state) {
    companionState = state;
    if (el.avatar) {
      el.avatar.className = "companion-avatar state-" + state;
    }
    if (state === "thinking" || state === "speaking" || state === "listening") {
      orbBoost = Math.max(orbBoost, state === "speaking" ? 1 : 0.75);
    }
    updateMeter();
  }

  /* ── unicode progress meter ── */
  function meterPattern(state, tick) {
    const width = 10;
    const t = tick % 40;

    if (state === "idle") {
      const pulse = Math.floor((Math.sin(tick * 0.08) + 1) * 1.2);
      return "░".repeat(Math.max(0, width - pulse - 1)) + "▒" + "░".repeat(pulse);
    }
    if (state === "listening") {
      const fill = 2 + (t % 3);
      return "▓".repeat(fill) + "░".repeat(width - fill);
    }
    if (state === "thinking") {
      const fill = 3 + Math.floor((t % 20) / 20 * 5);
      return "▓".repeat(fill) + "░".repeat(width - fill);
    }
    if (state === "speaking") {
      let out = "";
      for (let i = 0; i < width; i += 1) {
        const wave = Math.sin(i * 0.9 + tick * 0.35);
        if (wave > 0.45) out += "█";
        else if (wave > 0) out += "▓";
        else if (wave > -0.4) out += "▒";
        else out += "░";
      }
      return out;
    }
    if (state === "error") {
      return t % 8 < 4 ? "▓░▓░▓░▓░▓░" : "░▓░▓░▓░▓░▓";
    }
    return "░".repeat(width);
  }

  function updateMeter() {
    if (el.meterBar) el.meterBar.textContent = meterPattern(companionState, meterTick);
    if (el.meterLabel) el.meterLabel.textContent = companionState;
  }

  function showSpeech(text, duration) {
    if (!el.speech) return;
    clearTimeout(speechTimeout);
    orbBoost = Math.max(orbBoost, 0.55);
    el.speech.innerHTML = "<p>" + escapeHtml(text) + "</p>";
    el.speech.removeAttribute("hidden");
    el.speech.classList.add("visible");
    speechTimeout = setTimeout(function () {
      el.speech.classList.remove("visible");
      el.speech.setAttribute("hidden", "");
    }, duration || 4000);
  }

  function hideSpeech() {
    clearTimeout(speechTimeout);
    el.speech?.classList.remove("visible");
    el.speech?.setAttribute("hidden", "");
  }

  function startIdleHints() {
    const phrases = [
      "Press ⌘K for the assistant.",
      "Ask from published site context.",
      "Unknown details stay unknown.",
    ];
    let idx = 0;
    setInterval(function () {
      if (!panelOpen && companionState === "idle") {
        showSpeech(phrases[idx], 3400);
        idx = (idx + 1) % phrases.length;
      }
    }, 48000);
  }

  /* ── HQ Bayer dither orb ── */
  function initOrb() {
    const canvas = el.canvas;
    const ctx = canvas.getContext("2d");
    const size = canvas.width || 160;
    const cell = 4;
    const cols = Math.ceil(size / cell);
    const rows = Math.ceil(size / cell);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw() {
      orbFrame += 1;
      meterTick += 1;
      if (meterTick % 2 === 0) updateMeter();

      const t = orbFrame * 0.048;
      const active =
        companionState === "thinking" ||
        companionState === "speaking" ||
        companionState === "listening";
      const speed = active ? (companionState === "speaking" ? 2.2 : 1.55) : 0.55;
      const intensity = active ? 0.78 : 0.32;

      orbBoost *= 0.93;
      if (orbBoost < 0.03 && !active) orbBoost = 0;

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "rgba(8, 12, 10, 0.94)";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "700 8px JetBrains Mono, ui-monospace, monospace";
      ctx.textBaseline = "top";

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const px = x * cell + cell / 2;
          const py = y * cell + cell / 2;
          const dx = px - size / 2;
          const dy = py - size / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = size * 0.46;
          if (dist > radius) continue;

          const angle = Math.atan2(dy, dx);
          const ring = Math.sin(dist * 0.22 - t * speed * 2.05) * 0.5 + 0.5;
          const sweep = Math.sin(angle * 4.5 + t * speed + dist * 0.05) * 0.5 + 0.5;
          const speak =
            companionState === "speaking"
              ? Math.sin(angle * 8 + t * 4.2) * 0.18 + 0.12
              : 0;
          const think =
            companionState === "thinking"
              ? ((Math.sin(t * 3 + dist * 0.08) + 1) * 0.08)
              : 0;
          const bayer = ORB_BAYER[y & 3][x & 3] / 16;

          let value = (1 - dist / radius) * 0.52 + ring * 0.22 + sweep * 0.2;
          value += (bayer - 0.5) * 0.48;
          value += orbBoost * 0.24 + speak + think;
          value *= 0.55 + intensity;
          value = Math.max(0, Math.min(1, value));

          const idx = Math.max(
            0,
            Math.min(ORB_CHARS.length - 1, Math.floor(value * (ORB_CHARS.length - 1)))
          );
          const ch = ORB_CHARS[idx];
          if (ch === " " && value < 0.26) continue;

          // dusty sage palette → brighter bone when hot
          const r = Math.floor(120 + value * 80);
          const g = Math.floor(145 + value * 70);
          const b = Math.floor(130 + value * 55);
          const alpha = Math.min(0.95, 0.16 + value * 0.78);
          ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
          ctx.fillText(ch, x * cell, y * cell);
        }
      }

      ctx.strokeStyle = active
        ? "rgba(163,184,168,0.55)"
        : "rgba(163,184,168,0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2);
      ctx.stroke();

      if (!reduced) requestAnimationFrame(draw);
    }

    if (reduced) {
      // single static frame
      draw();
    } else {
      requestAnimationFrame(draw);
    }
  }

  function openPanel() {
    panelOpen = true;
    hideSpeech();
    el.panel?.classList.add("open");
    el.panel?.removeAttribute("hidden");
    el.wrapper?.classList.add("panel-open");
    document.body.classList.add("companion-panel-open");
    setCompanionState("listening");
    setTimeout(function () {
      el.input?.focus();
    }, 280);
  }

  function closePanel() {
    panelOpen = false;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    el.panel?.classList.remove("open");
    el.panel?.setAttribute("hidden", "");
    el.wrapper?.classList.remove("panel-open");
    document.body.classList.remove("companion-panel-open");
    setCompanionState("idle");
  }

  async function sendMessage() {
    if (isGenerating || !el.input) return;
    const text = (el.input.value || "").trim();
    if (!text) return;

    addMessage("user", text);
    el.input.value = "";
    isGenerating = true;
    if (el.sendBtn) el.sendBtn.disabled = true;
    accumulatedText = "";
    currentBubble = addMessage("assistant", "", true);
    setCompanionState("thinking");
    hideSpeech();
    abortController = new AbortController();

    try {
      const resp = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        signal: abortController.signal,
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(function () {
          return resp.statusText;
        });
        throw new Error("Remote " + resp.status + ": " + String(errBody).slice(0, 220));
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
        for (let i = 0; i < lines.length; i += 1) {
          const trimmed = lines[i].trim();
          if (!trimmed || trimmed.indexOf("data: ") !== 0) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta
              ? parsed.choices[0].delta.content
              : null;
            if (delta) {
              accumulatedText += delta;
              if (currentBubble) currentBubble.innerHTML = renderText(accumulatedText);
              scrollMessages();
            }
          } catch (_) {
            /* skip malformed chunk */
          }
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        addMessage("system", "Stopped.");
      } else {
        addMessage(
          "system error",
          "Could not reach the remote assistant. " + escapeHtml(err && err.message ? err.message : "Unknown error")
        );
        setCompanionState("error");
        showSpeech("Remote error.", 3500);
        setTimeout(function () {
          if (companionState === "error") setCompanionState("idle");
        }, 3500);
      }
    }

    isGenerating = false;
    currentBubble = null;
    abortController = null;
    if (el.sendBtn) el.sendBtn.disabled = false;
    if (companionState === "speaking" || companionState === "thinking") {
      setCompanionState(panelOpen ? "listening" : "idle");
    }
    scrollMessages();
  }

  function addMessage(role, content, returnBubble) {
    if (!el.messages) return null;
    let norm = "assistant";
    if (role.indexOf("user") !== -1) norm = "user";
    else if (role.indexOf("error") !== -1) norm = "error";
    else if (role.indexOf("system") !== -1) norm = "system";

    const row = document.createElement("div");
    row.className = "cp-message " + norm;

    const avatar = document.createElement("div");
    avatar.className = "cp-avatar " + norm;
    avatar.textContent = norm === "user" ? "YOU" : "AK";

    const bubble = document.createElement("div");
    bubble.className = "cp-bubble " + norm;
    bubble.innerHTML = norm === "user" ? escapeHtml(content) : renderText(content);

    row.appendChild(avatar);
    row.appendChild(bubble);
    el.messages.appendChild(row);
    scrollMessages();
    return returnBubble ? bubble : null;
  }

  function scrollMessages() {
    if (el.messages) el.messages.scrollTop = el.messages.scrollHeight;
  }

  function renderText(text) {
    if (!text) return "";
    return String(text)
      .replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp);)/g, "&amp;")
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

  window.companionOpenPanel = openPanel;
  window.companionClosePanel = closePanel;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
