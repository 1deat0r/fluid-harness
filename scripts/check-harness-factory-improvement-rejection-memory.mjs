import assert from 'node:assert/strict';

import {
  isTrustedAgentArchitectureProposalReport
} from '../src/agent-architecture-proposal.mjs';
import { memoryFromLedger, MEMORY_SOURCES, buildStructuredMemoryContext } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-rejection-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
factory.manufacture({
  goal: 'create discovery and rejected-improvement memory',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'archive a rejected improvement for memory retrieval',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-improvement-rejection-memory'
});
const rejectionSource = MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION;
const discoverySource = MEMORY_SOURCES.ARCHITECTURE_DISCOVERY;
const rejectionResult = memory.query({ source: rejectionSource, limit: 8 });
assert.equal(rejectionResult.totalMatches, 1);
assert.equal(rejectionResult.returnedCount, 1);
assert.equal(rejectionResult.results[0].source, rejectionSource);
assert.equal(rejectionResult.results[0].evidence, 'OBSERVED');
assert.equal(rejectionResult.results[0].historicalOnly, true);
assert.equal(rejectionResult.results[0].dataOnly, true);
assert.equal(rejectionResult.results[0].strategyKey, 'harness-factory-improvement-rejection');
assert.equal(rejectionResult.results[0].provenance.kind, 'harness-factory-improvement-rejection');
assert.equal(Object.hasOwn(rejectionResult.results[0], 'runner'), false);
assert.equal(Object.hasOwn(rejectionResult.results[0], 'actionReport'), false);

const combined = memory.query({
  sources: [rejectionSource, discoverySource],
  limit: 8
});
assert.equal(combined.totalMatches, 2);
assert.deepEqual(combined.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 1,
  HARNESS_FACTORY_IMPROVEMENT_REJECTION: 1
});
const combinedContext = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [rejectionSource, discoverySource],
    limit: 8
  }
});
const proposalReport = fixture.proposalRunner.propose({
  goal: 'fresh proposer receives combined factory evidence',
  plannerCandidateIds: [plannerCandidate.id],
  researchContext: combinedContext
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);
assert.equal(proposalReport.researchContext.resultCount, 2);
assert.deepEqual(proposalReport.researchContext.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 1,
  HARNESS_FACTORY_IMPROVEMENT_REJECTION: 1
});
assert.equal(proposalReport.researchContext.dataOnly, true);
assert.equal(proposalReport.researchContext.historicalOnly, true);
assert.equal(proposalReport.researchContext.authorityTransferred, false);
assert.equal(factory.improvementRejections().returnedRejectionCount, 1);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_REJECTION_MEMORY_OK rejectionMatches=${rejectionResult.returnedCount} `
  + `combinedMatches=${combined.returnedCount} sources=${Object.keys(combined.sourceCounts).join(',')} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposalReport)} `
  + `historicalOnly=${rejectionResult.results[0].historicalOnly} `
  + `authorityTransferred=${proposalReport.researchContext.authorityTransferred}`
);
