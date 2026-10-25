import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { solvePoseRig, mirrorPoseLandmarks, SCREEN_ARM_LANDMARKS } from '../src/pose-rig.js';
import { fitDistance, portraitPreviewWidth, compactPreviewWidth } from '../src/viewport.js';

function standingPose() {
  const points = Array.from({length:33}, () => ({x:0,y:0,z:0,visibility:0}));
  for (const [index,x,y,z] of [[11,.2,-.5,0],[12,-.2,-.5,0],[13,.25,-.2,0],[14,-.25,-.2,0],[15,.25,.1,0],[16,-.25,.1,0],[23,.15,0,0],[24,-.15,0,0],[25,.15,.45,0],[26,-.15,.45,0],[27,.15,.9,0],[28,-.15,.9,0],[29,.15,.9,.03],[30,-.15,.9,.03],[31,.15,.9,-.12],[32,-.15,.9,-.12]]) points[index] = {x,y,z,visibility:1};
  return points;
}

test('mirrored tracking raises the arm on the same screen side as the camera preview', () => {
  for (const [side, shoulder, elbow, wrist, sign] of [['left',11,13,15,1], ['right',12,14,16,-1]]) {
    const points = standingPose();
    points[elbow] = { ...points[elbow], x: sign * .5, y: -.65 };
    points[wrist] = { ...points[wrist], x: sign * .75, y: -.8 };
    const original = structuredClone(points);
    const rig = solvePoseRig(mirrorPoseLandmarks(points));
    const arm = rig[`${side}Arm`], other = rig[`${side === 'left' ? 'right' : 'left'}Arm`];
    const upperDirection = new Vector3(0,-1,0).applyQuaternion(arm.upper).applyQuaternion(rig.body);
    const otherDirection = new Vector3(0,-1,0).applyQuaternion(other.upper).applyQuaternion(rig.body);
    assert.ok(upperDirection.y > .4);
    assert.ok(upperDirection.x * sign < -.5);
    assert.ok(otherDirection.y < -.9);
    assert.equal(SCREEN_ARM_LANDMARKS[side][0], shoulder);
    assert.equal(SCREEN_ARM_LANDMARKS[side][2], wrist);
    assert.deepEqual(points, original, 'tracking data must remain unchanged for the camera overlay');
  }
});

test('mirroring reverses lean and turn while preserving a stable standing pose', () => {
  const points = standingPose(); points[11].y -= .08; points[12].y += .08;
  const original = solvePoseRig(points), mirrored = solvePoseRig(mirrorPoseLandmarks(points));
  assert.ok(Math.abs(mirrored.tilt + original.tilt) < .001);
  const turned = standingPose(), rotation = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), .6);
  for (const p of turned) {
    const v = new Vector3(p.x,-p.y,-p.z).applyQuaternion(rotation);
    p.x = v.x; p.y = -v.y; p.z = -v.z;
  }
  const rig = solvePoseRig(mirrorPoseLandmarks(turned));
  assert.ok(Math.abs(rig.yaw + .6) < .001);
  assert.ok(rig.leftLeg.upper.angleTo(new Quaternion()) < .001);
});

test('mirroring keeps leg visibility and image-space fallback on the correct screen side', () => {
  const points = standingPose(); points[26].visibility = .1;
  const rig = solvePoseRig(mirrorPoseLandmarks(points));
  assert.equal(rig.rightLeg, null); assert.ok(rig.leftLeg);
  const mirrored = mirrorPoseLandmarks(points);
  const direction = mirrored[13].x - mirrored[11].x;
  assert.ok(direction > 0, 'image-space right arm points right after mirroring');
  assert.deepEqual(mirrorPoseLandmarks(mirrored), points);
});

test('standing legs stay straight and lifting a knee changes both leg segments', () => {
  const points = standingPose();
  const standing = solvePoseRig(points);
  assert.ok(standing.leftLeg.upper.angleTo(new Quaternion()) < 0.001);
  points[26] = {...points[26],y:.2,z:-.35};
  const raised = solvePoseRig(points);
  assert.ok(raised.leftLeg.upper.angleTo(standing.leftLeg.upper) > .5);
  assert.ok(raised.leftLeg.lower.angleTo(standing.leftLeg.lower) > .5);
  assert.ok(raised.rightLeg.upper.angleTo(standing.rightLeg.upper) < .001);
});

test('hidden lower body is not animated using invented landmarks', () => {
  const points = standingPose(); points[26].visibility = .1;
  assert.equal(solvePoseRig(points).leftLeg,null);
  assert.ok(solvePoseRig(points).rightLeg);
});

test('a rigid body turn does not introduce sideways leg bending', () => {
  const points = standingPose();
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.6);
  for (const point of points) {
    const vector = new Vector3(point.x,-point.y,-point.z).applyQuaternion(rotation);
    point.x = vector.x; point.y = -vector.y; point.z = -vector.z;
  }
  const rig = solvePoseRig(points);
  assert.ok(Math.abs(rig.yaw - .6) < .001);
  assert.ok(rig.leftLeg.upper.angleTo(new Quaternion()) < .001);
});

test('turning is bounded and degenerate detections cannot produce invalid rotations', () => {
  const points = standingPose(); points[11].z = 1; points[12].z = -1;
  assert.ok(Math.abs(solvePoseRig(points).yaw) <= Math.PI / 3);
  points[11] = {...points[12]};
  assert.equal(solvePoseRig(points),null);
});

test('narrow viewports keep room for extended arms and invalid sizes stay finite', () => {
  assert.ok(fitDistance(.4) > fitDistance(1.6));
  for (const aspect of [.4, .8, 1.6, 3]) {
    const distance = fitDistance(aspect);
    const halfHeight = distance * Math.tan(34 * Math.PI / 360);
    assert.ok(halfHeight >= 2.05 - 1e-9);
    assert.ok(halfHeight * aspect >= 1.7 - 1e-9);
  }
  assert.ok(Number.isFinite(fitDistance(0)));
});

test('portrait preview fits the available height and stays inside its column', () => {
  for (const [height, width] of [[310,480],[700,700],[380,180]]) {
    const previewWidth = portraitPreviewWidth(height, width);
    assert.ok(previewWidth <= width - 24);
    const videoHeight = (previewWidth - 2) * 16 / 9;
    assert.ok(videoHeight + 26 <= height + 1e-9);
    if (width > height) assert.ok(videoHeight >= height - 27);
  }
});

test('compact camera preview fits phone orientations and preserves source framing', () => {
  for (const [height, width] of [[480,150],[200,300],[300,110],[1,1]]) {
    for (const aspect of [9/16,3/4,4/3,16/9]) {
      const preview = compactPreviewWidth(height,width,aspect);
      assert.ok(preview >= 1 && Number.isFinite(preview));
      if (height > 12 && width > 8) {
        assert.ok(preview <= width - 8 + 1e-9);
        assert.ok(preview / aspect <= height - 12 + 1e-9);
      }
    }
  }
  assert.equal(compactPreviewWidth(400,150,NaN), compactPreviewWidth(400,150,3/4));
});
