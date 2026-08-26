import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  EvolutionAuthority,
  MUTATION_LEVELS
} from '../src/evolution.mjs';
import {
  HeuristicRepresentationSelector,
  REPRESENTATIONS
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [new EvaluationCase({
  id: 'evolution-definition-drift-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'evolution-definition-drift-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
let candidateCalls = 0;
const candidates = [
  new RepresentationCandidate({
    id: 'evolution-definition-drift-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.NATURAL_LANGUAGE })
  }),
  new RepresentationCandidate({
    id: 'evolution-definition-drift-candidate',
    selectorFactory: () => {
      candidateCalls += 1;
      if (candidateCalls <= 3) {
        return new HeuristicRepresentationSelector();
      }
      return { select: () => REPRESENTATIONS.GRAPH };
    }
  })
];

function evaluateSearch() {
  const budget = new EvaluationBudget({ maxCases: 1 });
  return new RepresentationSearchRunner().evaluate({
    candidates,
    cases,
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });
}

const searchReport = evaluateSearch();
const reproductionReport = evaluateSearch();
assert.equal(searchReport.complete, true);
assert.equal(reproductionReport.complete, true);
assert.equal(searchReport.allAuditsValid, true);
assert.equal(reproductionReport.allAuditsValid, true);

const authority = new EvolutionAuthority();
const proposal = authority.propose({
  id: 'evolution-definition-drift-proposal',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'evolution-definition-drift-baseline',
  candidateCandidateId: 'evolution-definition-drift-candidate'
});

assert.equal(proposal.reproducible, false);
assert.equal(authority.approve(proposal).approved, false);

console.log('FLUID_EVOLUTION_DEFINITION_DRIFT_OK');
