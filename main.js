'use strict';

const obsidian = require('obsidian');

/** 변환 대상으로 볼 텍스트 확장자 */
const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'text', 'srt', 'vtt']);

/** 휴리스틱 샘플 길이 */
const SAMPLE = 8192;

/** 한글 음절 범위 (가-힣) */
function isHangul(code) {
  return code >= 0xac00 && code <= 0xd7a3;
}

/**
 * 주어진 인코딩으로 디코드를 시도하고 품질 지표를 반환한다.
 * @returns {{text:string, bad:number, hangul:number, len:number}|null}
 */
function tryDecode(bytes, enc) {
  try {
    const text = new TextDecoder(enc, { fatal: false }).decode(bytes);
    let bad = 0;
    let hangul = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c === 0xfffd) bad++;
      else if (isHangul(c)) hangul++;
    }
    return { text, bad, hangul, len: text.length };
  } catch (e) {
    return null;
  }
}

/**
 * raw 바이트에서 인코딩을 추정한다.
 * 반환: { enc, bom } — enc ∈ 'utf-8' | 'utf-16le' | 'utf-16be' | 'euc-kr' | 'unknown'
 * 참고: WHATWG의 'euc-kr' 디코더는 CP949/UHC(확장 완성형)까지 포함한다.
 */
function detectEncoding(bytes) {
  const n = bytes.length;
  if (n === 0) return { enc: 'utf-8', bom: false };

  // 1) BOM 우선
  if (n >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { enc: 'utf-8', bom: true };
  }
  if (n >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { enc: 'utf-16le', bom: true };
  }
  if (n >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { enc: 'utf-16be', bom: true };
  }

  // 2) BOM 없음 → null 바이트 분포로 UTF-16 추정
  const limit = Math.min(n, SAMPLE);
  let evenZero = 0; // 짝수 인덱스의 0x00 (UTF-16BE: 상위바이트 먼저)
  let oddZero = 0;  // 홀수 인덱스의 0x00 (UTF-16LE)
  let zeros = 0;
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x00) {
      zeros++;
      if (i % 2 === 0) evenZero++; else oddZero++;
    }
  }
  if (zeros > limit * 0.15) {
    if (evenZero > oddZero * 3) return { enc: 'utf-16be', bom: false };
    if (oddZero > evenZero * 3) return { enc: 'utf-16le', bom: false };
  }

  // 3) 유효한 UTF-8인가?
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { enc: 'utf-8', bom: false };
  } catch (e) {
    // 유효한 UTF-8이 아님 → 레거시 인코딩 시도
  }

  // 4) 레거시 한국어 인코딩 (EUC-KR / CP949 / UHC)
  const k = tryDecode(bytes, 'euc-kr');
  if (k && k.len > 0 && k.hangul > 0 && k.bad / k.len < 0.005) {
    return { enc: 'euc-kr', bom: false };
  }

  // 5) 판별 실패 — 함부로 변환하지 않음
  return { enc: 'unknown', bom: false };
}

/** 라벨 표시용 */
function encLabel(enc, bom) {
  const base = enc === 'euc-kr' ? 'EUC-KR/CP949' : enc.toUpperCase();
  return bom ? `${base} BOM` : base;
}

/** ArrayBuffer → Uint8Array */
function u8(buf) {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

module.exports = class EncodingAutoFixPlugin extends obsidian.Plugin {
  async onload() {
    // 자체 변환으로 인한 재진입 방지용 경로 집합
    this._inFlight = new Set();

    // 신규 생성 파일 자동 변환
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof obsidian.TFile) {
          // 생성 직후 디스크 쓰기 완료를 위해 살짝 지연
          window.setTimeout(() => this.tryFix(file, false), 150);
        }
      })
    );

    // 수동 명령: 현재 파일 강제 변환
    this.addCommand({
      id: 'fix-current-file-encoding',
      name: '현재 파일을 UTF-8로 변환 (Convert current file to UTF-8)',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.tryFix(file, true);
        return true;
      },
    });
  }

  /**
   * @param {TFile} file
   * @param {boolean} manual 수동 호출 여부(알림을 항상 표시)
   */
  async tryFix(file, manual) {
    if (!file || !(file instanceof obsidian.TFile)) return;
    const ext = (file.extension || '').toLowerCase();
    if (!TEXT_EXTS.has(ext)) {
      if (manual) new obsidian.Notice(`Skipped: ${file.name} (not a text extension)`);
      return;
    }
    if (this._inFlight.has(file.path)) return;

    this._inFlight.add(file.path);
    try {
      const bytes = u8(await this.app.vault.readBinary(file));
      const { enc, bom } = detectEncoding(bytes);

      // 이미 깨끗한 UTF-8(BOM 없음) → 아무것도 안 함
      if (enc === 'utf-8' && !bom) {
        if (manual) new obsidian.Notice(`Already UTF-8: ${file.name}`);
        return;
      }

      if (enc === 'unknown') {
        new obsidian.Notice(
          `⚠️ ${file.name}: could not detect encoding. Left untouched — please convert manually.`,
          8000
        );
        return;
      }

      // 디코드 → UTF-8 텍스트로 재저장 (BOM 제거)
      let text = new TextDecoder(enc, { fatal: false }).decode(bytes);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // 선행 BOM 제거

      await this.app.vault.modify(file, text);

      new obsidian.Notice(`✅ Encoding fixed: ${file.name} (${encLabel(enc, bom)} → UTF-8)`, 5000);
    } catch (e) {
      console.error('[encoding-autofix] conversion failed for', file && file.path, e);
      if (manual) new obsidian.Notice(`Conversion failed: ${file.name} (see console)`);
    } finally {
      // modify 가 디스크에 반영될 시간을 준 뒤 잠금 해제
      window.setTimeout(() => this._inFlight.delete(file.path), 500);
    }
  }
};
