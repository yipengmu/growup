import test from 'node:test';
import assert from 'node:assert/strict';
import { FruitAudio, FEEDBACK_CONFIG, fruitHalfPose } from '../src/fruit-feedback.js';

function fakeContext() {
  const nodes = [];
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => { const n = { connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop() { this.stopped = true; }, frequency: param(), gain: param(), Q: {} }; nodes.push(n); return n; };
  return { state: 'running', currentTime: 0, sampleRate: 100, destination: {}, nodes,
    createOscillator: node, createBufferSource: node, createGain: node, createBiquadFilter: node,
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
