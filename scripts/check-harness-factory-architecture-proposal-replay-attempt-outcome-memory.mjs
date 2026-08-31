import assert from 'node:assert/strict';

import { isTrustedAgentArchitectureProposalReport } from '../src/agent-architecture-proposal.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempt-outcome-memory',
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
  goal: 'archive three replay attempts for exact observed-only memory',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
for (let attempt = 0; attempt < 3; attempt += 1) {
  factory.manufactureFromArchivedProposals(batch, {
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  });
}
const source = MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME;
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'harness-factory-proposal-replay-attempt-outcome-memory'
});
const result = memory.query({ source, keywords: ['replay-attempts-3'], limit: 8 });
assert.equal(result.totalMatches, 1);
const entry = result.results[0];
assert.equal(entry.keywords.includes('replay-attempts-3'), true);
assert.equal(entry.keywords.includes('replayed-batches-1'), true);
assert.equal(entry.keywords.includes('rejected-replays-3'), true);
assert.equal(entry.evidence, 'OBSERVED');
assert.equal(entry.historicalOnly, true);
assert.equal(entry.dataOnly, true);
for (const key of ['attempts', 'candidate', 'discovery', 'proposals', 'runner']) {
  assert.equal(Object.hasOwn(entry, key), false);
}
const context = buildStructuredMemoryContext({
  memory,
  query: { source, keywords: ['replay-attempts-3'], limit: 8 }
});
const proposal = proposalRunner.propose({
  goal: 'use exact retry history only as data-only proposal context',
  plannerCandidateIds: [failingPlannerCandidate.id],
  researchContext: context
});
assert.equal(isTrustedAgentArchitectureProposalReport(proposal), true);
assert.equal(context.historicalOnly, true);
assert.equal(context.dataOnly, true);
assert.equal(context.authorityTransferred, false);
const beforeRead = ledger.serialize();
memory.query({ source, keywords: ['replay-attempts-3'], limit: 8 });
assert.equal(ledger.serialize(), beforeRead);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_MEMORY_OK `
  + `attempts=replay-attempts-3 batches=replayed-batches-1 rejected=rejected-replays-3 `
  + `evidence=${entry.evidence} historicalOnly=${context.historicalOnly} `
  + `dataOnly=${context.dataOnly} authorityTransferred=${context.authorityTransferred} `
  + `freshProposer=${isTrustedAgentArchitectureProposalReport(proposal)} verify=${ledger.verify()}`
);
