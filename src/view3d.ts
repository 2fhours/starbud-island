import { APP_VERSION } from './version';

const root = document.querySelector<HTMLElement>('#view3d-root');
const version = document.querySelector('#view3d-version');
if (version) version.textContent = `v${APP_VERSION} · 3D`;
if (!root) throw new Error('缺少 3D 容器');

const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
if (!probe) {
  root.innerHTML = `<div class="preview-fallback"><h2>这台浏览器没有可用的 WebGL</h2><p>3D 预览无法启动。可以回到平面版继续玩。</p><p><a href="./">回到 2D 游戏</a></p></div>`;
} else {
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  void start(root);
}

async function start(mount: HTMLElement): Promise<void> {
  const THREE: any = await import('three');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = true;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fd8ee');
  const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 80);
  let yaw = 0.7;
  const player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), new THREE.MeshStandardMaterial({ color: '#3c2a22' }));
  body.position.y = 0.55;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#f3d7b0' }));
  head.position.y = 1.05;
  head.castShadow = true;
  player.add(body, head);
  const pet = new THREE.Group();
  const petBody = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), new THREE.MeshStandardMaterial({ color: '#f6e2c4' }));
  petBody.position.y = 0.38;
  petBody.castShadow = true;
  const earGeo = new THREE.ConeGeometry(0.08, 0.28, 8);
  const earMat = new THREE.MeshStandardMaterial({ color: '#67b85a' });
  const earL = new THREE.Mesh(earGeo, earMat);
  const earR = new THREE.Mesh(earGeo, earMat);
  earL.position.set(-0.12, 0.72, 0);
  earR.position.set(0.12, 0.72, 0);
  pet.add(petBody, earL, earR);
  pet.position.set(-1.2, 0, 0.4);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 14, 12, 8), new THREE.MeshStandardMaterial({ color: '#7ec96a' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6, 14), new THREE.MeshStandardMaterial({ color: '#67c3d4', transparent: true, opacity: 0.86 }));
  water.rotation.x = -Math.PI / 2;
  water.position.x = 6;
  const house = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: '#f3d2b0' }));
  house.position.set(-2, 0.55, -2);
  house.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.8, 4), new THREE.MeshStandardMaterial({ color: '#ef6844' }));
  roof.position.set(-2, 1.4, -2);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  const trees: any[] = [];
  for (const [x, z] of [[2, -2], [3, 2], [-3, 2]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), new THREE.MeshStandardMaterial({ color: '#8a5a32' }));
    trunk.position.set(x, 0.35, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshStandardMaterial({ color: '#2f9a5a' }));
    crown.position.set(x, 1.05, z);
    crown.castShadow = true;
    scene.add(trunk, crown);
    trees.push(crown);
  }
  scene.add(new THREE.HemisphereLight('#fff4df', '#7ec96a', 0.85));
  const sun = new THREE.DirectionalLight('#fff1cf', 1.15);
  sun.position.set(6, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  scene.add(ground, water, house, roof, player, pet, sun);
  const keys = new Set<string>();
  const onKey = (event: KeyboardEvent, down: boolean) => {
    if (down) keys.add(event.code);
    else keys.delete(event.code);
  };
  const keyDown = (event: KeyboardEvent) => onKey(event, true);
  const keyUp = (event: KeyboardEvent) => onKey(event, false);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  let drag: { x: number; y: number; id: number } | null = null;
  const down = (event: PointerEvent) => {
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    keys.delete('KeyW');
    keys.delete('KeyA');
    keys.delete('KeyS');
    keys.delete('KeyD');
    if (Math.hypot(dx, dy) < 14) return;
    if (Math.abs(dx) > Math.abs(dy)) keys.add(dx > 0 ? 'KeyD' : 'KeyA');
    else keys.add(dy > 0 ? 'KeyS' : 'KeyW');
  };
  const up = () => {
    drag = null;
    keys.clear();
  };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', up);
  const orbit = (dir: number) => {
    yaw = Math.max(-0.4, Math.min(1.6, yaw + dir));
  };
  document.querySelector('#orbit-left')?.addEventListener('click', () => orbit(-0.25));
  document.querySelector('#orbit-right')?.addEventListener('click', () => orbit(0.25));
  const resize = () => {
    camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  };
  window.addEventListener('resize', resize);
  let frameId = 0;
  const loop = () => {
    let dx = 0;
    let dz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    const speed = 0.06;
    const nextX = player.position.x + dx * speed;
    const nextZ = player.position.z + dz * speed;
    const hit = trees.some((tree) => Math.hypot(nextX - tree.position.x, nextZ - tree.position.z) < 0.7) || Math.hypot(nextX + 2, nextZ + 2) < 0.9;
    if (!hit && Math.abs(nextX) < 7 && Math.abs(nextZ) < 5) {
      player.position.x = nextX;
      player.position.z = nextZ;
    }
    pet.position.x += (player.position.x - 0.8 - pet.position.x) * 0.08;
    pet.position.z += (player.position.z + 0.4 - pet.position.z) * 0.08;
    const dist = 9;
    camera.position.set(player.position.x + Math.cos(yaw) * dist, 7.2, player.position.z + Math.sin(yaw) * dist);
    camera.lookAt(player.position.x, 0.6, player.position.z);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(loop);
  };
  const dispose = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('resize', resize);
    renderer.dispose();
    scene.traverse((obj: any) => {
      obj.geometry?.dispose?.();
      const material = obj.material;
      if (Array.isArray(material)) material.forEach((item: any) => item.dispose());
      else material?.dispose?.();
    });
  };
  window.addEventListener('pagehide', dispose);
  resize();
  frameId = requestAnimationFrame(loop);
}
