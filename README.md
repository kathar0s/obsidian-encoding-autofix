# Encoding Auto-Fix

An Obsidian plugin that detects non-UTF-8 text files when they are added to your vault and **rewrites them as clean UTF-8** — before Obsidian or sync plugins (e.g. Self-hosted LiveSync) can corrupt the content.

This is especially important for **Korean / CJK text**: Obsidian assumes UTF-8 for all notes, so a UTF-16 file containing Korean characters gets silently mangled into replacement characters (`�`) the moment it is read. This plugin catches the file first and fixes it.

## Why

Obsidian reads and writes every note as UTF-8 and does **not** support UTF-16. If you drag in a `.txt` exported as "Unicode" (UTF-16) from Notepad, a transcription tool, etc., the multibyte characters are destroyed on read. With a sync plugin in the mix, the corrupted version then propagates to all your devices.

`Encoding Auto-Fix` reads the **raw bytes** of newly created files (via `readBinary`, before any lossy text decode), detects the real encoding, and converts to UTF-8.

## Features

- **Automatic conversion on file creation** — drag a file in, it's fixed.
- Detects:
  - UTF-16 LE / BE (with or without BOM)
  - UTF-8 with BOM (BOM is stripped)
- **Safe by design**: already-clean UTF-8 files are left untouched; unrecognized encodings (e.g. EUC-KR / CP949) are **not** force-converted — you get a warning instead, so nothing is destroyed.
- **Manual command**: `Encoding Auto-Fix: 현재 파일을 UTF-8로 변환` (convert the current file).
- Works on desktop and mobile (`isDesktopOnly: false`).

Handled text extensions: `txt`, `md`, `markdown`, `csv`, `tsv`, `json`, `log`, `text`, `srt`, `vtt`.

## How it works

1. Listens to the vault `create` event.
2. Reads raw bytes with `vault.readBinary()` (avoids Obsidian's lossy UTF-8 text read).
3. Detects encoding by BOM, then by null-byte distribution heuristics, then validates UTF-8.
4. If non-UTF-8, decodes with the correct `TextDecoder` and rewrites the file as UTF-8 (BOM removed).

## Installation

### Manual

1. Create a folder `<vault>/.obsidian/plugins/encoding-autofix/`.
2. Copy `main.js` and `manifest.json` into it.
3. Reload Obsidian → **Settings → Community plugins** → enable **Encoding Auto-Fix**.

### via BRAT (beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. BRAT → *Add beta plugin* → enter `kathar0s/obsidian-encoding-autofix`.

## Limitations

- The plugin must be installed **on the device where the file is added** — `.obsidian/plugins/` is not always sync-shared.
- Files whose original bytes were already corrupted (replacement characters already written) cannot be recovered — fix the source instead.
- EUC-KR / CP949 and other legacy codepages are detected as "unknown" and only warned about, not auto-converted (to avoid destructive guesses).

## License

[MIT](LICENSE)

---

## 한국어 설명

옵시디언에 추가되는 비-UTF-8 텍스트 파일을 감지해 **자동으로 UTF-8로 변환**하는 플러그인입니다. 옵시디언이나 동기화 플러그인(예: Self-hosted LiveSync)이 내용을 깨뜨리기 **전에** 잡아냅니다.

특히 **한글/CJK 텍스트**에 중요합니다. 옵시디언은 모든 노트를 UTF-8로 가정하므로, 한글이 들어간 UTF-16 파일은 읽는 순간 `�`(replacement character)로 손상됩니다. 이 플러그인은 파일을 먼저 가로채 고칩니다.

### 동작 방식
1. vault `create` 이벤트를 감지
2. `readBinary()`로 **raw 바이트**를 읽음 (옵시디언의 손실성 UTF-8 읽기 회피)
3. BOM → null 바이트 분포 휴리스틱 → UTF-8 유효성 순으로 인코딩 감지
4. 비-UTF-8이면 올바른 디코더로 읽어 UTF-8(BOM 제거)로 재저장

### 안전 장치
- 이미 깨끗한 UTF-8 파일은 건드리지 않음
- 감지 못 하는 인코딩(EUC-KR/CP949 등)은 강제 변환하지 않고 **경고만** 표시
- 수동 명령: `현재 파일을 UTF-8로 변환`
