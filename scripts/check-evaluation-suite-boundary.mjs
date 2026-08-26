import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

function graphCase(id) {
  return new EvaluationCase({
    id,
    domain: 'graph',
    adversarial: true,
    task: { id: `${id}-task`, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  });
}

function evaluate(candidateId, cases, mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId,
    cases,
    mode,
    budget: new EvaluationBudget({ maxCases: cases.length })
  });
}

const primaryCase = graphCase('primary-suite-case');
const alternateCase = graphCase('alternate-suite-case');
const primary = evaluate('same-candidate', [primaryCase], POLICY_MODES.RESEARCH);
const mismatchedSkeptic = evaluate('same-candidate', [alternateCase], POLICY_MODES.SKEPTIC);
const authority = new PromotionAuthority();
const rejected = authority.decide(primary, { skepticReport: mismatchedSkeptic });

assert.equal(rejected.promoted, false);
assert.ok(rejected.reasons.includes('skeptic evaluation case suite must match the primary evaluation'));

const matchingSkeptic = evaluate('same-candidate', [primaryCase], POLICY_MODES.SKEPTIC);
const accepted = authority.decide(primary, { skepticReport: matchingSkeptic });
assert.equal(accepted.promoted, true);

console.log('FLUID_EVALUATION_SUITE_BOUNDARY_OK');
