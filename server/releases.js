// 릴리즈 노트(CHANGELOG.md) 읽기 — 관리실 안내 문구 · 게임 속 소식 게시판이 같이 쓴다
import fs from 'node:fs';

let cache = null;
// 릴리즈 노트 전체를 버전별로 나눈다 (안내 문구 만들기에서 골라 쓴다)
// - 각 버전: 새 기능 항목, 그 밖의 항목(개선 · 고침 등)
// - 항목은 맨 앞 줄의 「- **제목**: 설명」 또는 「- 문장」만 쓰고, 들여쓴 하위 항목은 건너뛴다
export function releaseNotes() {
  if (cache) return cache; // 배포마다 서버가 새로 켜지므로 한 번만 읽으면 된다
  try {
    const md = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const out = [];
    for (const sec of md.split(/\n(?=## v)/).slice(1)) {
      const head = sec.match(/^## (v[\d.]+)(?:\s*[—-]\s*([\d-]+))?/);
      if (!head) continue;
      const rel = { version: head[1], date: head[2] || '', features: [], others: [] };
      let bucket = rel.others;
      for (const line of sec.split('\n').slice(1)) {
        if (line.startsWith('### ')) { bucket = line.includes('새 기능') ? rel.features : rel.others; continue; }
        if (line.startsWith('---')) break;
        if (!line.startsWith('- ')) continue;
        const m = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/); // 「**제목**: 설명」 형식만 제목 · 설명으로 나눈다
        const clean = (t) => t.replace(/\*\*/g, '').replace(/`/g, '').trim();
        if (m) bucket.push({ title: clean(m[1]), desc: clean(m[2]) });
        else bucket.push({ title: clean(line.slice(2)), desc: '' });
      }
      out.push(rel);
    }
    cache = out;
    return out;
  } catch { return []; }
}

