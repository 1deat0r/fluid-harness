import assert from 'node:assert/strict';

import {
  Constitution
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [new EvaluationCase({
  id: 'search-constitution-stability-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'search-constitution-stability-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B', 'C'],
    edges: [['A', 'B'], ['B', 'C']],
    start: 'A',
    goal: 'C'
  },
  expected: (report) => report.result.path.join('>') === 'A>B>C'
})];
let constitutionCalls = 0;
const candidates = [
  new RepresentationCandidate({
    id: 'search-constitution-stability-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  }),
  new RepresentationCandidate({
    id: 'search-constitution-stability-candidate',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  })
];

const report = new RepresentationSearchRunner({
  constitutionFactory: () => new Constitution({
    maxGraphExpansions: constitutionCalls++ === 0 ? 1 : 100
  })
}).evaluate({
  candidates,
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.complete, false);
assert.equal(report.promoted, null);
assert.ok(report.results.some(({ error }) => /inconsistent limits/.test(error ?? '')));

console.log('FLUID_SEARCH_CONSTITUTION_STABILITY_OK');
