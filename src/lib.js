// Pure helpers and GitHub selectors, shared by the content script and node (tests, selector check).
const gistree = {
  // GitHub DOM selectors live here and nowhere else: when gist.github.com changes, fix this block.
  SEL: {
    snippet: '.gist-snippet',
    gistLink: '.gist-snippet-meta a[href]',
    title: '.gist-snippet-meta a[href] strong',
    description: '.gist-snippet-meta span.f6',
    time: '.gist-snippet-meta relative-time',
    label: '.gist-snippet-meta .Label',
    pager: '.paginate-container',
    pagerLink: '.pagination a',
    snippetBody: '.js-gist-file-update-container',
    file: 'div.file[id^="file-"]',
    pageFile: '.gist-content div.file[id^="file-"]',
    fileName: '.gist-blob-name',
    fileIcon: '.file-info svg',
    markdown: 'article.markdown-body',
    codeLine: '.blob-code-inner',
  },

  // Any README first, then any markdown, then .txt, else GitHub's first file.
  pickPreview(names) {
    if (!names.length) return -1;
    const lower = names.map((n) => n.toLowerCase());
    for (const ok of [(n) => /^readme(\.(md|markdown|txt))?$/.test(n), (n) => /\.(md|markdown)$/.test(n), (n) => n.endsWith('.txt')]) {
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

  // "/ryoshin0830" -> "ryoshin0830"; site pages like "/discover" are not profiles.
  profileOwner(pathname) {
    const m = pathname.match(/^\/([^/]+)\/?$/);
    return m && !['discover', 'search', 'starred', 'mine'].includes(m[1]) ? m[1] : null;
  },

  // GitHub's own gist search covers file contents, and the owner's secret gists when signed in.
  searchUrl(owner, query) {
    return '/search?q=' + encodeURIComponent(owner ? `user:${owner} ${query}` : query);
  },
};

if (typeof module === 'object') module.exports = gistree;
