# Ashesh Kaji — Personal Web World

A Hermes-themed personal website built with pure HTML/CSS/JS: dark terminal-chic aesthetic, glowing accents, GitHub project integration, a browser-local Bonsai model drawer, a printable resume, and research project pages.

**asheshkaji.com** · Deployed via GitHub Pages from this repo.

## Features

- **Hermes UI** — dark teal canvas (`#08090d`), monospace typography, teal/purple accent glow
- **Personal web world framing** — identity-first, not employment-seeking
- **Live GitHub projects** — fetches public repos via GitHub REST API + hand-picked featured projects
- **Resume page** — clean, printable `resume.html` with updated experience and project links
- **Research write-up** — `projects/system-optimization-methods.html`, a blog-style post on portfolio allocation as layered system optimization
- **Global Ask drawer** — browser-local Bonsai 1.7B (ONNX, q1) via WebGPU + Transformers.js
- **No fabricated fallback** — if WebGPU/model loading fails, UI shows the exact error
- **Responsive** — desktop, tablet, mobile

## Local Development

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a WebGPU-capable Chromium browser for the full Bonsai experience.

## Deployment

Push to `main`. GitHub Pages deploys from the repository root. The `CNAME` file maps `asheshkaji.com` and `www.asheshkaji.com`.

DNS must have:
- `A` records pointing to GitHub Pages IPs
- `CNAME` for `www` → `ashesh8500.github.io`

## Structure

```
├── index.html                          # Main portfolio page
├── resume.html                         # Printable resume
├── CNAME                               # Domain configuration
├── projects/
│   └── system-optimization-methods.html # Research write-up
├── assets/
│   ├── css/style.css                   # Hermes theme
│   ├── js/main.js                      # UI + GitHub fetch
│   ├── js/prisml-chat.js               # Bonsai chat interface
│   └── js/prisml-worker.js             # Web Worker for model inference
└── .github/workflows/deploy.yml        # GitHub Pages deploy action
```
