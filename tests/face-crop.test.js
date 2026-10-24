import test from 'node:test';
import assert from 'node:assert/strict';
import { faceCrop } from '../src/face-crop.js';

function facePoints() {
  const points = Array.from({length:33}, () => ({x:.5,y:.5,visibility:1}));
  points[2].x = .46; points[5].x = .54;
  points[7].x = .4; points[8].x = .6;
  return points;
}

test('frontal face crop contains the nose and remains inside the source frame', () => {
  const crop = faceCrop(facePoints(),1280,720);
  assert.ok(crop.x <= 640 && crop.x + crop.width >= 640);
  assert.ok(crop.y <= 360 && crop.y + crop.height >= 360);
  assert.ok(crop.x >= 0 && crop.y >= 0);
  assert.ok(crop.x + crop.width <= 1280);
  assert.ok(crop.y + crop.height <= 720);
});

test('missing, occluded, or very small face detections do not replace the avatar', () => {
  assert.equal(faceCrop(undefined,1280,720),null);
  const points = facePoints(); points[7].visibility = .1;
  assert.equal(faceCrop(points,1280,720),null);
  points[7].visibility = 1; points[2].x = points[5].x;
  assert.equal(faceCrop(points,1280,720),null);
});

test('a face near the image boundary produces a bounded crop', () => {
  const points = facePoints();
  points.forEach((point) => { point.x -= .4; point.y -= .4; });
  const crop = faceCrop(points,1280,720);
  assert.equal(crop.x,0); assert.equal(crop.y,0);
  assert.ok(crop.width > 0 && crop.height > 0);
});
