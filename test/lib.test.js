const test = require('node:test');
const assert = require('node:assert');
const { pickPreview, truncateMiddle } = require('../src/lib.js');

test('README.md wins regardless of case and position', () => {
  assert.equal(pickPreview(['a.py', 'notes.md', 'README.MD']), 2);
});
test('falls back to first .md/.markdown, then .txt, then 0', () => {
  assert.equal(pickPreview(['a.py', 'b.txt', 'guide.markdown']), 2);
  assert.equal(pickPreview(['a.py', 'b.TXT']), 1);
  assert.equal(pickPreview(['Makefile', 'a.py']), 0);
  assert.equal(pickPreview([]), -1);
});
test('truncateMiddle keeps head and extension', () => {
  assert.equal(truncateMiddle('short.py'), 'short.py');
  const t = truncateMiddle('whisper-large-v3-turbo-benchmark-results.jsonl', 24);
  assert.equal(t.length, 24);
  assert.ok(t.startsWith('whisper') && t.endsWith('.jsonl') && t.includes('…'));
});
test('truncateMiddle handles no extension and multibyte', () => {
  assert.equal(truncateMiddle('a'.repeat(40), 10).length, 10);
  assert.equal(truncateMiddle('とても長い日本語のファイル名です本当に長い.md', 12).length, 12);
});

const { profileOwner, searchUrl } = require('../src/lib.js');

test('profileOwner reads the login from a gist profile path only', () => {
  assert.equal(profileOwner('/ryoshin0830'), 'ryoshin0830');
  assert.equal(profileOwner('/ryoshin0830/'), 'ryoshin0830');
  assert.equal(profileOwner('/ryoshin0830/starred'), null);
  assert.equal(profileOwner('/discover'), null);
  assert.equal(profileOwner('/search'), null);
  assert.equal(profileOwner('/starred'), null);
  assert.equal(profileOwner('/'), null);
});
test('searchUrl scopes to the profile owner when there is one', () => {
  assert.equal(searchUrl('ryoshin0830', 'claude code'), '/search?q=user%3Aryoshin0830%20claude%20code');
  assert.equal(searchUrl(null, 'claude'), '/search?q=claude');
});
test('any README variant beats other markdown and text', () => {
  assert.equal(pickPreview(['a.js', 'README']), 1);
  assert.equal(pickPreview(['notes.md', 'readme.markdown']), 1);
  assert.equal(pickPreview(['x.md', 'README.txt']), 1);
  assert.equal(pickPreview(['b.txt', 'a.md']), 1);
});
test('selectors are shared with node', () => {
  assert.equal(typeof require('../src/lib.js').SEL.snippet, 'string');
});

test('manifest icons exist on disk as PNG', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const { icons } = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(icons ?? {}), ['16', '48', '128']);
  for (const file of Object.values(icons)) {
    assert.equal(fs.readFileSync(path.join(root, file)).subarray(1, 4).toString(), 'PNG', file);
  }
});
