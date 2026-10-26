const SEL = gistree.SEL;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

function go(href) {
  location.assign(href);
}

// Files in GitHub's display order, read from the live gist page.
function readFiles(root, selector) {
  return [...root.querySelectorAll(selector)]
    .map((node) => ({ id: node.id, name: node.querySelector(SEL.fileName)?.textContent.trim(), icon: node.querySelector(SEL.fileIcon), el: node }))
    .filter((f) => f.name);
}

function fileLink(file, href) {
  const icon = file.icon && document.importNode(file.icon, true);
  return el('a', { href, title: file.name }, icon, el('span', { textContent: gistree.truncateMiddle(file.name) }));
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
  enhanceGist();
}

// Turbo snapshots the DOM without our listeners; put GitHub's page back so a restored page is rebuilt live.
function unwrap() {
  for (const layout of document.querySelectorAll('.gistree-layout')) layout.replaceWith(...layout.lastElementChild.children);
}

boot();
document.addEventListener('turbo:load', boot);
document.addEventListener('pjax:end', boot);
document.addEventListener('turbo:before-cache', unwrap);
