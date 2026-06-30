# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Hooks broken in the installed (packaged) app: the registered command pointed at `notify.js` inside `app.asar`, which an external `node` cannot read (`MODULE_NOT_FOUND` on every Stop hook). Unpack `hooks/` from the asar (`asarUnpack`) and register the `app.asar.unpacked` path. Re-run one-click Hooks install after updating.
- `npm test` could hang when port 4317 was already in use (e.g. the app running): the event-server default-port test leaked a server on fallback. It no longer falls back and always stops.

## [0.2.0] - 2026-06-30

### Added
- Multilingual UI: settings window and notification cards in English, 日本語, and 한국어, selectable from the General tab (`general.language`). Notch idle text and card defaults localize too.

### Fixed
- Settings sidebar tabs did nothing: an author `section { display:flex }` rule overrode the user-agent `[hidden] { display:none }`, so hidden panels stayed visible. Added `section[hidden] { display:none }`.

## [0.1.0] - 2026-06-30

First public release.

### Added
- Notch-style overlay (Electron) that displays Claude Code activity at the top of the screen.
- Local `127.0.0.1` HTTP server (default port 4317) that receives Claude Code Hook events.
- Five events mapped to the UI: `Stop` and `Notification` show cards; `PreToolUse`/`PostToolUse`/`SubagentStop` animate the character.
- Hover-to-reveal plus auto-show on events (~2.5s, permission prompts 4s).
- Position presets: top-center / top-left / top-right / left edge / right edge, with offset and per-monitor selection.
- Multi-session support: events from multiple Claude Code instances share one notch, labelled by project.
- Settings window (6 tabs): General, Connection, Notifications, Appearance, Character, Advanced.
- One-click Hooks installation into `~/.claude/settings.json` that preserves existing hooks, with install-status detection.
- Test-notification buttons to preview each state without Claude Code.
- Tray icon with open-settings, Do-Not-Disturb toggle, and quit.
- Unit tests (`node:test`) for all pure logic and an Electron renderer smoke test (`npm run smoke`).
- GitHub Actions: CI (tests on push/PR) and Release (builds the Windows installer on tag and attaches it to a GitHub Release).

### Known limitations
- Display-only (no replies/actions sent back to Claude Code).
- Changing the port requires re-running one-click Hooks install.
- Tray connection status is static; no custom app icon yet.
- The installer is unsigned (SmartScreen warning on first run).

[0.2.0]: https://github.com/takaaaaaan/claude-code-notch/releases/tag/v0.2.0
[0.1.0]: https://github.com/takaaaaaan/claude-code-notch/releases/tag/v0.1.0
