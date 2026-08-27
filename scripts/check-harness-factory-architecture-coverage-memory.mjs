import assert from 'node:assert/strict';

import { isTrustedAgentArchitectureProposalReport } from '../src/agent-architecture-proposal.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-coverage-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
factory.manufacture({
  goal: 'create coverage memory baseline',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'create repeated coverage memory evidence',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const coverageSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_COVERAGE;
const discoverySource = MEMORY_SOURCES.ARCHITECTURE_DISCOVERY;
const rejectionSource = MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-architecture-coverage-memory'
});
const coverageResult = memory.query({ source: coverageSource, limit: 8 });
assert.equal(coverageResult.totalMatches, 1);
assert.equal(coverageResult.returnedCount, 1);
assert.equal(coverageResult.results[0].source, coverageSource);
assert.equal(coverageResult.results[0].strategyKey, 'harness-factory-architecture-coverage');
assert.equal(coverageResult.results[0].evidence, 'OBSERVED');
assert.equal(coverageResult.results[0].historicalOnly, true);
assert.equal(coverageResult.results[0].dataOnly, true);
assert.equal(coverageResult.results[0].keywords.includes('unique-architectures-1'), true);
assert.equal(coverageResult.results[0].keywords.includes('repeated-attempts-1'), true);
assert.equal(coverageResult.results[0].provenance.kind, 'harness-factory-improvement-rejection');

const combined = memory.query({
  sources: [coverageSource, discoverySource, rejectionSource],
  limit: 8
});
assert.equal(combined.totalMatches, 3);
assert.deepEqual(combined.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 1,
  HARNESS_FACTORY_ARCHITECTURE_COVERAGE: 1,
  HARNESS_FACTORY_IMPROVEMENT_REJECTION: 1
});
const context = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [coverageSource, discoverySource, rejectionSource],
    limit: 8
  }
});
const proposalReport = fixture.proposalRunner.propose({
  goal: 'fresh proposer receives architecture coverage with history',
  plannerCandidateIds: [plannerCandidate.id],
  researchContext: context
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);
assert.equal(proposalReport.researchContext.resultCount, 3);
assert.deepEqual(proposalReport.researchContext.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 1,
  HARNESS_FACTORY_ARCHITECTURE_COVERAGE: 1,
  HARNESS_FACTORY_IMPROVEMENT_REJECTION: 1
});
assert.equal(proposalReport.researchContext.historicalOnly, true);
assert.equal(proposalReport.researchContext.dataOnly, true);
assert.equal(proposalReport.researchContext.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_MEMORY_OK coverageMatches=${coverageResult.returnedCount} `
  + `combinedMatches=${combined.returnedCount} sources=${Object.keys(combined.sourceCounts).join(',')} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposalReport)} `
  + `historicalOnly=${coverageResult.results[0].historicalOnly} `
  + `authorityTransferred=${proposalReport.researchContext.authorityTransferred}`
);
