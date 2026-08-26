import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';

let selectorInstances = 0;
const report = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'search-isolation-boundary',
    selectorFactory: () => {
      selectorInstances += 1;
      return new HeuristicRepresentationSelector();
    }
  })],
  cases: [new EvaluationCase({
    id: 'search-isolation-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'search-isolation-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(selectorInstances, 3);
assert.equal(report.allAuditsValid, true);
assert.equal(report.results[0].production.successRate, 1);
assert.equal(report.results[0].research.successRate, 1);
assert.equal(report.results[0].skeptic.successRate, 1);
console.log(`FLUID_SEARCH_ISOLATION_OK selectors=${selectorInstances} audits=${report.allAuditsValid}`);
