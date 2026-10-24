import { Euler, Quaternion, Vector3, MathUtils } from 'three';

const down = new Vector3(0, -1, 0);
const forward = new Vector3(0, 0, 1);

export function visible(points, indices, threshold = 0.55) {
  return Boolean(points && indices.every((index) => {
    const point = points[index];
    return point && [point.x, point.y, point.z].every(Number.isFinite) && (point.visibility ?? 1) >= threshold;
  }));
}

function direction(points, start, end, inverseBody) {
  return new Vector3(points[end].x - points[start].x, points[start].y - points[end].y, points[start].z - points[end].z).applyQuaternion(inverseBody);
}

function segmentRotation(vector) {
  if (vector.lengthSq() < 0.00001) return null;
  return new Quaternion().setFromUnitVectors(down, vector.normalize());
}

function solveChain(points, indices, inverseBody) {
  if (!visible(points, indices)) return null;
  const upper = segmentRotation(direction(points, indices[0], indices[1], inverseBody));
  const lower = segmentRotation(direction(points, indices[1], indices[2], inverseBody));
  if (!upper || !lower) return null;
  return { upper, lower: upper.clone().invert().multiply(lower), absoluteLower: lower };
}

export function solvePoseRig(points) {
  if (!visible(points, [11,12])) return null;
  const shoulder = new Vector3(points[11].x - points[12].x, points[12].y - points[11].y, points[12].z - points[11].z);
  if (shoulder.lengthSq() < 0.00001) return null;
  const yaw = MathUtils.clamp(Math.atan2(-shoulder.z, shoulder.x), -Math.PI / 3, Math.PI / 3);
  const tilt = MathUtils.clamp(Math.atan2(shoulder.y, Math.hypot(shoulder.x, shoulder.z)), -0.3, 0.3);
  const body = new Quaternion().setFromEuler(new Euler(0, yaw, tilt));
  const inverseBody = body.clone().invert();
  const result = { yaw, tilt, body, leftArm: solveChain(points, [12,14,16], inverseBody), rightArm: solveChain(points, [11,13,15], inverseBody), leftLeg: solveChain(points, [24,26,28], inverseBody), rightLeg: solveChain(points, [23,25,27], inverseBody) };
  for (const [side, wrist, finger] of [['left',16,20],['right',15,19]]) {
    const arm = result[`${side}Arm`];
    if (!arm || !visible(points, [wrist,finger])) continue;
    const handRotation = segmentRotation(direction(points, wrist, finger, inverseBody));
    if (handRotation) arm.hand = arm.absoluteLower.clone().invert().multiply(handRotation);
  }
  for (const [side, heel, toe] of [['left',30,32],['right',29,31]]) {
    const leg = result[`${side}Leg`];
    if (!leg || !visible(points, [heel,toe])) continue;
    const footDirection = direction(points, heel, toe, inverseBody);
    if (footDirection.lengthSq() < 0.00001) continue;
    const footRotation = new Quaternion().setFromUnitVectors(forward, footDirection.normalize());
    leg.foot = leg.absoluteLower.clone().invert().multiply(footRotation);
  }
  return result;
}
