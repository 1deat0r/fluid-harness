import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

const forgedModel = {
  history: [],
  profile: (strategyKey) => Object.freeze({ strategyKey, attempts: 0 }),
  predict: (strategy) => Object.freeze({
    expectedObservation: 'different expected outcome',
    expectedLikelihood: 0.8,
    mismatchLikelihood: 0.05,
    strategyKey: strategy.reasoningEngine
  }),
  measure: (prediction, observation) => Object.freeze({
    predictionError: false,
    surpriseNats: 0,
    surpriseBand: SURPRISE_BANDS.LOW,
    strategyKey: prediction.strategyKey,
    actualObservation: observation.actualObservation,
    expectedLikelihood: prediction.expectedLikelihood,
    observationLikelihood: prediction.expectedLikelihood
  }),
  update: (signal) => {
    forgedModel.history.push(signal);
    return forgedModel;
  }
};

const harness = new FluidHarness({ worldModel: forgedModel });
const plan = harness.plan({
  id: 'world-model-signal-consistency',
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
  /selected prediction.*observed outcome/i
);
assert.equal(forgedModel.history.length, 0);

console.log('FLUID_WORLD_MODEL_SIGNAL_CONSISTENCY_OK');
