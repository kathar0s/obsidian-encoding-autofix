# Encoding Auto-Fix

An Obsidian plugin that **automatically converts non-UTF-8 text files to clean UTF-8** the moment they are added to your vault — *before* Obsidian or a sync plugin can corrupt the content.

If you have ever dragged a `.txt` into Obsidian and seen your Korean/Japanese/Chinese text turn into garbage like `���` or `뿯붿`, or seen Self-hosted LiveSync refuse a file with **`File seems to be corrupted! Writing prevented`**, this plugin fixes the root cause.

---

## The problem (does this sound familiar?)

Obsidian reads and writes **every note as UTF-8** and does **not** support other encodings. So when a text file uses a different encoding, the bytes are mis-decoded the instant Obsidian touches them:

- A **UTF-16** file (e.g. a transcript, or a `.txt` saved as "Unicode" from Windows Notepad) gets its multibyte characters destroyed — replaced with the Unicode replacement character `�` (`U+FFFD`).
- A **EUC-KR / CP949** file (the legacy Korean encoding, still produced by lots of Korean software) shows up as mojibake.
- With a sync plugin like **Self-hosted LiveSync**, the damage gets worse: the byte count no longer matches, you see errors like `seems to be corrupted! Writing prevented (59286 != 100678)`, and the broken/blocked file propagates to your other devices.

Once `�` has been written to disk, **the original characters are gone forever** — different source bytes all collapse to the same `�`, so there is nothing left to recover. The only real fix is to **catch the file before that happens.** That is exactly what this plugin does.

### Symptoms this addresses

- Korean / CJK text shows as `�`, `?`, or mojibake after import or sync
- `File seems to be corrupted! Writing prevented (X != Y)` in Self-hosted LiveSync
- A file's byte size mismatches between devices (`recordedSize` vs `storageSize`)
- `.txt` exported from transcription tools, call recorders, Notepad ("Unicode"/"Unicode big-endian"), or old Korean apps looks broken in Obsidian

---

## How it works

1. Listens for the vault `create` event (a file being added/imported).
2. Reads the **raw bytes** with `vault.readBinary()` — this avoids Obsidian's lossy UTF-8 text read, so the original bytes are still intact.
3. Detects the real encoding:
   - **BOM** check → UTF-8 BOM, UTF-16 LE, UTF-16 BE
   - **Null-byte distribution** heuristic → BOM-less UTF-16 LE/BE
   - **UTF-8 validity** check → leave clean UTF-8 alone
   - **EUC-KR / CP949 / UHC** fallback (WHATWG `euc-kr` decoder, which includes the CP949/UHC extension) with a quality check
4. If the file is not clean UTF-8, it decodes with the correct decoder and **rewrites the file as UTF-8 (BOM stripped).**

## Features

- ✅ **Automatic conversion on file creation** — just drag the file in.
- ✅ Detects & converts: **UTF-16 LE/BE** (with or without BOM), **UTF-8 with BOM**, **EUC-KR / CP949 / UHC**.
- ✅ **Safe by design**: files that are already clean UTF-8 are never touched. Encodings it can't confidently identify are **left alone with a warning** — it never makes a destructive guess.
- ✅ **Manual command**: *"현재 파일을 UTF-8로 변환 (Convert current file to UTF-8)"* for fixing a file on demand.
- ✅ Works on **desktop and mobile**.

Handled text extensions: `txt`, `md`, `markdown`, `csv`, `tsv`, `json`, `log`, `text`, `srt`, `vtt`.

---

## Installation

### Community plugins (once approved)

Settings → Community plugins → Browse → search **"Encoding Auto-Fix"** → Install → Enable.

### Via BRAT (beta, available now)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. BRAT → *Add beta plugin* → enter `kathar0s/obsidian-encoding-autofix`.

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/kathar0s/obsidian-encoding-autofix/releases/latest).
2. Put them in `<your-vault>/.obsidian/plugins/encoding-autofix/`.
3. Reload Obsidian → Settings → Community plugins → enable **Encoding Auto-Fix**.

---

## Important notes & limitations

- 🔌 The plugin must be installed **on the device where the file is added.** `.obsidian/plugins/` is not always shared by sync, so install it on each device where you import files.
- 🧨 **Already-corrupted files cannot be recovered.** If `�` characters were already written to a file, the information is lost — re-import or fix the *source* file (e.g. re-export it as UTF-8) instead.
- 🇰🇷 EUC-KR / CP949 detection uses a confidence check. In the rare case a file can't be confidently identified, it is **left untouched** and you get a warning so you can convert it manually (no destructive guessing).
- This plugin only converts file *encoding*. It does not change file contents otherwise.

---

## Why I built this

I lost a meeting transcript to this exact bug: a UTF-16 `.txt` synced through Self-hosted LiveSync, got blocked with `Writing prevented`, and when force-received, every Korean character had become `�`. After confirming the original was fine and only Obsidian's UTF-8 assumption was the problem, I built this so that **dragging a file in "just works"** — and so others hitting the same wall don't lose their notes. If it helped you, an issue or star is appreciated. 🙏

## Contributing / Issues

Bug reports and PRs welcome at [the GitHub repo](https://github.com/kathar0s/obsidian-encoding-autofix). If a specific file isn't detected correctly, please attach the first ~32 bytes (hex) and the encoding you expected.

## License

[MIT](LICENSE)

---

## 한국어 설명

옵시디언에 추가되는 **비-UTF-8 텍스트 파일을 자동으로 UTF-8로 변환**하는 플러그인입니다. 옵시디언이나 동기화 플러그인(예: Self-hosted LiveSync)이 내용을 깨뜨리기 **전에** 가로채 고칩니다.

### 이런 증상이 있다면
- `.txt`를 옵시디언에 넣었더니 한글이 `�` 또는 `뿯붿` 같은 깨진 문자로 보임
- Self-hosted LiveSync에서 **`File seems to be corrupted! Writing prevented (59286 != 100678)`** 오류로 파일이 안 받아짐
- 기기마다 파일 크기가 다르게 잡힘 (`recordedSize` ≠ `storageSize`)
- 녹취/통화 녹음 프로그램, Windows 메모장("유니코드"로 저장), 오래된 한국 소프트웨어가 만든 파일이 옵시디언에서 깨짐

### 원인
옵시디언은 **모든 노트를 UTF-8로 가정**하고, 다른 인코딩을 지원하지 않습니다. 그래서 UTF-16이나 EUC-KR/CP949 파일은 옵시디언이 읽는 순간 한글이 `�`(U+FFFD)로 손상됩니다. 한 번 `�`로 바뀌면 **원래 글자는 영구 소실**됩니다(서로 다른 바이트가 모두 같은 `�`로 뭉개지기 때문). 그래서 **손상되기 전에 잡아야** 하고, 이 플러그인이 그 역할을 합니다.

### 동작 방식
1. vault `create` 이벤트 감지
2. `readBinary()`로 **raw 바이트**를 먼저 읽음 (옵시디언의 손실성 UTF-8 읽기 회피)
3. BOM → null 바이트 분포 → UTF-8 유효성 → EUC-KR/CP949 순으로 인코딩 감지
4. 비-UTF-8이면 올바른 디코더로 읽어 **UTF-8(BOM 제거)로 재저장**

### 지원 인코딩
- UTF-16 LE / BE (BOM 유무 무관)
- UTF-8 BOM (BOM 제거)
- **EUC-KR / CP949 / UHC** (확장 완성형 포함)

### 안전 장치
- 이미 깨끗한 UTF-8 파일은 건드리지 않음
- 확실히 판별되지 않는 인코딩은 **변환하지 않고 경고만** 표시 (잘못된 추측으로 파일을 망치지 않음)
- 수동 명령: `현재 파일을 UTF-8로 변환`

### 주의
- 파일을 **추가하는 기기마다** 플러그인을 설치해야 합니다 (`.obsidian/plugins/`는 동기화가 안 될 수 있음).
- 이미 `�`로 깨진 파일은 복구 불가 — 원본을 UTF-8로 다시 내보내 재추가하세요.
