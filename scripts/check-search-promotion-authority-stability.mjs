import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [
  new EvaluationCase({
    id: 'search-promotion-authority-stability-proof-case',
    domain: 'graph',
    task: { id: 'search-promotion-authority-stability-proof-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'search-promotion-authority-stability-refusal-case',
    domain: 'robustness',
    productionEligible: false,
    adversarial: true,
    requiresProof: false,
    task: {
      id: 'search-promotion-authority-stability-refusal-task',
      description: 'Refuse an unsupported representation safely'
    },
    input: {
      unsupported: true
    },
    expected: (report, error) => report === null
      && /No executor/.test(error?.message ?? String(error))
  })
];

let authorityCalls = 0;
const candidate = new RepresentationCandidate({
  id: 'search-promotion-authority-stability-candidate',
  selectorFactory: () => ({
    select: () => REPRESENTATIONS.NATURAL_LANGUAGE
  })
});

const report = new RepresentationSearchRunner({
  promotionAuthorityFactory: () => {
    authorityCalls += 1;
    return authorityCalls === 2
      ? new PromotionAuthority({ minimumSuccessRate: 0, minimumProvenRate: 0 })
      : new PromotionAuthority();
  }
}).evaluate({
  candidates: [candidate],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(authorityCalls, 2);
assert.equal(report.complete, false);
assert.equal(report.promoted, null);
assert.ok(report.results.some(({ error }) => /inconsistent thresholds/.test(error ?? '')));

console.log('FLUID_SEARCH_PROMOTION_AUTHORITY_STABILITY_OK');
