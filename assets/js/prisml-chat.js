/**
 * prisml-chat.js — Ask Me Anything (Chat UI)
 * 
 * Browser-native AI chat powered by PrismML's Bonsai 1.7B
 * Runs the REAL model via Web Worker + Transformers.js + WebGPU
 * 
 * Model: onnx-community/Bonsai-1.7B-ONNX (1-bit, ~290MB)
 * No server. No API keys. Zero data leaves your browser.
 */

// ─── WORKER ────────────────────────────────────────────────
let worker = null;
let currentAssistantBubble = null;
let accumulatedText = '';

// ─── DOM REFS ──────────────────────────────────────────────
const D = {};

function getDom() {
  D.messages = document.getElementById('chatMessages');
  D.input = document.getElementById('chatInput');
  D.loadBtn = document.getElementById('chatLoadBtn');
  D.statusDot = document.getElementById('chatStatusDot');
  D.statusText = document.getElementById('chatStatusText');
  D.modelInfo = document.getElementById('chatModelInfo');
}

// ─── INIT ──────────────────────────────────────────────────
async function initModel() {
  getDom();
  
  if (D.loadBtn.disabled && D.loadBtn.textContent.includes('Loading')) return;
  if (worker && D.loadBtn.textContent === '▸ Send') {
    // Already loaded, just focus input
    D.input.focus();
    return;
  }
  
  // Disable during init
  D.loadBtn.textContent = '⟳ Initializing...';
  D.loadBtn.disabled = true;
  D.loadBtn.style = '';
  
  setStatus('loading', 'Creating Web Worker...', 'Bonsai 1.7B');
  
  try {
    // Create Web Worker
    const workerUrl = new URL('assets/js/prisml-worker.js', window.location.href);
    worker = new Worker(workerUrl, { type: 'module' });
    
    // Worker message handler
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (err) => {
      console.error('Worker error:', err);
      setStatus('error', 'Worker crashed — try refreshing', 'error');
      addMessage('system', '❌ <strong>Worker error.</strong> Your browser may not support Web Workers with ES modules. Try Chrome 113+.');
    };
    
    // Step 1: Check WebGPU
    worker.postMessage({ type: 'check' });
    
  } catch (err) {
    console.error('Worker creation failed:', err);
    handleFallback('Could not create Web Worker for model inference');
  }
}

function handleWorkerMessage(e) {
  const { type, status, message, progress, stage, loaded, total, text, tps, numTokens, fallback } = e.data;
  
  switch (type) {
    case 'status':
      if (status === 'webgpu_ok') {
        setStatus('loading', 'WebGPU detected — loading Bonsai 1.7B...', 'WebGPU ✓');
        addMessage('system', `✅ <strong>WebGPU available</strong> — ${message}<br><small>Proceeding to load Bonsai 1.7B (1-bit, ~290MB)</small>`);
        // Start loading
        worker.postMessage({ type: 'load', data: '1.7b' });
      } else if (status === 'no_webgpu') {
        handleFallback(message);
      }
      break;
      
    case 'progress':
      const pctStr = progress !== undefined ? ` ${progress}%` : '';
      if (stage === 'compile') {
        setStatus('loading', message, 'Compiling shaders...');
        addMessage('system', `⚙️ ${message}`);
      } else {
        setStatus('loading', message, `${loaded || '?'}MB / ${total || '290'}MB`);
        // Update load button progress
        if (progress !== undefined) {
          D.loadBtn.textContent = `⟳ ${progress}%`;
        }
      }
      break;
      
    case 'ready':
      setStatus('online', 'Bonsai 1.7B · running locally', '1-bit · WebGPU');
      D.loadBtn.textContent = '▸ Send';
      D.loadBtn.disabled = false;
      D.loadBtn.style.background = 'var(--accent-purple)';
      D.input.disabled = false;
      D.input.placeholder = 'Ask me about Ashesh...';
      D.input.focus();
      
      // Wire up send
      D.input.addEventListener('keydown', handleKeydown);
      D.loadBtn.onclick = () => sendMessage();
      
      addMessage('system', `⚡ <strong>Bonsai 1.7B loaded!</strong><br>1-bit quantized model · WebGPU accelerated · running entirely in your browser<br><small>Try asking: "What projects has Ashesh built?" or "Tell me about his research"</small>`);
      break;
      
    case 'generating':
      // Create empty assistant bubble for streaming
      currentAssistantBubble = createStreamingBubble();
      accumulatedText = '';
      break;
      
    case 'token':
      if (currentAssistantBubble) {
        accumulatedText += text;
        currentAssistantBubble.innerHTML = formatText(accumulatedText);
        scrollToBottom();
      }
      break;
      
    case 'done':
      if (currentAssistantBubble) {
        currentAssistantBubble.innerHTML = formatText(accumulatedText);
      }
      currentAssistantBubble = null;
      D.input.disabled = false;
      D.loadBtn.disabled = false;
      D.input.focus();
      break;
      
    case 'interrupted':
      if (currentAssistantBubble) {
        currentAssistantBubble.innerHTML = formatText(accumulatedText + ' <em>[stopped]</em>');
      }
      currentAssistantBubble = null;
      D.input.disabled = false;
      D.loadBtn.disabled = false;
      D.input.focus();
      break;
      
    case 'error':
      console.error('Worker error:', message);
      if (fallback) {
        handleFallback(message);
      } else {
        addMessage('system', `❌ ${message}`);
        D.input.disabled = false;
        D.loadBtn.disabled = false;
      }
      break;
      
    case 'reset_done':
      addMessage('system', '🔄 Conversation reset.');
      break;
  }
}

// ─── FALLBACK ──────────────────────────────────────────────
function handleFallback(reason) {
  // Clean up worker
  if (worker) { worker.terminate(); worker = null; }
  
  setStatus('online', 'simulation mode · ' + (reason || 'WebGPU unavailable'), 'local');
  D.loadBtn.textContent = '▸ Send';
  D.loadBtn.disabled = false;
  D.loadBtn.style.background = 'var(--accent-purple)';
  D.input.disabled = false;
  D.input.placeholder = 'Ask me about Ashesh...';
  
  D.input.addEventListener('keydown', handleKeydown);
  D.loadBtn.onclick = () => sendMessage();
  
  addMessage('system', `⚡ Running in <strong>simulation mode</strong>. ${reason || 'WebGPU not available'}.<br><small>The full 1-bit Bonsai 1.7B requires Chrome 113+ with WebGPU enabled. Try again in Chrome for the real model running locally in your browser.</small>`);
  
  D.input.focus();
}

// ─── SEND MESSAGE ──────────────────────────────────────────
async function sendMessage() {
  const text = D.input.value.trim();
  if (!text) return;
  
  D.input.value = '';
  D.input.disabled = true;
  D.loadBtn.disabled = true;
  
  addMessage('user', text);
  
  if (worker && D.statusDot.classList.contains('online')) {
    // Real model inference via worker
    const messages = [
      { role: 'system', content: 'You are Ashesh Kaji, an AI Engineer pursuing an MS in Computer Engineering at NYU Tandon. You hold a BS with Honors in Cognitive Science (ML & Neural Computation) from UC San Diego. You have worked at SageX Global and UniQreate as an AI/ML Engineer, building RAG pipelines, fine-tuning LLMs, and deploying production AI systems. You are an expert in efficient ML inference, 1-bit quantization, Rust, and Python. You are friendly and concise. Respond as Ashesh would.' },
      { role: 'user', content: text },
    ];
    
    worker.postMessage({ type: 'generate', data: messages });
  } else {
    // Simulation fallback
    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    const response = getSimulatedResponse(text);
    addMessage('assistant', response);
    D.input.disabled = false;
    D.loadBtn.disabled = false;
    D.input.focus();
  }
}

// ─── STREAMING BUBBLE ──────────────────────────────────────
function createStreamingBubble() {
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `
    <div class="chat-avatar assistant">AK</div>
    <div class="chat-bubble assistant" id="streamingBubble"></div>
  `;
  D.messages.appendChild(div);
  return div.querySelector('#streamingBubble');
}

// ─── ADD MESSAGE ───────────────────────────────────────────
function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = 'chat-message';
  
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar ' + (role === 'user' ? 'user' : 'assistant');
  avatar.textContent = role === 'user' ? 'U' : 'AK';
  
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (role === 'user' ? 'user' : 'assistant');
  
  if (role === 'system') {
    bubble.className = 'chat-bubble system';
    bubble.innerHTML = content;
  } else if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = content;
  }
  
  div.appendChild(avatar);
  div.appendChild(bubble);
  D.messages.appendChild(div);
  scrollToBottom();
}

// ─── SIMULATION FALLBACK ───────────────────────────────────
function getSimulatedResponse(query) {
  const q = query.toLowerCase();
  
  if (q.includes('hello') || q.includes('hi') || q.includes('hey'))
    return "Hey! 👋 I'm Ashesh. I'm an AI Engineer and grad student at NYU. What would you like to know?";
  if (q.includes('project') || q.includes('build') || q.includes('github') || q.includes('portfolio'))
    return "I've built several projects: an <strong>RL-based autonomous driving system</strong> using CARLA, a <strong>statistical portfolio optimization engine</strong>, an <strong>Apple Health data analyzer</strong>, a <strong>Rust media sync CLI (mediasync)</strong>, and a <strong>ZKP FPGA accelerator</strong>. Check them out on my GitHub!";
  if (q.includes('experience') || q.includes('work') || q.includes('job') || q.includes('career') || q.includes('sagex'))
    return "I've worked at <strong>SageX Global</strong> (AI Engineer + ML Intern) where I built RAG pipelines, fine-tuned LLMs, and deployed production AI systems. Currently at <strong>UniQreate</strong> as an AI Engineer. I also did neuroscience research at <strong>UC San Diego</strong> studying iron metabolism and neurodegenerative disorders.";
  if (q.includes('skill') || q.includes('tech') || q.includes('stack') || q.includes('language') || q.includes('code'))
    return "My core stack: <strong>Python, PyTorch, Rust, MLOps, NLP, RAG, LLMs, Azure, AWS, Docker, WebAssembly</strong>. I also work with NumPy, Pandas, Scikit-Learn, and FPGA hardware design. I'm comfortable across the full ML lifecycle — from research to production.";
  if (q.includes('education') || q.includes('school') || q.includes('degree') || q.includes('study') || q.includes('nyu') || q.includes('ucsd'))
    return "I'm pursuing an <strong>MS in Computer Engineering at NYU Tandon</strong> (2026-2028). I did my undergrad at <strong>UC San Diego</strong> — BS with Honors in Cognitive Science, specializing in Machine Learning and Neural Computation. I also hold an <strong>IB Diploma</strong> (39/45).";
  if (q.includes('research') || q.includes('neuroscience') || q.includes('brain') || q.includes('iron') || q.includes('mri'))
    return "At UCSD, I researched under Dr. Mary Boyle, studying the relationship between <strong>peripheral iron levels and neurodegenerative disorders</strong> using UK BioBank data. I also explored how metal exposure from vapes affects brain MRI imaging in the ABCD study cohort.";
  if (q.includes('interest') || q.includes('passion') || q.includes('love') || q.includes('hobby'))
    return "I'm fascinated by <strong>efficient ML inference</strong> — 1-bit and ternary quantized models that run in your browser. I love the intersection of hardware and software: FPGA accelerators, WebGPU, and making AI accessible without the cloud. Also a big fan of Rust and well-designed CLIs.";
  if (q.includes('language') || q.includes('speak'))
    return "I'm trilingual: <strong>English, Gujarati, and Hindi</strong> — all at native/bilingual proficiency.";
  
  return "That's a great question! As an AI Engineer and grad student at NYU, I'm passionate about efficient ML systems, 1-bit models, and building things that work at the edge. Ask me about my projects at SageX, my research at UCSD, or the tech I'm excited about!";
}

// ─── FORMAT TEXT ───────────────────────────────────────────
function formatText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// ─── SCROLL ────────────────────────────────────────────────
function scrollToBottom() {
  requestAnimationFrame(() => {
    D.messages.scrollTop = D.messages.scrollHeight;
  });
}

// ─── KEYDOWN ───────────────────────────────────────────────
function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ─── STATUS ────────────────────────────────────────────────
function setStatus(status, text, modelText) {
  if (D.statusDot) D.statusDot.className = 'chat-status-dot ' + status;
  if (D.statusText) D.statusText.textContent = text;
  if (D.modelInfo) D.modelInfo.textContent = modelText;
}

// ─── EXPORT ────────────────────────────────────────────────
window.initModel = initModel;
