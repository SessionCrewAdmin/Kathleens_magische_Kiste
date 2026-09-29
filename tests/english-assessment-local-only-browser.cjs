const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

test('local Grammar KB works for a grade without Vocabulary KB', async t => {
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
  t.after(() => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/assessments/`);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('kathleen-english-bulk-extractor', 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('documents', { keyPath: 'id' });
      store.createIndex('status', 'status');
      store.createIndex('sha256', 'source.sha256');
      store.createIndex('grade', 'classification.grade');
      store.createIndex('unit', 'classification.unit');
      store.createIndex('category', 'classification.category');
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('documents', 'readwrite');
      tx.objectStore('documents').put({
        id: 'eng-local-grade-6-grammar',
        status: 'ready',
        classification: { grade: 6, unit: 2, section: 'grammar', topic: 'Simple past' },
        content: { objects: [{ type: 'grammar', title: 'Simple past', confidence: .98, rules: ['Use the second form for affirmative sentences.'], examples: ['They went home.'], sourcePages: [12] }] },
        quality: { score: .98 },
        source: { fileName: 'simple-past.pdf', relativePath: 'Klasse 6/Unit 2/simple-past.pdf', sha256: 'c'.repeat(64) },
        provenance: { reviewedAt: new Date().toISOString(), reviewStatus: 'approved', approvedUses: ['practice', 'worksheet', 'assessment'] }
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  }));

  await page.selectOption('#subject', 'Englisch');
  await page.selectOption('#grade', '6');
  await page.waitForFunction(() => document.querySelector('#unit')?.value === 'local:2' && document.querySelector('[data-kb-unit]'));
  assert.match(await page.locator('#contentTitle').innerText(), /English Knowledge Base/);
  assert.match(await page.locator('#contentList').innerText(), /Simple past/);
  assert.equal(await page.locator('[data-kb-unit]').isChecked(), false);

  await page.locator('.step-panel.active [data-next]').click();
  await page.locator('#areas input[value="vocabulary"]').uncheck();
  await page.locator('#areas input[value="grammar"]').check();
  await page.locator('[data-kb-unit]').check();
  await page.locator('.step-panel.active [data-next]').click();
  await page.fill('#duration', '15');
  await page.click('#buildPlan');
  await page.waitForSelector('.task-card');
  assert.match(await page.locator('#taskPlan').innerText(), /second form for affirmative sentences/);
  assert.match(await page.locator('#taskPlan').textContent(), /simple-past\.pdf/);
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/assessments/?subject=Englisch&grade=6&unit=2&area=grammar&kb=eng-local-grade-6-grammar%3Au1`);
  await page.waitForFunction(() => document.querySelector('[data-panel="2"]')?.classList.contains('active') && document.querySelector('[data-kb-unit]')?.checked);
  assert.equal(await page.locator('#areas input[value="grammar"]').isChecked(), true);
  assert.equal(await page.locator('#areas input[value="vocabulary"]').isChecked(), false);
  assert.match(await page.locator('#globalWarnings').innerText(), /vorausgewählt/i);
});
