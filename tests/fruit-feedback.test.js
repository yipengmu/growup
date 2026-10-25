import test from 'node:test';
import assert from 'node:assert/strict';
import { FruitAudio, StrokeSoundGate, FEEDBACK_CONFIG, fruitHalfPose } from '../src/fruit-feedback.js';

function fakeContext() {
  const nodes = [];
  const param = () => ({ value: .12, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => { const n = { connect() {}, disconnect() { this.disconnected = true; }, start(...args) { this.started = args; }, stop() { this.stopped = true; }, frequency: param(), playbackRate: param(), gain: param(), Q: {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; nodes.push(n); return n; };
  return { state: 'running', currentTime: 0, sampleRate: 100, destination: {}, nodes,
    createOscillator: node, createBufferSource: node, createGain: node, createBiquadFilter: node,
    createDynamicsCompressor: node,
    createBuffer: () => ({ sampleRate:100, getChannelData: () => new Float32Array(20) }),
  };
}
const stroke = (hand = 'left', direction = 1) => ({ hand, a: { x: 0, y: 0 }, b: { x: direction * .1, y: 0 } });

test('one continuous action sounds once, rearming only after a reversal or pause', () => {
  const gate = new StrokeSoundGate();
  let sounds = 0;
  for (let i = 0; i < 60; i++) if (gate.update([stroke()], 1 + i / 60)) sounds++;
  assert.equal(sounds, 1);
  assert.ok(gate.update([stroke('left', -1)], 2));
  assert.equal(gate.update([stroke('left', -1)], 2.05), false);
  assert.equal(gate.update([], 2.1), false);
  assert.ok(gate.update([stroke('left', -1)], 2.4));
  gate.clear(); assert.ok(gate.update([stroke()], 3));
});

test('two hands in the same action frame produce one sound and no stationary sounds', () => {
  const gate = new StrokeSoundGate();
  assert.equal(gate.update([], 0), false);
  assert.equal(gate.update([{ a: {x: 0, y: 0}, b: {x: 0, y: 0} }], .1), false);
  assert.ok(gate.update([stroke('left'), stroke('right', -1)], 1));
  for (let i = 1; i < 20; i++) assert.equal(gate.update([stroke('left'), stroke('right', -1)], 1 + i / 60), false);
});

test('each action plays a single short cut without extra hit layers; mute stops it', () => {
  const sound = new FruitAudio(); sound.context = fakeContext();
  const cut = { duration: .13 }; sound.samples.set('cut', cut);
  const calls = []; sound.play = options => calls.push(options);
  for (let i = 0; i < 20; i++) sound.swipe(1 + i / 60, [stroke()]);
  assert.equal(sound.voices.size, 1); assert.equal(calls.length, 0);
  const voice = [...sound.voices][0];
  assert.equal(voice.source.buffer, cut);
  assert.deepEqual(voice.source.started, [0, 0, .13]);
  sound.setEnabled(false);
  assert.equal(sound.voices.size, 0); assert.ok(voice.source.stopped && voice.source.disconnected);
  sound.swipe(2, [stroke()]); assert.equal(sound.voices.size, 0);
});

test('sample loading caches decoded files and retries failures without blocking synthesis', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0, failCut = true;
  globalThis.fetch = async url => {
    requests++;
    return { ok: !(url.endsWith('/cut.mp3') && failCut), arrayBuffer: async () => new ArrayBuffer(1) };
  };
  try {
    const sound = new FruitAudio(); sound.context = fakeContext();
    sound.context.decodeAudioData = async () => {
      const data = new Float32Array([.2, -.6]);
      return { duration: 1, numberOfChannels: 1, getChannelData: () => data };
    };
    await sound.loadSamples();
    assert.equal(requests, 2); assert.equal(sound.samples.size, 1);
    assert.ok(Math.abs(sound.samples.get('music').getChannelData(0)[1] + .9) < .001);
    sound.swipe(1, [stroke()]); assert.ok(sound.voices.size > 0);
    failCut = false; await sound.loadSamples();
    assert.equal(requests, 3); assert.equal(sound.samples.size, 2);
    await sound.loadSamples(); assert.equal(requests, 3);
    sound.stop();
  } finally { globalThis.fetch = originalFetch; }
});
test('sound concurrency is bounded and ended voices release their resources', () => {
  const sound = new FruitAudio(); sound.context = fakeContext();
  for (let i=0;i<100;i++) sound.play({});
  assert.equal(sound.voices.size,FEEDBACK_CONFIG.maxVoices);
  const voice = [...sound.voices][0]; voice.source.onended();
  assert.equal(sound.voices.size,FEEDBACK_CONFIG.maxVoices-1);
  assert.ok(voice.source.disconnected && voice.gain.disconnected);
  sound.stop(); assert.equal(sound.voices.size,0);
});

test('cut halves separate perpendicular to a swipe with exposed initial gap', () => {
  const f={x:.5,y:.5,radius:.065,dx:1,dy:0,age:0};
  const left=fruitHalfPose(f,-1), right=fruitHalfPose(f,1);
  assert.ok(left.y<right.y); assert.equal(left.x,right.x);
  f.age=.3;
  const a=fruitHalfPose(f,-1), b=fruitHalfPose(f,1);
  assert.ok(b.y-a.y>right.y-left.y); assert.ok(a.rotation<0); assert.ok(b.rotation>0);
  const reduced=fruitHalfPose(f,1,true);
  assert.ok(Math.abs(reduced.y-f.y)<Math.abs(b.y-f.y));
});


test('background music loops independently of effects and follows mode and mute state', () => {
  const sound = new FruitAudio(); sound.context = fakeContext(); sound.unlock = () => {};
  sound.samples.set('music', { duration: 30 });
  sound.setMusicActive(true);
  const first = sound.music;
  assert.ok(first.source.loop); assert.equal(first.source.buffer.duration, 30);
  assert.deepEqual(first.source.started, [0]);
  sound.setMusicActive(true); assert.equal(sound.music, first);
  sound.swipe(1, [stroke()]); sound.stop();
  assert.equal(sound.music, first); assert.ok(!first.source.stopped);
  sound.setEnabled(false); assert.equal(sound.music, null); assert.ok(first.source.stopped);
  sound.setEnabled(true); const resumed = sound.music; assert.ok(resumed);
  first.source.onended(); assert.equal(sound.music, resumed);
  sound.setMusicActive(false); assert.equal(sound.music, null); assert.ok(resumed.source.stopped);
  sound.setEnabled(true); assert.equal(sound.music, null);
});

test('late music decoding never starts playback after leaving the mode', () => {
  const sound = new FruitAudio(); sound.context = fakeContext(); sound.unlock = () => {};
  sound.setMusicActive(true); assert.equal(sound.music, null);
  sound.setMusicActive(false);
  sound.samples.set('music', { duration: 30 }); sound.syncMusic();
  assert.equal(sound.music, null);
  sound.setMusicActive(true); assert.ok(sound.music);
  sound.setMusicActive(false);
});
