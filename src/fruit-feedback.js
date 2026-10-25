// Presentation only: effects never change input thresholds, collisions or scores.
export const FEEDBACK_CONFIG = Object.freeze({ swipeCooldown: .14, hitCooldown: .045, cheerLife: 1.1, celebrationLife: 1.8, maxVoices: 24 });
const encouragements = ['切得真准！', '又收集一个！', '漂亮的一挥！', '一起收集，真开心！'];
const soundFiles = {
  slash: new URL('./assets/audio/slash.mp3', import.meta.url).href,
  tear: new URL('./assets/audio/tear.mp3', import.meta.url).href,
  music: new URL('./assets/audio/fruit-music.mp3', import.meta.url).href,
};
export function encouragement(count, hits, goal) {
  if (goal) return '合作目标达成！大家一起真棒！';
  if (hits > 1) return `一挥收集 ${hits} 个！太棒啦！`;
  return encouragements[Math.max(0, count - 1) % encouragements.length];
}

export class FruitAudio {
  constructor() { this.context = null; this.voices = new Set(); this.samples = new Map(); this.samplesLoading = null; this.enabled = true; this.musicRequested = false; this.music = null; this.lastSwipe = -Infinity; this.lastHit = -Infinity; }
  unlock() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      this.context ??= new Audio();
      this.context.resume()?.then(() => this.syncMusic()).catch(() => {});
      this.loadSamples();
    } catch { /* Visual feedback stays available when audio is unavailable. */ }
  }
  loadSamples() {
    if (!this.context || this.samplesLoading) return this.samplesLoading;
    this.samplesLoading = Promise.all(Object.entries(soundFiles).map(async ([name, url]) => {
      if (this.samples.has(name)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Sound unavailable');
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        let peak = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          for (const value of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
        }
        if (!peak) return;
        const scale = Math.min(3, .9 / peak);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < data.length; i++) data[i] *= scale;
        }
        this.samples.set(name, buffer);
        if (name === 'music') this.syncMusic();
      } catch { /* Keep synthesis available; retry missing samples on the next unlock. */ }
    })).finally(() => { this.samplesLoading = null; });
    return this.samplesLoading;
  }
  getOutput() {
    if (!this.output) {
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 4;
      compressor.attack.value = .003; compressor.release.value = .12;
      compressor.connect(this.context.destination); this.output = compressor;
    }
    return this.output;
  }
  playSample(name, { volume = .25, rate = 1, offset = 0, duration = .25 } = {}) {
    const ctx = this.context, buffer = this.samples.get(name);
    if (!buffer) return false;
    if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices.size >= FEEDBACK_CONFIG.maxVoices) return true;
    // Limit recorded transients separately so fast swipes cannot build a loud tail.
    if ([...this.voices].filter(voice => voice.kind === name).length >= 2) return true;
    const length = Math.min(duration, (buffer.duration - offset) / rate);
    if (length <= .012) return false;
    const start = ctx.currentTime, source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.playbackRate.setValueAtTime(rate, start);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .003);
    gain.gain.setValueAtTime(volume, start + length - .012); gain.gain.linearRampToValueAtTime(0, start + length);
    source.connect(gain); gain.connect(this.getOutput());
    const voice = { source, gain, kind: name }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(start, offset, length * rate); source.stop(start + length + .005);
    return true;
  }
  setMusicActive(active) {
    this.musicRequested = active;
    if (active) this.unlock();
    this.syncMusic();
  }
  syncMusic() {
    if (!this.musicRequested || !this.enabled) { this.stopMusic(); return; }
    const ctx = this.context, buffer = this.samples.get('music');
    if (this.music || !buffer || !ctx || ctx.state !== 'running') return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), start = ctx.currentTime;
    source.buffer = buffer; source.loop = true;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.12, start + .5);
    source.connect(gain); gain.connect(this.getOutput());
    const music = { source, gain }; this.music = music;
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.music === music) this.music = null;
    };
    source.start(start);
  }
  stopMusic(immediate = false) {
    const music = this.music;
    if (!music) return;
    this.music = null;
    const now = this.context.currentTime;
    music.gain.gain.cancelScheduledValues(now);
    music.gain.gain.setValueAtTime(music.gain.gain.value, now);
    music.gain.gain.linearRampToValueAtTime(0, now + (immediate ? 0 : .2));
    music.source.stop(now + (immediate ? 0 : .2));
  }
  setEnabled(value) {
    this.enabled = value;
    if (!value) { this.stop(); this.stopMusic(true); }
    else { this.unlock(); this.syncMusic(); }
  }
  stop() {
    for (const voice of this.voices) { try { voice.source.stop(); } catch { /* Already ended. */ } voice.source.disconnect(); voice.gain.disconnect(); voice.filter?.disconnect(); }
    this.voices.clear(); this.lastSwipe = -Infinity; this.lastHit = -Infinity;
  }
  play({ frequency = 660, endFrequency = frequency, duration = .16, volume = .035, delay = 0, noise = false, type = 'sine', filterStart = 1800, filterEnd = 500, filterQ = .7 }) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices.size >= FEEDBACK_CONFIG.maxVoices) return;
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    const gain = ctx.createGain(), start = ctx.currentTime + delay;
    let filter;
    if (noise) {
      if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
        this.noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .5), ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      source.buffer = this.noiseBuffer;
      filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = filterQ;
      filter.frequency.setValueAtTime(filterStart, start); filter.frequency.exponentialRampToValueAtTime(filterEnd, start + duration);
      source.connect(filter); filter.connect(gain);
    } else {
      source.type = type; source.frequency.setValueAtTime(frequency, start);
      source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(.001, start); gain.gain.linearRampToValueAtTime(volume, start + .004);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    gain.connect(this.getOutput());
    const voice = { source, gain, filter }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); filter?.disconnect(); this.voices.delete(voice); };
    source.start(start); source.stop(start + duration + .01);
  }
  swipe(now) {
    if (now - this.lastSwipe < FEEDBACK_CONFIG.swipeCooldown) return;
    this.lastSwipe = now;
    if (!this.playSample('slash', { volume: .22, rate: 1.1, offset: .055, duration: .24 })) {
      this.play({ noise: true, duration: .11, volume: .075, filterStart: 3400, filterEnd: 850 });
    }
  }
  hit(now, count, goal = false, fruit = 'apple') {
    if (now - this.lastHit < FEEDBACK_CONFIG.hitCooldown) return;
    this.lastHit = now;
    const pitch = { apple: 1.1, orange: 1, watermelon: .7, strawberry: 1.35 }[fruit] || 1;
    // Crack -> wet splat -> small droplets, all scheduled from this hit's audio time.
    const recorded = this.playSample('tear', { volume: .28, rate: pitch, offset: .04, duration: .24 / pitch });
    if (!recorded) this.play({ noise: true, duration: .065, volume: .15, filterStart: 3900 * pitch, filterEnd: 1300 * pitch });
    this.play({ noise: true, duration: recorded ? .16 : .23, volume: recorded ? .1 : .19, delay: .012, filterStart: 1000 * pitch, filterEnd: 180 * pitch, filterQ: 1.6 });
    this.play({ frequency: 260 * pitch, endFrequency: 65 * pitch, duration: .12, volume: recorded ? .06 : .095 });
    for (let i = 0; i < 3; i++) this.play({ frequency: (720 + i * 170) * pitch, endFrequency: (260 + i * 60) * pitch, duration: .055, volume: .026, delay: .06 + i * .038 });
    const notes = goal ? [523.25, 659.25, 783.99, 1046.5] : count > 1 ? [783.99, 1046.5] : [];
    notes.forEach((frequency, i) => this.play({ frequency, duration: .18, volume: .028, delay: .1 + i * .055, type: 'triangle' }));
  }
}

export function fruitHalfPose(fruit, side, reducedMotion = false) {
  const t = fruit.age, angle = Math.atan2(fruit.dy, fruit.dx) + Math.PI / 2;
  const spread = fruit.radius * .22 + (reducedMotion ? .07 : .5) * t;
  return {
    x: fruit.x + side * Math.cos(angle) * spread,
    y: fruit.y + side * Math.sin(angle) * spread + (reducedMotion ? .05 : .5) * t * t,
    rotation: reducedMotion ? side * .12 : side * (.16 + t * 2.5),
    scale: 1 - Math.max(0,t - .55) * .7,
  };
}

function star(ctx, x, y, radius, angle) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = angle + i * Math.PI / 4, r = i % 2 ? radius * .28 : radius;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

export function drawSwipe(ctx, trail, size, opacity, reducedMotion) {
  const { a, b } = trail;
  const gradient = ctx.createLinearGradient(a.x * size, a.y * size, b.x * size + .01, b.y * size + .01);
  gradient.addColorStop(0, '#72caff00'); gradient.addColorStop(.45, '#85e8f5'); gradient.addColorStop(1, '#fff4b8');
  ctx.save(); ctx.globalAlpha = opacity; ctx.lineCap = 'round'; ctx.strokeStyle = gradient;
  ctx.shadowColor = '#77e7ed'; ctx.shadowBlur = reducedMotion ? 0 : 16;
  for (const [width, alpha] of [[.042, .22], [.021, .7], [.007, 1]]) {
    ctx.lineWidth = size * width; ctx.globalAlpha = opacity * alpha;
    ctx.beginPath(); ctx.moveTo(a.x * size, a.y * size); ctx.lineTo(b.x * size, b.y * size); ctx.stroke();
  }
  ctx.globalAlpha = opacity; ctx.fillStyle = '#fffbe5';
  star(ctx, b.x * size, b.y * size, size * .014, .2);
  ctx.restore();
}

export function drawBurst(ctx, fruit, size, color, reducedMotion) {
  const t = fruit.age, life = .95, fade = Math.max(0, 1 - t / life);
  const x = fruit.x * size, y = fruit.y * size, radius = fruit.radius * size;
  const angle = Math.atan2(fruit.dy, fruit.dx);
  ctx.save(); ctx.globalAlpha = fade;
  // A persistent colored splat makes the hit readable after the blade has passed.
  ctx.fillStyle = color; ctx.globalAlpha = fade * .3;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const r = radius * (1.05 + .32 * Math.sin(i * 2.7 + fruit.x * 11)) * (1 + Math.min(t,.25));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * .75;
    if (!i) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = fade;
  const halo = ctx.createRadialGradient(x,y,0,x,y,radius * 2.3);
  halo.addColorStop(0, `${color}60`); halo.addColorStop(1, `${color}00`);
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x,y,radius * 2.3,0,Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1,size * .005);
  ctx.globalAlpha = fade * .65; ctx.beginPath(); ctx.arc(x,y,radius * (.5 + t * (reducedMotion ? .6 : 3)),0,Math.PI * 2); ctx.stroke();
  if (t < .18) {
    ctx.globalAlpha = 1-t/.18; ctx.strokeStyle = color; ctx.lineWidth = size * .032;
    ctx.lineCap = 'round'; ctx.shadowColor = '#fff6ce'; ctx.shadowBlur = reducedMotion ? 0 : 18;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(angle)*radius*2,y - Math.sin(angle)*radius*2);
    ctx.lineTo(x + Math.cos(angle)*radius*2,y + Math.sin(angle)*radius*2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = size * .011; ctx.stroke(); ctx.shadowBlur = 0;
  }
  const total = reducedMotion ? 6 : 26;
  for (let i = 0; i < total; i++) {
    const a = i * 2.39996 + angle, speed = .22 + (i % 5) * .07;
    const distance = reducedMotion ? radius * .75 : radius * .35 + t * size * speed;
    const px = x + Math.cos(a) * distance, py = y + Math.sin(a) * distance + (reducedMotion ? 0 : t*t*size*.16);
    const r = size * (.007 + i % 3 * .003) * (1-t*.65);
    ctx.globalAlpha = fade; ctx.fillStyle = i % 5 === 0 ? '#fff3bd' : color;
    ctx.beginPath(); ctx.ellipse(px,py,r * (i % 2 ? 1.8 : 1),r*.65,a,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = fade * .65;
    ctx.beginPath(); ctx.arc(px-r*.2,py-r*.2,r*.25,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = fade; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.max(20,size*.045)}px system-ui`;
  ctx.lineWidth = 4; ctx.strokeStyle = '#fffdf2'; ctx.fillStyle = '#755027';
  const labelY = y - radius * 1.5 - (reducedMotion ? 0 : t * size * .1);
  const label = fruit.practice ? '切开！' : '+1';
  ctx.strokeText(label,x,labelY); ctx.fillText(label,x,labelY);
  ctx.restore();
}

export function drawCelebration(ctx, progress, width, height, reducedMotion) {
  if (reducedMotion) return;
  ctx.save(); ctx.globalAlpha = Math.sin(progress * Math.PI) * .85;
  const palette = ['#f5c763','#89d8c2','#a8a0ed','#f39eaa'];
  for (let i=0; i<28; i++) {
    const x = width * ((i * .618034) % 1), y = height * (-.04 + progress * (.35 + i % 4 * .12));
    ctx.fillStyle = palette[i%palette.length];
    star(ctx,x + Math.sin(i+progress*4)*12,y,3 + i%3,progress*4+i);
  }
  ctx.restore();
}
