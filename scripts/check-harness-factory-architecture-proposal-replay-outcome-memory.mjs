import assert from 'node:assert/strict';

import { isTrustedAgentArchitectureProposalReport } from '../src/agent-architecture-proposal.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-outcome-memory',
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

factory.manufacture({
  goal: 'open with a failing generation so a later replay can gain',
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const replayedBatch = factory.proposeArchitectures({
  goal: 'archive the batch whose replay outcome becomes memory',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const replay = factory.manufactureFromArchivedProposals(replayedBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(replay.status, 'ADOPTED');
const idleBatch = factory.proposeArchitectures({
  goal: 'archive a second batch that stays untested',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.notEqual(idleBatch.archive.sequence, replayedBatch.archive.sequence);
const idleBatchRecord = idleBatch.archive;

const view = factory.architectureProposalReplayOutcomes();
assert.equal(view.consideredBatchCount, 2);
assert.equal(view.replayedBatchCount, 1);
assert.equal(view.attributedReplayCount, 1);
assert.equal(view.outcomes[1].outcome, 'NOT_REPLAYED');

const outcomeSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME;
const conversionSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION;
const proposalSource = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-proposal-replay-outcome-memory'
});
const outcomeResult = memory.query({ source: outcomeSource, limit: 8 });
assert.equal(outcomeResult.totalMatches, 1);
assert.equal(outcomeResult.returnedCount, 1);
const entry = outcomeResult.results[0];
assert.equal(entry.source, outcomeSource);
assert.equal(entry.strategyKey, 'harness-factory-proposal-replay-outcome');
assert.equal(entry.evidence, 'OBSERVED');
assert.equal(entry.historicalOnly, true);
assert.equal(entry.dataOnly, true);
assert.equal(entry.provenance.kind, 'harness-factory-architecture-proposals');
assert.deepEqual(entry.provenance, idleBatchRecord);
assert.equal(
  entry.keywords.includes(`archived-batches-${view.consideredBatchCount}`),
  true
);
assert.equal(
  entry.keywords.includes(`replayed-batches-${view.replayedBatchCount}`),
  true
);
assert.equal(
  entry.keywords.includes(
    `unreplayed-batches-${view.consideredBatchCount - view.replayedBatchCount}`
  ),
  true
);
assert.equal(
  entry.keywords.includes(`adopted-replays-${view.adoptedReplayCount}`),
  true
);
assert.equal(
  entry.keywords.includes(`rejected-replays-${view.rejectedReplayCount}`),
  true
);
assert.equal(
  entry.keywords.includes(`attributed-replays-${view.attributedReplayCount}`),
  true
);
assert.equal(entry.keywords.includes('adopted-replays-1'), true);
assert.equal(entry.keywords.includes(`factory-${factory.factoryId}`), true);
assert.equal(Object.hasOwn(entry, 'outcomes'), false);
assert.equal(Object.hasOwn(entry, 'deltas'), false);
assert.equal(Object.hasOwn(entry, 'candidate'), false);
assert.equal(Object.hasOwn(entry, 'runner'), false);
assert.equal(Object.hasOwn(entry, 'proposals'), false);

const combined = memory.query({
  sources: [outcomeSource, conversionSource, proposalSource],
  limit: 16
});
assert.deepEqual(combined.sourceCounts, {
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL: 2,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION: 1,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME: 1
});
assert.equal(combined.totalMatches, 4);

const context = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [outcomeSource, conversionSource, proposalSource],
    limit: 16
  }
});
const proposalReport = fixture.proposalRunner.propose({
  goal: 'fresh proposer receives the replay outcome funnel with history',
  plannerCandidateIds: [plannerCandidate.id],
  researchContext: context
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);
assert.equal(proposalReport.researchContext.resultCount, 4);
assert.equal(proposalReport.researchContext.historicalOnly, true);
assert.equal(proposalReport.researchContext.dataOnly, true);
assert.equal(proposalReport.researchContext.authorityTransferred, false);

const archivedContext = factory.proposeArchitectures({
  goal: 'archive-backed proposal pass can query the replay outcome source',
  plannerCandidates: [plannerCandidate],
  memoryQuery: { source: outcomeSource, keywords: ['harness-factory-proposal-replay-outcome'] }
});
assert.equal(archivedContext.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(archivedContext.researchContext.query.source, outcomeSource);
assert.equal(archivedContext.researchContext.resultCount, 1);
assert.equal(archivedContext.archived, false);

const beforeLedger = ledger.serialize();
memory.query({ source: outcomeSource, limit: 8 });
assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_MEMORY_OK `
  + `outcomeMatches=${outcomeResult.returnedCount} combinedMatches=${combined.returnedCount} `
  + `sources=${Object.keys(combined.sourceCounts).sort().join(',')} `
  + `replayed=${entry.keywords.find((keyword) => keyword.startsWith('replayed-batches-'))} `
  + `attributed=${entry.keywords.find((keyword) => keyword.startsWith('attributed-replays-'))} `
  + `provenance=${entry.provenance.kind}:${entry.provenance.sequence} `
  + `evidence=${entry.evidence} historicalOnly=${entry.historicalOnly} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposalReport)} `
  + `archiveQuery=${archivedContext.researchContext.resultCount} `
  + `authorityTransferred=${proposalReport.researchContext.authorityTransferred}`
);
