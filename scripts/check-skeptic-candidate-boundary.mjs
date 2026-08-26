import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const evaluationCase = new EvaluationCase({
  id: 'skeptic-candidate-boundary-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'skeptic-candidate-boundary-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});

function evaluate(candidateId, mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId,
    cases: [evaluationCase],
    mode,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
}

const authority = new PromotionAuthority();
const primary = evaluate('candidate-a', POLICY_MODES.RESEARCH);
const mismatchedSkeptic = evaluate('candidate-b', POLICY_MODES.SKEPTIC);
const rejected = authority.decide(primary, { skepticReport: mismatchedSkeptic });

assert.equal(rejected.promoted, false);
assert.ok(rejected.reasons.includes('skeptic evaluation candidate must match the primary candidate'));

const matchingSkeptic = evaluate('candidate-a', POLICY_MODES.SKEPTIC);
const accepted = authority.decide(primary, { skepticReport: matchingSkeptic });
assert.equal(accepted.promoted, true);

console.log('FLUID_SKEPTIC_CANDIDATE_BOUNDARY_OK');
