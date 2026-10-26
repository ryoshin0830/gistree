// Runs src/lib.js + src/content.js in jsdom against a fixture page, with fetch and browser-only APIs stubbed.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const read = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const fixture = (name) => read('fixtures', name);

// fetchMap: { '/alice/abc.json': { body, status = 200, wait } }; body is a string or JSON-able value,
// wait an optional promise that holds the response back. Unknown URLs answer 404.
function load({ url, html, fetchMap = {}, wide = true, before }) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.fetched = [];
  w.went = [];
  w.fetch = async (input) => {
    const u = new URL(input, url);
    const key = u.pathname + u.search;
    w.fetched.push(key);
    const hit = fetchMap[key] ?? { status: 404, body: '' };
    await hit.wait;
    const text = typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body);
    const status = hit.status ?? 200;
    return { ok: status < 300, status, text: async () => text, json: async () => JSON.parse(text) };
  };
  w.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb;
    }
    observe(target) {
      queueMicrotask(() => this.cb([{ isIntersecting: true, target }], this));
    }
    unobserve() {}
    disconnect() {}
  };
  w.matchMedia = (media) => ({ media, matches: wide, addEventListener() {}, removeEventListener() {} });
  before?.(w);
  // One eval, like content scripts sharing one global scope (separate evals would hide top-level consts).
  w.eval(read('..', 'src', 'lib.js') + '\n' + read('..', 'src', 'content.js'));
  w.go = (href) => w.went.push(href); // navigation is not implemented in jsdom
  return w;
}

// Lets queued fetches, microtasks and timers run.
async function settle(w, rounds = 20) {
  for (let i = 0; i < rounds; i++) await new Promise((r) => w.setTimeout(r, 0));
}

const fire = (w, type) => w.document.dispatchEvent(new w.Event(type));

module.exports = { load, settle, fixture, fire };
