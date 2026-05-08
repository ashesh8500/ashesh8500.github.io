/**
 * main.js — Ashesh Kaji Portfolio
 * Typewriter, scroll spy, nav, GitHub project fetch, animations
 */

document.addEventListener('DOMContentLoaded', () => {
  initTypewriter();
  if (window.initAsciiViz) window.initAsciiViz("ascii-viz-container");
  initScrollSpy();
  initMobileNav();
  initFadeInObserver();
  fetchGitHubProjects();
});

// ─── TYPEWRITER ───────────────────────────────────────────
function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  
  const phrases = [
    'AI Engineer · MS Computer Engineering @ NYU',
    'building ML systems at the edge',
    '1-bit models · RAG pipelines · autonomous agents',
    'from cognitive science to quantized inference',
    'Rust, Python, and everything in between',
  ];
  
  let phraseIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let isWaiting = false;
  
  function tick() {
    const current = phrases[phraseIdx];
    
    if (isWaiting) {
      setTimeout(() => { isWaiting = false; tick(); }, 2000);
      return;
    }
    
    if (isDeleting) {
      el.textContent = current.substring(0, charIdx - 1);
      charIdx--;
    } else {
      el.textContent = current.substring(0, charIdx + 1);
      charIdx++;
    }
    
    let speed = isDeleting ? 30 : 60;
    
    if (!isDeleting && charIdx === current.length) {
      isWaiting = true;
      isDeleting = true;
      speed = 2000;
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      phraseIdx = (phraseIdx + 1) % phrases.length;
      speed = 400;
    }
    
    setTimeout(tick, speed);
  }
  
  tick();
}

// ─── SCROLL SPY ───────────────────────────────────────────
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const top = section.offsetTop - 100;
      if (window.scrollY >= top) {
        current = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });
}

// ─── MOBILE NAV ───────────────────────────────────────────
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  
  if (!toggle || !links) return;
  
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
  });
  
  // Close on click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.textContent = '☰';
    });
  });
}

// ─── FADE-IN OBSERVER ─────────────────────────────────────
let fadeObserver = null;

function initFadeInObserver() {
  fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  
  observeFadeIns();
}

function observeFadeIns() {
  if (!fadeObserver) return;
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => fadeObserver.observe(el));
}

// ─── GITHUB PROJECTS ──────────────────────────────────────
async function fetchGitHubProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  
  try {
    const resp = await fetch(
      'https://api.github.com/users/ashesh8500/repos?sort=pushed&per_page=8&type=owner'
    );
    if (!resp.ok) throw new Error('GitHub API error');
    
    const repos = await resp.json();
    const filtered = repos.filter(r => !r.fork && r.name !== 'ashesh8500.github.io');
    
    grid.innerHTML = '';
    
    filtered.forEach(repo => {
      const card = createProjectCard(repo);
      grid.appendChild(card);
    });
    
    // Add highlights for specific non-GitHub projects
    addFeaturedProjects(grid);

    // Re-observe newly created cards
    observeFadeIns();
    
  } catch (err) {
    console.error('Failed to fetch repos:', err);
    grid.innerHTML = `
      <div class="project-loading">
        <span>could not load repos — </span>
        <a href="https://github.com/ashesh8500" target="_blank" rel="noopener">view on github ↗</a>
      </div>
    `;
  }
}

function createProjectCard(repo) {
  const card = document.createElement('div');
  card.className = 'project-card fade-in visible';
  
  const lang = repo.language || 'Other';
  const langClass = lang.toLowerCase();
  const langColors = {
    'python': '#3572A5', 'rust': '#DEA584', 'javascript': '#F7DF1E',
    'typescript': '#3178C6', 'shell': '#89E051', 'jupyter notebook': '#DA5B0B',
    'c': '#555555', 'c++': '#F34B7D',
  };
  const langColor = langColors[lang.toLowerCase()] || '#8B949E';
  
  const desc = repo.description || 'No description';
  const stars = repo.stargazers_count || 0;
  const pushed = timeAgo(repo.pushed_at);
  const topics = (repo.topics || []).slice(0, 4);
  
  card.innerHTML = `
    <div class="project-header">
      <div class="project-icon ${langClass}">📁</div>
      <div class="project-name">
        <a href="${repo.html_url}" target="_blank" rel="noopener">${repo.name}</a>
      </div>
    </div>
    <div class="project-desc">${escapeHtml(desc)}</div>
    <div class="project-meta">
      <span class="project-lang">
        <span class="project-lang-dot" style="background:${langColor}"></span> ${lang}
      </span>
      ${stars > 0 ? `<span class="project-stars">★ ${stars}</span>` : ''}
      <span class="project-date">${pushed}</span>
    </div>
    ${topics.length > 0 ? `
      <div class="project-topics">
        ${topics.map(t => `<span class="project-topic">${t}</span>`).join('')}
      </div>
    ` : ''}
  `;
  
  return card;
}

function addFeaturedProjects(grid) {
  const featured = [
    {
      name: 'RL Autonomous Driving',
      desc: 'Deep reinforcement learning for autonomous driving using CARLA simulator with real-world sensor feeds. Studied policy gradients, DQN variants, and sim-to-real transfer.',
      lang: 'Python',
      color: '#3572A5',
      icon: '🚗',
      url: 'https://github.com/ashesh8500/fp185',
    },
    {
      name: 'System Optimization Methods',
      desc: 'Portfolio allocation as layered system optimization: walk-forward validation, regime detection, and attractiveness scoring with provenance-ledger tracking. Active research project.',
      lang: 'Research',
      color: '#8b5cf6',
      icon: '📊',
      url: 'projects/system-optimization-methods.html',
    },
    {
      name: 'MediaSync',
      desc: 'Fast, local-first Rust pipeline for photo/video libraries: SHA-256 dedup, legacy container transcoding to MP4, and batched cloud upload via rclone/rsync with a terminal UI.',
      lang: 'Rust',
      color: '#DEA584',
      icon: '🎬',
      url: 'https://github.com/ashesh8500/mediasync',
    },
    {
      name: 'Apple Health Analyzer',
      desc: 'Transform Apple Health export data into analyzable CSVs with visualization of relationships between blood glucose, exercise, and other biomarkers.',
      lang: 'Python',
      color: '#3572A5',
      icon: '❤️',
      url: 'https://github.com/ashesh8500/apple_health_export',
    },
  ];
  
  // Add a separator
  const sep = document.createElement('div');
  sep.style.cssText = 'grid-column:1/-1;height:1px;background:var(--border-subtle);margin:8px 0;';
  grid.appendChild(sep);
  
  featured.forEach(f => {
    const card = document.createElement('div');
    card.className = 'project-card fade-in visible';
    card.innerHTML = `
      <div class="project-header">
        <div class="project-icon ml">${f.icon}</div>
        <div class="project-name">
          <a href="${f.url}" target="_blank" rel="noopener">${f.name}</a>
        </div>
      </div>
      <div class="project-desc">${f.desc}</div>
      <div class="project-meta">
        <span class="project-lang">
          <span class="project-lang-dot" style="background:${f.color}"></span> ${f.lang}
        </span>
        <span class="project-date">featured</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── UTILITIES ────────────────────────────────────────────
function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
