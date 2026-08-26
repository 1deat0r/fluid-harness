import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [new EvaluationCase({
  id: 'search-mode-definition-drift-case',
  domain: 'mixed-representation',
  adversarial: true,
  task: { id: 'search-mode-definition-drift-task', description: 'Find a graph path' },
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
})];
let selectorCalls = 0;
const candidate = new RepresentationCandidate({
  id: 'search-mode-definition-drift-candidate',
  selectorFactory: () => {
    selectorCalls += 1;
    if (selectorCalls < 3) {
      return new HeuristicRepresentationSelector();
    }
    return { select: () => REPRESENTATIONS.CONSTRAINT_SYSTEM };
  }
});

const report = new RepresentationSearchRunner().evaluate({
  candidates: [candidate],
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(selectorCalls, 3);
assert.equal(report.complete, false);
assert.equal(report.promoted, null);
assert.match(report.results[0].error, /inconsistent selector definitions/);

console.log('FLUID_SEARCH_MODE_DEFINITION_DRIFT_OK');
