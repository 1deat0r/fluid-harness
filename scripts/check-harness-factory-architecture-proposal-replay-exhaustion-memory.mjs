import assert from 'node:assert/strict';

import { isTrustedAgentArchitectureProposalReport } from '../src/agent-architecture-proposal.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import {
  MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-exhaustion-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  failingPlannerCandidate,
  evaluationCase,
  budgets,
  proposalRunner
} = fixture;
const batch = factory.proposeArchitectures({
  goal: 'archive exhausted replay history for a fresh proposer',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
for (let attempt = 0; attempt < MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS; attempt += 1) {
  factory.manufactureFromArchivedProposals(batch, {
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  });
}
const conversion = factory.architectureProposalConversion();
assert.equal(conversion.exhaustedBatchCount, 1);

const source = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-proposal-replay-exhaustion-memory'
});
const result = memory.query({ source, limit: 8 });
assert.equal(result.totalMatches, 1);
const entry = result.results[0];
assert.equal(entry.evidence, 'OBSERVED');
assert.equal(entry.historicalOnly, true);
assert.equal(entry.dataOnly, true);
assert.equal(entry.keywords.includes('exhausted-batches-1'), true);
assert.equal(entry.keywords.includes('replay-attempt-limit-3'), true);
assert.equal(entry.keywords.includes('replayed-batches-1'), true);
assert.equal(entry.keywords.includes('untested-architectures-1'), true);
assert.equal(Object.hasOwn(entry, 'candidate'), false);
assert.equal(Object.hasOwn(entry, 'proposals'), false);
assert.equal(Object.hasOwn(entry, 'runner'), false);

const context = buildStructuredMemoryContext({
  memory,
  query: { source, keywords: ['exhausted-batches-1'], limit: 8 }
});
const proposal = proposalRunner.propose({
  goal: 'use exhaustion only as historical context for a fresh proposal',
  plannerCandidateIds: [failingPlannerCandidate.id],
  researchContext: context
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposal), true);
assert.equal(proposal.researchContext.resultCount, 1);
assert.equal(proposal.researchContext.historicalOnly, true);
assert.equal(proposal.researchContext.dataOnly, true);
assert.equal(proposal.researchContext.authorityTransferred, false);
const beforeRead = ledger.serialize();
memory.query({ source, keywords: ['exhausted-batches-1'], limit: 8 });
assert.equal(ledger.serialize(), beforeRead);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXHAUSTION_MEMORY_OK `
  + `matches=${result.returnedCount} exhausted=exhausted-batches-1 `
  + `limit=replay-attempt-limit-3 evidence=${entry.evidence} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposal)} `
  + `historicalOnly=${context.historicalOnly} dataOnly=${context.dataOnly} `
  + `authorityTransferred=${context.authorityTransferred} verify=${ledger.verify()}`
);
