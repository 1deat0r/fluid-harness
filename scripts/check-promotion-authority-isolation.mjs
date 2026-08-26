import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import {
  HeuristicRepresentationSelector
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [new EvaluationCase({
  id: 'promotion-authority-isolation-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'promotion-authority-isolation-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
const budget = new EvaluationBudget({ maxCases: 1 });
const sharedAuthority = new PromotionAuthority();
const rejected = new RepresentationSearchRunner({
  promotionAuthorityFactory: () => sharedAuthority
}).evaluate({
  candidates: [new RepresentationCandidate({
    id: 'shared-promotion-authority',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases,
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});

assert.equal(rejected.results[0].research, null);
assert.match(rejected.results[0].error, /fresh promotion authority/);

const valid = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'fresh-promotion-authority',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases,
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});
assert.equal(valid.results[0].error, null);

console.log('FLUID_PROMOTION_AUTHORITY_ISOLATION_OK');
