import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES,
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-query',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const baseline = factory.manufacture({
  goal: 'create an archive record for proposal research',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
assert.equal(baseline.status, 'ADOPTED');
assert.equal(ledger.length, 1);

const report = factory.proposeArchitectures({
  goal: 'use the verified factory archive to propose the next configuration',
  plannerCandidates: [plannerCandidate],
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['adopted']
  }
});

assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(report), true);
assert.equal(report.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(report.researchContext.resultCount, 1);
assert.equal(report.researchContext.sourceCounts.ARCHITECTURE_DISCOVERY, 1);
assert.equal(report.researchContext.dataOnly, true);
assert.equal(report.researchContext.historicalOnly, true);
assert.equal(report.researchContext.authorityTransferred, false);
assert.equal(report.proposals[0].components.priorFactoryOutcome, 'adopted');
assert.equal(report.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(report.proposals[0].components.priorFactoryResultCount, 1);
assert.equal(report.proposals[0].status, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.NOVEL);
assert.equal(ledger.length, 1);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_QUERY_OK source=${report.researchContext.source} `
  + `results=${report.researchContext.resultCount} outcome=${report.proposals[0].components.priorFactoryOutcome} `
  + `status=${report.proposals[0].status} ledgerEntries=${ledger.length} `
  + `authorityTransferred=${report.authorityTransferred}`
);
