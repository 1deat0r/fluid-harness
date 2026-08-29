import assert from 'node:assert/strict';

import { isTrustedAgentArchitectureProposalReport } from '../src/agent-architecture-proposal.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempts-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidate,
  failingPlannerCandidate,
  evaluationCase,
  budgets
} = fixture;

const refusedBatch = factory.proposeArchitectures({
  goal: 'archive a design whose replay will earn no tested credit',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const refused = factory.manufactureFromArchivedProposals(refusedBatch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(refused.status, 'REJECTED');
const adoptedBatch = factory.proposeArchitectures({
  goal: 'archive a design whose replay will be adopted',
  plannerCandidates: [plannerCandidate],
  archive: true
});
factory.manufactureFromArchivedProposals(adoptedBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});

const conversion = factory.architectureProposalConversion();
assert.deepEqual(
  conversion.batches.map((batch) => batch.replayCount),
  [1, 1]
);
assert.equal(conversion.convertedFingerprintCount, 1);
assert.equal(conversion.untestedFingerprintCount, 1);
const outcomes = factory.architectureProposalReplayOutcomes();
assert.equal(outcomes.replayedBatchCount, 2);
assert.equal(outcomes.adoptedReplayCount, 1);
assert.equal(outcomes.rejectedReplayCount, 1);
assert.deepEqual(outcomes.outcomes.map((outcome) => outcome.replayCount), [1, 1]);

const conversionSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION;
const outcomeSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-proposal-replay-attempts-memory'
});
const conversionResult = memory.query({ source: conversionSource, limit: 8 });
assert.equal(conversionResult.totalMatches, 1);
const conversionEntry = conversionResult.results[0];
assert.equal(
  conversionEntry.keywords.includes(
    `converted-architectures-${conversion.convertedFingerprintCount}`
  ),
  true
);
assert.equal(
  conversionEntry.keywords.includes(
    `untested-architectures-${conversion.untestedFingerprintCount}`
  ),
  true
);
assert.equal(
  conversionEntry.keywords.includes(`replayed-batches-${conversion.replayedBatchCount}`),
  true
);

const outcomeResult = memory.query({ source: outcomeSource, limit: 8 });
assert.equal(outcomeResult.totalMatches, 1);
const outcomeEntry = outcomeResult.results[0];
assert.equal(outcomeEntry.source, outcomeSource);
assert.equal(outcomeEntry.evidence, 'OBSERVED');
assert.equal(outcomeEntry.historicalOnly, true);
assert.equal(outcomeEntry.dataOnly, true);
assert.equal(
  outcomeEntry.keywords.includes(`replayed-batches-${outcomes.replayedBatchCount}`),
  true
);
assert.equal(
  outcomeEntry.keywords.includes(`adopted-replays-${outcomes.adoptedReplayCount}`),
  true
);
assert.equal(
  outcomeEntry.keywords.includes(`rejected-replays-${outcomes.rejectedReplayCount}`),
  true
);
assert.equal(
  outcomeEntry.keywords.includes(`attributed-replays-${outcomes.attributedReplayCount}`),
  true
);
assert.equal(Object.hasOwn(outcomeEntry, 'outcomes'), false);
assert.equal(Object.hasOwn(outcomeEntry, 'deltas'), false);
assert.equal(Object.hasOwn(outcomeEntry, 'replayCount'), false);
assert.equal(Object.hasOwn(outcomeEntry, 'candidate'), false);
assert.equal(Object.hasOwn(outcomeEntry, 'runner'), false);
assert.equal(outcomeEntry.provenance.kind, 'architecture-discovery');

const combined = memory.query({
  sources: [conversionSource, outcomeSource],
  limit: 8
});
assert.deepEqual(combined.sourceCounts, {
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION: 1,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME: 1
});
const context = buildStructuredMemoryContext({
  memory,
  query: { sources: [conversionSource, outcomeSource], limit: 8 }
});
const proposalReport = fixture.proposalRunner.propose({
  goal: 'fresh proposer sees which archived exploration is still untested',
  plannerCandidateIds: [plannerCandidate.id],
  researchContext: context
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);
assert.equal(proposalReport.researchContext.resultCount, 2);
assert.equal(proposalReport.researchContext.historicalOnly, true);
assert.equal(proposalReport.researchContext.authorityTransferred, false);

const archiveQuery = factory.proposeArchitectures({
  goal: 'archive-backed proposal pass reads the attempt evidence',
  plannerCandidates: [plannerCandidate],
  memoryQuery: {
    sources: [conversionSource, outcomeSource],
    limit: 8
  }
});
assert.equal(archiveQuery.researchContext.resultCount, 2);
assert.deepEqual(archiveQuery.researchContext.sourceCounts, {
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION: 1,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME: 1
});
assert.equal(archiveQuery.archived, false);

const beforeLedger = ledger.serialize();
memory.query({ source: outcomeSource, limit: 8 });
factory.architectureProposalReplayOutcomes();
assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPTS_MEMORY_OK `
  + `replayed=${outcomeEntry.keywords.find((keyword) => keyword.startsWith('replayed-batches-'))} `
  + `adopted=${outcomeEntry.keywords.find((keyword) => keyword.startsWith('adopted-replays-'))} `
  + `rejected=${outcomeEntry.keywords.find((keyword) => keyword.startsWith('rejected-replays-'))} `
  + `untested=${conversionEntry.keywords.find((keyword) => keyword.startsWith('untested-architectures-'))} `
  + `combined=${combined.returnedCount} sources=${Object.keys(combined.sourceCounts).sort().join(',')} `
  + `provenance=${outcomeEntry.provenance.kind}:${outcomeEntry.provenance.sequence} `
  + `evidence=${outcomeEntry.evidence} historicalOnly=${outcomeEntry.historicalOnly} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposalReport)} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
