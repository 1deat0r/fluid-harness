import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  Observation,
  Prediction,
  WorldModel
} from '../src/world-model.mjs';

const model = new WorldModel();
const prediction = new Prediction({
  expectedObservation: 'expected',
  strategyKey: 'learning-boundary'
});
const signal = model.measure(prediction, new Observation({ actualObservation: 'expected' }));
const defaulted = model.update(signal);

assert.equal(defaulted.history[0].evidence, EVIDENCE_LEVELS.BELIEVED);
assert.equal(defaulted.history[0].verified, false);
assert.throws(
  () => model.update({ ...signal, evidence: 'FORGED' }),
  /known evidence level/
);
assert.throws(
  () => model.update({
    ...signal,
    evidence: EVIDENCE_LEVELS.PROVEN,
    verified: false
  }),
  /must match evidence level/
);
console.log('FLUID_LEARNING_BOUNDARY_OK');
