/**
 * prisml-worker.js — Web Worker for Bonsai 1-bit inference
 * 
 * Runs PrismML's Bonsai 1.7B ONNX model via Transformers.js + WebGPU.
 * Architecture: 1-bit quantization → WebGPU shaders → token streaming.
 * 
 * Model: onnx-community/Bonsai-1.7B-ONNX
 * No server. No API keys. Zero telemetry.
 */

// ─── IMPORTS (via importScripts for Worker compat) ──────────
// Transformers.js is imported via importScripts from CDN at worker init.
// The worker is created with { type: 'module' } so we use import syntax.

let generator = null;
let pastKeyValues = null;
let tokenizer = null;
let isGenerating = false;
let abortController = null;

// ─── WORKER MESSAGE HANDLER ─────────────────────────────────
self.onmessage = async (e) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'check':
      await checkWebGPU();
      break;
    case 'load':
      await loadModel(data);
      break;
    case 'generate':
      await generate(data);
      break;
    case 'stop':
      stopGeneration();
      break;
    case 'reset':
      resetConversation();
      break;
  }
};

// ─── WEbGPU CHECK ───────────────────────────────────────────
async function checkWebGPU() {
  try {
    if (!navigator.gpu) {
      self.postMessage({ type: 'status', status: 'no_webgpu', 
        message: 'WebGPU API not available in this browser' });
      return;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      self.postMessage({ type: 'status', status: 'no_webgpu',
        message: 'No WebGPU adapter found' });
      return;
    }
    self.postMessage({ 
      type: 'status', 
      status: 'webgpu_ok',
      adapter: adapter.name || 'Unknown GPU',
      message: `WebGPU available: ${adapter.name || 'GPU'}`
    });
  } catch (err) {
    self.postMessage({ 
      type: 'status', 
      status: 'no_webgpu',
      message: `WebGPU check failed: ${err.message}`
    });
  }
}

// ─── MODEL LOADING ──────────────────────────────────────────
async function loadModel(modelSize) {
  try {
    // Dynamically import Transformers.js in the worker
    self.postMessage({ type: 'progress', stage: 'import', progress: 0, message: 'Loading Transformers.js...' });
    
    const { pipeline, DynamicCache, InterruptableStoppingCriteria, env } = await import(
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0'
    );
    
    // Configure for browser
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
    
    const MODEL_ID = 'onnx-community/Bonsai-1.7B-ONNX';
    
    self.postMessage({ type: 'progress', stage: 'download', progress: 0, 
      message: 'Downloading Bonsai 1.7B (1-bit, ~290MB)...' });
    
    // Create the pipeline with WebGPU + 1-bit quantization
    generator = await pipeline(
      'text-generation',
      MODEL_ID,
      {
        device: 'webgpu',
        dtype: 'q1',
        progress_callback: (info) => {
          if (info.status === 'progress') {
            const pct = info.total ? Math.round((info.loaded / info.total) * 100) : 0;
            const loadedMB = Math.round((info.loaded || 0) / (1024 * 1024));
            const totalMB = info.total ? Math.round(info.total / (1024 * 1024)) : 290;
            self.postMessage({ 
              type: 'progress', 
              stage: 'download', 
              progress: pct,
              loaded: loadedMB,
              total: totalMB,
              message: `Downloading model... ${pct}% (${loadedMB}MB / ${totalMB}MB)`
            });
          } else if (info.status === 'initiate') {
            self.postMessage({ type: 'progress', stage: 'download', progress: 5, 
              message: 'Connecting to HuggingFace Hub...' });
          }
        },
      }
    );
    
    tokenizer = generator.tokenizer;
    
    // Warmup: run a single token to compile WebGPU shaders
    self.postMessage({ type: 'progress', stage: 'compile', progress: 95, 
      message: 'Compiling WebGPU shaders for 1-bit inference...' });
    
    const inputs = tokenizer('a');
    await generator.model.generate({ ...inputs, max_new_tokens: 1 });
    
    self.postMessage({ type: 'ready', message: 'Bonsai 1.7B loaded and ready' });
    
  } catch (err) {
    console.error('Model load error:', err);
    self.postMessage({ 
      type: 'error', 
      message: `Failed to load model: ${err.message}`,
      fallback: true
    });
  }
}

// ─── TEXT GENERATION ────────────────────────────────────────
async function generate(messages) {
  if (!generator) {
    self.postMessage({ type: 'error', message: 'Model not loaded' });
    return;
  }
  
  isGenerating = true;
  let startTime = null;
  let numTokens = 0;
  let tps = 0;
  
  try {
    // Import needed classes
    const { TextStreamer, DynamicCache, InterruptableStoppingCriteria } = await import(
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0'
    );
    
    const stoppingCriteria = new InterruptableStoppingCriteria();
    abortController = stoppingCriteria;
    
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => {
        self.postMessage({ type: 'token', text, tps, numTokens });
      },
      token_callback_function: () => {
        startTime = startTime || performance.now();
        numTokens++;
        if (numTokens > 1) {
          tps = (numTokens / (performance.now() - startTime)) * 1000;
        }
      },
    });
    
    self.postMessage({ type: 'generating' });
    
    // Initialize or reuse KV cache
    if (!pastKeyValues) {
      const { DynamicCache: DC } = await import(
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0'
      );
      pastKeyValues = new DC();
    }
    
    const output = await generator(messages, {
      max_new_tokens: 256,
      do_sample: true,
      temperature: 0.7,
      top_k: 40,
      top_p: 0.9,
      streamer,
      stopping_criteria: stoppingCriteria,
      past_key_values: pastKeyValues,
    });
    
    const fullText = output[0].generated_text;
    const assistantMsg = Array.isArray(fullText) ? fullText.at(-1)?.content || fullText : fullText;
    
    self.postMessage({ 
      type: 'done', 
      text: typeof assistantMsg === 'string' ? assistantMsg : '',
      tps,
      numTokens
    });
    
  } catch (err) {
    if (err.message?.includes('interrupt') || err.message?.includes('abort')) {
      self.postMessage({ type: 'interrupted' });
    } else {
      self.postMessage({ type: 'error', message: `Generation error: ${err.message}` });
    }
  } finally {
    isGenerating = false;
  }
}

// ─── STOP GENERATION ────────────────────────────────────────
function stopGeneration() {
  if (abortController?.interrupt) {
    abortController.interrupt();
  }
}

// ─── RESET CONVERSATION ─────────────────────────────────────
function resetConversation() {
  if (pastKeyValues?.dispose) {
    pastKeyValues.dispose();
  }
  pastKeyValues = null;
  self.postMessage({ type: 'reset_done' });
}
