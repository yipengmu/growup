import test from 'node:test';
import assert from 'node:assert/strict';
import { FruitGame, HandInput, CooperationBasket, sweptHit, seededRandom, handsRaised, FRUIT_TYPES } from '../src/fruit-game.js';
const segment = { a: { x: .1,y: .5 }, b: { x: .9,y: .5 } };
function playing(demo = true) {
  const g = new FruitGame(); g.prepare({ duration: 30, demo }); g.status = 'playing'; g.spawnIn = 100;
  g.fruits = [{ id: 'test', type: 'apple', x: .5,y: .5, radius: .065, age: 1, vx: 0,vy: .2,status: 'falling' }]; return g;
}
test('relative swept collision catches crossing paths between low-rate frames', () => {
  assert.ok(sweptHit(segment.a,segment.b,{x:.5,y:.6},{x:.5,y:.4},.07));
  assert.equal(sweptHit(segment.a,segment.b,{x:.5,y:.8},{x:.5,y:.7},.07),false);
});
test('stationary, jitter, invalid, discontinuous and reappearing hands cannot cut', () => {
  const h = new HandInput(); const p = {x: .5,y:.5};
  for (let i=0;i<10;i++) assert.equal(h.sample(p,{x:.5+(i%2)*.002,y:.5},i*.02,.3),null);
  h.clear(); assert.equal(h.sample(p,p,1,.3),null);
  assert.ok(h.sample({x:.8,y:.5},{x:.54,y:.5},1.1,.3));
  assert.equal(h.sample({x:.8,y:.5},{x:.54,y:.5},1.12,.3),null);
  assert.equal(h.sample(p,p,2,.3),null);
  assert.equal(h.sample(p,{x:2,y:2},2.05,.3),null);
  h.sample(null,null,2.06,.3,false);
  assert.equal(h.sample(p,p,2.07,.3),null);
});
test('dual hand hit collects each fruit once, one swipe collects multiple fruit', () => {
  const g = playing(); g.fruits.push({...g.fruits[0],id:'test2',x:.7});
  g.update(.1,true,[segment,segment]); assert.equal(g.collected,2); assert.equal(g.fruits.length,0); assert.equal(g.effects.length,2); assert.equal(g.counts.apple,2);
  g.update(.1,true,[segment]); assert.equal(g.collected,2);
});
test('fruit falling onto a resting hand and missed fruit do not score or penalize', () => {
  const g = playing(); g.update(.1,true,[]); assert.equal(g.collected,0);
  for (let i=0;i<50;i++) g.update(.1,true,[]);
  assert.equal(g.fruits.length,0); assert.equal(g.collected,0); assert.equal(g.status,'playing');
});
test('lowered or untracked hands do not interrupt falling fruit, spawning or elapsed time', () => {
  const g = playing(false); g.spawnIn=.1;
  g.update(.1,false,[segment]);
  assert.equal(g.status,'playing'); assert.equal(g.collected,0);
  assert.ok(g.fruits[0].y>.5); assert.equal(g.fruits.length,2);
  for (let i=0;i<50;i++) g.update(.1,false);
  assert.equal(g.status,'playing'); assert.ok(g.remaining<25); assert.ok(g.fruits.length>0);
  g.update(.1,true,[{a:{x:0,y:0},b:{x:0,y:0}}],false);
  assert.equal(g.status,'playing');
});
test('background time counts, stale trajectories never score, and no fruit backlog is replayed', () => {
  const g=playing(false); g.collected=4;
  g.update(10,true,[segment]);
  assert.equal(g.status,'playing'); assert.equal(g.remaining,20); assert.equal(g.collected,4);
  assert.equal(g.fruits.length,0); assert.equal(g.effects.length,0);
  g.update(.1,false); assert.equal(g.fruits.length,0);
  for(let i=0;i<4;i++) g.update(.1,false);
  assert.equal(g.fruits.length,1);
  g.update(25,false); assert.equal(g.status,'results'); assert.equal(g.remaining,0); assert.equal(g.collected,4);
});
test('calibration, practice and countdown do not consume round time', () => {
  const g = new FruitGame(); g.prepare(); g.tutorial(); assert.equal(g.status,'calibrating');
  for (let i=0;i<11;i++) g.update(.1,true);
  g.tutorial(); assert.equal(g.status,'tutorial'); g.update(.1,true); assert.equal(g.remaining,60);
  g.start(); assert.equal(g.status,'countdown');
  g.update(.1,false); assert.equal(g.countdown,3);
  while (g.status === 'countdown') g.update(.1,true);
  assert.equal(g.status,'playing'); assert.equal(g.remaining,60);
});
test('round expiry stops hits and basket submissions are idempotent and exclude demos', () => {
  const g = playing(false); g.collected=5; g.remaining=.05; g.update(.1,true,[segment]);
  assert.equal(g.status,'results'); assert.equal(g.collected,5); assert.equal(g.fruits.length,0);
  const basket = new CooperationBasket(); assert.ok(basket.add(g)); assert.equal(basket.add(g),false); assert.equal(basket.total,5);
  g.prepare({demo:true}); g.collected=10; g.status='results'; assert.equal(basket.add(g),false); assert.equal(basket.total,5);
  basket.clear(); assert.equal(basket.total,0);
});
test('repeat rounds clear entities and seeded fruit schedules are reproducible', () => {
  const a = new FruitGame({seed:123}), b = new FruitGame({seed:123});
  a.prepare(); b.prepare(); a.spawn(); b.spawn(); assert.equal(a.fruits[0].type,b.fruits[0].type);
  const rng1=seededRandom(1),rng2=seededRandom(1); assert.deepEqual(Array.from({length:10},rng1),Array.from({length:10},rng2));
  for (let i=0;i<10;i++) { a.prepare(); assert.equal(a.fruits.length,0); assert.equal(a.effects.length,0); assert.equal(a.collected,0); a.spawn(); a.dispose(); assert.equal(a.fruits.length,0); }
});
test('practice collects no formal fruit and first formal fruit starts in the middle', () => {
  const g = playing(); g.status='tutorial'; g.update(.1,true,[segment]);
  assert.equal(g.tutorialDone,true); assert.equal(g.collected,0); assert.equal(g.counts.apple,0);
  g.first=false; g.stable=1; g.start();
  while (g.status==='countdown') g.update(.1,true);
  for (let i=0;i<4;i++) g.update(.1,true);
  assert.equal(g.fruits.length,1);
  assert.ok(Math.abs(g.fruits[0].x-(g.bounds.left+g.bounds.right)/2)<.01);
});
test('camera start requires raised hands once and then keeps running with hands lowered', () => {
  const g = new FruitGame(); g.prepare({ demo:false, autoStart:true });
  for (let i=0;i<8;i++) g.update(.1,false);
  assert.equal(g.status,'calibrating'); assert.equal(g.remaining,60);
  g.update(.016,true);
  assert.equal(g.status,'calibrating');
  g.update(.016,false,[],true);
  assert.equal(g.status,'calibrating');
  g.update(.016,true,[],true);
  assert.equal(g.fruits.length,1);
  assert.equal(g.status,'playing'); assert.equal(g.remaining,60); assert.equal(g.collected,0);
  for (let i=0;i<20;i++) g.update(.1,false);
  assert.equal(g.status,'playing'); assert.ok(g.remaining<59);
  g.update(.016,true,[],false); assert.equal(g.status,'playing');

});

test('both visible wrists must be above their shoulders to start', () => {
  const pose = Array.from({length:33}, () => ({x:.5,y:.6,visibility:1}));
  pose[11] = {x:.35,y:.5,visibility:1}; pose[12] = {x:.65,y:.5,visibility:1};
  assert.equal(handsRaised(pose),false);
  pose[15].y=.4; assert.equal(handsRaised(pose),false);
  pose[16].y=.4; assert.equal(handsRaised(pose),true);
  pose[16].y=.49; assert.equal(handsRaised(pose),false);
  pose[16].y=.4; pose[14].visibility=.4; assert.equal(handsRaised(pose),false);
  assert.equal(handsRaised(null),false);
  pose[14].visibility=1; pose[15].y=NaN; assert.equal(handsRaised(pose),false);
});
test('every four spawns include all four fruits, with reproducible order', () => {
  const g = new FruitGame(); g.prepare();
  for(let round=0;round<3;round++) {
    const types=[];
    for(let i=0;i<4;i++) { g.spawn(); types.push(g.fruits.at(-1).type); }
    assert.deepEqual([...types].sort(),[...FRUIT_TYPES].sort());
  }
});

