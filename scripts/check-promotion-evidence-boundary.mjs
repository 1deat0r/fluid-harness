import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const evaluationCase = new EvaluationCase({
  id: 'promotion-evidence-boundary-case',
  domain: 'mixed-representation',
  adversarial: true,
  task: { id: 'promotion-evidence-boundary-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B',
    resources: { cpu: 1 },
    jobs: [{ id: 'job-a', duration: 1, prerequisites: [], demand: { cpu: 1 } }]
  },
  expected: (report) => report.result.path?.join('>') === 'A>B'
    || report.result.schedule?.length === 1
});

function evaluate(selector, mode) {
  return new EvaluationRunner({
    harness: new FluidHarness({ selector })
  }).evaluate({
    candidateId: 'same-candidate-id',
    cases: [evaluationCase],
    mode,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
}

const primary = evaluate(
  { select: () => REPRESENTATIONS.GRAPH },
  POLICY_MODES.RESEARCH
);
const mismatchedSkeptic = evaluate(
  { select: () => REPRESENTATIONS.CONSTRAINT_SYSTEM },
  POLICY_MODES.SKEPTIC
);

assert.equal(primary.complete, true);
assert.equal(mismatchedSkeptic.complete, true);
assert.equal(primary.successRate, 1);
assert.equal(mismatchedSkeptic.successRate, 1);
assert.notEqual(primary.results[0].representation, mismatchedSkeptic.results[0].representation);

const decision = new PromotionAuthority().decide(primary, {
  skepticReport: mismatchedSkeptic
});
assert.equal(decision.promoted, false);
assert.ok(decision.reasons.includes('skeptic evaluation evidence must match the primary candidate'));

console.log('FLUID_PROMOTION_EVIDENCE_BOUNDARY_OK');
