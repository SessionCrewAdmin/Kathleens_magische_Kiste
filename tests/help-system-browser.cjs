const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

test('help drawer supports context, search, deep links, keyboard and tour', async t => {
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

  const installed = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(installed ? { executablePath: installed } : {}) });
  } catch (error) {
    if (/Executable doesn't exist/i.test(error.message)) return t.skip('Chromium ist nicht installiert.');
    throw error;
  }
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
  await page.addInitScript(() => localStorage.setItem('kathleenHelpNeverV1', JSON.stringify({ 'assessment-overview': true })));
  const base = `http://127.0.0.1:${server.address().port}/tools/assessments/`;
  await page.goto(base);
  await page.locator('.kds-help-btn').click();
  await page.locator('#kHelpCenter.open').waitFor();
  assert.match(await page.locator('.k-help-context').innerText(), /Kurzarbeiten/);

  await page.locator('.k-help-search input').fill('PDF');
  assert.match(await page.locator('.k-help-results').innerText(), /PDF/);
  await page.getByRole('button', { name: /PDF kann nicht verarbeitet werden/ }).click();
  assert.match(page.url(), /help=pdf-troubleshooting/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#kHelpCenter')?.classList.contains('open'));
  assert.equal(await page.locator('#kHelpCenter').getAttribute('aria-hidden'), 'true');

  await page.goto(base + '?help=assessment-create');
  await page.locator('#kHelpCenter.open').waitFor();
  assert.match(await page.locator('.k-help-article h1').innerText(), /Kurzarbeit erstellen/);
  await page.getByRole('button', { name: /Schritt-für-Schritt starten/ }).click();
  await page.locator('.k-help-tour').waitFor();
  assert.match(await page.locator('.k-help-tour').innerText(), /Schritt 1/);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  assert.match(await page.locator('.k-help-tour').innerText(), /Schritt 2/);
  await page.getByRole('button', { name: 'Beenden' }).click();
  assert.equal(await page.locator('.k-help-tour').count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.kds-mobile-nav [data-more]').click();
  await page.locator('#kdsMore [data-kds-help]').click();
  const mobileBox = await page.locator('#kHelpCenter.open').boundingBox();
  assert.ok(mobileBox.width >= 385, `mobile drawer width: ${mobileBox.width}`);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.locator('.kds-help-btn').click();
  const tabletBox = await page.locator('#kHelpCenter.open').boundingBox();
  assert.ok(tabletBox.width <= 481, `tablet drawer width: ${tabletBox.width}`);
});
