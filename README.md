# Claude Notch for Windows

> A Dynamic-Island-style overlay for Windows that shows what **Claude Code** is doing — right at the top of your screen.

[![CI](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/ci.yml/badge.svg)](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/ci.yml)
[![Release](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/release.yml/badge.svg)](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6.svg)](#)

🌐 **English** · [日本語](./docs/README.ja.md) · [한국어](./docs/README.ko.md)

Claude Notch listens for [Claude Code Hooks](https://docs.claude.com/en/docs/claude-code/hooks) over a local HTTP server and renders them as a notch-style island that slides down from the top of the screen. Important moments (task done, waiting for you) appear as cards; lighter activity (tool use, subagents) animates a little character.

```
Claude Code (Hooks)  ──POST──▶  localhost:4317  ──▶  Claude Notch overlay
```

> **Preview the UI right now:** open [`mockups/notch-states.html`](./mockups/notch-states.html) in any browser and click through the states.

---

## Features

- **Hover to reveal** — the notch stays hidden and slides down only when you push the cursor to the screen edge, so it never gets in the way.
- **Auto-show on events** — notifications appear for ~2.5s (permission prompts 4s) then retreat.
- **Five Claude Code events:**
  | Event | Shown as |
  |-------|----------|
  | `Stop` | "Task complete" card (green) |
  | `Notification` | "Needs your response" card (yellow) |
  | `PreToolUse` / `PostToolUse` | character turns to "working" / back to idle |
  | `SubagentStop` | character "subagent done" |
- **Multiple sessions** — events from several Claude Code instances share one notch; each card is labelled with its project name.
- **Flexible position** — top-center / top-left / top-right / left edge / right edge, with offset and per-monitor selection.
- **One-click Hooks install** — registers all five hooks into `~/.claude/settings.json` for you, preserving any hooks you already have.
- **Click-through & lightweight** — the transparent overlay never blocks your desktop, and it's display-only (v1 never sends anything back to Claude Code).

---

## Install

> Windows only.

1. Download the latest `Claude.Notch.Setup.x.y.z.exe` from the [**Releases**](https://github.com/takaaaaaan/claude-code-notch/releases) page.
2. Run it. The installer is **unsigned**, so Windows SmartScreen may warn you — click **More info → Run anyway**.
3. Choose an install location and finish.

Or run from source — see [Development](#development).

## First-run setup

After launching, connect it to Claude Code:

1. Right-click the **Claude Notch** tray icon → **設定を開く / Open settings**.
2. Go to the **Connection** tab.
3. Click **One-click Hooks install**. This adds the five hooks to `~/.claude/settings.json` (existing hooks are preserved).
4. **Restart Claude Code** so it reloads its settings.

Then use Claude Code normally — the notch reacts to its activity. The **Advanced** tab has **Test notification** buttons to preview each state without Claude Code.

---

## Settings

| Tab | Contents |
|-----|----------|
| General | Start on Windows login, theme (system/dark/light) |
| Connection | Port, connection status, one-click Hooks install + status |
| Notifications | Display duration, per-event on/off (task done / permission / tool use / subagent) |
| Appearance | Hover reveal, position preset (top-center/left/right, left/right edge), size, offset, monitor |
| Character | Show/hide the character |
| Advanced | Test-notification buttons (simulate each event) |

## Notes

- The server listens on **`127.0.0.1` only** (default port **4317**). No external network traffic.
- After **changing the port**, re-run **One-click Hooks install** and restart Claude Code — the hook command has the port baked in.
- v1 is **display-only**: the notch shows state but never sends actions back to Claude Code.

---

## Development

Requires Node.js 20+ and Windows.

```bash
git clone https://github.com/takaaaaaan/claude-code-notch.git
cd claude-code-notch
npm install
npm start          # launch the app
npm test           # unit tests (node:test)
npm run smoke      # Electron renderer smoke test
npm run dist       # build the Windows installer (NSIS) into dist/
```

> `npm run dist` extracts code-signing helpers that contain symlinks; if it fails with "Cannot create symbolic link", enable **Windows Developer Mode** (Settings → Privacy & security → For developers) or run the terminal as Administrator. CI builds releases on a clean Windows runner, so tagged releases don't need this locally.

### Tech

Electron (main + two renderer windows) with a Node built-in `http` server. All decision logic (event normalization, window positioning, hover math, settings, hooks install) lives in pure modules unit-tested with `node:test`; the renderer is guarded by an Electron smoke test.

## Releasing

Pushing a tag like `v0.1.0` triggers the [release workflow](./.github/workflows/release.yml): it runs the tests, builds the installer on a Windows runner, and attaches the `.exe` to a GitHub Release.

```bash
npm version 0.1.0 --no-git-tag-version   # bump if needed
git commit -am "release: v0.1.0"
git tag v0.1.0
git push origin main --tags
```

## Roadmap (post-v1)

- Reply / jump-to-terminal from the notch
- Auto re-register hooks on port change
- Real tray connection status; custom app icon
- Sound, elapsed-time on cards, media/file/system-info widgets

## License

[MIT](./LICENSE) © takaaaaaan
