import * as THREE from 'three';
import { FruitGame, HandInput, CooperationBasket, FRUIT_CONFIG, FRUIT_TYPES, handsRaised } from './fruit-game.js';
import './fruit.css';
import { SCREEN_ARM_LANDMARKS } from './pose-rig.js';
import { FruitAudio, FEEDBACK_CONFIG, encouragement, drawSwipe, drawBurst, drawCelebration, fruitHalfPose } from './fruit-feedback.js';

const colors = { apple: '#ee696d', orange: '#f5a63c', watermelon: '#65aa7a', strawberry: '#de5178' };
const juiceColors = { apple: '#e9ad45', orange: '#f5a032', watermelon: '#ef4c6f', strawberry: '#de5178' };
const names = { apple: '苹果', orange: '橙子', watermelon: '西瓜', strawberry: '草莓' };
export function createFruitStage({ viewport, container, renderer, camera, controls, limbs, state, getPose, resetFace, resetView, audio = new FruitAudio() }) {
  const game = new FruitGame(), basket = new CooperationBasket();
  const inputs = { left: new HandInput(), right: new HandInput(), mouse: new HandInput() };
  let pendingSegments = [];
  let enabled = false, scale = null, calibration = [], lastNow = null, lastPoseTime = -1, pointer = null, pointerDown = false, trails = [], points = [], boundsDirty = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cheer = null, celebration = null, lastFeedbackTime = 0;
  const world = new THREE.Scene();
  const view = new THREE.OrthographicCamera(0, 1, 0, 1, .1, 100);
  view.position.z = 10;
  world.add(new THREE.HemisphereLight('#ffffff', '#aa8877', 3));
  const sun = new THREE.DirectionalLight('#ffffff', 3); sun.position.set(-2,-3,7); world.add(sun);
  const meshes = new Map();
  const originalShadows = renderer.shadowMap.enabled;
  const material = Object.fromEntries(FRUIT_TYPES.map(t => [t, new THREE.MeshStandardMaterial({ color: colors[t], roughness: .55 })]));
  const flesh = Object.fromEntries(FRUIT_TYPES.map(t => [t, new THREE.MeshBasicMaterial({ color: t === 'watermelon' ? '#fa5576' : t === 'orange' ? '#ffc34f' : t === 'strawberry' ? '#ff8fa3' : '#fff1ca', side: THREE.DoubleSide })]));
  const fullGeometry = new THREE.SphereGeometry(1, 24, 16);
  const halfGeometry = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  halfGeometry.rotateX(-Math.PI / 2);
  const diskGeometry = new THREE.CircleGeometry(1, 24);
  const stemGeometry = new THREE.CylinderGeometry(.06,.09,.4,6);
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#708052' });
  const seedMaterial = new THREE.MeshBasicMaterial({ color: '#593a32' });
  const pithMaterial = new THREE.MeshBasicMaterial({ color: '#fff5c9' });
  const overlay = document.createElement('div'); overlay.className = 'fruit-overlay'; overlay.hidden = true;
  overlay.innerHTML = '<div class="fruit-hud"><div><small>剩余时间</small><strong id="fruit-time">60</strong></div><div><small>本轮收集</small><strong id="fruit-count">0 <em>/ 12</em></strong></div><div><small>合作篮子</small><strong id="fruit-basket">0</strong></div></div><canvas class="fruit-trails"></canvas><div class="fruit-cheer" role="status" aria-live="polite" hidden></div><div class="fruit-message" role="status" aria-live="polite"></div><div class="fruit-card"></div>';
  viewport.append(overlay);
  const canvas = overlay.querySelector('canvas'), ctx = canvas.getContext('2d');
  const cheerLabel = overlay.querySelector('.fruit-cheer');
  const countCard = overlay.querySelector('#fruit-count').parentElement;
  const card = overlay.querySelector('.fruit-card'), message = overlay.querySelector('.fruit-message');
  const toolbar = document.createElement('div'); toolbar.className = 'fruit-toolbar';
  toolbar.innerHTML = '<div class="mode-switch" role="group" aria-label="互动模式"><button type="button" data-play-mode="free" aria-pressed="true">自由模式</button><button type="button" data-play-mode="fruit" aria-pressed="false">切水果</button></div>';
  document.querySelector('.stage-top').prepend(toolbar);
  const setup = document.createElement('section'); setup.className = 'fruit-settings';
  setup.innerHTML = '<h3>切水果 · 老师设置</h3><label>回合时长 <select id="fruit-duration"><option value="30">30 秒</option><option value="45">45 秒</option><option value="60" selected>60 秒</option></select></label><label>出果节奏 <select id="fruit-pace"><option value="slow">慢慢收集</option><option value="normal">轻快收集</option></select></label><label>可用手臂 <select id="fruit-hands"><option value="both">双手</option><option value="left">画面左手</option><option value="right">画面右手</option></select></label><label>输入方式 <select id="fruit-input"><option value="camera">摄像头体感</option><option value="mouse">老师演示 · 按住拖动</option></select></label><label><input type="checkbox" id="fruit-sound" checked> 音乐与音效</label><p>仅限老师监督下的单人 Demo，尚无身份锁定。原地站好，肩、肘、腕入镜即可，无需露出腿部。</p><p>合作篮子只保存在本页内存，刷新后归零。</p><button id="fruit-clear">清空本堂合作篮子</button>';
  document.querySelector('.settings-content').append(setup);
  const $ = id => document.getElementById(id);
  function clearInput() { pendingSegments = []; Object.values(inputs).forEach(i => i.clear()); trails = []; points = []; pointerDown = false; pointer = null; }
  function invalidateInput() { if (!enabled) return; clearInput(); audio.stop(); }
  function unlockAudio() { audio.unlock(); }
  function syncMusic() { audio.setMusicActive(enabled && game.status === 'playing' && !document.hidden); }
  function resetFeedback() {
    cheer = null; celebration = null; cheerLabel.hidden = true;
    countCard.style.removeProperty('transform'); audio.stop();
  }
  $('fruit-sound').addEventListener('change', e => audio.setEnabled(e.target.checked));
  function prepare() {
    resetFeedback(); clearInput(); scale = null; calibration = []; lastPoseTime = -1; boundsDirty = true;
    game.prepare({ duration: Number($('fruit-duration').value), pace: $('fruit-pace').value, demo: $('fruit-input').value === 'mouse', autoStart: $('fruit-input').value !== 'mouse' });
    game.career = state.career.name;
    syncMusic();
    paintUI();
  }
  function toggle(on) {
    if (on === enabled) return;
    toolbar.querySelectorAll('[data-play-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String((button.dataset.playMode === 'fruit') === on));
    });
    enabled = on; overlay.hidden = !on; container.classList.toggle('fruit-active', on); document.querySelector('#app').classList.toggle('fruit-mode', on);
    clearInput();
    if (on) { unlockAudio(); resetView(); controls.enableDamping = false; controls.update(); prepare(); }
    else { game.dispose(); resetFeedback(); controls.enableDamping = true; clearMeshes(); }
    syncMusic();
    renderer.shadowMap.enabled = on ? false : originalShadows;
    controls.enabled = !on;
    $('view-zoom').disabled = on; $('reset-view').disabled = on;
  }
  toolbar.querySelectorAll('[data-play-mode]').forEach(button => {
    button.addEventListener('click', () => toggle(button.dataset.playMode === 'fruit'));
  });
  $('fruit-clear').addEventListener('click', () => { basket.clear(); paintUI(); });
  for (const id of ['fruit-duration','fruit-pace','fruit-input']) $(id).addEventListener('change', () => { if (enabled && ['setup','calibrating','results'].includes(game.status)) prepare(); });
  setup.addEventListener('change', () => { clearInput(); });
  document.querySelector('.stage-top').addEventListener('click', e => { if (e.target.closest('.settings-button')) invalidateInput(); }, true);
  for (const selector of ['[data-camera-view]', '#camera-zoom', '#close-camera', '#camera-button']) document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('pointerdown', invalidateInput, true);
    el.addEventListener('change', invalidateInput, true);
  });
  // Duration and input settings apply to the next round.
  function action(label, fn, disabled = false) { const b = document.createElement('button'); b.textContent = label; b.disabled = disabled; b.addEventListener('click', () => { unlockAudio(); fn(); clearInput(); paintUI(); }); card.append(b); }
  let uiKey = '';
  function paintUI(ready = false) {
    $('fruit-time').textContent = Math.ceil(game.remaining);
    $('fruit-count').textContent = `${game.collected} / ${FRUIT_CONFIG.target}`;
    $('fruit-basket').textContent = basket.total;
    const status = game.status;
    const key = [status, state.camera, game.stable >= 1, ready, game.tutorialDone, basket.total, basket.rounds.has(game.roundId), game.career].join('|');
    if (key === uiKey) return; uiKey = key;
    const editable = ['calibrating','setup','results'].includes(status);
    for (const id of ['fruit-duration','fruit-pace','fruit-input']) $(id).disabled = !editable;
    card.replaceChildren(); card.hidden = status === 'playing' || (status === 'calibrating' && !game.demo);
    overlay.classList.toggle('fruit-preparing', status === 'calibrating' && !game.demo);
    if (status === 'calibrating') {
      message.textContent = game.demo ? '按住拖动，切开水果' : state.camera ? '举起双手，开始切水果' : '开启摄像头，举起双手开始';
      if (game.demo) action('练习一下', () => game.tutorial(), game.stable < 1);
    } else if (status === 'tutorial') {
      message.textContent = game.tutorialDone ? '切到了！光线经过，水果就分开啦' : '挥挥手，让光线划过水果';
      action(game.tutorialDone ? '开始本轮 · 3 秒准备' : '跳过练习，开始本轮', () => game.start(), game.stable < 1);
    } else if (status === 'countdown') { message.textContent = ready ? '准备收集水果' : '等待肩膀和手臂入镜'; }
    else if (status === 'results') {
      message.textContent = `我们一起收集了 ${game.collected} 个水果`;
      const p = document.createElement('p'); p.textContent = `这次你是${game.career}。谢谢你和大家一起参与！`; card.append(p);
      const detail = document.createElement('p'); detail.textContent = FRUIT_TYPES.map(t => `${names[t]} ${game.counts[t]}`).join(' · '); card.append(detail);
      if (!game.demo) action(basket.rounds.has(game.roundId) ? '已加入合作篮子 ✓' : '加入合作篮子', () => basket.add(game), basket.rounds.has(game.roundId));
      action('再玩一次', prepare); action('下一位', () => { resetFace(); prepare(); });
      action('返回自由模式', () => toggle(false));
    }
  }
  function clearMeshes() { for (const group of meshes.values()) world.remove(group); meshes.clear(); }
  function makeFruit(type, half = false) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(half ? halfGeometry : fullGeometry, material[type]);
    group.add(body);
    if (half) {
      const rind = new THREE.Mesh(diskGeometry, material[type]); rind.position.z = .005; group.add(rind);
      const disk = new THREE.Mesh(diskGeometry, flesh[type]); disk.scale.setScalar(.89); disk.position.z = .012; group.add(disk);
      if (type === 'orange') {
        for (let i = 0; i < 8; i++) {
          const divider = new THREE.Mesh(diskGeometry,pithMaterial), a = i * Math.PI / 4;
          divider.scale.set(.015,.42,1); divider.rotation.z = a;
          divider.position.set(Math.sin(-a)*.43,Math.cos(a)*.43,.02); group.add(divider);
        }
      } else {
        for (let i = 0; i < (type === 'watermelon' ? 9 : 4); i++) {
          const seed = new THREE.Mesh(diskGeometry,seedMaterial), a = i * 2.4;
          seed.scale.set(.04,.075,1); seed.rotation.z = a;
          seed.position.set(Math.sin(a)*.5,Math.cos(a)*.5,.025); group.add(seed);
        }
      }
    }
    else {
      const stem = new THREE.Mesh(stemGeometry, stemMaterial); stem.rotation.z = .2; stem.position.y = -1.05; group.add(stem);
      if (type === 'watermelon' || type === 'strawberry') {
        for (let i = 0; i < 7; i++) {
          const seed = new THREE.Mesh(fullGeometry, stemMaterial); const a = i * 2.4;
          seed.position.set(Math.sin(a) * .7, Math.cos(a) * .7,.7); seed.scale.set(.04, type === 'watermelon' ? .3 : .08,.04); group.add(seed);
        }
      }
    }
    if (type === 'strawberry') body.scale.set(.85,1.1,.85);
    return group;
  }
  function visuals(dt, segments, now) {
    const w = viewport.clientWidth, h = viewport.clientHeight, size = Math.min(w,h);
    if (!size) return;
    view.right = w / size; view.bottom = h / size; view.updateProjectionMatrix();
    const current = new Set();
    function show(id, type, x,y,r,rotation,half) {
      current.add(id); let group = meshes.get(id);
      if (!group) { group = makeFruit(type,half); meshes.set(id,group); world.add(group); }
      group.position.set(x,y,half ? 1 : 0); group.scale.setScalar(r); group.rotation.z = rotation;
      group.rotation.x = half ? half * .24 : 0;
      group.rotation.y = half ? half * .3 : 0;
    }
    for (const f of game.fruits) show(f.id,f.type,f.x,f.y,f.radius, Math.sin(f.age) * .12,0);
    for (const f of game.effects) for (const side of [-1,1]) {
      const p = fruitHalfPose(f,side,reducedMotion.matches);
      show(`${f.id}-${side}`,f.type,p.x,p.y,f.radius*p.scale,p.rotation,side);
    }
    for (const [id,group] of meshes) if (!current.has(id)) { world.remove(group); meshes.delete(id); }
    const ratio = Math.min(devicePixelRatio || 1,2);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,w,h);
    for (const segment of segments) trails.push({ ...segment, time: now });
    trails = trails.filter(t => now - t.time < FRUIT_CONFIG.trailLife);
    for (const t of trails) drawSwipe(ctx,t,size,1-(now-t.time)/FRUIT_CONFIG.trailLife,reducedMotion.matches);
    for (const p of points) {
      ctx.save(); ctx.shadowColor = '#8de8e0'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#fff5bd'; ctx.beginPath(); ctx.arc(p.x*size,p.y*size,size*.012,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    for (const f of game.effects) drawBurst(ctx,f,size,juiceColors[f.type],reducedMotion.matches);
    if (celebration) drawCelebration(ctx,celebration.age/FEEDBACK_CONFIG.celebrationLife,w,h,reducedMotion.matches);
    const oldAutoClear = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(world,view); renderer.autoClear = oldAutoClear;
  }
  function pointerPosition(e) { const rect = viewport.getBoundingClientRect(), size = Math.min(rect.width,rect.height); return { x: (e.clientX-rect.left)/size, y: (e.clientY-rect.top)/size }; }
  viewport.addEventListener('pointerdown', e => { if (!enabled || !game.demo || e.target.closest('button')) return; pointerDown = true; pointer = pointerPosition(e); inputs.mouse.clear(); inputs.mouse.sample(pointer,pointer,performance.now()/1000,.5,true); viewport.setPointerCapture(e.pointerId); unlockAudio(); });
  viewport.addEventListener('pointermove', e => {
    if (!enabled || !game.demo) return;
    pointer = pointerPosition(e);
    if (!pointerDown || !['tutorial','playing'].includes(game.status)) return;
    const seg = inputs.mouse.sample(pointer,pointer,performance.now()/1000,.5,true);
    if (seg) pendingSegments.push(seg);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) viewport.addEventListener(type, () => { pointerDown = false; inputs.mouse.clear(); });
  document.addEventListener('visibilitychange', () => {
    invalidateInput(); syncMusic();
  });
  window.addEventListener('pagehide', () => { audio.stop(); audio.setMusicActive(false); });
  new ResizeObserver(() => { invalidateInput(); scale = null; calibration = []; boundsDirty = true; game.fruits = []; game.effects = []; }).observe(viewport);
  setInterval(() => {
    if (!enabled || !document.hidden || game.status !== 'playing') return;
    const now = performance.now() / 1000;
    game.update(lastNow === null ? 0 : now - lastNow, false);
    lastNow = now;
    syncMusic();
    paintUI(false);
  }, 250);
  return {
    invalidateInput,
    frame(nowMs) {
      const now = nowMs / 1000, dt = lastNow === null ? 0 : now-lastNow; lastNow = now;
      if (!enabled) return;
      const data = getPose(); const pose = data.pose;
      const size = Math.min(viewport.clientWidth,viewport.clientHeight);
      if (size <= 0) { game.update(dt,false); paintUI(false); return; }
      const available = side => {
        const indices = SCREEN_ARM_LANDMARKS[side];
        return pose && nowMs-data.time < 180 && indices.every(i => pose[i] && pose[i].visibility >= .6) && [11,12].every(i => pose[i]?.visibility >= .6) && ($('fruit-hands').value === 'both' || $('fruit-hands').value === side);
      };
      const ready = !document.querySelector('#experience-settings').open && (game.demo || Boolean(state.camera && (available('left') || available('right'))));
      if (!game.demo && ready && data.time !== lastPoseTime && !scale) {
        calibration.push(Math.hypot(pose[11].x-pose[12].x,pose[11].y-pose[12].y));
        if (calibration.length >= 10) scale = [...calibration].sort((a,b)=>a-b)[Math.floor(calibration.length/2)];
      }
      lastPoseTime = data.time;
      if (!['results','disposed'].includes(game.status)) game.career = state.career.name;
      if (!game.demo && state.camera) {
        document.querySelector('#tracking-label').textContent = ready ? '肩、肘、腕已就绪 · 腿部无需入镜' : '请让肩膀和至少一只手臂入镜';
      }
      const segments = []; points = [];
      const active = ready && ['playing','tutorial'].includes(game.status) && dt <= FRUIT_CONFIG.maxGap;
      if (!active) clearInput();
      if (game.demo) {
        if (pointer) points.push(pointer);
        if (active) segments.push(...pendingSegments);
        pendingSegments = [];
      } else {
        for (const side of ['left','right']) {
          const valid = ready && available(side);
          const p = limbs[side].wrist.getWorldPosition(new THREE.Vector3()).project(camera);
          const point = { x: (p.x+1)*viewport.clientWidth/2/size, y: (1-p.y)*viewport.clientHeight/2/size };
          if (valid) points.push(point);
          const wrist = SCREEN_ARM_LANDMARKS[side][2];
          const raw = valid ? { x: (pose[11].x+pose[12].x)/2-pose[wrist].x, y: pose[wrist].y-(pose[11].y+pose[12].y)/2 } : null;
          const seg = inputs[side].sample(point,raw,now,scale,active && valid);
          if (seg) segments.push({ ...seg, hand: side });
        }
      }
      // Conservative stage region around projected shoulders, not the webpage or video bounds.
      if (boundsDirty || ['calibrating','tutorial','countdown'].includes(game.status)) {
        const a = limbs.left.shoulder.getWorldPosition(new THREE.Vector3()).project(camera), b = limbs.right.shoulder.getWorldPosition(new THREE.Vector3()).project(camera);
        const cx = ((a.x+b.x)/2+1)*viewport.clientWidth/2/size, cy = (1-(a.y+b.y)/2)*viewport.clientHeight/2/size;
        const reach = Math.max(.15,Math.abs(a.x-b.x)*viewport.clientWidth/2/size*1.1);
        game.bounds = { left: Math.max(.12,cx-reach), right: Math.min(viewport.clientWidth/size-.12,cx+reach), top: Math.max(.24,cy-.05), bottom: Math.min(viewport.clientHeight/size-.12,cy+reach*.95) };
        boundsDirty = false;
      }
      const count = game.collected;
      const previousEffects = new Set(game.effects.map(effect => effect.id));
      game.update(dt,ready,segments, !game.demo && ready && handsRaised(pose));
      syncMusic();
      const running = ['playing','tutorial'].includes(game.status);
      if (running) {
        audio.swipe(now, segments);
        const hits = game.effects.filter(effect => !previousEffects.has(effect.id));
        if (hits.length) {
          const goal = count < FRUIT_CONFIG.target && game.collected >= FRUIT_CONFIG.target;
          cheer = { age: 0, text: game.status === 'tutorial' ? '切到了！就是这样挥挥手 ✨' : encouragement(game.collected,hits.length,goal) };
          if (goal) celebration = { age: 0 };
          lastFeedbackTime = game.time;
        }
        if (cheer && (cheer.age += dt) >= FEEDBACK_CONFIG.cheerLife) cheer = null;
        if (celebration && (celebration.age += dt) >= FEEDBACK_CONFIG.celebrationLife) celebration = null;
      } else if (game.status !== 'countdown') resetFeedback();
      cheerLabel.hidden = !cheer || !running;
      message.hidden = Boolean(cheer && running);
      if (cheer && running) {
        cheerLabel.textContent = cheer.text;
        const pop = reducedMotion.matches ? 1 : 1 + Math.sin(Math.min(1,cheer.age/.24)*Math.PI)*.12;
        cheerLabel.style.transform = `translateX(-50%) scale(${pop})`;
        cheerLabel.style.opacity = String(Math.min(1,(FEEDBACK_CONFIG.cheerLife-cheer.age)/.2));
      }
      const pulse = running && !reducedMotion.matches ? Math.max(0,1-(game.time-lastFeedbackTime)/.32) : 0;
      countCard.style.transform = `scale(${1 + Math.sin(pulse*Math.PI)*.12})`;
      if (!running) audio.stop();
      paintUI(ready);
      if (game.status === 'countdown') { message.textContent = ready ? String(Math.max(1,Math.ceil(game.countdown))) : '等待肩膀和手臂入镜'; }
      if (game.status === 'playing') message.textContent = game.collected >= FRUIT_CONFIG.target ? '合作目标达成！还可以继续收集 ✨' : '';
      visuals(dt,running ? segments : [],now);
    },
  };
}
