const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = require('../data/help/catalog.js');
const registry = require('../tools/help-registry.js').create(catalog);

test('help catalog is complete, unique and internally linked', () => {
  assert.equal(catalog.schemaVersion, 'kathleen-help/v1');
  assert.ok(catalog.entries.length >= 25);
  assert.ok(catalog.coverage.length >= 19);
  assert.deepEqual(registry.validate(), []);
  assert.equal(new Set(catalog.entries.map(entry => entry.id)).size, catalog.entries.length);
  for (const entry of catalog.entries) {
    assert.equal(typeof entry.content, 'string', entry.id);
    assert.ok(Array.isArray(entry.steps), entry.id);
  }
});

test('natural language search finds the expected real tools', () => {
  const firstIds = query => registry.search(query).slice(0, 3).map(entry => entry.id);
  assert.ok(firstIds('Schulaufgabe').includes('assessment-create'));
  assert.ok(firstIds('Beamer').includes('whiteboard'));
  assert.ok(firstIds('Gruppen').includes('team-generator'));
  assert.ok(firstIds('PDF').includes('pdf-troubleshooting'));
  assert.ok(firstIds('Vokabeln').includes('knowledge-bases'));
});

test('route context selects the matching help area', () => {
  assert.equal(registry.context('/tools/assessments/')[0].tool, 'Kurzarbeiten');
  assert.equal(registry.context('/tools/english-bulk-extractor/')[0].id, 'english-extractor');
  assert.equal(registry.context('/tools/classroom-board/')[0].id, 'whiteboard');
});

test('shell loads the help system and offline cache contains every asset', () => {
  const shell = fs.readFileSync(path.join(root, 'tools/teacher-shell.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  for (const token of ['kds-help-btn', 'data-kds-help', 'help-center.js', 'help-integrations.js']) {
    assert.match(shell, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const asset of ['data/help/catalog.js', 'tools/help-registry.js', 'tools/help-center.js', 'tools/help-center.css', 'tools/help-integrations.js', 'tools/help-integrations.css']) {
    assert.ok(worker.includes(asset), asset);
  }
});

test('guided tours only name selectors that exist on their tool page', () => {
  const pages = new Map();
  for (const entry of catalog.entries.filter(item => item.guide)) {
    const local = path.join(root, entry.route.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(local)) continue;
    const html = pages.get(local) || fs.readFileSync(local, 'utf8');
    pages.set(local, html);
    for (const step of entry.steps.filter(item => /^#[\w-]+$/.test(item.target || ''))) {
      const id = step.target.slice(1);
      assert.ok(html.includes(`id="${id}"`) || html.includes(`id='${id}'`), `${entry.id}: ${step.target}`);
    }
  }
});
