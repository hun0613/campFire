// 화면 설정: 렌더러 + 후처리(픽셀 정리 → 빛 번짐 → 색감). 게임(main.js)과 실험실(lab)이 같은 설정을 쓴다
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 화면 배율: 레티나 같은 고해상도 화면에서 2~3배로 그리면 GPU가 몇 배로 일해서 기기가 뜨거워진다.
// 배율은 최대 1.5배, 그리고 전체 픽셀 수가 예산(PC 320만 · 폰 220만)을 넘지 않게 맞춘다
const MAX_PR = 1.5;

const FULLSCREEN_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/**
 * @param {{ scene: THREE.Scene, camera: THREE.Camera, lowSpec?: boolean }} o lowSpec: 휴대폰(터치) — 픽셀 예산 · 멀티샘플을 낮춘다
 * @returns {{ renderer, composer, bloom, grade, renderPR, resize(w, h) }}
 */
export function createRender({ scene, camera, lowSpec = false, quality = null }) {
  // 화질 (src/quality.js PRESET): 없으면 예전처럼 lowSpec 으로 (실험실)
  const Q = { pixels: lowSpec ? 2.2e6 : 3.2e6, maxPR: MAX_PR, samples: lowSpec ? 2 : 4, bloomDiv: 2, ...(quality || {}) };
  const renderPR = (w = innerWidth, h = innerHeight) => Math.max(0.75, Math.min(devicePixelRatio, Q.maxPR, Math.sqrt(Q.pixels / (w * h))));

  // alpha: TV 화면 자리만 투명하게 뚫어서, 캔버스 '뒤'에 있는 유튜브 영상이 보이게 한다 (앞의 물체가 영상을 제대로 가림)
  // antialias 는 끈다: 장면은 composer 의 별도 버퍼에 그려서 캔버스 안티에일리어싱은 효과 없이 메모리·대역폭만 쓴다
  // powerPreference 는 기본값: 'high-performance' 는 외장 GPU를 강제로 깨워 노트북을 뜨겁게 한다
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(renderPR());
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // (PCFSoft 는 three r187 에서 없어져 PCF 로 동작)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // 계단 현상(모자 · 울타리 · 나무 가장자리)을 줄이는 멀티샘플 안티에일리어싱: PC 4배, 폰 2배 (폰 GPU는 타일 방식이라 2배는 거의 공짜)
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderPR(), innerHeight * renderPR(), { type: THREE.HalfFloatType, samples: Q.samples }));
  composer.addPass(new RenderPass(scene, camera));
  // 빛 번짐 전에 픽셀 값 정리: 아주 드물게 생기는 NaN · 무한대 픽셀(멀티샘플 + HDR)이 블룸에 번지면 화면 전체가 까매진다
  // (노을 언덕 벤치에서 캠핑장 쪽으로 고개를 돌릴 때 재현) → 그런 픽셀은 0으로, 지나치게 밝은 값은 잘라 둔다
  const sanitize = new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
        gl_FragColor = vec4(clamp(c.rgb, 0.0, 64.0), clamp(c.a, 0.0, 1.0));
      }`,
  });
  composer.addPass(sanitize);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.32, 0.85);
  composer.addPass(bloom);
  // 빛 번짐(블룸)은 원래 흐릿한 효과라 절반 해상도로 계산해도 티가 거의 안 난다 — GPU 부담은 크게 준다
  // (가벼움 화질은 1/4 해상도)
  { const set = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => set(Math.round(w / Q.bloomDiv), Math.round(h / Q.bloomDiv)); }
  // 블룸을 더할 때 투명도(알파)는 건드리지 않게 → TV 화면 구멍이 블룸에 메워지지 않는다
  Object.assign(bloom.blendMaterial, {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  // 마무리 색감: 화면 가장자리를 살짝 어둡게(비네팅) + 채도를 조금 올려 따뜻한 밤 느낌. 투명도(TV 화면 구멍)는 그대로 둔다
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.07 } },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(.2126, .7152, .0722));
        c.rgb = max(mix(vec3(l), c.rgb, uSat), 0.0);
        vec2 d = vUv - .5; d.x *= 1.15;
        c.rgb *= 1.0 - uVig * smoothstep(.28, .82, length(d) * 1.25);
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  function resize(w = innerWidth, h = innerHeight) {
    renderer.setSize(w, h);
    renderer.setPixelRatio(renderPR(w, h));
    composer.setPixelRatio(renderPR(w, h));
    composer.setSize(w, h);
  }

  /** 화질 바꾸기 (게임 도중): 픽셀 예산 · 멀티샘플 · 빛 번짐 해상도 */
  function setQuality(q) {
    Object.assign(Q, q);
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== Q.samples) { rt.samples = Q.samples; rt.dispose(); }
    resize();
  }

  return { renderer, composer, bloom, grade, renderPR, resize, setQuality };
}
