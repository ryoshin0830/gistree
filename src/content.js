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

function boot() {}

boot();
