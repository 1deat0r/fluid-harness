import assert from 'node:assert/strict';

import {
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_ENTRIES
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempt-outcome-report',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const { factory, ledger, failingPlannerCandidate, evaluationCase, budgets } = fixture;
const batches = [];
for (let index = 0; index < 9; index += 1) {
  batches.push(factory.proposeArchitectures({
    goal: `archive replay-attempt report batch ${index + 1}`,
    plannerCandidates: [failingPlannerCandidate],
    archive: true
  }));
}
for (const batch of batches) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    factory.manufactureFromArchivedProposals(batch, {
      plannerCandidates: [failingPlannerCandidate],
      cases: [evaluationCase],
      ...budgets
    });
  }
}
const report = factory.architectureProposalReplayAttemptOutcomes();
assert.equal(report.consideredAttemptCount, 27);
assert.equal(report.attemptedBatchCount, 9);
assert.equal(report.returnedAttemptCount, MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_ENTRIES);
assert.equal(report.maxEntries, 24);
assert.equal(report.truncated, true);
assert.equal(report.complete, false);
assert.equal(report.rejectedAttemptCount, 27);
assert.equal(report.adoptedAttemptCount, 0);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.attempts), true);
assert.equal(report.attempts.every(Object.isFrozen), true);
assert.equal(report.attempts.every(({ archive }) => Object.isFrozen(archive)), true);
assert.equal(report.attempts.every(({ generationArchive }) => Object.isFrozen(generationArchive)), true);
assert.equal(
  report.attempts.every((attempt, index) => index === 0
    || report.attempts[index - 1].generationArchive.sequence
      < attempt.generationArchive.sequence),
  true
);
const restoredFactory = new HarnessFactory({
  factoryId: factory.factoryId,
  discoveryRunner: fixture.discoveryRunner,
  ledger: EvidenceLedger.fromSerialized(ledger.serialize())
});
assert.deepEqual(restoredFactory.architectureProposalReplayAttemptOutcomes(), report);
const beforeRead = ledger.serialize();
assert.deepEqual(factory.architectureProposalReplayAttemptOutcomes(), report);
assert.equal(ledger.serialize(), beforeRead);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_REPORT_OK `
  + `considered=${report.consideredAttemptCount} returned=${report.returnedAttemptCount} `
  + `batches=${report.attemptedBatchCount} max=${report.maxEntries} truncated=${report.truncated} `
  + `chronological=true frozen=true deterministic=true roundTrip=true verify=${ledger.verify()}`
);
