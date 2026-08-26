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
  id: 'candidate-definition-replay-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'candidate-definition-replay-task', description: 'Find a graph path' },
  input,
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
const budget = new EvaluationBudget({ maxCases: 1 });

function candidateSet(selectorFactory) {
  return [
    new RepresentationCandidate({
      id: 'candidate-definition-baseline',
      selectorFactory: () => ({ select: () => REPRESENTATIONS.NATURAL_LANGUAGE })
    }),
    new RepresentationCandidate({
      id: 'candidate-definition-candidate',
      description: 'same named candidate',
      selectorFactory
    })
  ];
}

function evaluate(candidates) {
  return new RepresentationSearchRunner().evaluate({
    candidates,
    cases,
    productionBudget: budget,
    researchBudget: budget,
    skepticBudget: budget
  });
}

const primary = evaluate(candidateSet(() => new HeuristicRepresentationSelector()));
const alternate = evaluate(candidateSet(() => ({ select: () => REPRESENTATIONS.GRAPH })));
const rejectedAuthority = new EvolutionAuthority();
const rejectedProposal = rejectedAuthority.propose({
  id: 'different-candidate-definition',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport: primary,
  reproductionReport: alternate,
  baselineCandidateId: 'candidate-definition-baseline',
  candidateCandidateId: 'candidate-definition-candidate'
});
assert.equal(rejectedProposal.reproducible, false);
assert.equal(rejectedAuthority.approve(rejectedProposal).approved, false);

const sharedCandidates = candidateSet(() => new HeuristicRepresentationSelector());
const sharedPrimary = evaluate(sharedCandidates);
const sharedReproduction = evaluate(sharedCandidates);
const validAuthority = new EvolutionAuthority();
const validProposal = validAuthority.propose({
  id: 'same-candidate-definition',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport: sharedPrimary,
  reproductionReport: sharedReproduction,
  baselineCandidateId: 'candidate-definition-baseline',
  candidateCandidateId: 'candidate-definition-candidate'
});
assert.equal(validProposal.reproducible, true);
assert.equal(validAuthority.approve(validProposal).approved, true);

console.log('FLUID_CANDIDATE_DEFINITION_REPLAY_OK');
