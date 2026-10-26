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
