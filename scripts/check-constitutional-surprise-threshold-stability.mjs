import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

let thresholdReads = 0;
const dynamicModel = {
  get highSurpriseThreshold() {
    thresholdReads += 1;
    return thresholdReads <= 4 ? 0 : 1000;
  },
  history: [],
  profile: (strategyKey) => Object.freeze({ strategyKey, attempts: 0 }),
  predict: (strategy) => Object.freeze({
    expectedObservation: 'different expected outcome',
    expectedLikelihood: 0.8,
    mismatchLikelihood: 0.05,
    strategyKey: strategy.reasoningEngine
  }),
  measure: (prediction, observation) => Object.freeze({
    predictionError: prediction.expectedObservation !== observation.actualObservation,
    surpriseNats: -Math.log(prediction.mismatchLikelihood),
    surpriseBand: dynamicModel.highSurpriseThreshold <= -Math.log(prediction.mismatchLikelihood)
      ? SURPRISE_BANDS.HIGH
      : SURPRISE_BANDS.LOW,
    strategyKey: prediction.strategyKey,
    actualObservation: observation.actualObservation,
    expectedLikelihood: prediction.expectedLikelihood,
    observationLikelihood: prediction.mismatchLikelihood
  }),
  update: (signal) => {
    dynamicModel.history.push(signal);
    return dynamicModel;
  }
};

const harness = new FluidHarness({ worldModel: dynamicModel });
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxSurpriseThreshold: 1 }),
  harness
});
const plan = core.plan({
  id: 'constitutional-surprise-threshold-stability',
  description: 'Find a graph path'
});

assert.equal(plan.highSurpriseThreshold, 0);
assert.throws(
  () => core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }),
  /World-model signal must match/i
);
assert.equal(core.status.actionsUsed, 1);
assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
assert.equal(dynamicModel.history.length, 0);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CONSTITUTIONAL_SURPRISE_THRESHOLD_STABILITY_OK');
