const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

test('AI assistant shows exact consent payload and stores only an unreviewed proposal', async t => {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, bytes) => {
      if (error) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let sent = null;
  await page.route('https://fzqxnjhuvgpgovcovosl.supabase.co/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('https://fzqxnjhuvgpgovcovosl.supabase.co/functions/v1/english-ai-assistant', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ provider: 'anthropic', model: 'claude-test', proposal: { summary: 'Simple-past gap task', title: 'Weekend in simple past', topic: 'Simple past', contentType: 'grammar', taskType: 'gap_fill', instruction: 'Complete the sentences.', solution: 'went', expectationHorizon: ['1 point'], warnings: [], confidence: .92 }, warnings: [], usage: { input_tokens: 42 } }) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/english-knowledge-base/`);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('kathleen-english-bulk-extractor', 3);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('documents', 'readwrite');
      tx.objectStore('documents').put({ id: 'ai-browser', status: 'ready', classification: { grade: 6, unit: 1, section: 'grammar', topic: 'Simple past' }, content: { objects: [{ type: 'grammar', title: 'Weekend', instruction: 'Complete the sentences.', sourceText: 'Yesterday Sam ___ (go) home.', sourcePages: [1] }] }, quality: { score: .9 }, source: { fileName: 'weekend.pdf', relativePath: 'weekend.pdf', sha256: 'a'.repeat(64) }, provenance: { reviewStatus: 'reviewed', approvedUses: ['practice'] } });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.evaluate(() => localStorage.setItem('kathleenEnglishKbSessionV1', JSON.stringify({ access_token: 'test-user-jwt', user: { id: 'teacher' } })));
  await page.locator('[data-open]').click();
  await page.locator('[data-ai-action="suggest_solution"]').click();
  assert.match(await page.locator('#aiPayloadPreview').innerText(), /Yesterday Sam/);
  assert.doesNotMatch(await page.locator('#aiPayloadPreview').innerText(), /base64/);
  await page.check('#aiConsent');
  await page.click('#aiSend');
  await page.getByText(/Vorschlag von anthropic/).waitFor();
  assert.equal(sent.action, 'suggest_solution');
  assert.equal(sent.image, null);
  await page.click('#aiApply');
  await page.getByText(/KI-Vorschlag lokal/).waitFor();
  const stored = await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('kathleen-english-bulk-extractor', 3);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const get = req.result.transaction('documents').objectStore('documents').get('ai-browser');
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    };
  }));
  assert.equal(stored.content.objects[0].aiProposal.reviewed, false);
  assert.equal(stored.provenance.reviewStatus, 'reviewed');
});
