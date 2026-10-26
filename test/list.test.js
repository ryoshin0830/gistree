const test = require('node:test');
const assert = require('node:assert');
const { load, settle, fixture, fire } = require('./dom.js');
const { md, code, gistJson } = require('./fixtures/gists.js');

const JSON_A = gistJson([
  ['README.md', md('Hello README')],
  ['app.js', code('const a = 1;')],
  ['notes.txt', code('plain')],
]);
const JSON_B = gistJson([['solo.py', code('print(1)')]]);
const base = () => ({
  '/alice/aaa111.json': { body: JSON_A },
  '/alice/bbb222.json': { body: JSON_B },
  '/alice/ccc333.json': { body: gistJson([['notes.txt', code('old')]]) },
  '/alice?page=2': { body: fixture('list-2.html') },
});

async function open({ fetchMap = {}, wide = true, url = 'https://gist.github.com/alice' } = {}) {
  const w = load({ url, html: fixture('list.html'), fetchMap: { ...base(), ...fetchMap }, wide });
  await settle(w);
  return w;
}
const $ = (w, s) => w.document.querySelector(s);
const rows = (w) => [...w.document.querySelectorAll('.gistree-row')];
const visible = (w) => rows(w).filter((li) => !li.hidden);
const chips = (li) => [...li.querySelectorAll('.gistree-chips a')].map((a) => a.title);
const paneText = (w) => $(w, '.gistree-pane-body').textContent.trim();
const key = (w, target, k) => target.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
const type = (w, value) => {
  const input = $(w, '.gistree-bar input');
  input.value = value;
  input.dispatchEvent(new w.Event('input'));
  return input;
};

test('merges Older pages: 3 rows, pager hidden', async () => {
  const w = await open();
  assert.deepEqual(rows(w).map((li) => li.gist.path), ['/alice/aaa111', '/alice/bbb222', '/alice/ccc333']);
  assert.ok($(w, '.paginate-container').hidden);
  assert.ok([...w.document.querySelectorAll('.gist-snippet')].every((s) => s.hidden));
  assert.equal($(w, '.gistree-bar .gistree-muted').textContent, '3 gists');
});

test('row shows description, Secret label, chips from .json files', async () => {
  const w = await open();
  const [a, b] = rows(w);
  assert.equal(a.querySelector('.gistree-title').textContent, 'Demo tool with docs');
  assert.equal(a.querySelector('.Label').textContent, 'Secret');
  assert.deepEqual(chips(a), ['README.md', 'app.js', 'notes.txt']);
  assert.equal(b.querySelector('.gistree-title').textContent, 'solo.py');
  assert.equal(b.querySelector('.Label'), null);
  assert.ok(!a.querySelector('.gistree-meta').textContent.includes('alice ·'));
});

test('first row auto-selected, pane shows README.md rendered markdown, ids stripped', async () => {
  const w = await open();
  assert.equal(rows(w)[0].getAttribute('aria-selected'), 'true');
  assert.ok($(w, '.gistree-pane-body article.markdown-body'));
  assert.ok(paneText(w).includes('Hello README'));
  assert.equal($(w, '.gistree-pane-body [id]'), null);
  assert.equal($(w, '.gistree-pane-head a.btn').getAttribute('href'), '/alice/aaa111');
});

test('click chip shows that file; tab aria-pressed follows', async () => {
  const w = await open();
  rows(w)[0].querySelector('a[data-file="1"]').click();
  await settle(w);
  assert.equal(paneText(w), 'const a = 1;');
  const pressed = [...w.document.querySelectorAll('.gistree-tab')].map((b) => b.getAttribute('aria-pressed'));
  assert.deepEqual(pressed, ['false', 'true', 'false']);
  assert.deepEqual(w.went, []);
});

test('ArrowDown selects next row', async () => {
  const w = await open();
  key(w, rows(w)[0], 'ArrowDown');
  await settle(w);
  assert.equal(rows(w)[1].getAttribute('aria-selected'), 'true');
  assert.equal(rows(w)[0].getAttribute('aria-selected'), null);
  assert.equal(paneText(w), 'print(1)');
  assert.equal(w.document.activeElement, rows(w)[1]);
  assert.deepEqual(w.errors, []);
});

test('Enter on selected row opens the gist', async () => {
  const w = await open();
  key(w, rows(w)[0], 'Enter');
  assert.deepEqual(w.went, ['/alice/aaa111']);
});

test("filter by file name hides rows and updates count 'N of M gists'", async () => {
  const w = await open();
  type(w, 'solo');
  assert.deepEqual(visible(w).map((li) => li.gist.path), ['/alice/bbb222']);
  assert.equal($(w, '.gistree-bar .gistree-muted').textContent, '1 of 3 gists');
});

test('filter Enter → searchUrl', async () => {
  const w = await open();
  key(w, type(w, 'solo'), 'Enter');
  assert.deepEqual(w.went, ['/search?q=user%3Aalice%20solo']);
});

test('narrow (wide=false): no auto-select, row click opens gist', async () => {
  const w = await open({ wide: false });
  assert.equal($(w, '.gistree-row[aria-selected]'), null);
  rows(w)[1].querySelector('.gistree-title').click();
  assert.deepEqual(w.went, ['/alice/bbb222']);
});

test(".json 404 → row chips show 'Files unavailable', selecting shows 'Could not load this gist.'", async () => {
  const w = await open({ fetchMap: { '/alice/bbb222.json': { status: 404, body: '' } } });
  const b = rows(w)[1];
  assert.equal(b.querySelector('.gistree-chips').textContent, 'Files unavailable');
  b.click();
  await settle(w);
  assert.equal(paneText(w), 'Could not load this gist.');
});

test('mismatched json: files longer than div → no throw, chips = min', async () => {
  const body = gistJson([['solo.py', code('print(1)')]], ['solo.py', 'ghost.py']);
  const w = await open({ fetchMap: { '/alice/bbb222.json': { body } } });
  assert.deepEqual(chips(rows(w)[1]), ['solo.py']);
});

test('stale selection: select A (slow), then B → pane shows B', async () => {
  let release;
  const wait = new Promise((r) => (release = r));
  const w = await open({ fetchMap: { '/alice/aaa111.json': { body: JSON_A, wait } } });
  rows(w)[1].click();
  await settle(w);
  assert.equal(paneText(w), 'print(1)');
  release();
  await settle(w);
  assert.equal(paneText(w), 'print(1)');
  assert.equal(rows(w)[1].getAttribute('aria-selected'), 'true');
});

test('cache: second boot with same stamp does not refetch', async () => {
  const w = await open();
  const count = () => w.fetched.filter((k) => k === '/alice/bbb222.json').length;
  assert.equal(count(), 1);
  fire(w, 'turbo:before-cache');
  fire(w, 'turbo:load');
  await settle(w);
  assert.equal(count(), 1);
  assert.deepEqual(chips(rows(w)[1]), ['solo.py']);
});

test('turbo restore: one .gistree-index, snippets restored on before-cache', async () => {
  const w = await open();
  fire(w, 'turbo:before-cache');
  assert.equal($(w, '.gistree-index'), null);
  assert.ok([...w.document.querySelectorAll('.gist-snippet, .paginate-container')].every((n) => !n.hidden));
  fire(w, 'turbo:load');
  fire(w, 'turbo:load');
  await settle(w);
  assert.equal(w.document.querySelectorAll('.gistree-index').length, 1);
  key(w, rows(w)[0], 'ArrowDown');
  await settle(w);
  assert.equal(rows(w)[1].getAttribute('aria-selected'), 'true');
});

test('/discover is not merged', async () => {
  const w = await open({ url: 'https://gist.github.com/discover' });
  assert.equal(rows(w).length, 2);
  assert.ok(!w.fetched.includes('/alice?page=2'));
  assert.ok(!$(w, '.paginate-container').hidden);
  assert.ok(rows(w)[0].querySelector('.gistree-meta').textContent.includes('alice ·'));
});
