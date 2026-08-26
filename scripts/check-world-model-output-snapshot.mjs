import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import { Prediction, WorldModel } from '../src/world-model.mjs';

let expectedObservation = 'graph path resolved';
let profileAttempts = 0;
const predictionPrototype = Object.create(Prediction.prototype);
Object.defineProperties(predictionPrototype, {
  expectedObservation: {
    get: () => expectedObservation,
    enumerable: true
  },
  expectedLikelihood: {
    value: 0.8,
    enumerable: true
  },
  mismatchLikelihood: {
    value: 0.05,
    enumerable: true
  },
  strategyKey: {
    value: 'graph-algorithms',
    enumerable: true
  }
});

const forgedPrediction = Object.freeze(Object.create(predictionPrototype));
const baseModel = new WorldModel();
const forgedModel = {
  history: [],
  profile: (strategyKey) => {
    profileAttempts += 1;
    return Object.freeze({
      strategyKey,
      attempts: profileAttempts,
      predictionErrors: 0,
      predictionAccuracy: 1,
      meanExpectedLikelihood: 0.8,
      calibrationGap: 0.2,
      averageSurpriseNats: 0,
      highSurpriseCases: 0,
      failureCases: 0,
      evidenceCounts: Object.freeze({
        [EVIDENCE_LEVELS.BELIEVED]: 0,
        [EVIDENCE_LEVELS.OBSERVED]: 0,
        [EVIDENCE_LEVELS.PROVEN]: 0
      }),
      provenCases: 0,
      observedCases: 0
    });
  },
  predict: () => forgedPrediction,
  measure: (prediction, observation) => baseModel.measure(prediction, observation),
  update: (signal) => {
    forgedModel.history = [...forgedModel.history, signal];
    return forgedModel;
  }
};

const harness = new FluidHarness({ worldModel: forgedModel });
const plan = harness.plan({
  id: 'world-model-output-snapshot',
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
assert.equal(Object.isFrozen(plan.prediction), true);
assert.equal(Object.getOwnPropertyDescriptor(plan.prediction, 'expectedObservation').get, undefined);
assert.equal(Object.isFrozen(report.strategyProfile), true);
assert.equal(Object.getOwnPropertyDescriptor(report.strategyProfile, 'attempts').get, undefined);

expectedObservation = 'mutated expectation';
assert.equal(plan.prediction.expectedObservation, 'graph path resolved');
assert.equal(report.prediction.expectedObservation, 'graph path resolved');

assert.throws(
  () => new FluidHarness({
    worldModel: {
      profile: () => ({}),
      predict: () => Object.freeze({
        expectedObservation: 'graph path resolved',
        expectedLikelihood: 0.8,
        mismatchLikelihood: 0.05,
        strategyKey: 'language-model'
      })
    }
  }).plan({ id: 'world-model-strategy-binding', description: 'Find a graph path' }),
  /selected reasoning engine/
);

assert.equal(report.strategy.representation, REPRESENTATIONS.GRAPH);
console.log('FLUID_WORLD_MODEL_OUTPUT_SNAPSHOT_OK');
