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

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const cases = [new EvaluationCase({
  id: 'production-regression-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'production-regression-task', description: 'Find a graph path' },
  input,
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
const budget = new EvaluationBudget({ maxCases: 1 });

function modeSwitchingCandidate(id, firstRepresentation, laterRepresentation) {
  let calls = 0;
  return new RepresentationCandidate({
    id,
    selectorFactory: () => {
      calls += 1;
      if (calls === 1) {
        return { select: () => firstRepresentation };
      }
      return laterRepresentation === REPRESENTATIONS.GRAPH
        ? new HeuristicRepresentationSelector()
        : { select: () => laterRepresentation };
    }
  });
}

const candidates = [
  modeSwitchingCandidate(
    'production-baseline',
    REPRESENTATIONS.GRAPH,
    REPRESENTATIONS.NATURAL_LANGUAGE
  ),
  modeSwitchingCandidate(
    'production-regressing-candidate',
    REPRESENTATIONS.NATURAL_LANGUAGE,
    REPRESENTATIONS.GRAPH
  )
];

function evaluateSearch() {
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
const baseline = searchReport.results.find(({ candidateId }) => candidateId === 'production-baseline');
const candidate = searchReport.results.find(({ candidateId }) => candidateId === 'production-regressing-candidate');
assert.equal(baseline.production.successRate, 1);
assert.equal(candidate.production.successRate, 0);
assert.equal(candidate.research.successRate, 1);
assert.equal(candidate.skeptic.adversarialSuccessRate, 1);
assert.equal(candidate.promoted, false);

const authority = new EvolutionAuthority();
const proposal = authority.propose({
  id: 'production-regression-proposal',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'production-baseline',
  candidateCandidateId: 'production-regressing-candidate'
});
assert.equal(proposal.improvement.productionSuccessRate, -1);
assert.equal(proposal.improvement.productionProvenRate, -1);
const decision = authority.approve(proposal);
assert.equal(decision.approved, false);
assert.ok(decision.reasons.includes('candidate must strictly improve without regressing measured metrics'));

console.log('FLUID_PRODUCTION_REGRESSION_OK');
