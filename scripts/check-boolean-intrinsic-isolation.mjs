import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  PromotionAuthority
} from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const cases = [new EvaluationCase({
  id: 'boolean-intrinsic-isolation-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'boolean-intrinsic-isolation-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: () => false
})];

const candidate = new RepresentationCandidate({
  id: 'boolean-intrinsic-isolation-candidate',
  selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
});

const originalBoolean = globalThis.Boolean;
let report;
try {
  globalThis.Boolean = () => true;
  report = new RepresentationSearchRunner({
    promotionAuthorityFactory: () => new PromotionAuthority()
  }).evaluate({
    candidates: [candidate],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
} finally {
  globalThis.Boolean = originalBoolean;
}

assert.equal(report.complete, true);
assert.equal(report.results[0].decision.promoted, false);
assert.equal(report.results[0].promoted, false);
assert.equal(report.promoted, null);
assert.throws(
  () => selectorFromPromotedSearch(report),
  /no promoted candidate/
);

console.log('FLUID_BOOLEAN_INTRINSIC_ISOLATION_OK');
