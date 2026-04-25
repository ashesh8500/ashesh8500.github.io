/**
 * prisml-worker.js — real Bonsai 1-bit inference worker
 *
 * This worker intentionally has NO simulation fallback.
 * If WebGPU, model download, ONNX execution, or generation fails, the UI receives
 * an error and must disclose it.
 *
 * Reference implementation checked against:
 * https://huggingface.co/spaces/webml-community/bonsai-webgpu/raw/main/src/worker.js
 */

import {
  pipeline,
  TextStreamer,
  DynamicCache,
  InterruptableStoppingCriteria,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.1.0";

const MODEL_IDS = {
  "1.7b": "onnx-community/Bonsai-1.7B-ONNX",
};

class TextGenerationPipeline {
  static instances = new Map();

  static getInstance(modelKey, progress_callback = null) {
    const modelId = MODEL_IDS[modelKey];
    if (!modelId) throw new Error(`Unknown Bonsai model key: ${modelKey}`);

    if (!this.instances.has(modelKey)) {
      this.instances.set(
        modelKey,
        pipeline("text-generation", modelId, {
          device: "webgpu",
          dtype: "q1",
          progress_callback,
        }),
      );
    }
    return this.instances.get(modelKey);
  }
}

const stoppingCriteria = new InterruptableStoppingCriteria();
let pastKeyValuesCache = null;
let currentModelKey = null;

function disposePastKeyValues() {
  pastKeyValuesCache?.dispose?.();
  pastKeyValuesCache = null;
}

async function check() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error("WebGPU is not supported: no adapter found.");

    let info = "WebGPU adapter available";
    try {
      if (typeof adapter.requestAdapterInfo === "function") {
        const adapterInfo = await adapter.requestAdapterInfo();
        info = [adapterInfo.vendor, adapterInfo.architecture, adapterInfo.device]
          .filter(Boolean)
          .join(" · ") || info;
      }
    } catch (_) {
      // Adapter info is optional and browser-dependent.
    }

    self.postMessage({ status: "webgpu_ok", data: info });
  } catch (e) {
    self.postMessage({ status: "error", phase: "webgpu_check", data: e.toString() });
  }
}

async function load(modelKey) {
  try {
    if (currentModelKey && currentModelKey !== modelKey) {
      disposePastKeyValues();
    }
    currentModelKey = modelKey;

    self.postMessage({ status: "loading", data: "Loading Bonsai 1.7B ONNX q1 model..." });

    const generator = await TextGenerationPipeline.getInstance(modelKey, (info) => {
      if (info.status === "progress_total") {
        self.postMessage({
          status: "progress_total",
          progress: Number(info.progress ?? 0),
          loaded: Number(info.loaded ?? 0),
          total: Number(info.total ?? 0),
        });
      } else if (info.status === "initiate" || info.status === "download" || info.status === "ready") {
        self.postMessage({ status: "loading", data: `${info.status}: ${info.file ?? "model artifact"}` });
      }
    });

    self.postMessage({ status: "loading", data: "Optimizing model for 1-bit WebGPU execution..." });

    const inputs = generator.tokenizer("a");
    await generator.model.generate({ ...inputs, max_new_tokens: 1 });

    self.postMessage({
      status: "ready",
      model: MODEL_IDS[modelKey],
      dtype: "q1",
      device: "webgpu",
    });
  } catch (e) {
    self.postMessage({ status: "error", phase: "model_load", data: e.toString() });
  }
}

async function generate(messages) {
  try {
    if (!currentModelKey) throw new Error("No model key selected. Load Bonsai first.");
    const generator = await TextGenerationPipeline.getInstance(currentModelKey);

    let startTime;
    let numTokens = 0;
    let tps;

    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (output) => {
        self.postMessage({ status: "update", output, tps, numTokens });
      },
      token_callback_function: () => {
        startTime ??= performance.now();
        if (numTokens++ > 0) {
          tps = (numTokens / (performance.now() - startTime)) * 1000;
        }
      },
    });

    self.postMessage({ status: "start" });
    pastKeyValuesCache ??= new DynamicCache();

    const output = await generator(messages, {
      max_new_tokens: 384,
      do_sample: false,
      streamer,
      stopping_criteria: stoppingCriteria,
      past_key_values: pastKeyValuesCache,
    });

    let finalText = "";
    const generated = output?.[0]?.generated_text;
    if (Array.isArray(generated)) {
      finalText = generated.at(-1)?.content ?? "";
    } else if (typeof generated === "string") {
      finalText = generated;
    }

    self.postMessage({ status: "complete", output: finalText });
  } catch (e) {
    self.postMessage({ status: "error", phase: "generation", data: e.toString() });
  }
}

self.addEventListener("message", async (e) => {
  const { type, data } = e.data;
  switch (type) {
    case "check":
      await check();
      break;
    case "load":
      await load(data);
      break;
    case "generate":
      stoppingCriteria.reset();
      await generate(data);
      break;
    case "interrupt":
      stoppingCriteria.interrupt();
      break;
    case "reset":
      disposePastKeyValues();
      stoppingCriteria.reset();
      self.postMessage({ status: "reset_done" });
      break;
    default:
      self.postMessage({ status: "error", phase: "worker", data: `Unknown worker message type: ${type}` });
  }
});
