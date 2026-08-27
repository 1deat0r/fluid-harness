import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES,
  isTrustedHarnessFactoryArchitectureProposalReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-batch',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDuplicateBatch'
});
const { factory, ledger, plannerCandidate } = fixture;

const report = factory.proposeArchitectures({
  goal: 'classify duplicate architecture configurations in one proposal batch',
  plannerCandidates: [plannerCandidate]
});

assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(report), true);
assert.equal(report.proposalCount, 2);
assert.equal(report.novelProposalCount, 1);
assert.equal(report.repeatedProposalCount, 1);
assert.equal(report.proposals[0].status, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.NOVEL);
assert.equal(report.proposals[0].historicalMatchCount, 0);
assert.equal(report.proposals[0].batchDuplicate, false);
assert.equal(report.proposals[1].status, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.REPEATED);
assert.equal(report.proposals[1].historicalMatchCount, 0);
assert.equal(report.proposals[1].batchDuplicate, true);
assert.equal(
  report.proposals[0].architectureFingerprint,
  report.proposals[1].architectureFingerprint
);
assert.equal(report.proposals[0].policy.maxEpisodes, 2);
assert.equal(report.proposals[0].policy.maxToolCallsPerEpisode, 8);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.proposals), true);
assert.equal(Object.isFrozen(report.proposals[0]), true);
assert.equal(Object.isFrozen(report.proposals[0].components), true);
assert.equal(Object.isFrozen(report.proposals[0].policy), true);
assert.equal(report.evaluated, false);
assert.equal(report.adopted, false);
assert.equal(report.deployed, false);
assert.equal(Object.hasOwn(report.proposals[0], 'candidate'), false);
assert.equal(Object.hasOwn(report.proposals[0], 'runner'), false);
assert.equal(Object.hasOwn(report.proposals[0], 'actionReport'), false);
assert.equal(ledger.length, 0);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_BATCH_OK proposals=${report.proposalCount} `
  + `novel=${report.novelProposalCount} repeated=${report.repeatedProposalCount} `
  + `effectiveToolCalls=${report.proposals[0].policy.maxToolCallsPerEpisode} `
  + `ledgerEntries=${ledger.length} frozen=${Object.isFrozen(report)}`
);
