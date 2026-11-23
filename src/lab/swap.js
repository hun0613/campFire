// 실험실 「바꿔 끼우기」: 디자이너가 보낸 요소 파일(원자 · 분자)을 브라우저에서 바로 불러 쓴다
// - 요소 폴더(src/elements/**)의 원본 코드를 글자 그대로 함께 싣고(?raw), 바꿀 파일만 디자이너 것으로 갈아 끼운 「모듈 묶음」을 새로 만든다
// - 그래서 원자(판자)를 바꾸면 그 원자를 쓰는 분자(벤치)도 새 원자로 다시 조립된다
// - 요소 파일이 가져다 쓸 수 있는 것: 'three', 요소 폴더 안 파일, src/toon.js (디자이너 키트 규칙과 같다)
import * as THREE from 'three';
import * as toonMod from '../toon.js';

const RAW = import.meta.glob('../elements/**/*.js', { query: '?raw', import: 'default', eager: true });
/** 'src/elements/atoms/plank.js' → 원본 코드 */
export const SOURCES = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [`src/${k.replace(/^\.\.\//, '')}`, v]));
const EXTERNAL = { three: THREE, 'src/toon.js': toonMod };

function resolve(from, spec) {
  if (spec === 'three') return 'three';
  if (!spec.startsWith('.')) throw new Error(`가져올 수 없는 모듈: ${spec} (three · 요소 폴더 · toon.js 만 돼요)`);
  const parts = from.split('/').slice(0, -1);
  for (const s of spec.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); }
  return parts.join('/');
}

const IMPORT_RE = /^[ \t]*import\s+(?:(\*\s+as\s+[\w$]+)|\{([^}]*)\}|([\w$]+))\s+from\s+['"]([^'"]+)['"];?/gm;
const REEXPORT_RE = /^[ \t]*export\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"];?/gm;
/** import · export from 을 「묶음에서 꺼내 쓰기」로 바꾼다 (블롭 모듈은 경로로 다른 모듈을 못 찾으므로) */
function transform(path, text, deps, gid) {
  const ref = (p) => `globalThis.__dsGraphs[${gid}](${JSON.stringify(p)})`;
  let n = 0;
  text = text.replace(REEXPORT_RE, (_, names, spec) => {
    const p = resolve(path, spec); deps.add(p);
    const pairs = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [a, b] = s.split(/\s+as\s+/); return [a, b || a]; });
    const k = n++;
    return `const { ${pairs.map(([a]) => `${a}: __re${k}_${a}`).join(', ')} } = ${ref(p)}; export { ${pairs.map(([a, b]) => `__re${k}_${a} as ${b}`).join(', ')} };`;
  });
  text = text.replace(IMPORT_RE, (_, star, named, def, spec) => {
    const p = resolve(path, spec); deps.add(p);
    if (star) return `const ${star.split(/\s+as\s+/)[1]} = ${ref(p)};`;
    if (named) return `const { ${named.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': ')).join(', ')} } = ${ref(p)};`;
    return `const ${def} = ${ref(p)}.default;`;
  });
  return text;
}

let gidSeq = 0;
/** 모듈 묶음: overrides { 'src/elements/atoms/plank.js': '새 코드' } 만 갈아 끼우고 나머지는 원본 */
export function createGraph(overrides = {}) {
  const gid = ++gidSeq;
  const mods = new Map(), loading = new Map();
  (globalThis.__dsGraphs ??= {})[gid] = (p) => {
    if (p in EXTERNAL) return EXTERNAL[p];
    if (!mods.has(p)) throw new Error(`모듈을 아직 못 불렀어요: ${p}`);
    return mods.get(p);
  };
  async function load(p) {
    if (p in EXTERNAL || mods.has(p)) return;
    if (loading.has(p)) return loading.get(p);
    const job = (async () => {
      const text = overrides[p] ?? SOURCES[p];
      if (text == null) throw new Error(`요소 폴더에 없는 파일: ${p}`);
      const deps = new Set();
      const code = transform(p, text, deps, gid);
      for (const d of deps) await load(d);
      const url = URL.createObjectURL(new Blob([`${code}\n//# sourceURL=lab:${p}`], { type: 'text/javascript' }));
      try { mods.set(p, await import(/* @vite-ignore */ url)); } finally { URL.revokeObjectURL(url); }
    })();
    loading.set(p, job);
    return job;
  }
  return { load: async (p) => { await load(p); return mods.get(p); } };
}

/** 놓은 파일 이름 → 요소 폴더의 경로 ('plank.js' → 'src/elements/atoms/plank.js'). 폴더 이름까지 있으면 더 정확히 */
export function matchPath(name) {
  const base = name.split(/[\\/]/).pop();
  const hits = Object.keys(SOURCES).filter((k) => k.endsWith(`/${base}`));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`「${base}」는 요소 폴더에 없는 파일 이름이에요. 원래 파일 이름(예: bench.js, plank.js) 그대로 보내 주세요`);
  throw new Error(`「${base}」 이름의 파일이 여러 개예요: ${hits.join(', ')}`);
}
/** 분자 파일 목록 (원자를 바꾸면 이것들을 다시 조립한다) */
export const MOLECULES = Object.keys(SOURCES).filter((k) => k.includes('/molecules/') || k.includes('/organisms/'));
