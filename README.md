# gistree

A Chrome extension that shows every file of a GitHub Gist.

- **Gist lists** (your gists, starred, discover, search): each gist becomes a two-column card, with all file names on the left and a preview on the right. The preview is `README.md` if the gist has one, otherwise another Markdown file, otherwise a `.txt` file, otherwise the first file.
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
