import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const secondCase = new EvaluationCase({
  id: 'search-suite-second',
  domain: 'graph',
  adversarial: true,
  task: { id: 'search-suite-second-task', description: 'Find a graph path' },
  input,
  expected: (report) => report.result.path.join('>') === 'A>B'
});
const cases = [
  new EvaluationCase({
    id: 'search-suite-first',
    domain: 'graph',
    adversarial: true,
    task: { id: 'search-suite-first-task', description: 'Find a graph path' },
    input,
    expected: (report) => report.result.path.join('>') === 'A>B'
  }),
  secondCase
];
let selectorCalls = 0;
const report = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'mutating-search-suite',
    selectorFactory: () => {
      selectorCalls += 1;
      if (selectorCalls === 1) {
        cases.pop();
      }
      return new HeuristicRepresentationSelector();
    }
  })],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
});

assert.equal(cases.length, 1);
const result = report.results[0];
assert.equal(result.production.eligibleCases, 2);
assert.equal(result.research.eligibleCases, 2);
assert.equal(result.skeptic.eligibleCases, 2);
assert.equal(report.complete, true);

console.log('FLUID_SEARCH_CASE_SUITE_ISOLATION_OK');
