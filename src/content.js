// GitHub DOM selectors live here and nowhere else: when gist.github.com changes, fix this block.
const SEL = {
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
};
const MAX_PARALLEL = 3;
const MAX_PAGES = 10; // ponytail: 100 gists merged; past that a "more" link goes on to GitHub's pages

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

async function fetchDoc(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new DOMParser().parseFromString(await res.text(), 'text/html');
}

// Runs jobs with at most MAX_PARALLEL fetches in flight; a failing job is skipped.
function pool() {
  const queue = [];
  let running = 0;
  const next = () => {
    if (running >= MAX_PARALLEL || !queue.length) return;
    running++;
    queue.shift()().catch((e) => console.debug('[gistree]', e)).finally(() => (running--, next()));
    next();
  };
  return (job) => (queue.push(job), next());
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
  const lines = [...file.el.querySelectorAll(SEL.codeLine)].map((td) => td.textContent);
  return lines.length ? el('pre', { textContent: lines.join('\n') }) : null;
}

// ---- Gist lists: a searchable index on the left, the selected gist on the right (split view) ----

function readSnippet(snippet) {
  const link = [...snippet.querySelectorAll(SEL.gistLink)].find((a) => /^\/[^/]+\/[0-9a-f]+$/.test(a.getAttribute('href')));
  if (!link) return null;
  const path = link.getAttribute('href');
  const time = snippet.querySelector(SEL.time);
  return {
    path,
    owner: path.split('/')[1],
    title: snippet.querySelector(SEL.title)?.textContent.trim() ?? path,
    description: snippet.querySelector(SEL.description)?.textContent.trim() ?? '',
    secret: [...snippet.querySelectorAll(SEL.label)].some((l) => l.textContent.trim() === 'Secret'),
    time: time && document.importNode(time, true),
    stamp: time?.getAttribute('datetime') ?? '',
  };
}

// File names cost a full gist page fetch, so remember them until the gist changes.
const cache = {
  get(gist) {
    try {
      const hit = JSON.parse(localStorage.getItem(`gistree:files:${gist.path}`));
      return hit?.stamp === gist.stamp ? hit.files : null;
    } catch {
      return null;
    }
  },
  set(gist, files) {
    try {
      localStorage.setItem(`gistree:files:${gist.path}`, JSON.stringify({ stamp: gist.stamp, files }));
    } catch {}
  },
};

function row(gist, owner) {
  const chips = el('div', { className: 'gistree-chips' }, el('span', { className: 'gistree-muted', textContent: 'Loading files…' }));
  const meta = el('div', { className: 'gistree-meta' }, gist.owner !== owner && `${gist.owner} · `, gist.time);
  const head = el(
    'div',
    { className: 'gistree-head' },
    el('span', { className: 'gistree-title', textContent: gist.description || gist.title }),
    gist.secret && el('span', { className: 'Label Label--secondary', textContent: 'Secret' }),
  );
  const li = el('li', { className: 'gistree-row', tabIndex: -1 }, head, meta, chips);
  li.setAttribute('role', 'option');
  li.gist = gist;
  li.searchText = `${gist.title} ${gist.description}`.toLowerCase();
  li.showFiles = (files) => {
    const chosen = gistree.pickPreview(files.map((f) => f.name));
    chips.replaceChildren(
      ...files.map((f, i) => {
        const a = el('a', { href: `${gist.path}#${f.id}`, title: f.name, textContent: gistree.truncateMiddle(f.name, 40) });
        a.dataset.file = i;
        if (i === chosen) a.classList.add('gistree-active');
        return a;
      }),
    );
    li.searchText += ' ' + files.map((f) => f.name).join(' ').toLowerCase();
    li.filesLoaded = true;
  };
  return li;
}

async function morePages(doc, makeRow, list) {
  for (let page = 1; page < MAX_PAGES; page++) {
    const older = [...doc.querySelectorAll(SEL.pagerLink)].find((a) => a.textContent.trim() === 'Older');
    if (!older) return null;
    doc = await fetchDoc(older.href);
    for (const s of doc.querySelectorAll(SEL.snippet)) {
      const gist = readSnippet(s);
      if (gist) list.append(makeRow(gist));
    }
  }
  return [...doc.querySelectorAll(SEL.pagerLink)].find((a) => a.textContent.trim() === 'Older')?.href ?? null;
}

function enhanceList() {
  const snippets = [...document.querySelectorAll(SEL.snippet)];
  const gists = snippets.map(readSnippet);
  if (!gists.length || gists.includes(null) || document.querySelector('.gistree-index')) return;

  const owner = gistree.profileOwner(location.pathname);
  const load = pool();
  const fetchFiles = (li) => {
    if (li.filesLoaded || li.queued) return;
    li.queued = true;
    load(async () => {
      const files = readFiles(await fetchDoc(li.gist.path)).map(({ id, name }) => ({ id, name }));
      cache.set(li.gist, files);
      li.showFiles(files);
      filterRows();
    });
  };
  const seen = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (seen.unobserve(e.target), fetchFiles(e.target))), { rootMargin: '200px' });
  const makeRow = (gist) => {
    const li = row(gist, owner);
    const cached = cache.get(gist);
    if (cached) li.showFiles(cached);
    else seen.observe(li);
    return li;
  };

  const list = el('ul', { className: 'gistree-list', ariaLabel: 'Gists' }, ...gists.map(makeRow));
  list.setAttribute('role', 'listbox');
  const paneHead = el('div', { className: 'gistree-pane-head' });
  const paneBody = el('div', { className: 'gistree-pane-body' });
  const pane = el('section', { className: 'gistree-pane', ariaLabel: 'Gist preview' }, paneHead, paneBody);
  let selected = null;
  let last = null; // the one gist page we keep parsed, so switching its files is instant

  const open = (li) => location.assign(li.gist.path);
  const select = async (li, fileIndex) => {
    selected?.removeAttribute('aria-selected');
    selected = li;
    li.setAttribute('aria-selected', 'true');
    const { path } = li.gist;
    pane.dataset.path = path;
    const openButton = el('a', { className: 'btn btn-sm btn-primary', href: path, textContent: 'Open gist' });
    paneHead.replaceChildren(el('div', { className: 'gistree-pane-title', textContent: li.gist.description || li.gist.title }), openButton);
    if (last?.path !== path) paneBody.replaceChildren(el('span', { className: 'gistree-muted', textContent: 'Loading…' }));
    try {
      if (last?.path !== path) last = { path, files: readFiles(await fetchDoc(path)) };
    } catch {
      if (pane.dataset.path === path) paneBody.replaceChildren(el('span', { className: 'gistree-muted', textContent: 'Could not load this gist.' }));
      return;
    }
    if (pane.dataset.path !== path) return; // a newer selection won
    const { files } = last;
    if (!li.filesLoaded) li.showFiles(files.map(({ id, name }) => ({ id, name })));
    const shown = fileIndex ?? gistree.pickPreview(files.map((f) => f.name));
    const tabs = files.map((f, i) => {
      const b = el('button', { type: 'button', className: 'gistree-tab', title: f.name, textContent: gistree.truncateMiddle(f.name, 28) });
      b.setAttribute('aria-pressed', String(i === shown));
      b.addEventListener('click', () => select(li, i));
      return b;
    });
    paneHead.replaceChildren(el('div', { className: 'gistree-pane-title', textContent: li.gist.description || li.gist.title }), openButton, el('div', { className: 'gistree-tabs' }, ...tabs));
    paneBody.replaceChildren(preview(files[shown]) ?? el('span', { className: 'gistree-muted', textContent: 'No text preview for this file.' }));
    paneBody.scrollTop = 0;
  };
  // Without room for the pane (narrow windows) a row simply opens its gist.
  const paneShown = () => pane.offsetParent !== null;

  list.addEventListener('click', (e) => {
    const li = e.target.closest('.gistree-row');
    if (!li || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (!paneShown()) return e.target.closest('a') || open(li);
    e.preventDefault();
    const chip = e.target.closest('a[data-file]');
    select(li, chip ? Number(chip.dataset.file) : undefined);
    li.focus({ preventScroll: true });
  });
  list.addEventListener('dblclick', (e) => {
    const li = e.target.closest('.gistree-row');
    if (li) open(li);
  });
  const visibleRows = () => [...list.children].filter((li) => !li.hidden);
  const step = (dir) => {
    const rows = visibleRows();
    const next = rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(selected) + dir))];
    if (!next) return;
    select(next);
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest' });
  };
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter' && selected) open(selected);
  });

  const count = el('span', { className: 'gistree-muted' });
  const input = el('input', {
    type: 'search',
    className: 'form-control',
    placeholder: owner ? `Filter ${owner}'s gists — Enter searches file contents, secret gists included` : 'Filter — Enter searches file contents',
    ariaLabel: 'Filter gists',
  });
  const filterRows = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const li of list.children) shown += !(li.hidden = !li.searchText.includes(q));
    count.textContent = q ? `${shown} of ${list.children.length} gists` : `${list.children.length} gists`;
    if (paneShown() && (!selected || selected.hidden) && visibleRows()[0]) select(visibleRows()[0]);
  };
  input.addEventListener('input', () => {
    // File names only arrive as rows scroll into view; a filter needs all of them.
    [...list.children].forEach(fetchFiles);
    filterRows();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) location.assign(gistree.searchUrl(owner, input.value.trim()));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (selected && !selected.hidden ? selected : visibleRows()[0])?.focus();
    }
  });

  const more = el('div', { className: 'gistree-more' });
  const index = el(
    'div',
    { className: 'gistree-index' },
    el('div', { className: 'gistree-bar' }, input, count),
    el('div', { className: 'gistree-split' }, el('div', { className: 'gistree-left' }, list, more), pane),
  );
  snippets[0].before(index);
  snippets.forEach((s) => (s.hidden = true));
  filterRows();

  // Search and discover results go on forever; only gist collections are merged into one list.
  if (/^\/(search|discover)\b/.test(location.pathname)) return;
  const pager = document.querySelector(SEL.pager);
  morePages(document, makeRow, list)
    .then((rest) => {
      if (pager) pager.hidden = true;
      if (rest) more.append(el('a', { href: rest, textContent: 'More gists on GitHub →' }));
    })
    .catch((e) => console.debug('[gistree]', e))
    .finally(filterRows);
}

// ---- Gist pages: file sidebar ----

const HIDDEN_KEY = 'gistree:sidebar-hidden';

function store(value) {
  try {
    if (value === undefined) return localStorage.getItem(HIDDEN_KEY) === '1';
    localStorage.setItem(HIDDEN_KEY, value ? '1' : '0');
  } catch {
    return false;
  }
}

function enhanceGist() {
  const files = readFiles(document, SEL.pageFile);
  if (files.length < 2 || files[0].el.closest('.gistree-layout')) return;
  // GitHub wraps each file in its own container; move them all into one column.
  const containers = [...new Set(files.map((f) => f.el.closest(SEL.snippetBody) ?? f.el))];

  const links = new Map(files.map((f) => [f.el, fileLink(f, `#${f.id}`)]));
  const list = el('ul', { className: 'gistree-files' }, ...[...links.values()].map((a) => el('li', {}, a)));
  const filter = el('input', { type: 'search', className: 'form-control input-sm', placeholder: 'Filter files', ariaLabel: 'Filter files' });
  filter.addEventListener('input', () => {
    const q = filter.value.toLowerCase();
    for (const f of files) links.get(f.el).parentElement.hidden = !f.name.toLowerCase().includes(q);
  });

  const layout = el('div', { className: 'gistree-layout' });
  const toggle = el('button', { type: 'button', className: 'btn-octicon gistree-toggle' });
  const setHidden = (hidden) => {
    layout.classList.toggle('gistree-collapsed', hidden);
    toggle.textContent = hidden ? '⇥' : '⇤';
    toggle.title = toggle.ariaLabel = hidden ? 'Show file sidebar' : 'Hide file sidebar';
  };
  toggle.addEventListener('click', () => {
    const hidden = !layout.classList.contains('gistree-collapsed');
    setHidden(hidden);
    store(hidden);
  });

  const head = el('div', { className: 'gistree-side-head' }, el('span', { textContent: `FILES · ${files.length}` }), toggle);
  const sidebar = el('nav', { className: 'gistree-sidebar', ariaLabel: 'Gist files' }, head, filter, list);
  containers[0].before(layout);
  layout.append(sidebar, el('div', {}, ...containers));
  setHidden(store());

  // Highlight the file whose top is in the upper part of the viewport.
  const observer = new IntersectionObserver(
    (entries) => {
      const hit = entries.find((e) => e.isIntersecting);
      if (!hit) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      links.get(hit.target).setAttribute('aria-current', 'true');
    },
    { rootMargin: '0px 0px -70% 0px' },
  );
  files.forEach((f) => observer.observe(f.el));
}

function boot() {
  enhanceList();
  enhanceGist();
}

// Turbo snapshots the DOM without our listeners; put GitHub's page back so a restored page is rebuilt live.
function unwrap() {
  for (const layout of document.querySelectorAll('.gistree-layout')) layout.replaceWith(...layout.lastElementChild.children);
  document.querySelectorAll('.gistree-index').forEach((n) => n.remove());
  document.querySelectorAll(`${SEL.snippet}, ${SEL.pager}`).forEach((n) => (n.hidden = false));
}

boot();
document.addEventListener('turbo:load', boot);
document.addEventListener('pjax:end', boot);
document.addEventListener('turbo:before-cache', unwrap);
