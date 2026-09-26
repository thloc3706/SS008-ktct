import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const canvas = document.createElement('canvas');
canvas.id = 'economy-3d-stage';
canvas.setAttribute('aria-hidden', 'true');
Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    zIndex: '-1', pointerEvents: 'none', opacity: '.92'
});
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x090c12, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x090c12, 0.025);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 80);
camera.position.set(0, 0.15, 7.5);

const room = new RoomEnvironment(renderer);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x4b342e, 1.9));
const keyLight = new THREE.DirectionalLight(0xffe6c7, 2.7);
keyLight.position.set(3, 5, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x9fc9ec, 1.35);
fillLight.position.set(-5, 1, 3);
scene.add(fillLight);
const rimLight = new THREE.PointLight(0xe0ad5b, 10, 20);
rimLight.position.set(0, 3, -2);
scene.add(rimLight);

const world = new THREE.Group();
scene.add(world);

/* --------------------------------------------------------------------------
   Tuỳ chỉnh nhanh hai bàn tay
   -------------------------------------------------------------------------- */
const HAND_FLIP = Math.PI;      // xoay 180° quanh trục Y (hướng trái → phải)
const HAND_SIZE = 5.6;          // phóng to hơn mức khởi đầu (trước đây 4.4)
const REAL_HAND_SCALE = 0.88;
const UPPER_HAND_ANGLE = 2.69;
const LOWER_HAND_ANGLE = -1.12;
const HAND_BRIGHTNESS = 0.68;   // hạ độ sáng và phản chiếu của bàn tay thật
const WIRE_BRIGHTNESS = 0.8;    // giảm độ sáng lưới khung của bàn tay vô hình
const PARTICLE_COLOR = 0xff9f8f;

let seed = 23;
function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
}

/* --------------------------------------------------------------------------
   Hiệu ứng hạt lơ lửng
   - Bỏ cách dựng cũ (THREE.Points mặc định vẽ ra ô vuông cứng nên trông như
     "khối động lơ lửng"): nay dùng sprite tròn mềm + chuyển động trôi nhẹ.
   - 3 lớp: sao li ti · bụi vàng · quầng xanh, mờ dần/hiện dần theo state.dust.
   -------------------------------------------------------------------------- */
function makeSoftDotTexture() {
    const size = 64;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const ctx = sprite.getContext('2d');
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.32, 'rgba(255,255,255,0.62)');
    glow.addColorStop(0.72, 'rgba(255,255,255,0.14)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(sprite);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
const dotTexture = makeSoftDotTexture();

function addParticleSurface(model) {
    const particleMaterial = new THREE.PointsMaterial({
        color: PARTICLE_COLOR, size: 0.028, map: dotTexture,
        transparent: true, opacity: 0.9, depthWrite: false,
        sizeAttenuation: true, toneMapped: false, blending: THREE.AdditiveBlending
    });

    model.traverse(object => {
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        const source = object.geometry.attributes.position;
        const positions = new Float32Array(source.count * 3);
        const point = new THREE.Vector3();
        for (let index = 0; index < source.count; index++) {
            point.fromBufferAttribute(source, index);
            if (object.isSkinnedMesh && object.applyBoneTransform) object.applyBoneTransform(index, point);
            const offset = index * 3;
            positions[offset] = point.x;
            positions[offset + 1] = point.y;
            positions[offset + 2] = point.z;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const points = new THREE.Points(geometry, particleMaterial);
        points.frustumCulled = false;
        object.add(points);
        const base = positions.slice();
        const phase = new Float32Array(source.count);
        for (let index = 0; index < source.count; index++) phase[index] = random() * Math.PI * 2;
        floatingLayers.push({
            points,
            update(time) {
                for (let index = 0; index < source.count; index++) {
                    const offset = index * 3;
                    const tick = time * 0.55 + phase[index];
                    positions[offset] = base[offset] + Math.sin(tick * 1.17) * 0.006;
                    positions[offset + 1] = base[offset + 1] + Math.cos(tick * 0.91) * 0.006;
                    positions[offset + 2] = base[offset + 2] + Math.sin(tick * 0.73) * 0.004;
                }
                geometry.attributes.position.needsUpdate = true;
            },
            dispose() {
                geometry.dispose();
            }
        });
    });
}

const floatingLayers = [];
function addFloatingLayer({ count, size, color, opacity, spread, amplitude, speed }) {
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const rate = new Float32Array(count);
    for (let index = 0; index < count; index++) {
        const offset = index * 3;
        base[offset] = (random() - 0.5) * spread[0];
        base[offset + 1] = (random() - 0.5) * spread[1];
        base[offset + 2] = (random() - 0.5) * spread[2];
        positions[offset] = base[offset];
        positions[offset + 1] = base[offset + 1];
        positions[offset + 2] = base[offset + 2];
        phase[index] = random() * Math.PI * 2;
        rate[index] = 0.55 + random() * 0.9;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color, size, map: dotTexture, transparent: true, opacity,
        depthWrite: false, sizeAttenuation: true, toneMapped: false,
        blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    points.frustumCulled = false;
    world.add(points);
    const layer = {
        points,
        update(time) {
            for (let index = 0; index < count; index++) {
                const offset = index * 3;
                const tick = time * speed * rate[index] + phase[index];
                positions[offset] = base[offset] + Math.sin(tick * 0.55) * amplitude[0];
                positions[offset + 1] = base[offset + 1] + Math.sin(tick) * amplitude[1];
                positions[offset + 2] = base[offset + 2] + Math.cos(tick * 0.4) * amplitude[2];
            }
            geometry.attributes.position.needsUpdate = true;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        }
    };
    floatingLayers.push(layer);
    return layer;
}

// sao li ti, trôi rất chậm
const starField = addFloatingLayer({
    count: 420, size: 0.032, color: 0xebcf92, opacity: 0.5,
    spread: [8, 5, 4], amplitude: [0.12, 0.22, 0.12], speed: 0.6
});
// hạt bụi vàng lơ lửng rõ hơn
const dustField = addFloatingLayer({
    count: 170, size: 0.095, color: 0xf3dda8, opacity: 0.55,
    spread: [10, 5.6, 4.6], amplitude: [0.4, 0.62, 0.34], speed: 0.34
});
// quầng sáng xanh lớn, trôi chậm tạo chiều sâu
const hazeField = addFloatingLayer({
    count: 26, size: 0.62, color: 0x8fb6d8, opacity: 0.16,
    spread: [12, 6.4, 4.8], amplitude: [0.8, 0.95, 0.6], speed: 0.16
});

const actorMarkers = new THREE.Group();
for (const position of [[-0.58, 1.12, 0.2], [0, 1.36, 0.2], [0.58, 1.12, 0.2]]) {
    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0xebcf92, transparent: true, opacity: 0.8 })
    );
    marker.position.set(...position);
    actorMarkers.add(marker);
}
world.add(actorMarkers);

const state = {
    spread: 5, skin: 1, wire: 0.78, handRoll: 1.52, market: 0, markers: 0, dust: 0,
    wireZoom: 1, skinZoom: 1,
    leftHandY: 3.6, rightHandY: -3.1,
    cameraX: 0, cameraY: 0.15, cameraZ: 7.5, cameraOrbit: 0, lookY: 0,
    yaw: 0, pitch: -0.08, worldY: 0, touch: 1
};
const scrollScene = { progress: 0, direction: 1 };
let invisibleHand;
let visibleHand;
let invisibleHandBaseScale;
let visibleHandBaseScale;

function makeHand(source, wireframe) {
    const holder = new THREE.Group();
    const model = SkeletonUtils.clone(source);
    holder.add(model);
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = HAND_SIZE / Math.max(size.y, size.x, size.z);
    holder.scale.setScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);
    holder.rotation.x = 0;

    model.traverse(object => {
        if (object.isBone) {
            const boneName = object.name.toLowerCase();
            const [finger, segment] = boneName.split('_');
            const isControlBone = boneName.includes('ctrl') || boneName.includes('_end') || boneName.includes('_tip');
            if (!isControlBone && (finger === 'pinky' || finger === 'ring' || finger === 'middle')) {
                const curls = { base: 0.7, '01': 1.05, '02': 0.82, '03': 0.48 };
                object.rotation.x += curls[segment] || 0;
            } else if (!isControlBone && finger === 'thumb') {
                object.rotation.x += segment === 'base' ? -0.18 : 0.38;
            }
        }
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (wireframe) {
            object.material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(PARTICLE_COLOR).multiplyScalar(WIRE_BRIGHTNESS),
                wireframe: true, transparent: true,
                opacity: 0.78, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
            });
        } else {
            const cloneMaterial = material => {
                const next = material.clone();
                next.transparent = true;
                next.opacity = 1;
                next.roughness = Math.max(next.roughness ?? 0.55, 0.58);
                // giảm độ sáng: tối màu vật liệu và giảm phản chiếu môi trường
                if (next.color) next.color.multiplyScalar(HAND_BRIGHTNESS);
                next.envMapIntensity = 0.72 * HAND_BRIGHTNESS;
                next.depthWrite = true;
                return next;
            };
            object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
        }
    });

    if (wireframe) addParticleSurface(model);

    return holder;
}

const manager = new THREE.LoadingManager();
manager.onError = url => console.error('Không tải được tài nguyên 3D:', url);
new FBXLoader(manager).load(
    './models/rigged-hand/handRig_02.fbx',
    source => {
        invisibleHand = makeHand(source, true);
        visibleHand = makeHand(source, false);
        invisibleHand.scale.x *= -1;
        visibleHand.scale.multiplyScalar(REAL_HAND_SCALE);
        invisibleHandBaseScale = invisibleHand.scale.clone();
        visibleHandBaseScale = visibleHand.scale.clone();
        world.add(invisibleHand, visibleHand);
        invisibleHand.position.z = 0.05;
        visibleHand.position.z = 0.08;
        updateScene();
    },
    undefined,
    error => {
        document.body.dataset.modelError = 'true';
        console.error('Không thể tải mô hình bàn tay:', error);
    }
);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), coarsePointer ? 0.08 : 0.18, 0.42, 0.84));

const chapters = {
    // dust: độ hiện của các lớp hạt lơ lửng (0 = màn mở đầu không có khối/hạt lơ lửng)
    opening: { spread: 5, skin: 1, wire: 0.78, handRoll: 1.52, market: 0, markers: 0, dust: 0, cameraX: 0, cameraY: 0.15, cameraZ: 7.2, cameraOrbit: 0, lookY: 0, yaw: 0, pitch: -0.02, worldY: 0, touch: 0 },
    market: { spread: 4.8, skin: 1, wire: 0.76, handRoll: 1.52, market: 0.08, markers: 0, dust: 0.45, cameraX: 0, cameraY: 4.7, cameraZ: 5.1, cameraOrbit: 0.28, lookY: 0, yaw: 0.08, pitch: -0.08, worldY: 0, touch: 1, wireZoom: 1.28, skinZoom: 1.2 },
    smith: { spread: 5.4, skin: 0, wire: 0.9, handRoll: 1.4, market: 0, markers: 0, dust: 0.6, cameraX: 0.62, cameraY: 0.2, cameraZ: 7.2, cameraOrbit: -0.12, lookY: 0, yaw: -0.12, pitch: 0.05, worldY: 0, touch: 0, wireZoom: 1.45 },
    city: { spread: 5, skin: 1, wire: 0.86, handRoll: 1.52, market: 0.08, markers: 0, dust: 0.5, cameraX: 0, cameraY: 4.2, cameraZ: 7.2, cameraOrbit: 0.08, lookY: 0, yaw: 0.02, pitch: 0, worldY: 0, touch: 0, wireZoom: 1.3 },
    cycles: { spread: 6.4, skin: 0, wire: 0, handRoll: 0, market: 0.52, markers: 0, dust: 0.95, cameraX: 0, cameraY: 0.9, cameraZ: 7.5, cameraOrbit: 0.28, lookY: -0.05, yaw: 0.06, pitch: 0.02, worldY: 0, touch: 0, wireZoom: 1.25 },
    actors: { spread: 5.4, skin: 0, wire: 0.92, handRoll: 1.4, market: 0.18, markers: 1, dust: 0.5, cameraX: 0.32, cameraY: 0.18, cameraZ: 6.25, cameraOrbit: -0.18, lookY: 0, yaw: -0.05, pitch: -0.02, worldY: 0, touch: 0, wireZoom: 1.35 },
    state: { spread: 5.4, skin: 1, wire: 0, handRoll: 1.4, market: 0, markers: 0, dust: 0.6, cameraX: -0.12, cameraY: 0.65, cameraZ: 6.3, cameraOrbit: 0.32, lookY: 0, yaw: 0.08, pitch: -0.06, worldY: 0, touch: 0, skinZoom: 1.45 },
    pause: { spread: 6.4, skin: 0, wire: 0, handRoll: 1.52, market: 0.08, markers: 0, dust: 0.4, cameraX: 0, cameraY: 0, cameraZ: 7.4, cameraOrbit: 0, lookY: 0, yaw: 0, pitch: 0, worldY: 0, touch: 0 },
        answer: { spread: 5, skin: 0.94, wire: 0.78, handRoll: 1.52, market: 0, markers: 0, dust: 0.5, cameraX: 0, cameraY: 0.12, cameraZ: 7.4, cameraOrbit: 0, lookY: 0, yaw: 0.02, pitch: -0.02, worldY: 0, touch: 1, wireZoom: 1.28, skinZoom: 1.28 },
    conclusion: { spread: 5, skin: 0.8, wire: 0.66, handRoll: 1.4, market: 0, markers: 0, dust: 0.5, cameraX: 0, cameraY: -1.7, cameraZ: 6.9, cameraOrbit: 0.18, lookY: 0.16, yaw: -0.03, pitch: 0.12, worldY: 0, touch: 0, wireZoom: 1.15, skinZoom: 1.15 },
    rebuttal: { spread: 5, skin: 0.72, wire: 0.7, handRoll: 1.32, market: 0, markers: 0, dust: 0.5, cameraX: 0, cameraY: 1.8, cameraZ: 6.6, cameraOrbit: 1.22, lookY: -0.1, yaw: 0.06, pitch: 0, worldY: 0, touch: 0, wireZoom: 1.15, skinZoom: 1.15 },
        discussion: { spread: 6.4, skin: 0, wire: 0, market: 0, markers: 0, dust: 0.9, cameraX: 0, cameraY: 0, cameraZ: 8, cameraOrbit: 0, lookY: 0, yaw: 0, pitch: 0, worldY: 0, touch: 0 },
    appendix: { spread: 6.4, skin: 0, wire: 0, market: 0, markers: 0, dust: 0.8, cameraX: 0, cameraY: 0.1, cameraZ: 8, cameraOrbit: 0, lookY: 0, yaw: 0, pitch: 0, worldY: 0, touch: 0 }
};

let currentSceneIndex = -1;
function setChapter(name, index) {
    const chapter = chapters[name];
    if (!chapter) return;
    const target = {
        ...chapter,
        wireZoom: chapter.wireZoom ?? 1,
        skinZoom: chapter.skinZoom ?? 1
    };
    if (index === currentSceneIndex && document.body.dataset.scene === name) return;
    currentSceneIndex = index;
    document.body.dataset.scene = name;
    gsap.to(state, {
        ...target,
        duration: reduceMotion ? 0 : 1.15,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onUpdate: updateScene
    });
}

function updateScene() {
    const mobileView = innerWidth < 480;
    const handRollDrift = state.handRoll - 1.52;
    const scrollWave = Math.sin(scrollScene.progress * Math.PI * 4);
    const scrollLift = Math.sin(scrollScene.progress * Math.PI * 2) * 0.08;
    const scrollSway = scrollWave * (mobileView ? 0.04 : 0.1);
    const wireFocus = 1 - (state.wireZoom - 1) * 0.55;
    const skinFocus = 1 - (state.skinZoom - 1) * 0.55;
    if (invisibleHand) {
        if (invisibleHandBaseScale) invisibleHand.scale.copy(invisibleHandBaseScale).multiplyScalar(state.wireZoom);
        invisibleHand.position.set(mobileView ? 0 : (-state.spread * 0.8 - scrollSway) * wireFocus, mobileView ? state.spread * 0.5 * wireFocus : state.leftHandY * wireFocus + scrollLift, 0.05);
        invisibleHand.rotation.z = mobileView ? Math.PI : UPPER_HAND_ANGLE + handRollDrift + scrollSway * 0.08;
        invisibleHand.rotation.y = -state.yaw + HAND_FLIP; // xoay 180° (trái → phải)
        invisibleHand.rotation.x = state.pitch + scrollSway * 0.03;
        invisibleHand.visible = state.wire > 0.01;
        invisibleHand.traverse(object => {
            if (object.isMesh) object.material.opacity = state.wire * WIRE_BRIGHTNESS;
            if (object.isPoints) object.material.opacity = state.wire * 0.9;
        });
    }
    if (visibleHand) {
        if (visibleHandBaseScale) visibleHand.scale.copy(visibleHandBaseScale).multiplyScalar(state.skinZoom);
        visibleHand.position.set(mobileView ? 0 : (state.spread * 0.75 + scrollSway) * skinFocus, mobileView ? -state.spread * 0.5 * skinFocus : state.rightHandY * skinFocus - scrollLift, 0.08);
        visibleHand.rotation.z = mobileView ? 0 : LOWER_HAND_ANGLE - handRollDrift - scrollSway * 0.08;
        visibleHand.rotation.y = state.yaw + HAND_FLIP; // xoay 180° (trái → phải)
        visibleHand.rotation.x = state.pitch - scrollSway * 0.03;
        visibleHand.visible = state.skin > 0.01;
        visibleHand.traverse(object => {
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => {
                material.opacity = state.skin;
                material.depthWrite = state.skin > 0.96;
            });
        });
    }
    actorMarkers.visible = state.markers > 0.01;
    actorMarkers.children.forEach(marker => { marker.material.opacity = state.markers * 0.85; });
    // sao nền luôn hiện rất nhẹ; bụi và haze tăng dần theo nội dung đang xem
    starField.points.visible = true;
    starField.points.material.opacity = 0.2 + 0.3 * state.dust;
    dustField.points.visible = state.dust > 0.02;
    dustField.points.material.opacity = 0.55 * state.dust;
    hazeField.points.visible = state.dust > 0.02;
    hazeField.points.material.opacity = 0.16 * state.dust;
    world.position.y = state.worldY + scrollLift;
    world.rotation.y = state.yaw * 0.18 + scrollScene.progress * 0.12;
    world.scale.setScalar(mobileView ? 0.75 : 1);
    starField.points.position.set(scrollSway * 0.45, scrollLift * 0.7, 0);
    dustField.points.position.set(-scrollSway * 0.7, -scrollLift, 0);
    hazeField.points.position.set(scrollSway * 0.9, scrollLift * 1.4, 0);
    keyLight.position.x = 3 + scrollSway * 2.2;
    fillLight.position.x = -5 - scrollSway * 1.4;
    rimLight.intensity = 10 + Math.abs(scrollWave) * 2.2;
    const cameraDepth = state.cameraZ + (mobileView ? 2.2 : 0);
    if (mobileView) {
        camera.position.set(0, 0.15, 9.6);
        camera.lookAt(0, 0, 0);
    } else {
        camera.position.set(
            state.cameraX + Math.sin(state.cameraOrbit) * cameraDepth,
            state.cameraY,
            Math.cos(state.cameraOrbit) * cameraDepth
        );
        camera.lookAt(0, state.lookY, 0);
    }
    renderOnce();
}

let renderFrameId = null;
function renderOnce() {
    if (document.hidden || renderFrameId !== null) return;
    renderFrameId = requestAnimationFrame(() => {
        renderFrameId = null;
        composer.render();
    });
}

/* Vòng lặp trôi hạt lơ lửng — chỉ cập nhật ~30fps (mỗi 2 khung hình) để nhẹ máy,
   tự dừng khi tab bị ẩn; bỏ qua hoàn toàn khi người dùng bật "giảm chuyển động". */
let floatingFrameId = null;
let floatingTick = 0;
function startFloatingLoop() {
    if (reduceMotion || floatingFrameId !== null) return;
    const step = now => {
        floatingFrameId = requestAnimationFrame(step);
        if (document.hidden) return;
        if (floatingTick++ % 2) return;
        const time = now * 0.001;
        for (const layer of floatingLayers) layer.update(time);
        renderOnce();
    };
    floatingFrameId = requestAnimationFrame(step);
}

const cueList = [
    { selector: '#hero', name: 'opening', progress: 0 },
    { selector: '#s2', name: 'market', progress: 0.08 },
    { selector: '#s3 .section__head', name: 'smith', progress: 0.16 },
    { selector: '#s3 .subhead:nth-of-type(2)', name: 'city', progress: 0.25 },
    { selector: '#s3 .subhead:nth-of-type(3)', name: 'cycles', progress: 0.35 },
    { selector: '#s4 .section__head', name: 'actors', progress: 0.46 },
    { selector: '#s5 .section__head', name: 'state', progress: 0.56 },
    { selector: '#s6 .section__head', name: 'pause', progress: 0.67 },
    { selector: '#s7 .section__head', name: 'answer', progress: 0.77 },
    { selector: '#s7 .subhead:nth-of-type(2)', name: 'conclusion', progress: 0.85 },
    { selector: '#s7 .subhead:nth-of-type(3)', name: 'rebuttal', progress: 0.91 },
    { selector: '#s7 .subhead:nth-of-type(4)', name: 'discussion', progress: 0.96 }
];

if (!reduceMotion) {
    gsap.timeline({
        onUpdate: updateScene,
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.8
        }
    }).fromTo(state, {
        spread: 5, touch: 0, cameraY: 0.15, cameraZ: 7.4, cameraOrbit: 0
    }, {
        spread: 4.8, touch: 1, cameraY: 4.7, cameraZ: 5.1, cameraOrbit: 0.28, ease: 'none'
    });

}

ScrollTrigger.create({
    id: 'ambient-scroll-choreography',
    trigger: document.body,
    start: 0,
    end: 'max',
    onUpdate(self) {
        scrollScene.progress = self.progress;
        scrollScene.direction = self.direction;
        updateScene();
    }
});

const sceneElements = cueList.map(cue => document.querySelector(cue.selector));
const appendixElement = document.querySelector('#s8 .section__head');

let sceneCheckPending = false;
function updateSceneFromScroll() {
    const marker = innerHeight * 0.52;
    let index = 0;
    for (let cueIndex = 1; cueIndex < sceneElements.length; cueIndex++) {
        const element = sceneElements[cueIndex];
        if (element && element.getBoundingClientRect().top <= marker) index = cueIndex;
        else break;
    }
    const atAppendix = appendixElement && appendixElement.getBoundingClientRect().top <= marker;
    setChapter(atAppendix ? 'appendix' : cueList[index].name, index);
}
function scheduleSceneCheck() {
    if (sceneCheckPending || reduceMotion) return;
    sceneCheckPending = true;
    requestAnimationFrame(() => {
        sceneCheckPending = false;
        updateSceneFromScroll();
    });
}
if (!reduceMotion) {
    window.addEventListener('scroll', scheduleSceneCheck, { passive: true });
    window.addEventListener('resize', scheduleSceneCheck, { passive: true });
    document.fonts?.ready.then(scheduleSceneCheck);
    scheduleSceneCheck();
} else {
    document.body.dataset.scene = 'opening';
}

function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.75));
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    updateScene();
}

function stop() {
    cancelAnimationFrame(renderFrameId);
    renderFrameId = null;
    if (floatingFrameId !== null) cancelAnimationFrame(floatingFrameId);
    floatingFrameId = null;
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    composer.dispose();
    renderer.dispose();
    scene.environment?.dispose();
    floatingLayers.forEach(layer => layer.dispose());
    dotTexture.dispose();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', scheduleSceneCheck);
    window.removeEventListener('resize', scheduleSceneCheck);
    canvas.remove();
}
function onVisibilityChange() {
    if (document.hidden) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
    } else {
        renderOnce();
    }
}

window.addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', onVisibilityChange);
document.addEventListener('visibilitychange', () => { if (!document.hidden) startFloatingLoop(); });
window.addEventListener('pagehide', () => {
    cancelAnimationFrame(renderFrameId);
    renderFrameId = null;
}, { once: true });
window.addEventListener('pageshow', event => {
    if (event.persisted && !document.hidden) {
        startFloatingLoop();
        renderOnce();
    }
});
window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
document.fonts?.ready.then(() => ScrollTrigger.refresh());
updateScene();
startFloatingLoop();

if (import.meta.hot) import.meta.hot.dispose(stop);
