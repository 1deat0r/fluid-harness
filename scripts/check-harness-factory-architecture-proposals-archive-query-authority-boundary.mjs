import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-query-authority-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const baseline = factory.manufacture({
  goal: 'create one historical generation before querying it',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);
const beforeLedger = ledger.serialize();

const report = factory.proposeArchitectures({
  goal: 'return only a historical archive summary',
  plannerCandidates: [plannerCandidate],
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['adopted']
  }
});

assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(report), true);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(report.evaluated, false);
assert.equal(report.adopted, false);
assert.equal(report.deployed, false);
assert.equal(report.researchContext.dataOnly, true);
assert.equal(report.researchContext.historicalOnly, true);
assert.equal(report.researchContext.authorityTransferred, false);
assert.equal(Object.hasOwn(report, 'candidate'), false);
assert.equal(Object.hasOwn(report, 'runner'), false);
assert.equal(Object.hasOwn(report, 'actionReport'), false);
assert.equal(Object.hasOwn(report.proposals[0], 'candidate'), false);
assert.equal(Object.hasOwn(report.proposals[0], 'runner'), false);
assert.equal(Object.hasOwn(report.proposals[0], 'actionReport'), false);
assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_QUERY_AUTHORITY_BOUNDARY_OK `
  + `historicalOnly=${report.researchContext.historicalOnly} dataOnly=${report.dataOnly} `
  + `evaluated=${report.evaluated} adopted=${report.adopted} deployed=${report.deployed} `
  + `ledgerPreserved=${ledger.verify()}`
);
