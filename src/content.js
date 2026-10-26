// GitHub DOM selectors live here and nowhere else: when gist.github.com changes, fix this block.
const SEL = {
  snippet: '.gist-snippet',
  snippetBody: '.js-gist-file-update-container',
  gistLink: '.gist-snippet-meta a[href]',
  file: 'div.file[id^="file-"]',
  pageFile: '.gist-content div.file[id^="file-"]',
  fileName: '.gist-blob-name',
  fileIcon: '.file-info svg',
  markdown: 'article.markdown-body',
  codeLine: '.blob-code-inner',
};
const MAX_PARALLEL = 3;
const PREVIEW_LINES = 12;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

// Files in GitHub's display order. Works on the live page and on fetched documents.
function readFiles(root, selector = SEL.file) {
  return [...root.querySelectorAll(selector)]
    .map((node) => ({ id: node.id, name: node.querySelector(SEL.fileName)?.textContent.trim(), icon: node.querySelector(SEL.fileIcon), el: node }))
    .filter((f) => f.name);
}

function fileLink(file, href) {
  const icon = file.icon && document.importNode(file.icon, true);
  return el('a', { href, title: file.name }, icon, el('span', { textContent: gistree.truncateMiddle(file.name) }));
}

function preview(file) {
  const md = file.el.querySelector(SEL.markdown);
  if (md) return document.importNode(md, true);
  const lines = [...file.el.querySelectorAll(SEL.codeLine)].slice(0, PREVIEW_LINES).map((td) => td.textContent);
  return el('pre', { textContent: lines.join('\n') });
}

async function enhanceSnippet(snippet) {
  const link = [...snippet.querySelectorAll(SEL.gistLink)].find((a) => /^\/[^/]+\/[0-9a-f]+$/.test(a.pathname));
  const body = snippet.querySelector(SEL.snippetBody);
  if (!link || !body) return;
  const res = await fetch(link.pathname);
  if (!res.ok) return;
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const files = readFiles(doc);
  if (files.length < 2) return;

  const chosen = files[gistree.pickPreview(files.map((f) => f.name))];
  const list = el('ul', { className: 'gistree-files' });
  for (const f of files) {
    const a = fileLink(f, `${link.pathname}#${f.id}`);
    if (f === chosen) a.classList.add('gistree-active');
    list.append(el('li', {}, a));
  }
  const card = el('div', { className: 'gistree-card' }, list, el('div', { className: 'gistree-preview' }, preview(chosen)));
  body.hidden = true;
  body.after(card);
}

async function enhanceList() {
  const queue = [...document.querySelectorAll(SEL.snippet)].filter((s) => !s.dataset.gistree);
  queue.forEach((s) => (s.dataset.gistree = '1'));
  const worker = async () => {
    for (let s; (s = queue.shift()); ) {
      // Any failure leaves GitHub's original snippet untouched.
      await enhanceSnippet(s).catch((e) => console.debug('[gistree]', e));
    }
  };
  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));
}

function boot() {
  enhanceList();
}

boot();
