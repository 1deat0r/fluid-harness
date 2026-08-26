import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  EvolutionAuthority,
  isTrustedMutationPermit,
  isTrustedMutationProposal,
  MUTATION_LEVELS
} from '../src/evolution.mjs';
import { HeuristicRepresentationSelector, REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [
    new EvaluationCase({
      id: 'mutation-replay-graph',
      domain: 'graph',
      task: { id: 'mutation-replay-graph-task', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }),
    new EvaluationCase({
      id: 'mutation-replay-ambiguous',
      domain: 'robustness',
      productionEligible: false,
      adversarial: true,
      requiresProof: false,
      task: { id: 'mutation-replay-ambiguous-task', description: 'Graph database' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (_report, error) => error?.message.includes('No executor')
    })
];
const candidates = [
  new RepresentationCandidate({
    id: 'graph-biased-replay',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  }),
  new RepresentationCandidate({
    id: 'heuristic-replay',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })
];
const evaluateSearch = () => new RepresentationSearchRunner().evaluate({
  candidates,
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
const searchReport = evaluateSearch();
const reproductionReport = evaluateSearch();

const donor = new EvolutionAuthority();
const proposal = donor.propose({
  id: 'mutation-replay-proposal',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  baselineCandidateId: 'graph-biased-replay',
  candidateCandidateId: 'heuristic-replay',
  reproductionReport
});
const approved = donor.approve(proposal);
const recipient = new EvolutionAuthority();

assert.equal(approved.approved, true);
assert.equal(isTrustedMutationProposal(proposal, donor), true);
assert.equal(isTrustedMutationProposal(proposal, recipient), false);
assert.throws(
  () => recipient.approve(proposal),
  /issued by EvolutionAuthority/
);
assert.equal(isTrustedMutationPermit(approved.permit, donor), true);
assert.equal(isTrustedMutationPermit(approved.permit, recipient), false);

console.log('FLUID_MUTATION_REPLAY_OK');
