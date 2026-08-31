import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReplayAttemptOutcomeReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempt-outcome',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const { factory, ledger, failingPlannerCandidate, evaluationCase, budgets } = fixture;
const empty = factory.architectureProposalReplayAttemptOutcomes();
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayAttemptOutcomeReport(empty),
  true
);
assert.equal(empty.consideredAttemptCount, 0);
assert.equal(empty.returnedAttemptCount, 0);

const first = factory.proposeArchitectures({
  goal: 'archive the first batch for an interleaved retry trajectory',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const second = factory.proposeArchitectures({
  goal: 'archive the second batch for an interleaved retry trajectory',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const replay = (batch) => factory.manufactureFromArchivedProposals(batch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const firstOne = replay(first);
const secondOne = replay(second);
const firstTwo = replay(first);
const firstThree = replay(first);

const report = factory.architectureProposalReplayAttemptOutcomes();
assert.equal(report.consideredAttemptCount, 4);
assert.equal(report.returnedAttemptCount, 4);
assert.equal(report.attemptedBatchCount, 2);
assert.deepEqual(report.attempts.map(({ attempt }) => attempt), [1, 1, 2, 3]);
assert.deepEqual(
  report.attempts.map(({ generationArchive }) => generationArchive.sequence),
  [firstOne.archive, secondOne.archive, firstTwo.archive, firstThree.archive]
    .map(({ sequence }) => sequence)
);
assert.deepEqual(
  report.attempts.map(({ archive }) => archive.sequence),
  [first.archive.sequence, second.archive.sequence, first.archive.sequence, first.archive.sequence]
);
assert.equal(
  report.attempts.every(({ generationArchive }, index, attempts) =>
    index === 0 || attempts[index - 1].generationArchive.sequence < generationArchive.sequence),
  true
);
assert.deepEqual(
  report.attempts.filter(({ archive }) => archive.sequence === first.archive.sequence)
    .map(({ replayCount }) => replayCount),
  [1, 2, 3]
);
const batchView = factory.architectureProposalReplayOutcomes().outcomes.find(
  ({ archive }) => archive.sequence === first.archive.sequence
);
assert.equal(batchView.replayCount, 3);
assert.deepEqual(batchView.generationArchive, firstThree.archive);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_OK `
  + `attempts=${report.consideredAttemptCount} batches=${report.attemptedBatchCount} `
  + `ordinals=${report.attempts.map(({ attempt }) => attempt).join('>')} `
  + `chronological=true batchLatest=${batchView.replayCount} `
  + `dataOnly=${report.dataOnly} authorityTransferred=${report.authorityTransferred} `
  + `verify=${ledger.verify()}`
);
