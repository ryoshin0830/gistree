// Daily guard (.github/workflows/selectors.yml): does gist.github.com still have the markup SEL expects?
// Exit 0: fine. Exit 1: markup drifted, report on stdout. Anything else: could not check (network, GitHub down).
const { SEL } = require('../src/lib.js');

const GIST_PATH = /^\/[^/]+\/[0-9a-f]+$/;
const miss = (where, key) => `${where}: \`${SEL[key]}\` matches nothing (${key})`;

function checkList(doc) {
  const snippets = [...doc.querySelectorAll(SEL.snippet)];
  if (!snippets.length) return [miss('list', 'snippet')];
  const problems = [];
  for (const key of ['title', 'time']) if (!snippets.every((s) => s.querySelector(SEL[key]))) problems.push(miss('list snippet', key));
  if (!snippets.every((s) => [...s.querySelectorAll(SEL.gistLink)].some((a) => GIST_PATH.test(a.getAttribute('href'))))) problems.push(miss('list snippet', 'gistLink'));
  if (![...doc.querySelectorAll(SEL.pagerLink)].some((a) => a.textContent.trim() === 'Older')) problems.push(miss('list "Older"', 'pagerLink'));
  return problems;
}

function checkGist(doc) {
  const files = [...doc.querySelectorAll(SEL.pageFile)];
  if (!files.length) return [miss('gist page', 'pageFile')];
  return files.every((f) => f.querySelector(SEL.fileName)) ? [] : [miss('gist page file', 'fileName')];
}

// Several gists: every one must pair names with files, but only some need text, since csv, ipynb,
// svg and image gists render without markdown or code lines.
function checkJson(jsons, DOMParser) {
  const problems = [];
  let text = false;
  for (const json of jsons) {
    if (!Array.isArray(json.files) || !json.files.length || typeof json.div !== 'string') {
      problems.push('gist .json: no "files" array or "div" string');
      continue;
    }
    const div = new DOMParser().parseFromString(json.div, 'text/html');
    const count = div.querySelectorAll(SEL.file).length;
    if (count !== json.files.length) problems.push(`gist .json: ${json.files.length} names but ${count} \`${SEL.file}\` (file)`);
    text ||= !!div.querySelector(`${SEL.markdown}, ${SEL.codeLine}`);
  }
  if (!text) problems.push(miss('gist .json', 'codeLine'));
  return problems;
}

async function main() {
  const { JSDOM } = require('jsdom');
  const get = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
  };
  const page = async (url) => new JSDOM(await (await get(url)).text(), { url }).window.document;

  const list = await page('https://gist.github.com/discover');
  const problems = checkList(list);
  const paths = [...new Set([...list.querySelectorAll(SEL.gistLink)].map((a) => a.getAttribute('href')).filter((h) => GIST_PATH.test(h)))].slice(0, 5);
  const path = paths[0];
  if (path) {
    problems.push(...checkGist(await page(`https://gist.github.com${path}`)));
    const jsons = await Promise.all(paths.map(async (p) => (await get(`https://gist.github.com${p}.json`)).json()));
    problems.push(...checkJson(jsons, new JSDOM('').window.DOMParser));
  }
  if (!problems.length) return console.log(`ok: discover, ${path} and ${paths.length} .json match SEL`);
  console.log(`gistree's selectors in \`src/lib.js\` no longer match gist.github.com (checked discover and ${path ?? 'no gist'}):\n`);
  console.log(problems.map((p) => `- ${p}`).join('\n'));
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.log(`could not check: ${e.message}`);
    process.exitCode = 2;
  });
}

module.exports = { checkList, checkGist, checkJson };
