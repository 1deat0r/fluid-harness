import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  PromotionAuthority
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

const cases = [
  new EvaluationCase({
    id: 'evolution-policy-graph',
    domain: 'graph',
    task: { id: 'evolution-policy-graph-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.result?.path?.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'evolution-policy-constraint',
    domain: 'constraints',
    task: {
      id: 'evolution-policy-constraint-task',
      description: 'Schedule jobs under resource constraints'
    },
    input: {
      resources: { cpu: 1 },
      jobs: [{ id: 'job', duration: 1, demand: { cpu: 1 } }]
    },
    expected: (report) => report?.result?.makespan === 1
  }),
  new EvaluationCase({
    id: 'evolution-policy-adversarial',
    domain: 'robustness',
    productionEligible: false,
    adversarial: true,
    requiresProof: false,
    task: {
      id: 'evolution-policy-adversarial-task',
      description: 'Find a graph path but reject malformed input'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (_report, error) => error?.message.includes('No executor')
  })
];

const baseline = new RepresentationCandidate({
  id: 'evolution-policy-baseline',
  selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
});
const candidate = new RepresentationCandidate({
  id: 'evolution-policy-candidate',
  selectorFactory: () => new HeuristicRepresentationSelector()
});

function evaluateSearch() {
  return new RepresentationSearchRunner({
    promotionAuthorityFactory: () => new PromotionAuthority({
      minimumSuccessRate: 0,
      minimumProvenRate: 0,
      requireResearch: false,
      requireSkeptic: false
    })
  }).evaluate({
    candidates: [baseline, candidate],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: 2 }),
    researchBudget: new EvaluationBudget({ maxCases: 3 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  });
}

const searchReport = evaluateSearch();
const reproductionReport = evaluateSearch();
const candidateResult = searchReport.results.find(({ candidateId }) => candidateId === candidate.id);
assert.equal(searchReport.complete, true);
assert.equal(candidateResult.promoted, true);
assert.equal(candidateResult.skeptic.weaknessesExposed, 1);

const authority = new EvolutionAuthority();
const proposal = authority.propose({
  id: 'evolution-policy-boundary-proposal',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  reproductionReport,
  baselineCandidateId: baseline.id,
  candidateCandidateId: candidate.id
});
const approval = authority.approve(proposal);

assert.equal(proposal.reproducible, true);
assert.equal(proposal.candidate.skepticWeaknessesExposed, 1);
assert.equal(proposal.improvement.demonstrated, true);
assert.equal(approval.approved, false);
assert.match(
  approval.reasons.join('|'),
  /every production, research, and skeptic case without exposed weaknesses/
);

console.log('FLUID_EVOLUTION_PROMOTION_POLICY_BOUNDARY_OK');
