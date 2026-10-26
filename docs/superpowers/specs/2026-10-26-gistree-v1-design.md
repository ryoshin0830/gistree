# gistree 1.0 設計

PoC（PR #1、`poc` ブランチ。merge せずに閉じる）で、作り方と見た目が固まった。この文書は、それを main に入れる本実装の設計である。PoC のコードは参照用として扱い、main から作り直す。

## 何のために

gist.github.com の一覧には、ファイル名を ASCII 順に並べたときの先頭 1 ファイルしか出ない。そのため、どの gist にどんなファイルがあるのか分からない。個別ページでも、ファイルの全体像をつかみにくい。gistree は、この 2 つを Chrome 拡張で解決する。

## ゴール（PoC v3 の挙動をそのまま引き継ぐ）

1. **一覧ページ**（`.gist-snippet` があるページ。ユーザーの一覧、starred、discover、検索結果）
   - GitHub のスニペットを隠し、代わりに索引を出す。左に gist の一覧（1 件 = 1 行）、右に固定のプレビュー欄を置く左右分割にする。
   - 行に出すもの：見出し（説明文。無ければ GitHub のタイトル）、Secret ラベル、更新日時、全ファイル名のチップ。他人の gist を含む一覧では所有者名も出す。
   - 選択：行のどこを押しても選べる。↑↓ キーで移動し、Enter・ダブルクリック・「Open gist」ボタンで gist を開く。最初は先頭の行を選んでおく。
   - プレビュー欄：上部にファイルボタン（高さ 28px、`aria-pressed`）を並べる。最初に出すファイルは次の順で決める。
     1. README（`README`、`README.md`、`README.markdown`、`README.txt`。大文字小文字は区別しない）
     2. 他の Markdown
     3. `.txt`
     4. 先頭のファイル
   - チップを押すと、そのファイルをプレビューに出す。Cmd/Ctrl+クリックでは新しいタブで開く。
   - 上部の欄に入力すると、タイトル・説明文・ファイル名で即座に絞り込む。Enter を押すと、GitHub の gist 検索（`user:<owner> <語>`）へ移動する。↓ を押すと一覧に移る。
   - ユーザーの一覧と starred では、「Older」をたどって最大 10 ページ（100 件）を 1 つにまとめる。それ以上ある場合は、GitHub のページへのリンクを出す。検索結果と discover はまとめない。
   - 画面幅が 1011px 以下ならプレビュー欄を出さず、行を押すとその gist を開く。
2. **個別ページ**（ファイルが 2 つ以上ある gist）
   - 左に追従するサイドバーを出す。中身は「FILES · N」の見出し、絞り込み欄、ファイルの一覧、今読んでいるファイルのハイライト、開閉ボタン。開閉の状態は localStorage に保存する。
   - 幅 767px 以下では縦に積む。
3. **Turbo との共存**：`turbo:before-cache` の時点で GitHub の元の DOM に戻す。`turbo:load` / `pjax:end` で組み直す。二重に起動しても、索引とサイドバーは 1 つだけにする。

## 本実装で変えること

1. **軽い取得**：ファイル名とプレビューは、gist ページ全体（ログイン時は約 800KB）ではなく、埋め込み用の同一オリジンのエンドポイント `https://gist.github.com/<owner>/<id>.json` から読む（実測：同じ gist でページ 135KB に対し 30KB）。中身は次のとおり。
   - `files`：ファイル名の配列。ページと同じ順。
   - `div`：各ファイルを描画した HTML。`div.file#file-<slug>` が `files` と同じ順に並び、Markdown は `article.markdown-body`、コードは `.blob-code-inner` で、ページと同じ構造。
   - token は要らない。secret gist も URL を知っていれば読める。ファイル名は `div` ではなく `files` から取る（`div` には `.gist-blob-name` が無い）。
2. **後回しにしていた不具合の修正**
   - README の判定を上記 1〜4 の順に広げる。
   - プレビューに複製した要素の `id` を消す。隠した GitHub のスニペットと ID が重複しないようにするため。
   - 幅の判定を `offsetParent` から `matchMedia('(min-width: 1012px)')` に変える。CSS のブレークポイントと同じ値で判定し、テストでも差し替えられるようにする。
3. **DOM テスト**：jsdom（devDependency に 1 つだけ追加）で fixture の HTML を読み込み、`src/lib.js` と `src/content.js` をそのまま実行して、組み上がった DOM を確かめる。fixture は実際の HTML の構造を写した小さな HTML/JSON で、中身は合成したものにする。対象は次のとおり。
   - 一覧の組み立て
   - 選択とキー操作
   - 絞り込み
   - ページの統合
   - 狭い幅のとき
   - 取得に失敗したとき
   - Turbo キャッシュからの復元
   - 個別ページのサイドバー
4. **HTML の変化を検知する定期 CI**：GitHub Actions で毎日 1 回、ログインせずに次のページを取得する。
   - `https://gist.github.com/discover`
   - そこに出ている先頭の gist のページ
   - 同じ gist の `.json`

   そして、拡張が使うセレクタ（`SEL`）がまだ当たるかを確かめる。外れたら、ラベル `selector-drift` の issue を立てる（同じラベルの issue が開いていれば立てない）。`SEL` は Node から読めるように `src/lib.js` に移す。ログイン時にしか出ない DOM の違いは、この CI では検知できない。
5. **アイコンと説明**：16/48/128px のアイコン、manifest の説明、英語の README（Releases の zip から入れる手順を含む）を整える。
6. **CI とリリース**（`.github/workflows/`）
   - PR と push のたびに `npm test` を実行する（Node 22）。
   - main に push されるたびに、テストが通ったら Release を作る。
     - version は `manifest.json` の `"version": "1.0"`（major.minor）に、main のコミット数（`git rev-list --count HEAD`）を patch として足したもの。例：`1.0.42`。
     - tag は `v1.0.42`。同じ tag がすでにあれば何もしない。
     - zip（`gistree-1.0.42.zip`）の中身は、version を書き換えた `manifest.json`、`src/`、`icons/`。
     - リリースノートは GitHub の自動生成を使う。
   - 書き戻しのコミットはしない。major や minor を上げたいときは、`manifest.json` を手で書き換える。

## 非ゴール

- Chrome Web Store への公開、Firefox/Safari 対応、オプション画面、並べ替えの保存

## アンチゴール

- **拡張がトークンや API キーを要求すること**、GitHub API（`api.github.com`）を呼ぶこと。permissions と host_permissions は空のままにする。
- 読み取りや解析に失敗したときに、GitHub の元の表示を壊すこと。失敗したら、その部分は GitHub の表示のままにする。
- ビルドツールやフレームワークを入れること。拡張は MV3 + 素の JS + CSS のまま、ファイルをそのまま読み込めるようにする。

## 見た目

- Primer の CSS 変数を使い、ライト/ダークに自動で追従する。Octicon は GitHub のページにあるものを流用する。
- Apple HIG に合わせる。行全体をクリック対象にする。選択中の行は常にハイライトする。ポインタで操作するコントロールの高さは 28px にする。

## 実装担当に任せること

- ファイルの分け方（`src/content.js` が大きくなりすぎるなら、一覧用と個別ページ用に分けてよい）
- fixture の作り方と置き場所
- アイコンの図柄と、その作り方（依存は増やさない）
- 定期 CI の実行時刻
- PR の merge 方法（squash を推奨）

## 設計者の判断で決めたこと（ユーザー未確認）

- 一覧で、ある gist のファイル名を取得できなかったときは、行を残してチップの位置に「Files unavailable」と出す。その行を選ぶと、右欄に「Could not load this gist.」を出す。
- PoC にあったファイル名のキャッシュ（localStorage に gist の更新日時と一緒に保存）は残す。`.json` で 1 件あたりの取得は軽くなったが、一覧を開くたびに数十件を取得し直すのは避けたいため。
- 定期 CI で必須とするセレクタの線引き（discover / gist ページ / `.json` のどれで何を確かめるか）は、実装担当が決める。
