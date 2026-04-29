import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import http from 'node:http';
import fs from 'node:fs';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9337);
const USER_DATA = process.env.CHROME_USER_DATA || '/tmp/ashesh-bonsai-chrome-profile';
const URL = process.env.BONSAI_URL || 'http://127.0.0.1:8766/?bonsai-smoke=1';
const TIMEOUT_MS = Number(process.env.BONSAI_TIMEOUT_MS || 420000);
const HEADLESS = process.env.HEADLESS !== '0';

fs.rmSync(USER_DATA, { recursive: true, force: true });

const chromeArgs = [
  ...(HEADLESS ? ['--headless=new'] : []),
  '--disable-gpu=false',
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan,UseSkiaRenderer',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1440,1200',
  URL,
];

console.log(`Launching Chrome: ${CHROME}`);
console.log(`URL: ${URL}`);
console.log(`Mode: ${HEADLESS ? 'headless' : 'headed'}`);
console.log('Pass condition: WebGPU adapter + Bonsai ready + non-empty generated output.');

const chrome = spawn(CHROME, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
const chromeLogs = [];
chrome.stdout.on('data', d => chromeLogs.push(d.toString()));
chrome.stderr.on('data', d => chromeLogs.push(d.toString()));

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: PORT, path }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body || e.message)); }
      });
    }).on('error', reject);
  });
}

async function waitForWsUrl() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const tabs = await getJson('/json');
      const tab = tabs.find(t => t.url?.startsWith(URL.split('?')[0])) || tabs[0];
      if (tab?.webSocketDebuggerUrl) return tab.webSocketDebuggerUrl;
    } catch (_) {}
    await delay(250);
  }
  throw new Error('Could not connect to Chrome DevTools endpoint');
}

const wsUrl = await waitForWsUrl();
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const consoleLines = [];

function send(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    setTimeout(() => {
      if (pending.has(msgId)) {
        pending.delete(msgId);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 15000).unref?.();
  });
}

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args?.map(a => a.value ?? a.description ?? '').join(' ');
    consoleLines.push(`[console.${msg.params.type}] ${text}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleLines.push(`[exception] ${msg.params.exceptionDetails?.text || JSON.stringify(msg.params.exceptionDetails)}`);
  }
  if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    consoleLines.push(`[log.${e.level}] ${e.text}`);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Network.enable');

const started = Date.now();
let lastLine = '';
let result = null;
while (Date.now() - started < TIMEOUT_MS) {
  const evalResult = await send('Runtime.evaluate', {
    expression: `(() => ({
      ready: !!window.__bonsaiReady,
      error: window.__bonsaiError || null,
      smoke: window.__bonsaiSmokeResult || null,
      output: window.__bonsaiLastOutput || '',
      status: document.getElementById('chatStatusText')?.textContent || '',
      diagnostics: document.getElementById('chatDiagnostics')?.textContent || '',
      progress: document.getElementById('chatProgressFill')?.style?.width || ''
    }))()`,
    returnByValue: true,
    awaitPromise: true,
  });
  const state = evalResult.result.value;
  const line = `${Math.round((Date.now()-started)/1000)}s | ready=${state.ready} | status=${state.status} | progress=${state.progress} | diag=${state.diagnostics}`;
  if (line !== lastLine) {
    console.log(line);
    lastLine = line;
  }
  if (state.smoke || state.error) {
    result = state;
    break;
  }
  await delay(2000);
}

if (!result) {
  const evalResult = await send('Runtime.evaluate', {
    expression: `({timeout:true, ready:!!window.__bonsaiReady, error:window.__bonsaiError||null, smoke:window.__bonsaiSmokeResult||null, status:document.getElementById('chatStatusText')?.textContent||'', diagnostics:document.getElementById('chatDiagnostics')?.textContent||'', output:window.__bonsaiLastOutput||''})`,
    returnByValue: true,
  });
  result = evalResult.result.value;
}

console.log('\n=== BROWSER CONSOLE / LOGS ===');
console.log(consoleLines.slice(-80).join('\n') || '(none)');
console.log('\n=== CHROME STDERR TAIL ===');
console.log(chromeLogs.join('').split('\n').slice(-40).join('\n'));
console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(result, null, 2));

ws.close();
chrome.kill('SIGTERM');
await delay(500);
process.exit(result?.smoke?.ok ? 0 : 2);
