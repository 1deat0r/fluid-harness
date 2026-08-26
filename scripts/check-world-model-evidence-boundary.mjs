import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { EvaluationCase, EvaluationRunner, POLICY_MODES } from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { questionFor, QUESTION_REASONS } from '../src/curiosity.mjs';
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

const graphInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

const harness = new FluidHarness({ worldModel: forgedModel });
const plan = harness.plan({
  id: 'world-model-evidence-boundary',
  description: 'Find a graph path'
});
const report = harness.execute({
  plan,
  input: graphInput,
  executionOptions: { maxExpansions: 1 }
});

assert.equal(report.verification.passed, false);
assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(report.strategyProfile.provenCases, 999);
assert.equal(report.surpriseBand, SURPRISE_BANDS.LOW);

const question = questionFor({ actionReport: report });
assert.equal(question.reason, QUESTION_REASONS.INSUFFICIENT_EVIDENCE);
assert.equal(question.requested, true);
assert.equal(question.researchRequired, true);

const evaluationCase = new EvaluationCase({
  id: 'world-model-evidence-boundary-case',
  domain: 'world-model-boundary',
  task: {
    id: 'world-model-evidence-boundary-task',
    description: 'Find a graph path'
  },
  input: graphInput,
  expected: () => true
});
const evaluation = new EvaluationRunner({ harness }).evaluate({
  candidateId: 'forged-world-model',
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH,
  executionOptions: { maxExpansions: 1 }
});

assert.equal(evaluation.results[0].proven, false);
assert.equal(evaluation.results[0].success, false);

console.log('FLUID_WORLD_MODEL_EVIDENCE_BOUNDARY_OK');
