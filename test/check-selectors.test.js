const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
const { fixture } = require('./dom.js');
const { md, code, gistJson } = require('./fixtures/gists.js');
const { checkList, checkGist, checkJson } = require('../scripts/check-selectors.js');

const doc = (html) => new JSDOM(html).window.document;
const { DOMParser } = new JSDOM('').window;

test('fixtures pass all checks', () => {
  assert.deepEqual(checkList(doc(fixture('list.html'))), []);
  assert.deepEqual(checkGist(doc(fixture('gist.html'))), []);
  assert.deepEqual(checkGist(doc(fixture('gist-single.html'))), []);
  assert.deepEqual(checkJson(gistJson([['README.md', md('hi')], ['a.js', code('x')]]), DOMParser), []);
});

test('renamed class fails', () => {
  const problems = checkList(doc(fixture('list.html').replaceAll('class="gist-snippet"', 'class="gist-x"')));
  assert.ok(problems.some((p) => p.includes('(snippet)')), problems.join('\n'));
});

test('missing Older link, file names or json files are reported', () => {
  assert.ok(checkList(doc(fixture('list-2.html'))).some((p) => p.includes('(pagerLink)')));
  assert.ok(checkGist(doc(fixture('gist.html').replaceAll('gist-blob-name', 'renamed'))).some((p) => p.includes('(fileName)')));
  assert.ok(checkJson(gistJson([['a.js', code('x')]], ['a.js', 'b.js']), DOMParser).some((p) => p.includes('(file)')));
  assert.ok(checkJson({ div: '' }, DOMParser).length);
});
