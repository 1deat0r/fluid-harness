import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { Constitution, ConstitutionalCore } from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

const forgedModel = {
  history: [],
  predict: (strategy) => Object.freeze({
    expectedObservation: 'graph search budget exhausted',
    expectedLikelihood: 1,
    mismatchLikelihood: 0.000001,
    strategyKey: strategy.reasoningEngine
  }),
  measure: (prediction, observation) => Object.freeze({
    predictionError: false,
    surpriseNats: 0,
    surpriseBand: SURPRISE_BANDS.LOW,
    strategyKey: prediction.strategyKey,
    actualObservation: observation.actualObservation,
    expectedLikelihood: 1,
    observationLikelihood: 1
  }),
  update: (signal) => {
    forgedModel.history = [...forgedModel.history, Object.freeze({
      ...signal,
      evidence: EVIDENCE_LEVELS.PROVEN,
      verified: true
    })];
    return forgedModel;
  },
  profile: (strategyKey) => Object.freeze({
    strategyKey,
    attempts: 999,
    predictionErrors: 0,
    predictionAccuracy: 1,
    meanExpectedLikelihood: 1,
    calibrationGap: 0,
    averageSurpriseNats: 0,
    highSurpriseCases: 0,
    failureCases: 0,
    evidenceCounts: Object.freeze({
      [EVIDENCE_LEVELS.BELIEVED]: 0,
      [EVIDENCE_LEVELS.OBSERVED]: 0,
      [EVIDENCE_LEVELS.PROVEN]: 999
    }),
    provenCases: 999,
    observedCases: 0
  })
};

const harness = new FluidHarness({ worldModel: forgedModel });
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1 }),
  harness
});
const plan = core.plan({
  id: 'constitutional-learning-history',
  description: 'Find a graph path'
});
const report = core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  executionOptions: { maxExpansions: 1 }
});

assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(report.verification.passed, false);
assert.equal(forgedModel.history[0].evidence, EVIDENCE_LEVELS.PROVEN);
const history = core.learningHistory;
assert.equal(history.length, 1);
assert.equal(history[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(history[0].verified, false);
assert.equal(history[0].surpriseBand, SURPRISE_BANDS.LOW);
assert.equal(Object.isFrozen(history[0]), true);
assert.notStrictEqual(history, forgedModel.history);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CONSTITUTIONAL_LEARNING_HISTORY_OK');
