import test from 'node:test';
import assert from 'node:assert/strict';
import { FruitAudio, FEEDBACK_CONFIG, fruitHalfPose } from '../src/fruit-feedback.js';

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
test('rapid swipes are throttled; muting stops scheduled voices and blocks further sounds', () => {
  const sound = new FruitAudio(); sound.context = fakeContext();
  sound.swipe(1); const voices = [...sound.voices]; assert.equal(voices.length,1);
  sound.swipe(1.02); assert.equal(sound.voices.size,1);
  sound.hit(1,1); assert.ok(sound.voices.size>1);
  const all = [...sound.voices]; sound.setEnabled(false);
  assert.equal(sound.voices.size,0); assert.ok(all.every(v => v.source.stopped && v.source.disconnected && v.gain.disconnected));
  sound.hit(2,3); sound.swipe(2); assert.equal(sound.voices.size,0);
});

test('recorded sounds replace the synthetic slash and crack, with bounded overlap and mute cleanup', () => {
  const sound = new FruitAudio(); sound.context = fakeContext();
  const slash = { duration: .55 }, tear = { duration: 1.05 };
  sound.samples.set('slash', slash); sound.samples.set('tear', tear);
  const calls = []; sound.play = options => calls.push(options);
  sound.swipe(1); sound.swipe(1.2); sound.swipe(1.4);
  assert.equal(sound.voices.size, 2);
  assert.equal(calls.length, 0);
  assert.ok([...sound.voices].every(v => v.source.buffer === slash));
  sound.hit(2, 1, false, 'watermelon');
  const hit = [...sound.voices].find(v => v.kind === 'tear');
  assert.equal(hit.source.buffer, tear);
  assert.equal(hit.source.started[0], sound.context.currentTime);
  assert.equal(hit.source.started[1], .04);
  assert.ok(Math.abs(hit.source.started[2] - .24) < .0001);
  assert.equal(calls.filter(c => c.noise).length, 1);
  assert.ok(calls.some(c => c.filterQ === 1.6));
  assert.equal(sound.output.threshold.value, -12);
  const voices = [...sound.voices]; sound.setEnabled(false);
  assert.equal(sound.voices.size, 0);
  assert.ok(voices.every(v => v.source.stopped && v.source.disconnected));
  sound.swipe(3); sound.hit(3, 1); assert.equal(sound.voices.size, 0);
});

test('sample loading caches decoded files and retries failures without blocking synthesis', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0, failTear = true;
  globalThis.fetch = async url => {
    requests++;
    return { ok: !(url.endsWith('/tear.mp3') && failTear), arrayBuffer: async () => new ArrayBuffer(1) };
  };
  try {
    const sound = new FruitAudio(); sound.context = fakeContext();
    sound.context.decodeAudioData = async () => {
      const data = new Float32Array([.2, -.6]);
      return { duration: 1, numberOfChannels: 1, getChannelData: () => data };
    };
    await sound.loadSamples();
    assert.equal(requests, 3); assert.equal(sound.samples.size, 2);
    assert.ok(Math.abs(sound.samples.get('slash').getChannelData(0)[1] + .9) < .001);
    sound.hit(1, 1); assert.ok(sound.voices.size > 0);
    failTear = false; await sound.loadSamples();
    assert.equal(requests, 4); assert.equal(sound.samples.size, 3);
    await sound.loadSamples(); assert.equal(requests, 4);
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

test('a hit layers a crack, wet splat and droplets; fruit types vary pitch', () => {
  const sound=new FruitAudio(), calls=[];
  sound.play=options=>calls.push(options);
  sound.hit(1,1,false,'watermelon');
  assert.equal(calls.filter(c=>c.noise).length,2);
  assert.ok(calls.some(c=>c.filterQ===1.6));
  const low=calls.find(c=>!c.noise).frequency;
  calls.length=0; sound.hit(2,1,false,'strawberry');
  assert.ok(calls.find(c=>!c.noise).frequency>low);
  calls.length=0; sound.hit(2.01,1); assert.equal(calls.length,0);
  sound.hit(3,3,true); assert.ok(calls.some(c=>c.type==='triangle'));
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
  sound.swipe(1); sound.stop();
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
