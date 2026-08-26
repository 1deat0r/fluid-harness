import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import {
  EvolutionAuthority,
  MUTATION_LEVELS
} from '../src/evolution.mjs';
import { HeuristicRepresentationSelector, REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [
  new EvaluationCase({
    id: 'reproducibility-graph',
    domain: 'graph',
    task: { id: 'reproducibility-graph-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'reproducibility-ambiguous',
    domain: 'robustness',
    productionEligible: false,
    adversarial: true,
    requiresProof: false,
    task: { id: 'reproducibility-ambiguous-task', description: 'Graph database' },
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
    id: 'reproducibility-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  }),
  new RepresentationCandidate({
    id: 'reproducibility-candidate',
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
const proposalInput = {
  level: MUTATION_LEVELS.PROMPTS,
  searchReport,
  baselineCandidateId: 'reproducibility-baseline',
  candidateCandidateId: 'reproducibility-candidate'
};

const selfAttestedAuthority = new EvolutionAuthority();
const selfAttested = selfAttestedAuthority.propose({
  ...proposalInput,
  id: 'self-attested-reproducibility',
  reproducible: true
});
const selfDecision = selfAttestedAuthority.approve(selfAttested);
assert.equal(selfDecision.approved, false);
assert.ok(selfDecision.reasons.includes('reproducible evidence is required'));

const sameReportAuthority = new EvolutionAuthority();
const sameReport = sameReportAuthority.propose({
  ...proposalInput,
  id: 'same-report-reproducibility',
  reproductionReport: searchReport
});
assert.equal(sameReportAuthority.approve(sameReport).approved, false);

const validAuthority = new EvolutionAuthority();
const validProposal = validAuthority.propose({
  ...proposalInput,
  id: 'independent-reproducibility',
  reproductionReport
});
assert.equal(validAuthority.approve(validProposal).approved, true);

console.log('FLUID_REPRODUCIBILITY_BOUNDARY_OK');
