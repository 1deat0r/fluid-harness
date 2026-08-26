import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  HeuristicRepresentationSelector
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner,
  selectorFromPromotedSearch
} from '../src/search.mjs';

const cases = (id) => [new EvaluationCase({
  id: `${id}-case`,
  domain: 'graph',
  adversarial: true,
  task: { id: `${id}-task`, description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
})];
const budget = new EvaluationBudget({ maxCases: 1 });
const created = [];
const replayingCandidate = new RepresentationCandidate({
  id: 'adoption-selector-replay-boundary',
  selectorFactory: () => {
    if (created.length < 3) {
      const selector = new HeuristicRepresentationSelector();
      created.push(selector);
      return selector;
    }
    return created[0];
  }
});
const rejectedReport = new RepresentationSearchRunner().evaluate({
  candidates: [replayingCandidate],
  cases: cases('adoption-selector-replay-boundary'),
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});
assert.equal(rejectedReport.promoted.candidateId, replayingCandidate.id);
assert.throws(
  () => selectorFromPromotedSearch(rejectedReport),
  /fresh selector not used during search or prior adoption/
);

const freshSelectors = [];
const validReport = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'fresh-adoption-selector-boundary',
    selectorFactory: () => {
      const selector = new HeuristicRepresentationSelector();
      freshSelectors.push(selector);
      return selector;
    }
  })],
  cases: cases('fresh-adoption-selector-boundary'),
  productionBudget: budget,
  researchBudget: budget,
  skepticBudget: budget
});
const evaluatedSelectors = [...freshSelectors];
const adopted = selectorFromPromotedSearch(validReport);
assert.equal(evaluatedSelectors.includes(adopted), false);

console.log('FLUID_SELECTOR_ADOPTION_ISOLATION_OK');
