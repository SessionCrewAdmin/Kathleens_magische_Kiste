const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const artwork = 'assets/reveal/kathleen-welcome-artwork.webp';

test('welcome uses a standalone image element with desktop cover and mobile focal point', () => {
  assert.match(html, new RegExp(`<img class="k-welcome-art" src="${artwork}" alt="" aria-hidden="true">`));
  assert.ok(fs.statSync(path.join(root, artwork)).size > 10_000, 'standalone artwork is present');
  assert.match(html, /\.k-welcome-art\{[^}]*object-fit:cover;object-position:50% 45%/);
  assert.match(html, /@media\(max-width:980px\)\{\s*\.k-welcome-art\{object-fit:contain;object-position:50% 0%\}/);
});

test('welcome time modes no longer select artwork sprite frames', () => {
  assert.doesNotMatch(html, /\.k-welcome(?:\.time-(?:morning|lunch|evening))? \.k-welcome-art\{[^}]*background-position/);
  assert.doesNotMatch(html, /\.k-welcome-art\{[^}]*background-size:[^}]*300%/);
  for (const mode of ['morning', 'lunch', 'evening']) {
    assert.match(html, new RegExp(`${mode}:\\{className:'time-${mode}'`));
  }
});

test('forced previews, session guard, skip and automatic completion remain wired', () => {
  assert.match(html, /preview=\[\s*'morning','lunch','evening'\s*\]\.includes\(forced\)/);
  assert.match(html, /if\(WELCOME_MODES\[forced\]\)return forced/);
  assert.match(html, /sessionStorage\.getItem\(WELCOME_SESSION_KEY\)/);
  assert.match(html, /sessionStorage\.setItem\(WELCOME_SESSION_KEY,'1'\)/);
  assert.match(html, /kWelcomeSkip[^;]*addEventListener\('click',finish\)/);
  assert.match(html, /setTimeout\(finish,reduced\?2050:4850\)/);
  assert.match(html, /kWelcomeAutoOut/);
});

test('new image is precached and cache version is advanced', () => {
  assert.match(worker, /kathleen-v122-welcome-artwork-20260930/);
  assert.match(worker, new RegExp(`'\\./${artwork}'`));
});
