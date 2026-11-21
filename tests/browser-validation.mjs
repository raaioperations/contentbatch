import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CONTENTBATCH_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid URL');
    return;
  }
  const filePath = path.resolve(projectRoot, `.${pathname}`);
  if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = readFileSync(filePath);
    response.writeHead(200, { 'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const profile = mkdtempSync(path.join(tmpdir(), 'contentbatch-browser-'));
let chrome;
let socket;
let requestId = 0;
const pending = new Map();
const browserErrors = [];

function send(method, params = {}, sessionId) {
  const id = ++requestId;
  const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify(message));
  });
}

async function waitForBrowserSocket(port) {
  let stderr = '';
  chrome.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited before DevTools opened (code ${chrome.exitCode}). ${stderr.trim()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        const version = await response.json();
        if (version.webSocketDebuggerUrl) return version.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Chrome did not open DevTools on port ${port}. ${stderr.trim()}`);
}

function connectToBrowser(webSocketUrl) {
  return new Promise((resolve, reject) => {
    socket = new WebSocket(webSocketUrl);
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to Chrome DevTools.')), { once: true });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        browserErrors.push(message.params.exceptionDetails?.text || 'Uncaught browser exception');
      } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        browserErrors.push(message.params.args?.map(argument => argument.value ?? argument.description ?? '').join(' ') || 'Browser console error');
      }
    });
  });
}

function evaluate(expression, sessionId) {
  return send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId).then(result => {
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
    return result.result?.value;
  });
}

async function stopChrome() {
  if (!chrome || chrome.exitCode !== null) return;
  const closed = new Promise(resolve => chrome.once('close', resolve));
  chrome.kill('SIGTERM');
  const result = await Promise.race([closed.then(() => 'closed'), new Promise(resolve => setTimeout(() => resolve('timeout'), 4000))]);
  if (result === 'timeout' && chrome.exitCode === null) {
    const forceClosed = new Promise(resolve => chrome.once('close', resolve));
    chrome.kill('SIGKILL');
    await Promise.race([forceClosed, new Promise(resolve => setTimeout(resolve, 2500))]);
  }
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const portProbe = createServer();
  await new Promise((resolve, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', resolve);
  });
  const debuggingPort = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debuggingPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    '--window-size=1600,1200',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const browserWebSocket = await waitForBrowserSocket(debuggingPort);
  await connectToBrowser(browserWebSocket);
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${address.port}/tests/browser-runner.html` }, sessionId);

  const deadline = Date.now() + 360000;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await evaluate('({result: document.documentElement.dataset.testResult || "", report: document.querySelector("#results")?.textContent || "", ready: document.readyState})', sessionId);
    if (snapshot.result) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (snapshot?.result === 'passed') {
    console.log(snapshot.report);
    if (process.argv.includes('--capture-mobile-preview')) {
      const testItemId = await evaluate('window.testItemId', sessionId);
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
      await evaluate(`(() => {
        const frame = document.querySelector('#app-frame');
        frame.style.width = '390px';
        frame.style.height = '844px';
        frame.style.margin = '0';
        frame.style.border = '0';
        document.body.style.padding = '0';
        document.querySelector('strong').hidden = true;
        document.querySelector('#results').hidden = true;
        frame.contentDocument.querySelector('a.nav-link[data-view="content"]').click();
        return true;
      })()`, sessionId);
      const previewDeadline = Date.now() + 5000;
      while (Date.now() < previewDeadline && !(await evaluate('Boolean(document.querySelector("#app-frame")?.contentDocument?.querySelector(".content-layout"))', sessionId))) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await evaluate(`(() => {
        const frame = document.querySelector('#app-frame');
        frame.contentDocument.querySelector('[data-open-id="${testItemId}"]').click();
        return true;
      })()`, sessionId);
      const editorDeadline = Date.now() + 5000;
      while (Date.now() < editorDeadline && !(await evaluate('Boolean(document.querySelector("#app-frame")?.contentDocument?.querySelector("#editor-form"))', sessionId))) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await evaluate('window.scrollTo(0, 0); document.querySelector("#app-frame").scrollIntoView({block: "start"})', sessionId);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      const screenshotPath = path.join(tmpdir(), 'contentbatch-mobile-editor-preview.png');
      writeFileSync(screenshotPath, Buffer.from(data, 'base64'));
      console.log(`Mobile editor preview: ${screenshotPath}`);
    }
    if (process.argv.includes('--capture-batch-previews')) {
      await evaluate(`(() => {
        const frame = document.querySelector('#app-frame');
        frame.style.width = '390px';
        frame.style.height = '844px';
        frame.style.margin = '0';
        frame.style.border = '0';
        document.body.style.padding = '0';
        document.querySelector('strong').hidden = true;
        document.querySelector('#results').hidden = true;
        return true;
      })()`, sessionId);
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
      const waitForSelector = async selector => {
        const end = Date.now() + 5000;
        while (Date.now() < end && !(await evaluate(`Boolean(document.querySelector('#app-frame')?.contentDocument?.querySelector('${selector}'))`, sessionId))) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };
      const capture = async filename => {
        await evaluate('window.scrollTo(0, 0); document.querySelector("#app-frame").scrollIntoView({block: "start"})', sessionId);
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        const screenshotPath = path.join(tmpdir(), filename);
        writeFileSync(screenshotPath, Buffer.from(data, 'base64'));
        console.log(`Batch preview: ${screenshotPath}`);
      };
      await waitForSelector('.batch-workspace');
      await capture('contentbatch-batch-detail-mobile.png');
      await evaluate(`document.querySelector('#app-frame').contentDocument.querySelector('[data-action="back-to-batches"]').click()`, sessionId);
      await waitForSelector('.batches-layout');
      await capture('contentbatch-batch-list-mobile.png');
      const titleBounds = await evaluate(`(() => {
        const frame = document.querySelector('#app-frame');
        const child = frame.contentDocument;
        const title = child.querySelector('#page-title').getBoundingClientRect();
        const heading = child.querySelector('#page-heading').getBoundingClientRect();
        return { viewport: child.defaultView.innerWidth, scrollX: child.defaultView.scrollX, titleX: title.x, titleWidth: title.width, headingX: heading.x, headingWidth: heading.width };
      })()`, sessionId);
      console.log(`Mobile Batch title bounds: ${JSON.stringify(titleBounds)}`);

      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
      await evaluate(`document.querySelector('#app-frame').style.width = '1280px'; document.querySelector('#app-frame').style.height = '800px'`, sessionId);
      const desktopListDeadline = Date.now() + 3000;
      while (Date.now() < desktopListDeadline && (await evaluate('document.querySelector("#app-frame").contentWindow.innerWidth', sessionId)) !== 1280) await new Promise(resolve => setTimeout(resolve, 100));
      await capture('contentbatch-batch-list-desktop.png');
      await evaluate(`document.querySelector('#app-frame').contentDocument.querySelector('[data-open-batch-id]').click()`, sessionId);
      await waitForSelector('.batch-workspace');
      await capture('contentbatch-batch-detail-desktop.png');
    }
  } else {
    console.error(snapshot?.report || 'Browser workflow did not finish.');
    if (browserErrors.length) console.error(`Browser errors:\n${browserErrors.join('\n')}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    if (socket?.readyState === WebSocket.OPEN) {
      await Promise.race([
        send('Browser.close').then(() => undefined).catch(() => undefined),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
    }
  } catch {}
  try { socket?.close(); } catch {}
  await stopChrome();
  if (server.listening) {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections?.();
      setTimeout(resolve, 1500);
    });
  }
  rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
