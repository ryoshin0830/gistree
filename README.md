# gistree

A Chrome extension that shows every file of a GitHub Gist.

- **Gist lists** (your gists, starred, discover, search): a compact index. Each gist shows its description as the title, a Secret label, when it changed, and every file name. A preview opens on demand: `README.md` if the gist has one, otherwise another Markdown file, otherwise a `.txt` file, otherwise the first file. All pages of a profile are merged into one list (up to 100 gists).
- **Filter and search**: type to filter by title, description or file name. Press Enter to search file contents with GitHub's gist search, scoped to that user. Your own secret gists are included while you are signed in.
- **Gist pages**: a sticky file sidebar with a filter box that highlights the file you are reading. You can hide it, and it stays hidden after a reload.

No token, no API key, no permissions. gistree reads the same gist pages your browser already shows, so your secret gists work while you are signed in.

> Status: proof of concept. It reads GitHub's HTML, so a GitHub redesign can break it. When that happens, gistree leaves the page untouched instead of breaking it.

## Install (unpacked)

1. Clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder.

## Develop

```sh
npm test   # node --test, Node 20+
```

GitHub DOM selectors all live in the `SEL` object at the top of `src/content.js`.
