import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import './layout.css';
import './mobile-layout.css';
import { solvePoseRig, visible, mirrorPoseLandmarks } from './pose-rig.js';
import { fitDistance, portraitPreviewWidth, compactPreviewWidth } from './viewport.js';
import { faceCrop } from './face-crop.js';
import { cameraCaptureConstraints, useWidestCamera } from './camera-capture.js';
import { createFruitStage } from './fruit-stage.js';
import { createCareerEnvironment } from './career-environment.js';
let fruitStage;

const careers = [
  { id: 'space', icon: '✦', name: '宇航员', en: 'SPACE EXPLORER', color: '#a69bdf', suit: '#ececf8', accent: '#8e82ce', background: '#e8e3f3', place: '月球探索站', task: '展开双臂，启动探索飞船', hint: '像小飞机一样，慢慢张开两只手臂', result: '飞船收到你的信号啦！', badge: '勇敢探索家', category: '探索' },
  { id: 'science', icon: '⚗', name: '科学家', en: 'LITTLE SCIENTIST', color: '#86b7a3', suit: '#f2f5ee', accent: '#66a68c', background: '#dfede5', place: '奇妙实验室', task: '展开双臂，唤醒实验装置', hint: '张开双臂，为奇妙实验注入能量', result: '新的发现，来自你的好奇心！', badge: '好奇发现家', category: '探索' },
  { id: 'fire', icon: '♨', name: '消防员', en: 'BRAVE FIREFIGHTER', color: '#db956d', suit: '#d97947', accent: '#f3d374', background: '#f2e4d9', place: '城市守护站', task: '展开双臂，点亮救援信号', hint: '稳稳站好，张开双臂发出信号', result: '救援小队已经准备出发！', badge: '勇敢守护者', category: '守护' },
  { id: 'soldier', icon: '★', name: '解放军', en: 'PLA SOLDIER', color: '#82956c', suit: '#75865b', accent: '#d8bd72', background: '#e5ebdd', place: '和平守护营', task: '展开双臂，传递平安信号', hint: '稳稳站好，慢慢张开双臂，和伙伴一起守护平安', result: '平安信号收到啦，谢谢你守护大家！', badge: '和平小卫士', category: '守护' },
  { id: 'doctor', icon: '✚', name: '医生', en: 'KIND DOCTOR', color: '#81b9c3', suit: '#edf5f5', accent: '#65a8b7', background: '#e0edf0', place: '暖心诊疗室', task: '展开双臂，传递暖心能量', hint: '张开双臂，给需要帮助的人一点力量', result: '谢谢你，让世界多一点温暖！', badge: '暖心守护者', category: '守护' },
  { id: 'engineer', icon: '⚙', name: '工程师', en: 'FUTURE BUILDER', color: '#d3b26a', suit: '#7f9cab', accent: '#edc970', background: '#eee9da', place: '未来建造工坊', task: '展开双臂，启动建造机器人', hint: '张开双臂，让机器人收到开工信号', result: '一座新的梦想之桥，即将建成！', badge: '未来建造家', category: '创造' },
  { id: 'artist', icon: '✿', name: '画家', en: 'DREAM ARTIST', color: '#d69caf', suit: '#e9c1ce', accent: '#9c83bd', background: '#f1e2ea', place: '彩虹画室', task: '展开双臂，为画室点亮色彩', hint: '把双手展开，想象你最喜欢的颜色', result: '你的想象，让世界有了新颜色！', badge: '色彩梦想家', category: '创造' },
  { id: 'chef', icon: '♧', name: '厨师', en: 'HAPPY CHEF', color: '#c6a07c', suit: '#f5f0e8', accent: '#ba8270', background: '#eee4da', place: '幸福小厨房', task: '展开双臂，开启美味派对', hint: '张开双臂，邀请大家一起分享美味', result: '分享的美味，拥有双倍的快乐！', badge: '美味创造家', category: '创造' },
  { id: 'garden', icon: '❀', name: '园艺师', en: 'NATURE KEEPER', color: '#9aac74', suit: '#a7b68a', accent: '#e7ce94', background: '#e7ecdc', place: '生长小花园', task: '展开双臂，让小花迎接阳光', hint: '像一棵小树一样，舒展你的枝条', result: '在你的照顾下，小花开啦！', badge: '自然好朋友', category: '探索' },
];

const state = { career: careers[0], filter: '全部', camera: false, tracking: false, skeleton: true, demo: true, motion: 'wave', paused: false, cameraView: 'wide' };
const compactLayout = window.matchMedia('(max-width: 900px), (max-width: 1100px) and (max-height: 550px)');
const icons = { camera: '<svg viewBox="0 0 24 24"><path d="m8 5 1-2h6l1 2h4v15H4V5z"/><circle cx="12" cy="12" r="4"/></svg>' };
document.querySelector('#app').innerHTML = `
  <header class="header"><a class="brand" href="/" aria-label="未来的我首页"><span class="brand-icon">✳</span><div>未来的我<span class="brand-sub">FUTURE ME LAB</span></div></a><button class="primary camera-launch" id="camera-button" aria-pressed="false">${icons.camera}<span>开启摄像头</span></button></header>
  <main><div class="intro"><div><div class="eyebrow">A LITTLE IMAGINATION, A BIG FUTURE</div><h1>长大后的我，<span>会是什么样子？</span></h1><p>开启摄像头，让未来的自己跟着你一起动起来。</p></div><div class="session-tag"><span class="live-dot"></span> 职业体验馆 <span class="tag-version">风格 Demo 01</span></div></div>
  <div class="workspace">
    <aside class="career-panel panel"><div class="panel-title"><span class="step">01</span><h2>选择我的梦想</h2><span class="count">${careers.length} 个职业</span></div><div class="filters" role="group" aria-label="职业分类">${['全部','探索','守护','创造'].map((label) => `<button class="filter ${label === '全部' ? 'active' : ''}" data-filter="${label}">${label}</button>`).join('')}</div><div id="career-list" role="group" aria-label="选择职业"></div><div class="template-note"><span>✧</span><div><strong>每一个梦想，都值得被看见</strong><p>预制职业模板 · 更多可能正在生长</p></div></div></aside>
    <section class="stage-panel panel"><div class="stage-top"><span class="location"><span class="live-dot"></span><span id="place">月球探索站</span></span><button class="view-toggle" id="skeleton-toggle" aria-pressed="true">◎ 骨架节点 <span>开</span></button></div><div id="scene"><div class="scene-caption"><span id="career-en">SPACE EXPLORER</span><strong>你好，未来的<span id="career-name">宇航员</span>！</strong></div><div class="orbit-label">✦ 20 年后的想象</div><div class="stage-loader" id="stage-loader">正在布置梦想舞台…</div></div><div class="stage-bottom"><span class="mode-status" id="mode-status"><i></i> 演示动作 · 非实时识别</span><span>拖动旋转视角 · 滚轮缩放</span><button id="reset-view" class="text-button">视角复位 ↺</button></div><div class="motion-bar"><span>试一试</span><button class="motion active" data-motion="wave">👋 挥挥手</button><button class="motion" data-motion="stretch">🙌 展开双臂</button><button class="motion" data-motion="sway">🌿 左右摇摆</button><button id="pause" class="pause" aria-label="暂停演示动画">Ⅱ</button></div></section>
  </div>
  <section class="camera-preview panel" id="camera-preview" hidden><div class="preview-header"><strong><span class="live-dot"></span> AI 观察窗</strong><button class="text-button" id="close-camera" aria-label="关闭摄像头">×</button></div><div class="video-wrap"><video id="video" autoplay muted playsinline></video><canvas id="landmarks"></canvas></div><p id="tracking-label" role="status">等待识别 · 请正面站好</p></section>
  <footer><span>想象未来，不预测未来。你可以成为很多种自己。</span><span>MADE FOR LITTLE DREAMERS <span class="footer-star">✦</span></span></footer></main>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

const container = document.querySelector('#scene');
const settings = document.createElement('dialog');
settings.id = 'experience-settings';
settings.setAttribute('aria-labelledby', 'settings-title');
settings.innerHTML = '<div class="settings-heading"><div><span class="eyebrow">TEACHER SETUP</span><h2 id="settings-title">体验设置</h2></div><button class="quiet" id="close-settings" aria-label="关闭体验设置">关闭 ×</button></div><div class="settings-content"></div><button class="primary" id="start-interaction">收起设置，开始互动 ↗</button>';
document.body.appendChild(settings);
const settingsButton = document.createElement('button');
settingsButton.className = 'settings-button';
settingsButton.textContent = '⚙ 设置';
settingsButton.setAttribute('aria-haspopup', 'dialog');
document.querySelector('.stage-top').append(settingsButton);
settingsButton.addEventListener('click', () => settings.showModal());
compactLayout.addEventListener('change', () => {
  if (compactLayout.matches) {
    state.filter = '全部';
    document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === '全部'));
    renderCareers();
  }
  updateCameraFraming();
});
for (const selector of ['#close-settings','#start-interaction']) document.querySelector(selector).addEventListener('click', () => settings.close());
for (const [motion, label] of [['march','🦵 抬腿踏步'],['turn','↔ 转身看看']]) {
  const button = document.createElement('button');
  button.className = 'motion'; button.dataset.motion = motion; button.textContent = label;
  document.querySelector('#pause').before(button);
}
container.appendChild(document.querySelector('#camera-preview'));
const cameraTools = document.createElement('div');
cameraTools.className = 'camera-view-tools';
cameraTools.innerHTML = '<div class="camera-fit-options" role="group" aria-label="真人取景方式"><button data-camera-view="wide" aria-pressed="true">广角完整</button><button data-camera-view="portrait" aria-pressed="false">竖屏广角</button></div><label>真人缩放 <input id="camera-zoom" type="range" min="60" max="180" value="100" step="5" aria-label="真人画面缩放"/><output id="camera-zoom-value" for="camera-zoom">1.00×</output></label>';
document.querySelector('#camera-preview').appendChild(cameraTools);
const cameraCaptureStatus = document.createElement('span');
cameraCaptureStatus.className = 'camera-capture-status';
cameraCaptureStatus.setAttribute('role', 'status');
cameraTools.appendChild(cameraCaptureStatus);
function updateCameraFraming() {
  const preview = document.querySelector('#camera-preview');
  const portrait = state.cameraView === 'portrait';
  preview.classList.toggle('portrait-view', portrait);
  if (compactLayout.matches) {
    const aspect = portrait ? 9 / 16 : (video.videoWidth / video.videoHeight || 3 / 4);
    const fraction = container.classList.contains('fruit-active') ? .4 : .42;
    preview.style.width = `${compactPreviewWidth(container.clientHeight, container.clientWidth * fraction, aspect)}px`;
    preview.style.setProperty('--preview-aspect', String(aspect));
  } else if (portrait) preview.style.width = `${portraitPreviewWidth(container.clientHeight, container.clientWidth * 0.54)}px`;
  else preview.style.removeProperty('width');
}
document.querySelectorAll('[data-camera-view]').forEach((button) => button.addEventListener('click', () => {
  state.cameraView = button.dataset.cameraView;
  document.querySelectorAll('[data-camera-view]').forEach((option) => option.setAttribute('aria-pressed', option === button));
  document.querySelector('#camera-zoom').value = '100';
  document.querySelector('#camera-zoom-value').textContent = '1.00×';
  document.querySelector('#camera-preview').style.setProperty('--camera-zoom', '1');
  updateCameraFraming();
}));
document.querySelector('#camera-zoom').addEventListener('input', (event) => {
  const zoom = Number(event.target.value) / 100;
  document.querySelector('#camera-preview').style.setProperty('--camera-zoom', String(zoom));
  document.querySelector('#camera-zoom-value').textContent = `${zoom.toFixed(2)}×`;
});
const renderViewport = document.createElement('div');
renderViewport.className = 'render-viewport';
container.appendChild(renderViewport);
const zoomControl = document.createElement('label');
zoomControl.className = 'zoom-control';
zoomControl.innerHTML = '视野 <input id="view-zoom" type="range" min="60" max="140" value="85" step="5" aria-label="3D 角色画面缩放比例"/><output id="zoom-value" for="view-zoom">85%</output>';
const displaySettings = document.createElement('section');
displaySettings.className = 'panel advanced-settings';
displaySettings.innerHTML = '<h2>画面与识别</h2><p class="helper">调整角色视野、真人取景和骨架显示。</p><span id="tracking-detail">全身节点 · 肩 / 肘 / 腕 / 髋 / 膝 / 踝 / 足尖</span>';
displaySettings.append(document.querySelector('#skeleton-toggle'), zoomControl, document.querySelector('#reset-view'), cameraTools);
settings.querySelector('.settings-content').append(displaySettings);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderViewport.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(state.career.background);
scene.fog = new THREE.Fog(state.career.background, 9, 20);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
camera.zoom = 0.85;
camera.position.set(0, 2.15, 7.7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.65, 0);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 11;
controls.minAzimuthAngle = -0.55;
controls.maxAzimuthAngle = 0.55;
controls.maxPolarAngle = Math.PI / 2;
controls.enablePan = false;
controls.enableZoom = false;
scene.add(new THREE.HemisphereLight('#fff8ef', '#8e8aab', 2.7));
const keyLight = new THREE.DirectionalLight('#fff7eb', 4.2);
keyLight.position.set(-3, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -5;
keyLight.shadow.camera.right = 5;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -5;
keyLight.shadow.normalBias = 0.03;
scene.add(keyLight);
const fill = new THREE.DirectionalLight('#d5cdff', 2);
fill.position.set(4, 3, -2);
scene.add(fill);

const suit = new THREE.MeshStandardMaterial({ color: state.career.suit, roughness: 0.72 });
const accent = new THREE.MeshStandardMaterial({ color: state.career.accent, roughness: 0.65 });
const skin = new THREE.MeshStandardMaterial({ color: '#efc49f', roughness: 0.8 });
const dark = new THREE.MeshStandardMaterial({ color: '#49465e', roughness: 0.8 });
const white = new THREE.MeshStandardMaterial({ color: '#f9f6ee', roughness: 0.65 });
function mesh(geometry, material, parent, position = [0,0,0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function capsule(radius, length, material, parent, position) { return mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), material, parent, position); }
const floor = mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#e7e1ed', roughness: 1 }), scene);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.15;
const platform = mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.22, 80), new THREE.MeshStandardMaterial({ color: '#f7f3fd', roughness: 0.8 }), scene, [0, -0.02, 0]);
const ring = mesh(new THREE.TorusGeometry(1.4, 0.012, 8, 100), accent, scene, [0, 0.1, 0]);
ring.rotation.x = -Math.PI / 2;
const character = new THREE.Group();
scene.add(character);
const torso = capsule(0.38, 0.52, suit, character, [0, 1.6, 0]);
torso.scale.set(1.05, 1, 0.73);
mesh(new THREE.BoxGeometry(0.69, 0.13, 0.48), accent, character, [0, 1.26, 0]);
const chest = mesh(new THREE.BoxGeometry(0.32, 0.28, 0.08), accent, character, [0, 1.68, 0.29]);
mesh(new THREE.BoxGeometry(0.16, 0.035, 0.015), white, chest, [0, 0.04, 0.05]);
mesh(new THREE.SphereGeometry(0.025, 12, 12), white, chest, [-0.05, -0.04, 0.05]);
mesh(new THREE.SphereGeometry(0.025, 12, 12), white, chest, [0.05, -0.04, 0.05]);
const backpack = mesh(new THREE.BoxGeometry(0.62, 0.7, 0.32), accent, character, [0, 1.64, -0.34]);
const limbs = {};
for (const side of ['left', 'right']) {
  const direction = side === 'left' ? -1 : 1;
  const shoulder = new THREE.Group();
  shoulder.position.set(direction * 0.43, 1.91, 0);
  character.add(shoulder);
  capsule(0.145, 0.27, suit, shoulder, [0, -0.21, 0]);
  const elbow = new THREE.Group();
  elbow.position.y = -0.44;
  shoulder.add(elbow);
  capsule(0.125, 0.24, suit, elbow, [0, -0.16, 0]);
  capsule(0.13, 0.025, accent, elbow, [0, -0.32, 0]);
  const hand = mesh(new THREE.SphereGeometry(0.14, 24, 20), skin, elbow, [0, -0.44, 0]);
  hand.scale.set(0.8, 1.1, 0.8);
  const hip = new THREE.Group();
  hip.position.set(direction * 0.22, 1.15, 0);
  character.add(hip);
  capsule(0.17, 0.2, suit, hip, [0, -0.2, 0]);
  const knee = new THREE.Group();
  knee.position.y = -0.4;
  hip.add(knee);
  capsule(0.15, 0.2, suit, knee, [0, -0.17, 0]);
  const boot = capsule(0.17, 0.1, accent, knee, [0, -0.45, 0.08]);
  boot.scale.set(1, 0.7, 1.5);
  const wrist = new THREE.Group();
  wrist.position.copy(hand.position);
  elbow.add(wrist);
  hand.position.set(0,0,0);
  wrist.add(hand);
  const thumb = mesh(new THREE.SphereGeometry(0.065, 12, 12), skin, wrist, [direction * -0.09, 0.015, 0.04]);
  const ankle = new THREE.Group();
  ankle.position.copy(boot.position);
  knee.add(ankle); boot.position.set(0,0,0); ankle.add(boot);
  limbs[side] = { shoulder, elbow, hip, knee, hand, wrist, ankle, thumb };
}
capsule(0.2, 0.08, skin, character, [0, 2.14, 0]);
const head = new THREE.Group();
head.position.set(0, 2.63, 0);
character.add(head);
const skull = mesh(new THREE.SphereGeometry(0.56, 48, 40), skin, head);
skull.scale.set(1, 1.08, 0.85);
const hair = mesh(new THREE.SphereGeometry(0.575, 40, 24, 0, Math.PI * 2, 0, 1.12), dark, head, [0, 0.04, -0.025]);
const faceCanvas = document.createElement('canvas');
faceCanvas.width = 512; faceCanvas.height = 512;
const faceContext = faceCanvas.getContext('2d');
function drawDefaultFace() {
  const context = faceContext;
  context.clearRect(0, 0, 512, 512);
  context.fillStyle = '#efc49f';
  context.beginPath(); context.ellipse(256, 257, 218, 240, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#494152';
  context.beginPath(); context.moveTo(36, 220); context.bezierCurveTo(15, -15, 480, -38, 479, 213); context.bezierCurveTo(412, 180, 392, 118, 364, 108); context.bezierCurveTo(290, 192, 162, 143, 67, 209); context.closePath(); context.fill();
  context.lineWidth = 12; context.lineCap = 'round'; context.strokeStyle = '#494152';
  for (const eyeX of [178, 334]) {
    context.beginPath(); context.moveTo(eyeX - 21, 239); context.quadraticCurveTo(eyeX, 228, eyeX + 21, 238); context.stroke();
    context.beginPath(); context.ellipse(eyeX, 283, 11, 16, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#fff8ee'; context.beginPath(); context.arc(eyeX + 3, 278, 3, 0, Math.PI * 2); context.fill(); context.fillStyle = '#494152';
  }
  context.fillStyle = '#e4a593';
  for (const cheekX of [133, 379]) { context.beginPath(); context.ellipse(cheekX, 329, 27, 13, 0, 0, Math.PI * 2); context.fill(); }
  context.strokeStyle = '#cf997c'; context.lineWidth = 7;
  context.beginPath(); context.moveTo(256, 294); context.lineTo(246, 326); context.quadraticCurveTo(254, 332, 265, 327); context.stroke();
  context.strokeStyle = '#895750'; context.lineWidth = 9;
  context.beginPath(); context.moveTo(219, 365); context.quadraticCurveTo(256, 395, 294, 365); context.stroke();
}
drawDefaultFace();
const faceTexture = new THREE.CanvasTexture(faceCanvas);
faceTexture.colorSpace = THREE.SRGBColorSpace;
const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, side: THREE.DoubleSide });
const faceMesh = mesh(new THREE.PlaneGeometry(1.06, 1.12), faceMaterial, head, [0, -0.015, 0.54]);
faceMesh.castShadow = false;
const accessories = new THREE.Group();
head.add(accessories);
const capBadgeMaterial = new THREE.MeshStandardMaterial({ color: '#d94e43', roughness: 0.65, side: THREE.DoubleSide });
function updateAccessories() {
  while (accessories.children.length) {
    const child = accessories.children[0];
    child.geometry?.dispose();
    accessories.remove(child);
  }
  backpack.visible = state.career.id === 'space';
  hair.visible = !['fire','engineer','chef','soldier'].includes(state.career.id);
  if (['fire','engineer'].includes(state.career.id)) {
    mesh(new THREE.SphereGeometry(0.61, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), accent, accessories, [0, 0.32, 0]);
    mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 40), accent, accessories, [0, 0.32, 0]);
  }
  if (state.career.id === 'soldier') {
    mesh(new THREE.CylinderGeometry(0.55, 0.56, 0.26, 40), suit, accessories, [0, 0.48, 0]);
    const visor = mesh(new THREE.SphereGeometry(0.49, 24, 12), suit, accessories, [0, 0.36, 0.35]);
    visor.scale.set(1.1, 0.065, 0.85);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 0.09 : 0.04;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i === 0) star.moveTo(x, y); else star.lineTo(x, y);
    }
    star.closePath();
    mesh(new THREE.ShapeGeometry(star), capBadgeMaterial, accessories, [0, 0.49, 0.565]);
  }
  if (state.career.id === 'chef') {
    mesh(new THREE.CylinderGeometry(0.43, 0.48, 0.28, 32), white, accessories, [0, 0.56, 0]);
    for (const offset of [-0.25,0,0.25]) mesh(new THREE.SphereGeometry(0.28, 20, 20), white, accessories, [offset, 0.77, 0]);
  }
  if (state.career.id === 'space') {
    mesh(new THREE.TorusGeometry(0.64, 0.045, 12, 64), white, accessories, [0, 0, 0]);
    for (const offset of [-0.61, 0.61]) mesh(new THREE.SphereGeometry(0.115, 20, 20), accent, accessories, [offset, 0, 0]);
  }
  if (state.career.id === 'artist') {
    const beret = mesh(new THREE.SphereGeometry(0.56, 32, 16), accent, accessories, [-0.06, 0.47, 0]);
    beret.scale.set(1.1, 0.35, 0.9);
  }
}
updateAccessories();
let liveFace = false;
let lastFaceFrame = 0;
function stopLiveFace(restore = true) {
  liveFace = false;
  if (restore) {
    drawDefaultFace();
    faceTexture.needsUpdate = true;
  }
}
function startLiveFace() {
  if (liveFace || !state.camera) return;
  liveFace = true;
  lastFaceFrame = 0;
}
function updateLiveFace(points, now) {
  if (!liveFace || now - lastFaceFrame < 140) return;
  lastFaceFrame = now;
  const crop = faceCrop(points,video.videoWidth,video.videoHeight);
  if (!crop) {
    return;
  }
  faceContext.clearRect(0,0,512,512);
  faceContext.save();
  faceContext.beginPath(); faceContext.ellipse(256,256,218,240,0,0,Math.PI * 2); faceContext.clip();
  faceContext.translate(512,0); faceContext.scale(-1,1);
  faceContext.drawImage(video,crop.x,crop.y,crop.width,crop.height,22,0,468,512);
  faceContext.restore(); faceTexture.needsUpdate = true;
}

const environment = createCareerEnvironment(scene);
environment.setCareer(state.career.id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const skeletonGroup = new THREE.Group(); character.add(skeletonGroup);
const skeletonMaterial = new THREE.MeshBasicMaterial({ color: '#c3f4e6', depthTest: false, transparent: true, opacity: 0.82 });
const skeletonAnchors = [head, limbs.left.shoulder, limbs.left.elbow, limbs.left.wrist, limbs.right.shoulder, limbs.right.elbow, limbs.right.wrist, limbs.left.hip, limbs.left.knee, limbs.left.ankle, limbs.right.hip, limbs.right.knee, limbs.right.ankle];
const skeletonEdges = [[0,1],[1,2],[2,3],[0,4],[4,5],[5,6],[1,7],[4,10],[7,10],[7,8],[8,9],[10,11],[11,12],[1,4],[9,13],[12,14],[3,15],[6,16]];
const skeletonPoints = Array.from({ length: 17 }, () => { const point = mesh(new THREE.SphereGeometry(0.041, 12, 12), skeletonMaterial, skeletonGroup); point.renderOrder = 3; return point; });
const skeletonPositions = new Float32Array(skeletonEdges.length * 6);
const skeletonGeometry = new THREE.BufferGeometry();
skeletonGeometry.setAttribute('position', new THREE.BufferAttribute(skeletonPositions, 3));
const skeletonLines = new THREE.LineSegments(skeletonGeometry, new THREE.LineBasicMaterial({ color: '#bcf3e1', depthTest: false, transparent: true, opacity: 0.65 }));
skeletonLines.renderOrder = 2; skeletonLines.frustumCulled = false; skeletonGroup.add(skeletonLines);
const localPoint = new THREE.Vector3();
function updateSkeleton() {
  skeletonGroup.visible = state.skeleton;
  if (!state.skeleton) return;
  skeletonAnchors.forEach((object, index) => { object.getWorldPosition(localPoint); character.worldToLocal(localPoint); skeletonPoints[index].position.copy(localPoint); skeletonPoints[index].position.z += 0.22; });
  for (const [index, side, source, offset] of [[13,'left','ankle',[0,0,0.25]],[14,'right','ankle',[0,0,0.25]],[15,'left','wrist',[0,-0.09,0.06]],[16,'right','wrist',[0,-0.09,0.06]]]) {
    localPoint.set(...offset); limbs[side][source].localToWorld(localPoint); character.worldToLocal(localPoint);
    skeletonPoints[index].position.copy(localPoint); skeletonPoints[index].position.z += 0.22;
  }
  skeletonEdges.forEach(([start,end], index) => {
    skeletonPoints[start].position.toArray(skeletonPositions, index * 6);
    skeletonPoints[end].position.toArray(skeletonPositions, index * 6 + 3);
  });
  skeletonGeometry.attributes.position.needsUpdate = true;
}
new ResizeObserver(() => {
  const width = renderViewport.clientWidth; const height = renderViewport.clientHeight;
  if (width < 1 || height < 1) return;
  camera.aspect = width / height;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  updateCameraFraming();
  fitView();
}).observe(renderViewport);
document.querySelector('#stage-loader').hidden = true;

function renderCareers() {
  document.querySelector('#career-list').innerHTML = careers.filter((career) => state.filter === '全部' || career.category === state.filter).map((career) => `<button class="career-card ${career.id === state.career.id ? 'selected' : ''}" data-career="${career.id}" aria-pressed="${career.id === state.career.id}" style="--career-color:${career.color}"><span class="career-icon">${career.icon}</span><span><strong>${career.name}</strong><small>${career.en}</small></span><span class="career-check">${career.id === state.career.id ? '✓' : '↗'}</span></button>`).join('');
  document.querySelectorAll('[data-career]').forEach((button) => button.addEventListener('click', () => chooseCareer(button.dataset.career)));
}
function chooseCareer(id) {
  fruitStage?.invalidateInput();
  state.career = careers.find((career) => career.id === id);
  const career = state.career;
  suit.color.set(career.suit); accent.color.set(career.accent); scene.background.set(career.background); scene.fog.color.set(career.background); floor.material.color.set(career.background);
  document.querySelector('#place').textContent = career.place;
  document.querySelector('#career-name').textContent = career.name;
  document.querySelector('#career-en').textContent = career.en;
  document.documentElement.style.setProperty('--accent', career.accent);
  environment.setCareer(career.id);
  updateStageTheme(career);
  updateAccessories(); renderCareers();
  if (compactLayout.matches) {
    const list = document.querySelector('#career-list'), selected = list.querySelector('.selected');
    list.scrollTo({ left: selected.offsetLeft - (list.clientWidth - selected.clientWidth) / 2,
      top: selected.offsetTop - (list.clientHeight - selected.clientHeight) / 2, behavior: 'smooth' });
  }
}
function updateStageTheme(career) {
  const panel = document.querySelector('.stage-panel');
  panel.style.setProperty('--stage-background', career.background);
  panel.style.setProperty('--stage-ink', new THREE.Color(career.color).multiplyScalar(0.57).getStyle());
  panel.dataset.career = career.id;
}
updateStageTheme(state.career);
renderCareers();
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((filter) => filter.classList.toggle('active', filter === button)); renderCareers();
}));
let toastTimeout;
function toast(message) { const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => element.classList.remove('show'), 5000); }
document.querySelector('#skeleton-toggle').addEventListener('click', (event) => {
  state.skeleton = !state.skeleton;
  event.currentTarget.setAttribute('aria-pressed', state.skeleton);
  event.currentTarget.querySelector('span').textContent = state.skeleton ? '开' : '关';
});
function fitView() {
  const distance = fitDistance(camera.aspect, camera.fov);
  controls.maxDistance = Math.max(11, distance * 1.4);
  const direction = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(direction, distance);
  camera.updateProjectionMatrix(); controls.update();
}
function resetView() {
  camera.zoom = 0.85;
  document.querySelector('#view-zoom').value = '85';
  document.querySelector('#zoom-value').textContent = '85%';
  controls.target.set(0, 1.65, 0);
  camera.position.set(0, 2.05, 7.7);
  fitView();
}
document.querySelector('#reset-view').addEventListener('click', resetView);
document.querySelector('#view-zoom').addEventListener('input', (event) => {
  camera.zoom = Number(event.target.value) / 100;
  camera.updateProjectionMatrix();
  document.querySelector('#zoom-value').textContent = `${event.target.value}%`;
});
let detector = null;
let stream = null;
let cameraSession = 0;
let lastVideoTime = -1;
let lastSeen = 0;
let poseAt = 0;
let pose = null;
let worldPose = null;
let startingCamera = false;
const video = document.querySelector('#video');
video.addEventListener('loadedmetadata', updateCameraFraming);
const landmarkCanvas = document.querySelector('#landmarks');
const landmarkContext = landmarkCanvas.getContext('2d');
function updateMode() {
  document.querySelector('#mode-status').innerHTML = `<i></i> ${state.camera ? (state.tracking ? '摄像头实时跟随' : '未识别到身体 · 角色等待中') : '演示动作 · 非实时识别'}`;
  document.querySelectorAll('.motion, #pause').forEach((button) => { button.disabled = state.camera; });
}
function stopCamera() {
  fruitStage?.invalidateInput();
  stopLiveFace();
  cameraSession++;
  stream?.getTracks().forEach((track) => track.stop()); stream = null; video.srcObject = null;
  state.camera = false; state.tracking = false; state.demo = true; pose = null; worldPose = null; startingCamera = false;
  document.querySelector('#camera-preview').hidden = true;
  container.classList.remove('camera-active');
  document.querySelector('#app').classList.remove('is-interacting');
  const button = document.querySelector('#camera-button'); button.disabled = false; button.querySelector('span').textContent = '开启摄像头';
  button.setAttribute('aria-pressed', 'false');
  updateMode();
}
async function startCamera() {
  if (state.camera) { stopCamera(); return; }
  if (startingCamera) return;
  startingCamera = true; const session = ++cameraSession;
  const button = document.querySelector('#camera-button'); button.disabled = true; button.querySelector('span').textContent = '正在准备识别…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持摄像头，请使用本机 localhost 或 HTTPS 下的 Chrome / Edge。');
    const nextStream = await navigator.mediaDevices.getUserMedia(cameraCaptureConstraints());
    if (session !== cameraSession) { nextStream.getTracks().forEach((track) => track.stop()); return; }
    stream = nextStream;
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (session === cameraSession) stopCamera(); }));
    cameraCaptureStatus.textContent = await useWidestCamera(stream.getVideoTracks()[0]);
    if (session !== cameraSession) return;
    video.srcObject = stream; await video.play();
    if (!detector) {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      detector = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1 });
    }
    if (session !== cameraSession) return;
    state.camera = true; state.demo = false; state.paused = false; state.tracking = false; lastSeen = 0; lastVideoTime = -1;
    startLiveFace();
    document.querySelector('#camera-preview').hidden = false;
    container.classList.add('camera-active');
    document.querySelector('#app').classList.add('is-interacting');
    button.querySelector('span').textContent = '关闭摄像头';
    button.setAttribute('aria-pressed', 'true');
    document.querySelector('#pause').textContent = 'Ⅱ'; updateMode();
  } catch (error) {
    if (session !== cameraSession) return;
    stopCamera();
    const message = error.name === 'NotAllowedError' ? '摄像头权限未开启，你仍可以使用演示动作。' : error.name === 'NotFoundError' ? '未找到摄像头，你仍可以使用演示动作。' : '摄像头或识别模型未能启动，请检查设备和模型下载网络。你仍可以使用演示动作。';
    toast(message); console.warn('Camera initialization failed:', error);
  } finally { if (session === cameraSession) { button.disabled = false; startingCamera = false; } }
}
document.querySelector('#camera-button').addEventListener('click', startCamera);
document.querySelector('#close-camera').addEventListener('click', stopCamera);
document.querySelectorAll('[data-motion]').forEach((button) => button.addEventListener('click', () => {
  state.motion = button.dataset.motion; state.paused = false;
  document.querySelectorAll('[data-motion]').forEach((motion) => motion.classList.toggle('active', motion === button));
  document.querySelector('#pause').textContent = 'Ⅱ'; document.querySelector('#pause').setAttribute('aria-label', '暂停演示动画');
}));
document.querySelector('#pause').addEventListener('click', (event) => { state.paused = !state.paused; event.currentTarget.textContent = state.paused ? '▷' : 'Ⅱ'; event.currentTarget.setAttribute('aria-label', state.paused ? '继续演示动画' : '暂停演示动画'); });
const poseConnections = [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[17,19],[15,21],[12,14],[14,16],[16,18],[16,20],[18,20],[16,22],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[27,31],[24,26],[26,28],[28,30],[30,32],[28,32]];
function readPose(now) {
  if (!state.camera || !detector || video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  try {
    const result = detector.detectForVideo(video, now);
    poseAt = now;
    const landmarks = result.landmarks[0];
    updateLiveFace(landmarks,now);
    landmarkCanvas.width = video.videoWidth; landmarkCanvas.height = video.videoHeight;
    landmarkContext.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);
    if (!landmarks) { pose = null; worldPose = null; return; }
    worldPose = result.worldLandmarks[0] || null;
    if ([11,12].every((index) => landmarks[index].visibility > 0.55)) { lastSeen = now; pose = landmarks; }
    else { pose = null; }
    if (!state.skeleton) return;
    const pixelScale = landmarkCanvas.width / 640;
    landmarkContext.lineCap = 'round';
    landmarkContext.lineJoin = 'round';
    landmarkContext.strokeStyle = '#233e54';
    landmarkContext.lineWidth = 7 * pixelScale;
    for (const [start,end] of poseConnections) {
      if (landmarks[start].visibility < 0.5 || landmarks[end].visibility < 0.5) continue;
      landmarkContext.beginPath(); landmarkContext.moveTo(landmarks[start].x * landmarkCanvas.width, landmarks[start].y * landmarkCanvas.height); landmarkContext.lineTo(landmarks[end].x * landmarkCanvas.width, landmarks[end].y * landmarkCanvas.height); landmarkContext.stroke();
    }
    landmarkContext.strokeStyle = '#71ffd1';
    landmarkContext.lineWidth = 3 * pixelScale;
    landmarkContext.shadowColor = '#40f5c4'; landmarkContext.shadowBlur = 8 * pixelScale;
    for (const [start,end] of poseConnections) {
      if (landmarks[start].visibility < 0.5 || landmarks[end].visibility < 0.5) continue;
      landmarkContext.beginPath(); landmarkContext.moveTo(landmarks[start].x * landmarkCanvas.width, landmarks[start].y * landmarkCanvas.height); landmarkContext.lineTo(landmarks[end].x * landmarkCanvas.width, landmarks[end].y * landmarkCanvas.height); landmarkContext.stroke();
    }
    landmarkContext.shadowBlur = 0;
    for (const [index, point] of landmarks.entries()) {
      if (point.visibility < 0.5) continue;
      landmarkContext.fillStyle = [15,16].includes(index) ? '#ffcf75' : '#effff9';
      landmarkContext.strokeStyle = '#246c68'; landmarkContext.lineWidth = 2 * pixelScale;
      landmarkContext.beginPath(); landmarkContext.arc(point.x * landmarkCanvas.width,point.y * landmarkCanvas.height,(index < 11 ? 3.5 : 5.5) * pixelScale,0,Math.PI * 2); landmarkContext.fill(); landmarkContext.stroke();
    }
  } catch (error) { stopCamera(); toast('识别暂时中断，已恢复演示模式。'); console.warn(error); }
}
fruitStage = createFruitStage({ viewport: renderViewport, container, renderer, camera, controls, limbs, state,
  getPose: () => ({ pose, time: poseAt }), resetView,
  resetFace: () => {
    stopLiveFace(false);
    drawDefaultFace(); faceTexture.needsUpdate = true;
    pose = null; worldPose = null; lastSeen = 0;
    startLiveFace();
  },
});
const clock = new THREE.Clock();
let elapsed = 0;
let inferenceAt = 0;
const smoothing = (current, target, delta) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * 12));
function animate() {
  const delta = Math.min(clock.getDelta(),0.05); const now = performance.now();
  if (!state.paused) elapsed += delta;
  if (state.camera && now - inferenceAt > 70) { readPose(now); inferenceAt = now; }
  const tracking = state.camera && pose !== null && now - lastSeen < 500;
  if (tracking !== state.tracking) { state.tracking = tracking; updateMode(); }
  const fullBody = tracking && visible(worldPose, [23,24,25,26,27,28]);
  if (state.camera) document.querySelector('#tracking-label').textContent = tracking ? (fullBody ? '全身跟随 · 抬腿 / 屈膝 / 小幅转身' : '上半身跟随 · 后退让膝盖和脚踝入镜') : '请站在画面中央，让身体完整入镜';
  document.querySelector('#tracking-detail').textContent = state.camera ? (tracking ? `可见节点 ${pose.filter((point) => point.visibility >= 0.5).length} / 33 · ${fullBody ? '腿部已识别' : '腿部未完整入镜'}` : '等待身体入镜 · 不可靠关节回到休息姿势') : '全身节点 · 肩 / 肘 / 腕 / 髋 / 膝 / 踝 / 足尖';
  let leftAngle = -0.15, rightAngle = 0.15, leftBend = 0, rightBend = 0, bodyTilt = 0, headTilt = 0;
  let bodyYaw = 0;
  const legAngles = { left: [0,0], right: [0,0] };
  const mirroredPose = tracking ? mirrorPoseLandmarks(pose) : null;
  const rig = tracking && worldPose ? solvePoseRig(mirrorPoseLandmarks(worldPose)) : null;
  if (tracking) {
    const angle = (shoulderIndex, elbowIndex) => Math.atan2(mirroredPose[elbowIndex].x - mirroredPose[shoulderIndex].x, mirroredPose[elbowIndex].y - mirroredPose[shoulderIndex].y);
    if ([12,14,16].every((index) => mirroredPose[index].visibility > 0.5)) { leftAngle = angle(12,14); leftBend = angle(14,16) - leftAngle; }
    if ([11,13,15].every((index) => mirroredPose[index].visibility > 0.5)) { rightAngle = angle(11,13); rightBend = angle(13,15) - rightAngle; }
    bodyTilt = THREE.MathUtils.clamp(Math.atan2(mirroredPose[12].y - mirroredPose[11].y, Math.abs(mirroredPose[12].x - mirroredPose[11].x)), -0.2, 0.2);
    headTilt = bodyTilt * 0.6;
  } else if (state.demo) {
    if (state.motion === 'wave') { rightAngle = 2.35; rightBend = Math.sin(elapsed * 4) * 0.35 + 0.35; leftAngle = -0.15 + Math.sin(elapsed * 2) * 0.06; }
    if (state.motion === 'stretch') { leftAngle = -1.57; rightAngle = 1.57; }
    if (state.motion === 'sway') { bodyTilt = Math.sin(elapsed * 1.6) * 0.13; leftAngle = -0.35; rightAngle = 0.35; headTilt = -bodyTilt * 0.6; }
    if (state.motion === 'march') {
      for (const [side, phase] of [['left',0],['right',Math.PI]]) {
        const lift = Math.max(0, Math.sin(elapsed * 2.4 + phase));
        legAngles[side] = [-lift * 0.85, lift * 1.3];
      }
      leftAngle = -0.35; rightAngle = 0.35;
    }
    if (state.motion === 'turn') { bodyYaw = Math.sin(elapsed * 0.9) * 0.9; leftAngle = -0.3; rightAngle = 0.3; }
  }
  if (!state.paused) {
    const blend = 1 - Math.exp(-delta * 10);
    for (const [side, armAngle, elbowAngle] of [['left',leftAngle,leftBend],['right',rightAngle,rightBend]]) {
      const arm = rig?.[`${side}Arm`]; const leg = rig?.[`${side}Leg`];
      const rotation = (angle, axis = 'z') => new THREE.Quaternion().setFromEuler(new THREE.Euler(axis === 'x' ? angle : 0,0,axis === 'z' ? angle : 0));
      limbs[side].shoulder.quaternion.slerp(arm?.upper || rotation(armAngle),blend);
      limbs[side].elbow.quaternion.slerp(arm?.lower || rotation(THREE.MathUtils.clamp(elbowAngle,-2.3,2.3)),blend);
      limbs[side].wrist.quaternion.slerp(arm?.hand || new THREE.Quaternion(),blend * 0.6);
      limbs[side].hip.quaternion.slerp(leg?.upper || rotation(legAngles[side][0],'x'),blend);
      limbs[side].knee.quaternion.slerp(leg?.lower || rotation(legAngles[side][1],'x'),blend);
      const footTarget = new THREE.Quaternion();
      if (leg?.foot) footTarget.slerp(leg.foot,0.45);
      limbs[side].ankle.quaternion.slerp(footTarget,blend);
    }
    bodyYaw = rig?.yaw ?? bodyYaw;
    const rootRotation = rig?.body || new THREE.Quaternion().setFromEuler(new THREE.Euler(0,bodyYaw,bodyTilt));
    character.quaternion.slerp(rootRotation,blend);
    head.rotation.z = smoothing(head.rotation.z,headTilt,delta);
    head.rotation.y = smoothing(head.rotation.y,THREE.MathUtils.clamp(-bodyYaw * 0.75,-0.7,0.7),delta);
    character.position.y = 0;
    if (fullBody || state.motion === 'march' && state.demo) {
      character.updateMatrixWorld(true);
      const lowestAnkle = Math.min(limbs.left.ankle.getWorldPosition(new THREE.Vector3()).y,limbs.right.ankle.getWorldPosition(new THREE.Vector3()).y);
      character.position.y = THREE.MathUtils.clamp(0.3 - lowestAnkle,-0.55,0.4);
    }
  }
  environment.update(elapsed, reducedMotion.matches || container.classList.contains('fruit-active'));
  controls.update(); scene.updateMatrixWorld(true); updateSkeleton(); renderer.render(scene,camera); fruitStage.frame(now);
}
renderer.setAnimationLoop(animate);
window.addEventListener('pagehide', () => { stopCamera(); detector?.close(); });
