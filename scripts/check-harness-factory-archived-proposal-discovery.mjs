import assert from 'node:assert/strict';

import {
  AgentArchitectureProposal,
  AgentArchitectureProposalReport,
  isTrustedAgentArchitectureProposalReport
} from '../src/agent-architecture-proposal.mjs';
import {
  isTrustedAgentArchitectureDiscoveryReport
} from '../src/agent-architecture-discovery.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-archived-discovery',
  includeResearch: false
});
const {
  factory,
  discoveryRunner,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const archived = factory.proposeArchitectures({
  goal: 'evaluate an archived architecture proposal batch',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const proposalReport = new AgentArchitectureProposalReport({
  goal: archived.goal,
  source: archived.source,
  researchContext: archived.researchContext,
  proposals: archived.proposals.map((proposal) => new AgentArchitectureProposal({
    id: proposal.id,
    plannerCandidateId: proposal.plannerCandidateId,
    policy: proposal.policy,
    components: proposal.components
  }))
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);

const discovery = discoveryRunner.discoverFromProposalReport({
  proposalReport,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedAgentArchitectureDiscoveryReport(discovery), true);
assert.equal(discovery.goal, archived.goal);
assert.equal(discovery.proposalReport, proposalReport);
assert.equal(discovery.primary.complete, true);
assert.equal(discovery.reproduction.complete, true);
assert.equal(discovery.reproducibility.reproducible, true);
assert.equal(discovery.adopted, true);
assert.equal(discovery.complete, true);
assert.equal(discovery.deployed, false);
assert.equal(discovery.dataOnly, false);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHIVED_PROPOSAL_DISCOVERY_OK `
  + `proposals=${discovery.proposals.length} candidates=${discovery.candidates.length} `
  + `primaryComplete=${discovery.primary.complete} `
  + `reproductionComplete=${discovery.reproduction.complete} `
  + `reproducible=${discovery.reproducibility.reproducible} adopted=${discovery.adopted}`
);
