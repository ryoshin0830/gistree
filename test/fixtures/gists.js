// Builds bodies shaped like https://gist.github.com/<owner>/<id>.json (the embed endpoint).
const slug = (name) => 'file-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const md = (text) =>
  `<div class="Box-body readme blob"><article class="markdown-body entry-content container-lg" itemprop="text"><h1>Demo</h1><a id="user-content-demo" class="anchor" href="#demo">#</a><p>${text}</p></article></div>`;

const code = (...lines) =>
  `<div class="Box-body p-0 blob-wrapper data"><table class="highlight"><tbody>${lines
    .map((l, i) => `<tr><td id="LC${i + 1}" class="blob-code blob-code-inner js-file-line">${l}</td></tr>`)
    .join('')}</tbody></table></div>`;

// files: [[name, bodyHtml], ...]; names overrides the "files" array (to fake a mismatch).
function gistJson(files, names = files.map(([n]) => n)) {
  const div = files
    .map(
      ([name, body]) =>
        `<div class="gist-file"><div class="gist-data"><div class="js-gist-file-update-container js-task-list-container"><div id="${slug(name)}" class="file my-2">${body}</div></div></div></div>`,
    )
    .join('');
  return { description: '', public: true, files: names, owner: 'alice', div: `<div id="gist1" class="gist">${div}</div>`, stylesheet: '' };
}

module.exports = { md, code, gistJson };
