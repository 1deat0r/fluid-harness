import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  Observation,
  Prediction,
  WorldModel
} from '../src/world-model.mjs';

const prediction = new Prediction({
  expectedObservation: 'expected',
  strategyKey: 'proven-learning-boundary'
});
const model = new WorldModel();
const signal = model.measure(prediction, new Observation({ actualObservation: 'expected' }));

assert.throws(
  () => model.update({
    ...signal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: true
  }),
  /trusted verification/
);

const harness = new FluidHarness();
const plan = harness.plan({ id: 'proven-learning-valid', description: 'Find a graph path' });
const report = harness.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_PROVEN_LEARNING_BOUNDARY_OK');
