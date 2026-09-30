const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

test('V3 quick review works by buttons and keyboard on a phone viewport', async t => {
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('kathleenHelpNeverV1', JSON.stringify({ 'english-kb': true })));
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/english-knowledge-base/`);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('kathleen-english-bulk-extractor', 3);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('documents', 'readwrite');
      tx.objectStore('documents').put({
        id: 'eng-v3-phone', schemaVersion: 'english-extracted-document/v3', status: 'needs_review',
        classification: { grade: 6, unit: 1, section: 'grammar', topic: 'Simple past' },
        content: { objects: [
          { type: 'grammar', title: 'Weekend task', taskId: 'task-1', taskType: 'gap_fill', instruction: 'Use the simple past.', sourceText: 'Mia ___ home.', solution: { text: 'Mia went home.' }, confidence: .9, sourcePages: [1], reviewStatus: 'needs_review', approvedUses: ['practice'] },
          { type: 'grammar', title: 'Second task', taskId: 'task-2', instruction: 'Complete.', sourceText: 'Text', confidence: .6, sourcePages: [1], reviewStatus: 'needs_review', approvedUses: ['practice'] }
        ] },
        quality: { score: .9 }, source: { fileName: 'weekend.pdf', relativePath: 'weekend.pdf', sha256: 'd'.repeat(64) }, provenance: { originalRemainsLocal: true }
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  }));

  await page.reload();
  await page.click('#quickReviewStart');
  await page.waitForSelector('#quickReviewDialog[open]');
  await page.waitForFunction(() => document.querySelector('#quickReviewCard')?.textContent.includes('Weekend task'));
  assert.match(await page.locator('#quickReviewCard').innerText(), /Weekend task/);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#quickReviewCard')?.textContent.includes('Second task'));
  await page.click('#quickUndo');
  await page.waitForFunction(() => document.querySelector('#quickReviewCard')?.textContent.includes('Weekend task'));
  await page.click('#quickAccept');
  await page.waitForFunction(() => document.querySelector('#quickReviewCard')?.textContent.includes('Second task'));
  const saved = await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('kathleen-english-bulk-extractor', 3);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const get = req.result.transaction('documents').objectStore('documents').get('eng-v3-phone');
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result);
    };
  }));
  assert.equal(saved.content.objects[0].reviewStatus, 'reviewed');
  assert.equal(saved.content.objects[1].reviewStatus, 'needs_review');
  assert.ok(!saved.content.objects[0].approvedUses.includes('assessment'));
  assert.equal(await page.locator('#quickReviewDialog').evaluate(el => el.getBoundingClientRect().width <= innerWidth), true);
});
