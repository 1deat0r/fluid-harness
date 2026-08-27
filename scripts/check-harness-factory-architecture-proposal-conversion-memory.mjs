import assert from 'node:assert/strict';

import { isTrustedAgentArchitectureProposalReport } from '../src/agent-architecture-proposal.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-conversion-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const batchA = factory.proposeArchitectures({
  goal: 'archive a batch before conversion memory exists',
  plannerCandidates: [plannerCandidate],
  archive: true
});
factory.manufacture({
  goal: 'evaluate the archived architecture independently',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const batchB = factory.proposeArchitectures({
  goal: 'archive the batch that the replay bridge will test',
  plannerCandidates: [plannerCandidate],
  archive: true
});
factory.manufactureFromArchivedProposals(batchB, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});

const conversion = factory.architectureProposalConversion();
assert.equal(conversion.consideredBatchCount, 2);
assert.equal(conversion.replayedBatchCount, 1);
assert.equal(conversion.convertedFingerprintCount, 1);

const conversionSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION;
const proposalSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL;
const coverageSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_COVERAGE;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-proposal-conversion-memory'
});
const conversionResult = memory.query({ source: conversionSource, limit: 8 });
assert.equal(conversionResult.totalMatches, 1);
assert.equal(conversionResult.returnedCount, 1);
const entry = conversionResult.results[0];
assert.equal(entry.source, conversionSource);
assert.equal(entry.strategyKey, 'harness-factory-proposal-conversion');
assert.equal(entry.evidence, 'OBSERVED');
assert.equal(entry.historicalOnly, true);
assert.equal(entry.dataOnly, true);
assert.equal(entry.provenance.kind, 'harness-factory-architecture-proposals');
assert.equal(entry.provenance.sequence, batchB.archive.sequence);
assert.equal(entry.keywords.includes(`archived-batches-${conversion.consideredBatchCount}`), true);
assert.equal(
  entry.keywords.includes(`archived-architectures-${conversion.archivedFingerprintCount}`),
  true
);
assert.equal(
  entry.keywords.includes(`converted-architectures-${conversion.convertedFingerprintCount}`),
  true
);
assert.equal(
  entry.keywords.includes(`untested-architectures-${conversion.untestedFingerprintCount}`),
  true
);
assert.equal(
  entry.keywords.includes(`replayed-batches-${conversion.replayedBatchCount}`),
  true
);
assert.equal(entry.keywords.includes(`untested-batches-${conversion.untestedBatchCount}`), true);
assert.equal(Object.hasOwn(entry, 'proposals'), false);
assert.equal(Object.hasOwn(entry, 'candidate'), false);
assert.equal(Object.hasOwn(entry, 'runner'), false);

const combined = memory.query({
  sources: [conversionSource, proposalSource, coverageSource],
  limit: 16
});
assert.deepEqual(combined.sourceCounts, {
  HARNESS_FACTORY_ARCHITECTURE_COVERAGE: 1,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL: 2,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION: 1
});
assert.equal(combined.totalMatches, 4);

const context = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [conversionSource, proposalSource, coverageSource],
    limit: 16
  }
});
const proposalReport = fixture.proposalRunner.propose({
  goal: 'fresh proposer receives the conversion funnel with history',
  plannerCandidateIds: [plannerCandidate.id],
  researchContext: context
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);
assert.equal(proposalReport.researchContext.resultCount, 4);
assert.equal(proposalReport.researchContext.historicalOnly, true);
assert.equal(proposalReport.researchContext.dataOnly, true);
assert.equal(proposalReport.researchContext.authorityTransferred, false);
const beforeLedger = ledger.serialize();
memory.query({ source: conversionSource, limit: 8 });
assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_MEMORY_OK `
  + `conversionMatches=${conversionResult.returnedCount} combinedMatches=${combined.returnedCount} `
  + `sources=${Object.keys(combined.sourceCounts).sort().join(',')} `
  + `batches=${entry.keywords.find((keyword) => keyword.startsWith('archived-batches-'))} `
  + `converted=${entry.keywords.find((keyword) => keyword.startsWith('converted-architectures-'))} `
  + `replayed=${entry.keywords.find((keyword) => keyword.startsWith('replayed-batches-'))} `
  + `evidence=${entry.evidence} historicalOnly=${entry.historicalOnly} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposalReport)} `
  + `authorityTransferred=${proposalReport.researchContext.authorityTransferred}`
);
