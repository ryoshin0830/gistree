# gistree

A Chrome extension that shows every file of a GitHub Gist. GitHub's gist lists show only one file per gist (the first by name), so you can't tell what a multi-file gist contains. gistree fixes that.

- **Gist lists** (your gists, starred, discover, search) become a compact, searchable index. Each row shows the gist's description, a Secret label, when it changed, and every file name. Select a row (click, or ↑/↓) to preview the gist on the right, like Mail. Enter or double-click opens it. The preview starts with the README, otherwise another Markdown file, otherwise a `.txt` file, otherwise the first file. Every other file is one click away. All pages of a profile are merged into one list (up to 100 gists).
- **Filter and search**: typing filters by title, description and file name. Enter searches file contents with GitHub's gist search, scoped to that user. Your own secret gists are included while you are signed in.
- **Gist pages** get a sticky file sidebar with a filter box. It highlights the file you are reading, and it stays hidden after a reload if you hide it.

**No token, no API key, no permissions.** gistree reads only gist.github.com, from your own browser, and never calls GitHub's API.

## Install

1. Download `gistree-<version>.zip` from the [latest release](https://github.com/ryoshin0830/gistree/releases/latest) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

To update, unzip the new release over the same folder and click ↻ on gistree's card in `chrome://extensions`.

## How it works

- Gist lists fetch each gist's embed data (`https://gist.github.com/<user>/<id>.json`, same origin, about 30 KB) for its file names and previews. File names are cached in `localStorage` until the gist changes.
- Every GitHub DOM selector lives in `SEL` in `src/lib.js`. If GitHub changes its markup, gistree leaves that part of the page as GitHub drew it.
- A daily workflow (`.github/workflows/selectors.yml`) checks the live site against `SEL` and opens a `selector-drift` issue when the markup no longer matches.

## Develop

```sh
npm ci
npm test   # node --test with jsdom, Node 22
```

Load the repository folder itself as an unpacked extension to try changes.

## Releases

Every push to `main` that passes the tests is released automatically by `.github/workflows/ci.yml`. The version is the `major.minor` in `manifest.json` plus the number of commits on `main` (for example `1.0.42`). To start a new major or minor version, edit `version` in `manifest.json`.
