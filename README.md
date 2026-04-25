# Ashesh Kaji — Personal Web World

A Nous Hermes-inspired personal website built with pure HTML/CSS/JS: deep teal canvas, cream midground, warm glow/noise overlays, real GitHub project integration, a viewable resume page, and a globally accessible browser-local Bonsai model drawer.

## Features

- **Hermes/Nous visual language** — LENS_0-style teal canvas (`#041c1c`), cream midground (`#ffe6cb`), warm glow, thin borders, uppercase terminal navigation.
- **Personal web world framing** — identity-first, not employment-seeking copy.
- **Live GitHub projects** — fetches public repository data via the GitHub REST API.
- **Global Ask drawer** — accessible from the nav, hero, floating launcher, or `Cmd/Ctrl+K`.
- **Real Bonsai attempt only** — loads `onnx-community/Bonsai-1.7B-ONNX` with `dtype: q1` and `device: webgpu` via Transformers.js in a Web Worker.
- **No fabricated fallback** — if WebGPU/model loading/generation fails, the UI shows the exact failure and refuses to simulate an answer.
- **Smoke test hook** — append `?bonsai-smoke=1` or click “run Bonsai smoke test” to verify WebGPU + model-ready + generation.
- **Viewable resume** — clean, printable `resume.html` page.
- **Responsive** — desktop, tablet, and mobile friendly.

## Local Development

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a WebGPU-capable Chromium browser.

For the committed Bonsai smoke test, use port 8766:

```bash
python3 -m http.server 8766
# in another shell; HEADLESS=0 uses a normal Chrome window
HEADLESS=0 node tests/bonsai-smoke.mjs
```

The test exits `0` only if WebGPU is accepted, Bonsai reaches `ready`, and a non-empty generation is produced. It exits non-zero with the exact browser/model error otherwise.

## Bonsai Verification

Manual:
1. Open the site in Chrome/Edge with WebGPU enabled.
2. Open the Ask drawer.
3. Click `Load real Bonsai`.
4. Wait for status: `Real Bonsai 1.7B q1 is running locally`.
5. Click `run Bonsai smoke test`.

Programmatic browser state exposed for testing:

```js
window.__bonsaiReady       // true only after real model ready
window.__bonsaiError       // { phase, message } if loading/generation failed
window.__bonsaiLastOutput  // last real generated output
window.__bonsaiSmokeResult // { ok, output, model, dtype, device }
```

There is intentionally no CPU/WASM/simulation fallback for answers.

## Deployment

Push to `main`. GitHub Pages deploys from the repository root and preserves `CNAME` for `www.asheshkaji.com`.
