import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { WorldModel } from '../src/world-model.mjs';

let marker = 'stable';
const valuesPrototype = Object.create(Array.prototype);
Object.defineProperty(valuesPrototype, 'marker', {
  get: () => marker,
  enumerable: true
});
const forgedValues = [];
Object.setPrototypeOf(forgedValues, valuesPrototype);
Object.freeze(forgedValues);
const forgedObservation = Object.freeze({
  kind: 'structured',
  values: forgedValues
});
const forgedPrediction = Object.freeze({
  expectedObservation: forgedObservation,
  expectedLikelihood: 0.8,
  mismatchLikelihood: 0.05,
  strategyKey: 'graph-algorithms'
});
const baseModel = new WorldModel();
const forgedModel = {
  history: [],
  profile: (strategyKey) => baseModel.profile(strategyKey),
  predict: () => forgedPrediction,
  measure: (prediction, observation) => baseModel.measure(prediction, observation),
  update: (signal) => {
    forgedModel.history = [...forgedModel.history, signal];
    return forgedModel;
  }
};

const harness = new FluidHarness({ worldModel: forgedModel });
const plan = harness.plan({
  id: 'prediction-observation-snapshot',
  description: 'Find a graph path'
});
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
assert.equal(Object.isFrozen(report.prediction.expectedObservation), true);
assert.equal(report.prediction.expectedObservation.kind, 'structured');
assert.equal(Object.isFrozen(report.prediction.expectedObservation.values), true);
assert.equal(report.prediction.expectedObservation.values.marker, undefined);

marker = 'mutated';
assert.equal(report.prediction.expectedObservation.kind, 'structured');
assert.equal(report.prediction.expectedObservation.values.marker, undefined);

console.log('FLUID_PREDICTION_OBSERVATION_SNAPSHOT_OK');
