import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraCaptureConstraints, useWidestCamera } from '../src/camera-capture.js';

test('capture prefers native format without imposing an aspect ratio', () => {
  const constraints = cameraCaptureConstraints();
  assert.equal(constraints.audio, false);
  assert.equal(constraints.video.resizeMode.ideal, 'none');
  assert.equal(constraints.video.aspectRatio, undefined);
  assert.equal(constraints.video.facingMode.ideal, 'user');
});

test('uses device minimum zoom and preserves capture constraints', async () => {
  let applied;
  const message = await useWidestCamera({
    getCapabilities: () => ({ zoom: { min: 0.5, max: 4 } }),
    getConstraints: () => ({ deviceId: { exact: 'camera' }, resizeMode: { ideal: 'none' } }),
    applyConstraints: async constraints => { applied = constraints; },
    getSettings: () => ({ zoom: 0.5 }),
  });
  assert.deepEqual(applied.advanced, [{ zoom: 0.5 }]);
  assert.equal(applied.deviceId.exact, 'camera');
  assert.equal(applied.resizeMode.ideal, 'none');
  assert.match(message, /已使用设备最低变焦/);
});

test('unsupported devices retain ordinary capture', async () => {
  for (const track of [{}, { getCapabilities: () => ({ zoom: { min: 1, max: 1 } }) }]) {
    assert.match(await useWidestCamera(track), /未开放镜头变焦/);
  }
});

test('rejected or ignored zoom never claims success or breaks capture', async () => {
  const track = {
    getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
    applyConstraints: async () => {},
    getSettings: () => ({ zoom: 2 }),
  };
  assert.match(await useWidestCamera(track), /未确认/);
  track.applyConstraints = async () => { throw new Error('Unsupported control'); };
  assert.match(await useWidestCamera(track), /不可用/);
});
