// Pure helpers shared by the content script and node tests.
const gistree = {
  // README.md first, then any markdown, then .txt, else GitHub's first file.
  pickPreview(names) {
    if (!names.length) return -1;
    const lower = names.map((n) => n.toLowerCase());
    for (const ok of [(n) => n === 'readme.md', (n) => /\.(md|markdown)$/.test(n), (n) => n.endsWith('.txt')]) {
      const i = lower.findIndex(ok);
      if (i !== -1) return i;
    }
    return 0;
  },

  // "whisper-large-v3-turbo.jsonl" -> "whisper-la….jsonl": keeps the start and the extension.
  truncateMiddle(name, max = 32) {
    const chars = Array.from(name);
    if (chars.length <= max) return name;
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 && name.length - dot <= 8 ? Array.from(name.slice(dot)) : [];
    const tail = ext.length ? ext : chars.slice(chars.length - Math.floor((max - 1) / 2));
    return chars.slice(0, max - 1 - tail.length).join('') + '…' + tail.join('');
  },
};

if (typeof module === 'object') module.exports = gistree;
