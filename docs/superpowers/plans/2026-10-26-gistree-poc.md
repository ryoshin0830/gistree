# gistree PoC 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gist.github.com の一覧ページに「全ファイル一覧＋README プレビュー」を、個別ページに「ファイルのサイドバー」を足す Chrome 拡張（MV3）の PoC。

**Architecture:** content script を 2 本にする。DOM に依存しない純粋関数は `src/lib.js`、GitHub の DOM を触る処理は `src/content.js` に置く。一覧ページでは、各 gist の個別ページ HTML を同じサイトから `fetch` して `DOMParser` で読む。個別ページでは今のページの DOM から読む。GitHub の DOM セレクタは `content.js` 冒頭の `SEL` オブジェクト 1 か所にまとめる。

**Tech Stack:** Chrome MV3、素の JS（ビルドなし）、CSS（Primer の CSS 変数）、テストは `node --test`（Node 20+）。

**Spec:** `docs/superpowers/specs/2026-10-26-gistree-poc-design.md`

## Global Constraints

- GitHub API・トークン・API キーは使わない。データは gist.github.com の HTML のみから取る。
- 読み取りや fetch に失敗したら、その gist の元の表示に一切手を付けない。
- 同時に fetch するのは最大 3 件まで。
- プレビューの選択順は `README.md` → 他の `.md` → `.txt` → 先頭ファイル。大文字小文字は区別しない。
- ファイル一覧は全件表示する。
- 色は Primer の CSS 変数を使う（例 `var(--fgColor-muted, #59636e)`）。
- 幅 768px 未満では縦積みにする。
- 依存パッケージは追加しない。

## Review Focus

1. fetch が失敗する（429・404・ネットワーク切断）→ そのカードは元の表示のまま。Task 3 の手動確認で、オフラインにして再読み込みして確かめる。
2. ファイルが 1 つだけの gist → 拡張は何もしない（一覧の行が 1 行だけ増えても意味がないため）。Task 3 の手動確認。
3. ページ送り（Turbo/pjax）で中身が差し替わる、または同じ処理が 2 回走る → 二重に挿入しない。`data-gistree` の印で冪等にする。Task 3 と Task 4 の手動確認。
4. 大文字の `README.MD`、`readme.markdown`、拡張子なしのファイル名、日本語のファイル名 → `pickPreview` と `truncateMiddle` のテストで固定する（Task 1）。
5. 個別ページでサイドバーを隠した後に再読み込みする → 隠れたまま。Task 4 の手動確認。

---

### Task 1: 純粋関数 `src/lib.js`

**Files:**
- Create: `src/lib.js`
- Test: `test/lib.test.js`
- Create: `package.json`（`{"private":true,"scripts":{"test":"node --test"}}` だけ）

**Interfaces:**
- Produces: グローバル `gistree` オブジェクト（Node では `module.exports`）
  - `pickPreview(names: string[]) -> number`：プレビューにするファイルの index。空配列なら `-1`。
  - `truncateMiddle(name: string, max = 32) -> string`：`max` 文字を超えたら、拡張子を残して真ん中を `…` にする。

- [ ] **Step 1: 失敗するテストを書く**

```js
const test = require('node:test');
const assert = require('node:assert');
const { pickPreview, truncateMiddle } = require('../src/lib.js');

test('README.md wins regardless of case and position', () => {
  assert.equal(pickPreview(['a.py', 'notes.md', 'README.MD']), 2);
});
test('falls back to first .md/.markdown, then .txt, then 0', () => {
  assert.equal(pickPreview(['a.py', 'b.txt', 'guide.markdown']), 2);
  assert.equal(pickPreview(['a.py', 'b.TXT']), 1);
  assert.equal(pickPreview(['Makefile', 'a.py']), 0);
  assert.equal(pickPreview([]), -1);
});
test('truncateMiddle keeps head and extension', () => {
  assert.equal(truncateMiddle('short.py'), 'short.py');
  const t = truncateMiddle('whisper-large-v3-turbo-benchmark-results.jsonl', 24);
  assert.equal(t.length, 24);
  assert.ok(t.startsWith('whisper') && t.endsWith('.jsonl') && t.includes('…'));
});
test('truncateMiddle handles no extension and multibyte', () => {
  assert.equal(truncateMiddle('a'.repeat(40), 10).length, 10);
  assert.equal(truncateMiddle('とても長い日本語のファイル名です本当に長い.md', 12).length, 12);
});
```

- [ ] **Step 2:** `npm test` を実行する → `Cannot find module '../src/lib.js'` で失敗すること。
- [ ] **Step 3:** `src/lib.js` を実装する。末尾は `if (typeof module === 'object') module.exports = gistree;` とする（content script ではグローバルとして使う）。拡張子が 8 文字を超える場合は、拡張子とみなさず単純に真ん中を省略する。
- [ ] **Step 4:** `npm test` を実行する → 4 件 pass。
- [ ] **Step 5:** commit `feat: add preview picker and middle truncation`

### Task 2: 拡張の骨組み（manifest・CSS）

**Files:**
- Create: `manifest.json`（MV3、`name: "gistree"`、`matches: ["https://gist.github.com/*"]`、`js: ["src/lib.js","src/content.js"]`、`css: ["src/gistree.css"]`、`run_at: "document_idle"`。`permissions` は空）
- Create: `src/gistree.css`
- Create: `src/content.js`（この時点では `SEL` 定数と、起動部分の空の関数だけ）

- [ ] **Step 1:** `chrome://extensions` →「パッケージ化されていない拡張機能を読み込む」でエラーが出ないこと。
- [ ] **Step 2:** commit `chore: add MV3 manifest and stylesheet skeleton`

### Task 3: 一覧ページの 2 列表示

**Files:**
- Modify: `src/content.js`
- Modify: `src/gistree.css`

**Interfaces:**
- Consumes: `gistree.pickPreview`, `gistree.truncateMiddle`
- Produces（Task 4 でも使う）: `readFiles(root: ParentNode) -> {id, name, icon: Element|null, el: Element}[]`。`root` 配下の `SEL.file` を GitHub の表示順に返す。

`SEL`（セレクタはここだけに書く）:
- `snippet: '.gist-snippet'`
- `snippetBody: '.js-gist-file-update-container'`
- `gistLink: '.gist-snippet-meta a[href]'`（href が `/^\/[^/]+\/[0-9a-f]+$/` に一致するもの）
- `file: '.gist-content div.file[id^="file-"]'`（fetch した document 用は `div.file[id^="file-"]`）
- `fileName: '.gist-blob-name'`
- `fileIcon: '.file-info svg'`
- `markdown: 'article.markdown-body'`
- `codeLine: '.blob-code-inner'`

- [ ] **Step 1:** `enhanceList()` を実装する。`SEL.snippet` のうち `data-gistree` が無いものを対象にし、最大 3 並列で gist ページを `fetch` → `DOMParser` → `readFiles` する。ファイル数が 2 以上のときだけ、`snippetBody` を隠して `.gistree-card` を挿入する。中身は、左が全ファイルのリンク（`href = gistUrl + '#' + id`、`title` にフルネーム、表示名は `truncateMiddle`）、右がプレビュー。プレビューは、markdown なら `article` を `importNode`、それ以外は先頭 12 行を `<pre>` に `textContent` で入れる。プレビューに使ったファイルを左の一覧で強調する。どこかで例外が出たら、そのカードは元の表示のまま。
- [ ] **Step 2:** 手動確認（Chrome で読み込み）：`https://gist.github.com/fitchmultz` で 18 files の gist が 2 列になり、README が整形されて出ること。1 file の gist は元のままであること。ライト/ダーク両方で読めること。DevTools で Offline にして再読み込みすると、すべて元の表示のままであること。
- [ ] **Step 3:** commit `feat: show all files and README preview on gist lists`

### Task 4: 個別ページのサイドバー

**Files:**
- Modify: `src/content.js`
- Modify: `src/gistree.css`

**Interfaces:**
- Consumes: `readFiles(document)`, `gistree.truncateMiddle`

- [ ] **Step 1:** `enhanceGist()` を実装する。ファイルが 2 つ以上のとき、`SEL.file` の親（`.js-gist-file-update-container`）を `.gistree-layout`（flex）で包む。左に `.gistree-sidebar`（position: sticky）を置き、中身は見出し `FILES · N`、隠すボタン、絞り込み input、ファイルリンク。IntersectionObserver で、今見えているファイルの行に `aria-current="true"` を付ける。隠した状態は `localStorage['gistree:sidebar-hidden']` に保存する（読み書きは try/catch で包む）。
- [ ] **Step 2:** `boot()` を作る。`enhanceList(); enhanceGist();` を、読み込み時と `turbo:load`・`pjax:end` で呼ぶ。冪等にする。
- [ ] **Step 3:** 手動確認：18 files の gist でサイドバーが出ること。クリックでジャンプすること。スクロールで現在地が動くこと。絞り込みが効くこと。隠して再読み込みしても隠れたままであること。幅 700px で縦積みになること。
- [ ] **Step 4:** commit `feat: add file sidebar on gist pages`

### Task 5: README と PR

- [ ] **Step 1:** `README.md` に、何をするものか・インストール手順（unpacked）・トークン不要の方針を書く。
- [ ] **Step 2:** `npm test` が pass すること。push して、`main` に向けた PR を作る。
