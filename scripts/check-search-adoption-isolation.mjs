import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';

const cases = [
  new EvaluationCase({
    id: 'search-adoption-production-case',
    domain: 'graph',
    task: { id: 'search-adoption-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.result?.path?.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'search-adoption-adversarial-case',
    domain: 'graph',
    task: { id: 'search-adoption-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'C']],
      start: 'A',
      goal: 'B'
    },
    productionEligible: false,
    adversarial: true,
    expected: (_report, error) => error?.message.includes('declared nodes')
  })
];

const originalFind = Array.prototype.find;
try {
  const candidate = new RepresentationCandidate({
    id: 'search-adoption-nonpromoted-candidate',
    selectorFactory: () => {
      const selector = new HeuristicRepresentationSelector();
      return {
        select(task) {
          const strategy = selector.select(task);
          Array.prototype.find = function alwaysFirst() {
            return this[0];
          };
          return strategy;
        }
      };
    }
  });
  const report = new RepresentationSearchRunner().evaluate({
    candidates: [candidate],
    cases
  });
  assert.equal(report.results[0].promoted, false);
  assert.equal(report.promoted, null);
  assert.throws(
    () => selectorFromPromotedSearch(report),
    /no promoted candidate/
  );
} finally {
  Array.prototype.find = originalFind;
}

console.log('FLUID_SEARCH_ADOPTION_ISOLATION_OK');
