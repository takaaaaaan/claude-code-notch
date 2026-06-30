# Claude Notch for Windows

> **Claude Code** 가 무엇을 하고 있는지 화면 상단에 실시간으로 보여주는 Windows용 Dynamic Island 스타일 오버레이입니다.

[![CI](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/ci.yml/badge.svg)](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/ci.yml)
[![Release](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/release.yml/badge.svg)](https://github.com/takaaaaaan/claude-code-notch/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6.svg)](#)

🌐 [English](../README.md) · [日本語](./README.ja.md) · **한국어**

Claude Notch는 [Claude Code Hooks](https://docs.claude.com/en/docs/claude-code/hooks)를 로컬 HTTP 서버를 통해 수신하고, 화면 상단에서 슬라이드 다운되는 노치 스타일 아일랜드로 렌더링합니다. 중요한 순간(작업 완료, 응답 대기)은 카드로 표시되고, 가벼운 활동(도구 사용, 서브에이전트)은 작은 캐릭터가 애니메이션으로 표현합니다.

```
Claude Code (Hooks)  ──POST──▶  localhost:4317  ──▶  Claude Notch overlay
```

> **지금 바로 UI 미리보기:** 브라우저에서 [`mockups/notch-states.html`](./mockups/notch-states.html) 을 열고 각 상태를 클릭해 확인하세요.

---

## 기능

- **호버로 표시** — 노치는 평소 숨겨져 있고, 커서를 화면 가장자리로 밀었을 때만 슬라이드 다운됩니다. 작업을 방해하지 않습니다.
- **이벤트 시 자동 표시** — 알림은 약 2.5초(권한 프롬프트는 4초) 동안 표시된 후 사라집니다.
- **5가지 Claude Code 이벤트:**
  | 이벤트 | 표시 방식 |
  |--------|-----------|
  | `Stop` | "작업 완료" 카드 (초록색) |
  | `Notification` | "응답 필요" 카드 (노란색) |
  | `PreToolUse` / `PostToolUse` | 캐릭터가 "작업 중"으로 전환 / 유휴 상태로 복귀 |
  | `SubagentStop` | 캐릭터 "서브에이전트 완료" |
- **멀티 세션 지원** — 여러 Claude Code 인스턴스의 이벤트를 하나의 노치에서 공유하며, 각 카드에 프로젝트 이름이 표시됩니다.
- **유연한 위치 설정** — 상단 중앙 / 상단 좌측 / 상단 우측 / 좌측 가장자리 / 우측 가장자리, 오프셋 및 모니터별 선택 가능.
- **원클릭 Hooks 설치** — 기존 hooks를 보존하면서 5개의 hooks를 `~/.claude/settings.json`에 자동으로 등록합니다.
- **다국어 UI** — 설정 창과 알림 텍스트를 English / 日本語 / 한국어로 표시 (일반 탭에서 전환).
- **클릭스루 & 경량** — 투명한 오버레이는 데스크탑을 가리지 않으며, v1에서는 Claude Code로 어떤 데이터도 전송하지 않습니다.

---

## 설치

> Windows 전용.

1. [**Releases**](https://github.com/takaaaaaan/claude-code-notch/releases) 페이지에서 최신 `Claude.Notch.Setup.x.y.z.exe`를 다운로드합니다.
2. 실행합니다. 인스톨러는 **서명되지 않아** Windows SmartScreen 경고가 표시될 수 있습니다 — **자세한 정보 → 실행**을 클릭하세요.
3. 설치 위치를 선택하고 완료합니다.

소스에서 실행하려면 [개발](#개발)을 참고하세요.

## 초기 설정

실행 후 Claude Code와 연결합니다:

1. **Claude Notch** 트레이 아이콘을 우클릭 → **設定を開く / Open settings**.
2. **Connection** 탭으로 이동합니다.
3. **One-click Hooks install**을 클릭합니다. 이렇게 하면 5개의 hooks가 `~/.claude/settings.json`에 추가됩니다 (기존 hooks는 유지됩니다).
4. Claude Code를 **재시작**하여 설정을 다시 로드합니다.

이후에는 Claude Code를 평소처럼 사용하면 됩니다 — 노치가 활동에 반응합니다. **Advanced** 탭에는 Claude Code 없이도 각 상태를 미리 볼 수 있는 **테스트 알림** 버튼이 있습니다.

---

## 설정

| 탭 | 내용 |
|----|------|
| General | Windows 로그인 시 시작, 테마 (시스템 / 다크 / 라이트) |
| Connection | 포트, 연결 상태, 원클릭 Hooks 설치 + 상태 |
| Notifications | 표시 시간, 이벤트별 켜기 / 끄기 (작업 완료 / 권한 / 도구 사용 / 서브에이전트) |
| Appearance | 호버 표시, 위치 프리셋 (상단 중앙 / 좌 / 우, 좌 / 우 가장자리), 크기, 오프셋, 모니터 |
| Character | 캐릭터 표시 / 숨기기 |
| Advanced | 테스트 알림 버튼 (각 이벤트 시뮬레이션) |

## 참고사항

- 서버는 **`127.0.0.1`만** 수신합니다 (기본 포트 **4317**). 외부 네트워크 트래픽 없음.
- **포트를 변경한 후**에는 **One-click Hooks install**을 다시 실행하고 Claude Code를 재시작하세요 — hook 명령에 포트가 포함되어 있습니다.
- v1은 **표시 전용**: 노치는 상태를 표시하지만 Claude Code로 어떠한 동작도 전송하지 않습니다.

---

## 개발

Node.js 20 이상과 Windows가 필요합니다.

```bash
git clone https://github.com/takaaaaaan/claude-code-notch.git
cd claude-code-notch
npm install
npm start          # launch the app
npm test           # unit tests (node:test)
npm run smoke      # Electron renderer smoke test
npm run dist       # build the Windows installer (NSIS) into dist/
```

> `npm run dist`는 심볼릭 링크를 포함하는 코드 서명 헬퍼를 추출합니다. "Cannot create symbolic link" 오류가 발생하면 **Windows 개발자 모드**를 활성화하거나 (설정 → 개인 정보 및 보안 → 개발자용) 터미널을 관리자 권한으로 실행하세요. CI는 클린한 Windows 러너에서 릴리스를 빌드하므로 태그된 릴리스에서는 로컬 조치가 필요 없습니다.

### 기술 스택

Node 내장 `http` 서버를 사용한 Electron (메인 + 렌더러 창 2개). 이벤트 정규화, 창 위치 지정, 호버 계산, 설정, hooks 설치 등 모든 결정 로직은 `node:test`로 유닛 테스트된 순수 모듈에 포함되어 있으며, 렌더러는 Electron 스모크 테스트로 보호됩니다.

## 릴리스

`v0.1.0`과 같은 태그를 푸시하면 [릴리스 워크플로우](./.github/workflows/release.yml)가 트리거됩니다. 테스트를 실행하고 Windows 러너에서 인스톨러를 빌드한 다음 `.exe`를 GitHub Release에 첨부합니다.

```bash
npm version 0.1.0 --no-git-tag-version   # bump if needed
git commit -am "release: v0.1.0"
git tag v0.1.0
git push origin main --tags
```

## 로드맵 (v1 이후)

- 노치에서 답장 / 터미널로 이동
- 포트 변경 시 hooks 자동 재등록
- 실제 트레이 연결 상태; 커스텀 앱 아이콘
- 사운드, 카드의 경과 시간, 미디어 / 파일 / 시스템 정보 위젯

## 라이선스

[MIT](./LICENSE) © takaaaaaan
