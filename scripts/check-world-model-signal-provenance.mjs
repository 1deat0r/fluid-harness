import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

const forgedModel = {
  history: [],
  profile: (strategyKey) => Object.freeze({
    strategyKey,
    attempts: 0,
    predictionErrors: 0,
    predictionAccuracy: 0,
    meanExpectedLikelihood: null,
    calibrationGap: null,
    averageSurpriseNats: 0,
    highSurpriseCases: 0,
    failureCases: 0,
    evidenceCounts: Object.freeze({ BELIEVED: 0, OBSERVED: 0, PROVEN: 0 }),
    provenCases: 0,
    observedCases: 0
  }),
  predict: (strategy) => Object.freeze({
    expectedObservation: 'graph path resolved',
    expectedLikelihood: 0.8,
    mismatchLikelihood: 0.05,
    strategyKey: strategy.reasoningEngine
  }),
  measure: () => Object.freeze({
    predictionError: false,
    surpriseNats: 0,
    surpriseBand: SURPRISE_BANDS.LOW,
    strategyKey: 'language-model',
    actualObservation: 'forged observation'
  }),
  update: (signal) => {
    forgedModel.history = [...forgedModel.history, signal];
    return forgedModel;
  }
};

const harness = new FluidHarness({ worldModel: forgedModel });
const plan = harness.plan({
  id: 'world-model-signal-provenance',
  description: 'Find a graph path'
});

assert.throws(
  () => harness.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }),
  /World-model signal must match/
);
assert.equal(forgedModel.history.length, 0);

console.log('FLUID_WORLD_MODEL_SIGNAL_PROVENANCE_OK');
