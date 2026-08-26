import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

function modelWithThreshold(highSurpriseThreshold) {
  const model = {
    highSurpriseThreshold,
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
      surpriseBand: highSurpriseThreshold <= -Math.log(prediction.mismatchLikelihood)
        ? SURPRISE_BANDS.HIGH
        : SURPRISE_BANDS.LOW,
      strategyKey: prediction.strategyKey,
      actualObservation: observation.actualObservation,
      expectedLikelihood: prediction.expectedLikelihood,
      observationLikelihood: prediction.mismatchLikelihood
    }),
    update: (signal) => {
      model.history.push(signal);
      return model;
    }
  };
  return model;
}

const graphInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

assert.throws(
  () => new Constitution({ maxSurpriseThreshold: -1 }),
  /non-negative finite number/i
);
assert.throws(
  () => new Constitution({ maxSurpriseThreshold: Infinity }),
  /non-negative finite number/i
);

const oversizedModel = modelWithThreshold(1000);
const oversizedHarness = new FluidHarness({ worldModel: oversizedModel });
assert.throws(
  () => new ConstitutionalCore({ harness: oversizedHarness }),
  /high-surprise threshold.*constitutional maximum/i
);

const replacementModel = modelWithThreshold(1000);
const replacementHarness = new FluidHarness();
const replacementCore = new ConstitutionalCore({ harness: replacementHarness });
const replacementPlan = replacementCore.plan({
  id: 'constitutional-surprise-threshold-replacement',
  description: 'Find a graph path'
});
replacementHarness.worldModel = replacementModel;
assert.throws(
  () => replacementCore.execute({ plan: replacementPlan, input: graphInput }),
  /high-surprise threshold.*constitutional maximum/i
);
assert.equal(replacementCore.status.actionsUsed, 0);
assert.equal(replacementCore.auditTrail.at(-1).event, CORE_EVENTS.ACTION_REJECTED);
assert.equal(replacementCore.verifyAudit(), true);

const permittedModel = modelWithThreshold(2);
const permittedHarness = new FluidHarness({ worldModel: permittedModel });
const permittedCore = new ConstitutionalCore({
  constitution: new Constitution({ maxSurpriseThreshold: 2 }),
  harness: permittedHarness
});
const permittedPlan = permittedCore.plan({
  id: 'constitutional-surprise-threshold-permitted',
  description: 'Find a graph path'
});
const permittedReport = permittedCore.execute({ plan: permittedPlan, input: graphInput });
assert.equal(permittedReport.evidence, 'PROVEN');
assert.equal(permittedReport.surpriseBand, SURPRISE_BANDS.HIGH);
assert.equal(permittedCore.verifyAudit(), true);

console.log('FLUID_CONSTITUTIONAL_SURPRISE_THRESHOLD_OK');
