import assert from 'node:assert/strict';

import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

let factoryCalls = 0;
const cases = [new EvaluationCase({
  id: 'search-production-promotion-boundary-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'search-production-promotion-boundary-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.result?.path?.join('>') === 'A>B'
})];

const report = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'production-failure-candidate',
    selectorFactory: () => {
      const call = ++factoryCalls;
      return {
        select: () => call === 1
          ? REPRESENTATIONS.NATURAL_LANGUAGE
          : REPRESENTATIONS.GRAPH
      };
    }
  })],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

const result = report.results[0];
assert.equal(result.production.successRate, 0);
assert.equal(result.production.complete, true);
assert.equal(result.research.successRate, 1);
assert.equal(result.skeptic.successRate, 1);
assert.equal(result.decision.promoted, false);
assert.equal(result.promoted, false);
assert.match(result.decision.reasons.join(' '), /production/i);

console.log('FLUID_SEARCH_PRODUCTION_PROMOTION_BOUNDARY_OK');
