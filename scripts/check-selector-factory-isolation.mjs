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

const cases = [new EvaluationCase({
  id: 'selector-factory-isolation-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'selector-factory-isolation-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
const budget = new EvaluationBudget({ maxCases: 1 });
const sharedFactory = () => new HeuristicRepresentationSelector();
const rejected = new RepresentationSearchRunner().evaluate({
  candidates: [
    new RepresentationCandidate({ id: 'first-shared-factory', selectorFactory: sharedFactory }),
    new RepresentationCandidate({ id: 'second-shared-factory', selectorFactory: sharedFactory })
  ],
  cases,
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});

assert.equal(rejected.results[0].error, null);
assert.equal(rejected.results[1].production, null);
assert.match(rejected.results[1].error, /fresh selector factory/);

const valid = new RepresentationSearchRunner().evaluate({
  candidates: [
    new RepresentationCandidate({
      id: 'first-fresh-factory',
      selectorFactory: () => new HeuristicRepresentationSelector()
    }),
    new RepresentationCandidate({
      id: 'second-fresh-factory',
      selectorFactory: () => new HeuristicRepresentationSelector()
    })
  ],
  cases,
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});
assert.equal(valid.results.every(({ error }) => error === null), true);

console.log('FLUID_SELECTOR_FACTORY_ISOLATION_OK');
