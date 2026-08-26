import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'observation-immutability-plan',
  description: 'Find a graph path'
});
const observation = {
  status: 'original',
  metadata: { confidence: 0.5 }
};
const report = harness.record({
  plan,
  actualObservation: observation,
  result: { accepted: true }
});

observation.status = 'changed';
observation.metadata.confidence = 0.99;

assert.equal(report.observation.actualObservation.status, 'original');
assert.equal(report.observation.actualObservation.metadata.confidence, 0.5);
assert.equal(Object.isFrozen(report.observation.actualObservation), true);
assert.equal(Object.isFrozen(report.observation.actualObservation.metadata), true);
assert.equal(harness.worldModel.history[0].actualObservation.status, 'original');
assert.equal(harness.worldModel.history[0].actualObservation.metadata.confidence, 0.5);

console.log('FLUID_OBSERVATION_IMMUTABILITY_OK');
