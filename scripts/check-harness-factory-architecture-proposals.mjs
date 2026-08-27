import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SOURCES,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES,
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const initial = factory.proposeArchitectures({
  goal: 'propose an architecture before evaluation',
  plannerCandidates: [plannerCandidate]
});
assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(initial), true);
assert.equal(initial.factoryId, factory.factoryId);
assert.equal(initial.goal, 'propose an architecture before evaluation');
assert.equal(initial.source, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SOURCES.PROCESS_ISOLATED);
assert.equal(initial.proposalCount, 1);
assert.equal(initial.novelProposalCount, 1);
assert.equal(initial.repeatedProposalCount, 0);
assert.equal(initial.proposals[0].status, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.NOVEL);
assert.equal(initial.proposals[0].novel, true);
assert.equal(initial.proposals[0].repeated, false);
assert.equal(initial.proposals[0].historicalMatchCount, 0);
assert.equal(initial.proposals[0].batchDuplicate, false);
assert.equal(initial.proposals[0].policy.maxEpisodes, 2);
assert.equal(initial.proposals[0].policy.maxToolCallsPerEpisode, 2);
assert.equal(initial.evaluated, false);
assert.equal(initial.adopted, false);
assert.equal(initial.deployed, false);
assert.equal(initial.dataOnly, true);
assert.equal(initial.authorityTransferred, false);
assert.equal(ledger.length, 0);

const baseline = factory.manufacture({
  goal: 'evaluate the proposed architecture explicitly',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
assert.equal(baseline.status, 'ADOPTED');
assert.equal(ledger.length, 1);

const repeated = factory.proposeArchitectures({
  goal: 'propose the same architecture after evaluation',
  plannerCandidates: [plannerCandidate]
});
assert.equal(repeated.proposals[0].status, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.REPEATED);
assert.equal(repeated.proposals[0].novel, false);
assert.equal(repeated.proposals[0].repeated, true);
assert.equal(repeated.proposals[0].historicalMatchCount, 1);
assert.equal(
  repeated.proposals[0].architectureFingerprint,
  initial.proposals[0].architectureFingerprint
);
assert.equal(ledger.length, 1);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_OK initial=${initial.proposals[0].status} `
  + `afterArchive=${repeated.proposals[0].status} historicalMatches=${repeated.proposals[0].historicalMatchCount} `
  + `ledgerEntries=${ledger.length} dataOnly=${initial.dataOnly} `
  + `authorityTransferred=${initial.authorityTransferred}`
);
