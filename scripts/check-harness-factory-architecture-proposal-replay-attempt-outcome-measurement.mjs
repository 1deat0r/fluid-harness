import assert from 'node:assert/strict';

import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempt-outcome-measurement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  holdoutCase,
  budgets
} = fixture;
const batch = factory.proposeArchitectures({
  goal: 'archive one design whose three replay attempts have separate measurements',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const replay = (holdout = false) => factory.manufactureFromArchivedProposals(batch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets,
  ...(holdout
    ? {
      holdoutCases: [holdoutCase],
      holdoutProductionBudget: budgets.productionBudget,
      holdoutResearchBudget: budgets.researchBudget,
      holdoutSkepticBudget: budgets.skepticBudget
    }
    : {})
});
const first = replay();
const second = replay();
const third = replay(true);
assert.throws(
  () => factory.improve({
    goal: 'measure a rejected downstream improvement from the second replay',
    baselineGeneration: second.generation,
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /did not strictly improve measured fitness/
);

const report = factory.architectureProposalReplayAttemptOutcomes();
assert.equal(report.consideredAttemptCount, 3);
assert.equal(report.attemptedBatchCount, 1);
assert.equal(report.adoptedAttemptCount, 3);
assert.equal(report.rejectedAttemptCount, 0);
assert.equal(report.attributedAttemptCount, 3);
assert.equal(report.validatedAttemptCount, 1);
assert.equal(report.pendingValidationAttemptCount, 2);
assert.equal(report.noComparatorAttemptCount, 1);
assert.equal(report.unchangedAttemptCount, 1);
assert.equal(report.comparatorMismatchAttemptCount, 1);
assert.equal(report.regressedAttemptCount, 0);
assert.equal(report.gainedAttemptCount, 0);
assert.equal(report.adoptionRate, 1);
assert.equal(report.gainRate, 0);
assert.deepEqual(
  report.attempts.map(({ outcome }) => outcome),
  ['NO_COMPARATOR', 'UNCHANGED', 'COMPARATOR_MISMATCH']
);
assert.deepEqual(
  report.attempts.map(({ holdoutStatus }) => holdoutStatus),
  ['NOT_RUN', 'NOT_RUN', 'PASSED']
);
assert.deepEqual(report.attempts[1].baseline, first.archive);
assert.deepEqual(report.attempts[2].baseline, second.archive);
assert.equal(report.attempts[1].downstreamImprovementCount, 1);
assert.equal(report.attempts[1].downstreamGainCount, 0);
assert.equal(report.attempts[0].downstreamImprovementCount, 0);
assert.equal(report.attempts[2].downstreamImprovementCount, 0);
assert.equal(report.downstreamImprovementCount, 1);
assert.equal(report.downstreamGainCount, 0);
assert.deepEqual(report.attempts[2].generationArchive, third.archive);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_MEASUREMENT_OK `
  + `attempts=${report.consideredAttemptCount} adopted=${report.adoptedAttemptCount} `
  + `attributed=${report.attributedAttemptCount} validated=${report.validatedAttemptCount} `
  + `outcomes=${report.attempts.map(({ outcome }) => outcome).join('>')} `
  + `downstream=${report.downstreamImprovementCount} gains=${report.downstreamGainCount} `
  + `adoptionRate=${report.adoptionRate} gainRate=${report.gainRate} verify=${ledger.verify()}`
);
