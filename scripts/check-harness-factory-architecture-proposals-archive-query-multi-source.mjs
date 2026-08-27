import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-query-multi-source',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const baseline = factory.manufacture({
  goal: 'create factory history for a multi-source proposal query',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(baseline), true);

assert.throws(
  () => factory.improve({
    goal: 'create a rejected archive for a multi-source query',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      keywords: ['adopted']
    }
  }),
  /did not strictly improve measured fitness/
);
assert.equal(ledger.length, 2);

const report = factory.proposeArchitectures({
  goal: 'combine factory history, rejection, and coverage research',
  plannerCandidates: [plannerCandidate],
  memoryQuery: {
    sources: [
      MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
      MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION,
      MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_COVERAGE
    ]
  }
});

assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(report), true);
assert.equal(report.researchContext.resultCount, 3);
assert.deepEqual(
  Object.keys(report.researchContext.sourceCounts).sort(),
  [
    MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_COVERAGE,
    MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION
  ].sort()
);
assert.deepEqual(
  Object.values(report.researchContext.sourceCounts).sort((left, right) => left - right),
  [1, 1, 1]
);
assert.equal(report.researchContext.dataOnly, true);
assert.equal(report.researchContext.historicalOnly, true);
assert.equal(report.researchContext.authorityTransferred, false);
assert.equal(report.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(ledger.length, 2);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_QUERY_MULTI_SOURCE_OK `
  + `sources=${Object.keys(report.researchContext.sourceCounts).sort().join(',')} `
  + `results=${report.researchContext.resultCount} ledgerEntries=${ledger.length} `
  + `historicalOnly=${report.researchContext.historicalOnly}`
);
