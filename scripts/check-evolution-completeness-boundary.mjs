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
  id: 'evolution-completeness-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'evolution-completeness-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
let incompleteCandidateCalls = 0;
const candidates = [
  new RepresentationCandidate({
    id: 'evolution-completeness-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.NATURAL_LANGUAGE })
  }),
  new RepresentationCandidate({
    id: 'evolution-completeness-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  }),
  new RepresentationCandidate({
    id: 'evolution-completeness-unrelated-failure',
    selectorFactory: () => {
      incompleteCandidateCalls += 1;
      if (incompleteCandidateCalls % 2 === 0) {
        throw new Error('unrelated candidate failed during search');
      }
      return new HeuristicRepresentationSelector();
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
assert.equal(searchReport.complete, false);
assert.equal(reproductionReport.complete, false);
assert.equal(searchReport.allAuditsValid, true);
assert.equal(reproductionReport.allAuditsValid, true);

const authority = new EvolutionAuthority();
const proposal = authority.propose({
  id: 'evolution-completeness-proposal',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'evolution-completeness-baseline',
  candidateCandidateId: 'evolution-completeness-candidate'
});

assert.equal(proposal.reproducible, false);
assert.equal(authority.approve(proposal).approved, false);

console.log('FLUID_EVOLUTION_COMPLETENESS_BOUNDARY_OK');
