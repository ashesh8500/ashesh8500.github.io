# Ashesh Kaji — Personal Portfolio

A Hermes-themed personal portfolio built with pure HTML/CSS/JS. Dark terminal-chic aesthetic, real-time GitHub project integration, and a browser-native AI chat powered by PrismML's Bonsai 1-bit architecture.

## Features

- **Hermes UI Theme** — Dark, terminal-inspired design with teal/purple accents
- **Live GitHub Projects** — Fetches real repository data via GitHub API
- **Ask Me Anything** — Browser-native AI chat running PrismML's Bonsai 1.7B via WebGPU + Transformers.js (100% client-side, zero server)
- **Viewable Resume** — Clean, printable resume page sourced from real experience
- **Responsive** — Works on desktop, tablet, and mobile
- **Zero Dependencies** — Pure HTML, CSS, and vanilla JavaScript

## Tech Stack

- HTML5 / CSS3 / Vanilla JavaScript
- GitHub REST API (public, no auth needed)
- HuggingFace Transformers.js (CDN-loaded for AI chat)
- WebGPU / WebAssembly for browser-native ML inference

## Local Development

```bash
# Just serve the directory
python3 -m http.server 8080
# or
npx serve .
```

Open `http://localhost:8080` — no build step, no npm install.

## Deployment

Push to the `main` branch. GitHub Pages deploys automatically via GitHub Actions.

**Note:** The AI chat loads a model from HuggingFace Hub on first visit (~290MB, cached by browser after). WebGPU requires Chrome 113+ or Edge 113+. Falls back gracefully to CPU/WASM or simulation mode.

## Structure

```
├── index.html              # Main portfolio page
├── resume.html             # Viewable/printable resume
├── assets/
│   ├── css/
│   │   └── style.css       # All styles (Hermes theme)
│   └── js/
│       ├── main.js         # Typewriter, scroll spy, GitHub fetch
│       └── prisml-chat.js  # Browser-native AI chat integration
└── README.md
```
