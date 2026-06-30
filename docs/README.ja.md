# Claude Notch for Windows

> **Claude Code** が何をしているかを画面上部にリアルタイム表示する、Windows 向け Dynamic Island スタイルのオーバーレイです。

[![CI](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/ci.yml/badge.svg)](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/ci.yml)
[![Release](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/release.yml/badge.svg)](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6.svg)](#)

🌐 [English](../README.md) · **日本語** · [한국어](./README.ko.md)

Claude Notch は、[Claude Code Hooks](https://docs.claude.com/en/docs/claude-code/hooks) をローカル HTTP サーバー経由で受信し、画面上部からスライドダウンするノッチスタイルのアイランドとして表示します。重要なタイミング（タスク完了・入力待ち）はカードとして表示され、軽い作業（ツール使用・サブエージェント）はキャラクターがアニメーションで表現します。

```
Claude Code (Hooks)  ──POST──▶  localhost:4317  ──▶  Claude Notch overlay
```

> **今すぐ UI をプレビューする：** ブラウザで [`mockups/notch-states.html`](./mockups/notch-states.html) を開き、各状態をクリックして確認できます。

---

## 機能

- **ホバーで表示** — ノッチは通常非表示で、カーソルを画面端に押し当てたときだけスライドダウンします。邪魔になりません。
- **イベント時に自動表示** — 通知は約 2.5 秒（許可プロンプトは 4 秒）表示されてから引っ込みます。
- **5 つの Claude Code イベント：**
  | イベント | 表示形式 |
  |----------|----------|
  | `Stop` | 「タスク完了」カード（緑） |
  | `Notification` | 「応答が必要」カード（黄） |
  | `PreToolUse` / `PostToolUse` | キャラクターが「作業中」に変わる / アイドルに戻る |
  | `SubagentStop` | キャラクター「サブエージェント完了」 |
- **複数セッション対応** — 複数の Claude Code インスタンスからのイベントを 1 つのノッチで受け取り、各カードにプロジェクト名が表示されます。
- **柔軟な位置設定** — 上部中央 / 上部左 / 上部右 / 左端 / 右端から選択でき、オフセットやモニターも個別に設定できます。
- **ワンクリック Hooks インストール** — 既存の hooks を保持したまま、5 つの hooks を `~/.claude/settings.json` に自動登録します。
- **クリックスルー & 軽量** — 透明なオーバーレイはデスクトップを遮らず、v1 では Claude Code へのデータ送信は一切行いません。

---

## インストール

> Windows のみ対応。

1. [**Releases**](https://github.com/takaaaaaan/claude-code-notch/releases) ページから最新の `Claude.Notch.Setup.x.y.z.exe` をダウンロードします。
2. 実行します。インストーラーは**署名なし**のため、Windows SmartScreen の警告が出ることがあります — **詳細情報 → 実行** をクリックしてください。
3. インストール先を選択して完了させます。

ソースから実行する場合は [開発](#開発) をご覧ください。

## 初回セットアップ

起動後、Claude Code と接続します：

1. **Claude Notch** トレイアイコンを右クリック → **設定を開く / Open settings**。
2. **Connection** タブを開きます。
3. **One-click Hooks install** をクリックします。これにより 5 つの hooks が `~/.claude/settings.json` に追加されます（既存の hooks は保持されます）。
4. **Claude Code を再起動**して設定を再読み込みします。

あとは Claude Code を通常通りに使うだけです — ノッチがその動作に反応します。**Advanced** タブには、Claude Code なしで各状態をプレビューできる**テスト通知**ボタンがあります。

---

## 設定

| タブ | 内容 |
|------|------|
| General | Windows ログイン時に起動、テーマ（システム / ダーク / ライト） |
| Connection | ポート、接続状態、ワンクリック Hooks インストール＋ステータス |
| Notifications | 表示時間、イベントごとのオン / オフ（タスク完了 / 許可 / ツール使用 / サブエージェント） |
| Appearance | ホバー表示、位置プリセット（上部中央 / 左 / 右、左 / 右端）、サイズ、オフセット、モニター |
| Character | キャラクターの表示 / 非表示 |
| Advanced | テスト通知ボタン（各イベントをシミュレート） |

## 注意事項

- サーバーは **`127.0.0.1` のみ** でリッスンします（デフォルトポート **4317**）。外部ネットワーク通信はありません。
- **ポートを変更した場合**は、**One-click Hooks install** を再実行して Claude Code を再起動してください — hook コマンドにはポートが埋め込まれています。
- v1 は**表示専用**：ノッチは状態を表示するだけで、Claude Code にアクションを送り返すことはありません。

---

## 開発

Node.js 20 以上と Windows が必要です。

```bash
git clone https://github.com/takaaaaaan/claude-code-notch.git
cd claude-code-notch
npm install
npm start          # launch the app
npm test           # unit tests (node:test)
npm run smoke      # Electron renderer smoke test
npm run dist       # build the Windows installer (NSIS) into dist/
```

> `npm run dist` はシンボリックリンクを含むコード署名ヘルパーを展開します。「Cannot create symbolic link」エラーが出た場合は、**Windows 開発者モード**を有効にするか（設定 → プライバシーとセキュリティ → 開発者向け）、ターミナルを管理者として実行してください。CI はクリーンな Windows ランナーでリリースをビルドするため、タグ付きリリースではローカルでの対応は不要です。

### 技術スタック

Node 組み込みの `http` サーバーを使用した Electron（メイン + 2 つのレンダラーウィンドウ）。イベント正規化・ウィンドウ位置計算・ホバー数学・設定・hooks インストールなど、すべての判断ロジックは `node:test` でユニットテストされた純粋なモジュールに集約されており、レンダラーは Electron スモークテストで保護されています。

## リリース

`v0.1.0` のようなタグをプッシュすると、[リリースワークフロー](./.github/workflows/release.yml) がトリガーされます。テストを実行し、Windows ランナーでインストーラーをビルドして、`.exe` を GitHub Release に添付します。

```bash
npm version 0.1.0 --no-git-tag-version   # bump if needed
git commit -am "release: v0.1.0"
git tag v0.1.0
git push origin main --tags
```

## ロードマップ（v1 以降）

- ノッチからの返信 / ターミナルへのジャンプ
- ポート変更時の hooks 自動再登録
- 本物のトレイ接続ステータス；カスタムアプリアイコン
- サウンド、カードの経過時間表示、メディア / ファイル / システム情報ウィジェット

## ライセンス

[MIT](./LICENSE) © takaaaaaan
