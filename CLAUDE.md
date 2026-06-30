# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要: このファイルのメンテナンス方針

- このリポジトリで開発が進み、**全体構造やフローが変わった**、または **CLAUDE.md に書かれている内容と実態がズレた**ことに気づいたら、CLAUDE.md を更新する。
- ただし **CLAUDE.md の変更は必ず user の許可を取ってから行うこと**。Claude 側の判断で勝手に書き換えない。「○○の節を××のように更新したい(理由: …)」と提案 → user の "OK" を待ってから編集する。

## プロジェクト概要

**Claude Notch for Windows** — Claude Code の作業状態を画面端に出す Dynamic Island 風オーバーレイ（Electron 製・Windows 専用）。Claude Code の Hooks がローカル HTTP サーバー（既定 `127.0.0.1:4317`）へイベントを POST し、ノッチが受信して表示する。重要イベント（Stop / Notification）はカード、軽いイベント（PreToolUse / PostToolUse / SubagentStop）はキャラ（周回ロゴ）の変化で表す。v1 は**表示専用**（Claude Code への送り返しはしない）。

- リポジトリ: `takaaaaaan/claude-code-notch`（公開）。これ単体で完結し、姉妹リポ依存は無い。
- 設計思想: 判断ロジックはすべて**純粋モジュール**に隔離して `node:test` で単体テスト。Electron 依存部分（ウィンドウ / トレイ / IPC）は薄く保ち、起動と smoke テストで検証する。
- UI は英語 / 日本語 / 韓国語の 3 言語対応（既定 `ja`）。

## よく使うコマンド

```bash
npm install      # 依存（Electron / electron-builder）を入れる
npm start        # アプリを起動
npm test         # 単体テスト（node:test、追加ランナー無し）
npm run smoke    # レンダラーの Electron smoke テスト（後述）
npm run dist     # Windows インストーラ(NSIS)を dist/ に生成
```

サーバは必ず `127.0.0.1` にバインドし、既定ポートは `4317`（使用中なら 4327 まで自動フォールバック）。外部ネットワークには公開しない。

## ハイレベル構成

```
src/
  main/         Electron メインプロセス（純粋ロジック＋薄いグルー）
    settings-store.js   設定の既定値・マージ・JSON 永続化（純粋）
    event-mapper.js     イベント正規化＋表示コマンド化＋カード文言の i18n（純粋）
    event-server.js     127.0.0.1 の HTTP 受信サーバー（純粋寄り）
    position.js         ノッチ窓のステージ位置計算（プリセット/マルチモニタ、純粋）
    hover.js            ホバー検知帯の計算（純粋）
    hooks-installer.js  ~/.claude/settings.json への登録/解除/判定（純粋）
    notify-policy.js    表示秒数・イベント有効判定（純粋）
    ipc.js              設定/Hooks/テスト通知の IPC ハンドラ（グルー）
    tray-controller.js  トレイ常駐・メニュー（グルー）
    main.js             ウィンドウ生成・サーバ起動・ホバー監視の配線（グルー）
  preload/        contextBridge（notch / settings の安全な API 公開）
  renderer/
    notch/        オーバーレイ UI（HTML/CSS/JS、周回ロゴのキャラ）
    settings/     設定ウィンドウ（6 タブ）＋ i18n.js（en/ja/ko 文字列表）
hooks/            Claude Code から呼ばれる notify.js（stdin→localhost へ POST、純粋な payload.js）
scripts/          smoke-notch.js（レンダラーの自動検証）
test/             node:test の単体テスト群
assets/           icon.png（周回ロゴ）
docs/             設計仕様・実装計画（docs/superpowers/）、README.ja/ko
mockups/          notch-states.html（各状態のプレビュー）
.github/workflows/ ci.yml（push/PR でテスト）・release.yml（タグで配布ビルド）
```

## アーキテクチャ

データの流れ：

```
Claude Code (Hooks) ──POST──▶ 127.0.0.1:4317/event ──▶ main: event-server
   hooks/notify.js                                         │ normalizeEvent
   (payload.js で整形)                                      ▼ mapToDisplay(lang)
                                              IPC 'notch:display' ──▶ renderer/notch
```

- **純粋とグルーの分離**: `event-mapper` / `position` / `hover` / `settings-store` / `hooks-installer` / `notify-policy` / `payload` は副作用が無く、すべて `node:test` で検証。`main.js` / `ipc.js` / `tray-controller` は Electron 配線のみで薄く保つ。
- **ウィンドウ**: ノッチは透明・枠なし・最前面・クリック透過の「ステージ」窓。カードが収まる十分な大きさ（`computeStageBounds`）にし、ピルは中身サイズで各端にアンカー（CSS の `data-pos`）。ホバーはグローバルカーソル座標のポーリングで検知（DOM イベントではない）。
- **i18n**: 設定 UI は `src/renderer/settings/i18n.js`（`window.I18N` 兼 node モジュール）、通知カードは `event-mapper` の `CARD_STRINGS`。言語は `settings.general.language` から適用。
- **Hooks 連携**: 登録/解除/判定は `hooks-installer`（パス非依存マッチ）。パッケージ版では `hooks/` を asar から unpack し、`unpackedScriptPath` で実体パスに変換して登録する。

## 編集・拡張時の指針

- **純粋ロジックを足すなら**：まず `test/` に失敗するテストを書き（RED→GREEN）、`src/main/` の該当モジュールに最小実装。`node:test` のみを使う（Jest/Vitest は入れない）。
- **レンダラー（notch/settings）をいじったら**：必ず `npm run smoke` を通す。これは「レンダラーが実行されているか」を守る砦（過去に、トップレベル `const notch` が contextBridge の `window.notch` と衝突してスクリプト全体が死んだ事故がある。preload が公開するグローバル名と被る `const`/`let` を作らない）。
- **UI 文字列を足すなら**：`i18n.js` の en/ja/ko **3 言語すべて**にキーを足す（パリティ用テストが欠落を検出する）。main から渡す文言は `event-mapper` の `CARD_STRINGS` も同様。
- **ノッチ位置プリセットを足すなら**：`position.js`（`computeBounds`/`computeStageBounds`）＋`hover.js`（`triggerZone`）＋`notch.css`（`data-pos` アンカーとスライド方向）＋`settings.html` の選択肢＋`i18n.js`＋テスト、をワンセットで。
- **設計→実装の進め方**：大きめの作業は superpowers の brainstorming → writing-plans → subagent-driven-development で進め、仕様と計画を `docs/superpowers/` に残す。
- **リリースの流れ（重要）**：変更は **main に積んでいく**だけ。すぐにタグは打たず、ある程度溜まったらリリースする。蓄積中の変更は `CHANGELOG.md` の `[Unreleased]` に記録。リリース時にバージョンを上げ、`v*` タグを push → GitHub Actions が Windows ランナーでインストーラをビルドして Release に添付。CI は push/PR で `node:test` と smoke を回す。
- **依存**：実行時依存は Electron のみ（他は Node 組み込み）。

## ドキュメント

- `docs/superpowers/specs/` — 設計仕様、`docs/superpowers/plans/` — 実装計画
- `CHANGELOG.md` — Keep a Changelog 形式（未リリース分は `[Unreleased]`）
- `README.md`（英語・正） / `docs/README.ja.md` / `docs/README.ko.md`
- `mockups/notch-states.html` — 各状態のブラウザプレビュー

## Commit style（strictly enforced）

`<emoji> <type>: <description>` 形式。**コミットメッセージは韓国語で書く**(インフラ・config 系のみ英語可)。

Types: `✨ feat` `🐛 fix` `♻️ refactor` `🧪 test` `📝 docs` `🔧 chore` `🚀 perf` `💄 style` `🔒 security` `🗑️ remove` `🚧 wip`。

`git add -A` / `git add .` は禁止 — パスを明示してステージする。サブモジュールがある場合は先にサブモジュール内でコミットし、親リポではポインタ更新を別コミットにする。
