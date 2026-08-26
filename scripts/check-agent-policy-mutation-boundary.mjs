import assert from 'node:assert/strict';

import {
  AgentPolicy,
  EvolutionAuthority,
  isTrustedAgentPolicy,
  isTrustedAgentPolicyApplication,
  MUTATION_LEVELS,
  MUTATION_TARGETS
} from '../src/evolution.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector, REPRESENTATIONS } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const cases = [
  new EvaluationCase({
    id: 'policy-mutation-graph',
    domain: 'graph',
    task: { id: 'policy-mutation-graph-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report.result.path.join('>') === 'A>B'
  }),
  new EvaluationCase({
    id: 'policy-mutation-ambiguous',
    domain: 'robustness',
    productionEligible: false,
    adversarial: true,
    requiresProof: false,
    task: { id: 'policy-mutation-ambiguous-task', description: 'Graph database' },
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
    id: 'policy-mutation-baseline',
    selectorFactory: () => ({ select: () => REPRESENTATIONS.GRAPH })
  }),
  new RepresentationCandidate({
    id: 'policy-mutation-candidate',
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
const baselinePolicy = new AgentPolicy({ maxEpisodes: 4, maxToolCallsPerEpisode: 2 });
const candidatePolicy = new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 1 });
const authority = new EvolutionAuthority({ unlockedThrough: MUTATION_LEVELS.PROMPTS });
const proposal = authority.propose({
  id: 'policy-mutation-proposal',
  level: MUTATION_LEVELS.POLICIES,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'policy-mutation-baseline',
  candidateCandidateId: 'policy-mutation-candidate',
  baselinePolicy,
  candidatePolicy
});
const decision = authority.approve(proposal);

assert.equal(decision.approved, true);
assert.equal(proposal.mutationTarget, MUTATION_TARGETS.AGENT_POLICY);
assert.equal(proposal.baselinePolicy, baselinePolicy);
assert.equal(proposal.candidatePolicy, candidatePolicy);
assert.equal(isTrustedAgentPolicy(baselinePolicy), true);
assert.equal(isTrustedAgentPolicy(candidatePolicy), true);
assert.equal(Object.isFrozen(baselinePolicy), true);
assert.equal(Object.isFrozen(candidatePolicy), true);

const foreignAuthority = new EvolutionAuthority({ unlockedThrough: MUTATION_LEVELS.PROMPTS });
assert.throws(
  () => foreignAuthority.applyAgentPolicy({
    permit: decision.permit,
    currentPolicy: baselinePolicy,
    nextPolicy: candidatePolicy
  }),
  /permit issued by EvolutionAuthority/
);
assert.throws(
  () => authority.applyAgentPolicy({
    permit: decision.permit,
    currentPolicy: new AgentPolicy({ maxEpisodes: 3, maxToolCallsPerEpisode: 2 }),
    nextPolicy: candidatePolicy
  }),
  /baseline fingerprint/
);
assert.throws(
  () => authority.applyAgentPolicy({
    permit: decision.permit,
    currentPolicy: baselinePolicy,
    nextPolicy: new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 })
  }),
  /candidate fingerprint/
);

const searchOnlyAuthority = new EvolutionAuthority({ unlockedThrough: MUTATION_LEVELS.PROMPTS });
const searchOnlyProposal = searchOnlyAuthority.propose({
  id: 'search-only-policy-application',
  level: MUTATION_LEVELS.POLICIES,
  searchReport,
  reproductionReport,
  baselineCandidateId: 'policy-mutation-baseline',
  candidateCandidateId: 'policy-mutation-candidate'
});
const searchOnlyDecision = searchOnlyAuthority.approve(searchOnlyProposal);
assert.equal(searchOnlyDecision.approved, true);
assert.throws(
  () => searchOnlyAuthority.applyAgentPolicy({
    permit: searchOnlyDecision.permit,
    currentPolicy: baselinePolicy,
    nextPolicy: candidatePolicy
  }),
  /not bound to an agent policy target/
);

const application = authority.applyAgentPolicy({
  permit: decision.permit,
  currentPolicy: baselinePolicy,
  nextPolicy: candidatePolicy
});
assert.equal(isTrustedAgentPolicyApplication(application), true);
assert.equal(application.proposalId, proposal.id);
assert.equal(application.previousPolicy, baselinePolicy);
assert.equal(application.currentPolicy, candidatePolicy);
assert.equal(Object.isFrozen(application), true);
assert.throws(
  () => authority.applyAgentPolicy({
    permit: decision.permit,
    currentPolicy: baselinePolicy,
    nextPolicy: candidatePolicy
  }),
  /already been consumed/
);

console.log(
  `FLUID_AGENT_POLICY_MUTATION_OK target=${proposal.mutationTarget} `
  + `level=${decision.level} approved=${decision.approved} `
  + `application=${isTrustedAgentPolicyApplication(application)} replayRejected=true`
);
