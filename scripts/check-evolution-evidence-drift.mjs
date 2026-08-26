import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  EvolutionAuthority,
  MUTATION_LEVELS
} from '../src/evolution.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [new EvaluationCase({
  id: 'evolution-evidence-drift-case',
  domain: 'representation',
  adversarial: true,
  requiresProof: false,
  task: { id: 'evolution-evidence-drift-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: () => true
})];
let candidateCalls = 0;
const candidates = [
  new RepresentationCandidate({
    id: 'evolution-evidence-drift-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.NATURAL_LANGUAGE })
  }),
  new RepresentationCandidate({
    id: 'evolution-evidence-drift-candidate',
    selectorFactory: () => {
      candidateCalls += 1;
      const representation = candidateCalls <= 3
        ? REPRESENTATIONS.GRAPH
        : REPRESENTATIONS.NATURAL_LANGUAGE;
      return { select: () => representation };
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
const primaryCandidate = searchReport.results.find(
  ({ candidateId }) => candidateId === 'evolution-evidence-drift-candidate'
);
const reproductionCandidate = reproductionReport.results.find(
  ({ candidateId }) => candidateId === 'evolution-evidence-drift-candidate'
);

assert.equal(searchReport.complete, true);
assert.equal(reproductionReport.complete, true);
assert.equal(primaryCandidate.production.results[0].representation, REPRESENTATIONS.GRAPH);
assert.equal(reproductionCandidate.production.results[0].representation, null);
assert.deepEqual(primaryCandidate.fitness, reproductionCandidate.fitness);
assert.equal(
  primaryCandidate.definitionFingerprint,
  reproductionCandidate.definitionFingerprint
);

const authority = new EvolutionAuthority();
const proposal = authority.propose({
  id: 'evolution-evidence-drift-proposal',
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'evolution-evidence-drift-baseline',
  candidateCandidateId: 'evolution-evidence-drift-candidate'
});

assert.equal(proposal.reproducible, false);

console.log('FLUID_EVOLUTION_EVIDENCE_DRIFT_OK');
