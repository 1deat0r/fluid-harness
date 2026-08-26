import assert from 'node:assert/strict';

import { ScalingCurve, ScalingPoint } from '../src/scaling.mjs';

const incomplete = new ScalingPoint({
  levelId: 'scaling-aggregation-isolation-level',
  computeUnits: 1,
  eligibleCases: 1,
  attemptedCases: 1,
  successes: 0,
  proofEligibleCases: 1,
  proven: 0,
  highSurpriseCases: 1,
  elapsedMs: 1,
  complete: false,
  transferMatrix: {}
});

const originalEvery = Array.prototype.every;
try {
  Array.prototype.every = () => true;
  const curve = new ScalingCurve({
    candidateId: 'scaling-aggregation-isolation-candidate',
    mode: 'research',
    points: [incomplete]
  });
  assert.equal(curve.complete, false);
} finally {
  Array.prototype.every = originalEvery;
}

console.log('FLUID_SCALING_AGGREGATION_ISOLATION_OK');
