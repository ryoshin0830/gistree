const test = require('node:test');
const assert = require('node:assert');
const { load, settle, fixture, fire } = require('./dom.js');

const page = (html = fixture('gist.html')) => load({ url: 'https://gist.github.com/alice/abc123', html });
const links = (w) => [...w.document.querySelectorAll('.gistree-files a')];

test('3 files → sidebar lists 3 links in order with FILES · 3', () => {
  const w = page();
  assert.deepEqual(
    links(w).map((a) => [a.getAttribute('href'), a.title]),
    [
      ['#file-readme-md', 'README.md'],
      ['#file-app-js', 'app.js'],
      ['#file-notes-txt', 'notes.txt'],
    ],
  );
  assert.equal(w.document.querySelector('.gistree-side-head span').textContent, 'FILES · 3');
  assert.equal(w.document.querySelectorAll('.gistree-layout div.file').length, 3);
});

test("filter 'md' hides non-matching links", () => {
  const w = page();
  const input = w.document.querySelector('.gistree-sidebar input');
  input.value = 'md';
  input.dispatchEvent(new w.Event('input'));
  assert.deepEqual(
    links(w).filter((a) => !a.parentElement.hidden).map((a) => a.title),
    ['README.md'],
  );
});

test("toggle hides and persists gistree:sidebar-hidden='1'", () => {
  const w = page();
  w.document.querySelector('.gistree-toggle').click();
  assert.ok(w.document.querySelector('.gistree-layout').classList.contains('gistree-collapsed'));
  assert.equal(w.localStorage.getItem('gistree:sidebar-hidden'), '1');
});

test('current file is highlighted', async () => {
  const w = page();
  await settle(w);
  assert.equal(links(w).filter((a) => a.getAttribute('aria-current') === 'true').length, 1);
});

test('single-file gist → no sidebar', () => {
  const w = page(fixture('gist-single.html'));
  assert.equal(w.document.querySelector('.gistree-sidebar'), null);
});

test('turbo restore: before-cache then turbo:load → exactly one .gistree-layout and the filter still works', () => {
  const w = page();
  fire(w, 'turbo:before-cache');
  assert.equal(w.document.querySelector('.gistree-layout'), null);
  assert.equal(w.document.querySelectorAll('.gist-content > .js-gist-file-update-container').length, 3);
  fire(w, 'turbo:load');
  fire(w, 'turbo:load');
  assert.equal(w.document.querySelectorAll('.gistree-layout').length, 1);
  const input = w.document.querySelector('.gistree-sidebar input');
  input.value = 'txt';
  input.dispatchEvent(new w.Event('input'));
  assert.deepEqual(
    links(w).filter((a) => !a.parentElement.hidden).map((a) => a.title),
    ['notes.txt'],
  );
});
