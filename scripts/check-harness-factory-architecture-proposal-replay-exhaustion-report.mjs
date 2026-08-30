import assert from 'node:assert/strict';

import {
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES,
  MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-exhaustion-report',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const { factory, ledger, failingPlannerCandidate, evaluationCase, budgets } = fixture;
const batch = factory.proposeArchitectures({
  goal: 'archive a proposal whose report will reach exhaustion',
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
const report = factory.architectureProposalConversion();
assert.equal(report.replayAttemptLimit, 3);
assert.equal(report.exhaustedBatchCount, 1);
assert.equal(report.replayedBatchCount, 1);
assert.equal(report.convertedBatchCount, 0);
assert.equal(report.untestedBatchCount, 0);
assert.equal(report.batches[0].replayAttemptLimit, 3);
assert.equal(report.batches[0].replayAttemptsRemaining, 0);
assert.equal(report.batches[0].replayExhausted, true);
assert.equal(report.batches[0].status, 'EXHAUSTED');
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.batches), true);
assert.equal(Object.isFrozen(report.batches[0]), true);

const restoredFactory = new HarnessFactory({
  factoryId: factory.factoryId,
  discoveryRunner: fixture.discoveryRunner,
  ledger: EvidenceLedger.fromSerialized(ledger.serialize())
});
assert.deepEqual(restoredFactory.architectureProposalConversion(), report);

for (let index = 0; index < 9; index += 1) {
  factory.proposeArchitectures({
    goal: `archive untouched overflow proposal ${index + 1}`,
    plannerCandidates: [failingPlannerCandidate],
    archive: true
  });
}
const overflow = factory.architectureProposalConversion();
assert.equal(overflow.consideredBatchCount, 10);
assert.equal(overflow.returnedBatchCount, MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES);
assert.equal(overflow.truncated, true);
assert.equal(overflow.exhaustedBatchCount, 1);
assert.equal(overflow.batches.some((candidate) => candidate.status === 'EXHAUSTED'), false);
assert.equal(
  overflow.replayedBatchCount + overflow.convertedBatchCount + overflow.untestedBatchCount,
  overflow.consideredBatchCount
);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXHAUSTION_REPORT_OK `
  + `limit=${report.replayAttemptLimit} status=${report.batches[0].status} `
  + `remaining=${report.batches[0].replayAttemptsRemaining} exhausted=${overflow.exhaustedBatchCount} `
  + `considered=${overflow.consideredBatchCount} returned=${overflow.returnedBatchCount} `
  + `truncated=${overflow.truncated} roundTrip=true frozen=true verify=${ledger.verify()}`
);
