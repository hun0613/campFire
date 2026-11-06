import * as THREE from 'three';
import { Character } from './character.js';
import { radialTexture } from './toon.js';

/** 입장 화면의 캐릭터 미리보기 (드래그로 회전) */
export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 1.25, 4.6);
    this.camera.lookAt(0, 0.8, 0);

    this.scene.add(new THREE.HemisphereLight('#c9d2ff', '#3a2a20', 1.4));
    const key = new THREE.DirectionalLight('#fff1dc', 1.6);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    const fire = new THREE.PointLight('#ff9a4a', 6, 6, 1.5);
    fire.position.set(-1.2, 0.5, 1.4);
    this.scene.add(fire);
    this.fire = fire;

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 40),
      new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffb36b', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.rotY = 0.35;
    this.spin = 0;
    this.char = null;
    this.running = true;

    let dragging = false, lastX = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.spin = (e.clientX - lastX) * 0.012;
      this.rotY += this.spin;
      lastX = e.clientX;
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    this.dragging = () => dragging;

    this.clock = new THREE.Clock();
    const loop = () => {
      if (!this.running) return;
      this.#frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setLook(look) {
    if (this.char) this.char.dispose();
    this.char = new Character({ ...look }, { name: '' });
    this.char.label.visible = false;
    this.holder.add(this.char.root);
    this.char.play('wave');
  }

  #frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w && h && (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio()) || this._h !== h)) {
      this._h = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // 세로로 긴 캔버스에서도 캐릭터(폭 ~1.5m, 키 ~2.2m)가 다 보이도록 거리 계산
      const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const dist = Math.max(1.25 / t, 0.85 / (t * this.camera.aspect));
      this.camera.position.set(0, 1.0 + dist * 0.06, dist);
      this.camera.lookAt(0, 0.95, 0);
      this.camera.updateProjectionMatrix();
    }
    if (!this.dragging()) {
      this.spin *= 0.92;
      this.rotY += this.spin + dt * 0.25;
    }
    this.holder.rotation.y = this.rotY;
    this.fire.intensity = 5 + Math.sin(this.clock.elapsedTime * 11) * 0.6 + Math.random() * 0.6;
    this.char?.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    this.char?.dispose();
    this.renderer.dispose();
  }
}
