import assert from 'node:assert/strict';

import {
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_ENTRIES,
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const isolated = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-outcome-first',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyView = isolated.factory.architectureProposalReplayOutcomes();
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(emptyView),
  true
);
assert.equal(emptyView.factoryId, isolated.factory.factoryId);
assert.equal(emptyView.consideredBatchCount, 0);
assert.equal(emptyView.returnedOutcomeCount, 0);
assert.equal(emptyView.replayedBatchCount, 0);
assert.equal(emptyView.unreplayedBatchCount, 0);
assert.equal(emptyView.adoptedReplayCount, 0);
assert.equal(emptyView.rejectedReplayCount, 0);
assert.equal(emptyView.gainedReplayCount, 0);
assert.equal(emptyView.unchangedReplayCount, 0);
assert.equal(emptyView.regressedReplayCount, 0);
assert.equal(emptyView.noComparatorReplayCount, 0);
assert.equal(emptyView.comparatorMismatchReplayCount, 0);
assert.equal(emptyView.attributedReplayCount, 0);
assert.equal(emptyView.validatedReplayCount, 0);
assert.equal(emptyView.pendingValidationReplayCount, 0);
assert.equal(emptyView.downstreamImprovementCount, 0);
assert.equal(emptyView.downstreamGainCount, 0);
assert.equal(emptyView.adoptionRate, 0);
assert.equal(emptyView.gainRate, 0);
assert.equal(emptyView.truncated, false);
assert.equal(emptyView.complete, true);
assert.equal(
  emptyView.maxEntries,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_ENTRIES
);
assert.equal(emptyView.dataOnly, true);
assert.equal(emptyView.authorityTransferred, false);

const firstBatch = isolated.factory.proposeArchitectures({
  goal: 'archive the batch that becomes the very first factory generation',
  plannerCandidates: [isolated.plannerCandidate],
  archive: true
});
const firstReplay = isolated.factory.manufactureFromArchivedProposals(firstBatch, {
  plannerCandidates: [isolated.plannerCandidate],
  cases: [isolated.evaluationCase],
  productionBudget: isolated.budgets.productionBudget,
  researchBudget: isolated.budgets.researchBudget,
  skepticBudget: isolated.budgets.skepticBudget
});
assert.equal(firstReplay.generation, 1);
assert.equal(firstReplay.status, 'ADOPTED');
const firstView = isolated.factory.architectureProposalReplayOutcomes();
assert.equal(firstView.consideredBatchCount, 1);
assert.equal(firstView.replayedBatchCount, 1);
assert.equal(firstView.noComparatorReplayCount, 1);
assert.equal(firstView.adoptedReplayCount, 1);
assert.equal(firstView.attributedReplayCount, 1);
assert.equal(firstView.pendingValidationReplayCount, 1);
assert.equal(firstView.adoptionRate, 1);
assert.equal(firstView.gainRate, 0);
assert.equal(firstView.outcomes[0].outcome, 'NO_COMPARATOR');
assert.equal(firstView.outcomes[0].generation, 1);
assert.equal(firstView.outcomes[0].baseline, null);
assert.equal(firstView.outcomes[0].baselineGeneration, null);
assert.equal(firstView.outcomes[0].deltas, null);
assert.deepEqual(firstView.outcomes[0].archive, firstBatch.archive);
assert.deepEqual(firstView.outcomes[0].generationArchive, firstReplay.archive);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-outcome',
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
  secondEvaluationCase,
  holdoutCase,
  budgets
} = fixture;

const baseline = factory.manufacture({
  goal: 'open the factory on a failing generation that a replay must beat',
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(baseline.status, 'REJECTED');
assert.equal(factory.architectureProposalReplayOutcomes().consideredBatchCount, 0);

const gainedBatch = factory.proposeArchitectures({
  goal: 'archive the batch whose replay beats the failing baseline',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const gained = factory.manufactureFromArchivedProposals(gainedBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(gained.status, 'ADOPTED');
const afterGain = factory.architectureProposalReplayOutcomes();
assert.equal(afterGain.consideredBatchCount, 1);
assert.equal(afterGain.replayedBatchCount, 1);
assert.equal(afterGain.adoptedReplayCount, 1);
assert.equal(afterGain.rejectedReplayCount, 0);
assert.equal(afterGain.gainedReplayCount, 1);
assert.equal(afterGain.attributedReplayCount, 1);
assert.equal(afterGain.validatedReplayCount, 0);
assert.equal(afterGain.pendingValidationReplayCount, 1);
assert.equal(afterGain.adoptionRate, 1);
assert.equal(afterGain.gainRate, 1);
const gainedItem = afterGain.outcomes[0];
assert.equal(gainedItem.outcome, 'GAINED');
assert.equal(gainedItem.adopted, true);
assert.equal(gainedItem.attributed, true);
assert.equal(gainedItem.holdoutStatus, 'NOT_RUN');
assert.equal(gainedItem.generation, gained.generation);
assert.deepEqual(gainedItem.archive, gainedBatch.archive);
assert.deepEqual(gainedItem.generationArchive, gained.archive);
assert.deepEqual(gainedItem.baseline, baseline.archive);
assert.equal(gainedItem.baselineGeneration, baseline.generation);
assert.equal(gainedItem.proposalCount, gainedBatch.proposalCount);
assert.equal(gainedItem.fingerprintCount, 1);
assert.equal(gainedItem.replayCount, 1);
assert.equal(gainedItem.downstreamImprovementCount, 0);
assert.equal(gainedItem.downstreamGainCount, 0);
assert.deepEqual(
  Object.keys(gainedItem.deltas),
  [
    'productionProvenRate',
    'productionSuccessRate',
    'researchProvenRate',
    'researchSuccessRate',
    'skepticSuccessRate',
    'skepticWeaknessesExposed',
    'transferSuccessRate'
  ]
);
assert.equal(gainedItem.deltas.productionSuccessRate, 1);
assert.equal(gainedItem.deltas.transferSuccessRate, 1);
assert.equal(gainedItem.deltas.skepticWeaknessesExposed, 1);

const unchangedBatch = factory.proposeArchitectures({
  goal: 'archive the batch whose replay only matches the current winner',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const unchanged = factory.manufactureFromArchivedProposals(unchangedBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(unchanged.status, 'ADOPTED');
const afterUnchanged = factory.architectureProposalReplayOutcomes();
assert.equal(afterUnchanged.unchangedReplayCount, 1);
assert.equal(afterUnchanged.attributedReplayCount, 2);
assert.equal(afterUnchanged.gainedReplayCount, 1);
assert.equal(afterUnchanged.adoptionRate, 1);
assert.equal(afterUnchanged.gainRate, 1 / 2);
assert.equal(afterUnchanged.outcomes[1].outcome, 'UNCHANGED');
assert.equal(afterUnchanged.outcomes[1].deltas.productionSuccessRate, 0);
assert.equal(afterUnchanged.outcomes[1].deltas.skepticWeaknessesExposed, 0);

const regressedBatch = factory.proposeArchitectures({
  goal: 'archive the failing batch whose replay regresses against the winner',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const regressed = factory.manufactureFromArchivedProposals(regressedBatch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(regressed.status, 'REJECTED');
const afterRegress = factory.architectureProposalReplayOutcomes();
assert.equal(afterRegress.replayedBatchCount, 3);
assert.equal(afterRegress.adoptedReplayCount, 2);
assert.equal(afterRegress.rejectedReplayCount, 1);
assert.equal(afterRegress.regressedReplayCount, 1);
assert.equal(afterRegress.attributedReplayCount, 2);
assert.equal(afterRegress.adoptionRate, 2 / 3);
assert.equal(afterRegress.gainRate, 1 / 3);
const regressedItem = afterRegress.outcomes[2];
assert.equal(regressedItem.outcome, 'REGRESSED');
assert.equal(regressedItem.adopted, false);
assert.equal(regressedItem.attributed, false);
assert.equal(regressedItem.winnerArchitectureFingerprint, null);
assert.equal(regressedItem.deltas.productionSuccessRate, -1);
assert.equal(regressedItem.holdoutStatus, 'NOT_RUN');

const recovered = factory.improve({
  goal: 'build a later adopted generation on top of the rejected replay',
  baselineGeneration: regressed.generation,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(recovered.status, 'ADOPTED');
assert.equal(recovered.improvement.accepted, true);
assert.deepEqual(recovered.improvement.baseline.archive, regressed.archive);
const downstreamView = factory.architectureProposalReplayOutcomes();
assert.equal(downstreamView.outcomes[2].downstreamImprovementCount, 1);
assert.equal(downstreamView.outcomes[2].downstreamGainCount, 1);
assert.equal(downstreamView.downstreamImprovementCount, 1);
assert.equal(downstreamView.downstreamGainCount, 1);
assert.equal(
  downstreamView.outcomes[0].outcome,
  'GAINED',
  'the archived strict gain never rewrites the earlier replay comparison'
);

const mismatchBatch = factory.proposeArchitectures({
  goal: 'archive a batch replayed under a different unseen-holdout benchmark',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const mismatch = factory.manufactureFromArchivedProposals(mismatchBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets,
  holdoutCases: [holdoutCase],
  holdoutProductionBudget: budgets.productionBudget,
  holdoutResearchBudget: budgets.researchBudget,
  holdoutSkepticBudget: budgets.skepticBudget
});
assert.equal(mismatch.status, 'ADOPTED');
const afterMismatch = factory.architectureProposalReplayOutcomes();
assert.equal(afterMismatch.comparatorMismatchReplayCount, 1);
assert.equal(afterMismatch.validatedReplayCount, 1);
assert.equal(afterMismatch.pendingValidationReplayCount, 2);
assert.equal(
  afterMismatch.gainedReplayCount
    + afterMismatch.unchangedReplayCount
    + afterMismatch.regressedReplayCount
    + afterMismatch.noComparatorReplayCount
    + afterMismatch.comparatorMismatchReplayCount,
  afterMismatch.replayedBatchCount
);
assert.equal(afterMismatch.outcomes[3].outcome, 'COMPARATOR_MISMATCH');
assert.deepEqual(
  afterMismatch.outcomes[3].baseline,
  recovered.archive
);
assert.equal(afterMismatch.outcomes[3].deltas, null);

const idleBatch = factory.proposeArchitectures({
  goal: 'archive a batch that no replay ever tests',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const view = factory.architectureProposalReplayOutcomes();
assert.equal(view.consideredBatchCount, 5);
assert.equal(view.replayedBatchCount, 4);
assert.equal(view.unreplayedBatchCount, 1);
assert.equal(
  view.unreplayedBatchCount + view.replayedBatchCount,
  view.consideredBatchCount
);
assert.equal(
  view.adoptedReplayCount + view.rejectedReplayCount,
  view.replayedBatchCount
);
assert.equal(view.outcomes[4].outcome, 'NOT_REPLAYED');
assert.deepEqual(view.outcomes[4].archive, idleBatch.archive);
assert.equal(view.outcomes[4].generation, null);
assert.equal(view.outcomes[4].generationArchive, null);
assert.equal(view.outcomes[4].baseline, null);
assert.equal(view.outcomes[4].deltas, null);
assert.equal(view.outcomes[4].adopted, false);
assert.equal(view.outcomes[4].attributed, false);
assert.equal(view.outcomes[4].replayCount, 0);
assert.equal(view.outcomes[4].holdoutStatus, 'NOT_RUN');

assert.equal(Object.isFrozen(view), true);
assert.equal(Object.isFrozen(view.outcomes[0]), true);
assert.equal(Object.isFrozen(view.outcomes[0].deltas), true);
assert.equal(
  view.outcomes.every((outcome) => Object.hasOwn(outcome, 'proposals') === false),
  true
);
assert.equal(
  view.outcomes.every((outcome) => Object.hasOwn(outcome, 'candidate') === false),
  true
);
assert.equal(
  view.outcomes.every((outcome) => Object.hasOwn(outcome, 'runner') === false),
  true
);
assert.equal(
  view.outcomes.every((outcome) => Object.hasOwn(outcome, 'discovery') === false),
  true
);
const beforeRead = ledger.serialize();
const repeat = factory.architectureProposalReplayOutcomes();
assert.deepEqual(JSON.parse(JSON.stringify(repeat)), JSON.parse(JSON.stringify(view)));
assert.deepEqual(ledger.serialize(), beforeRead);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_OK `
  + `batches=${view.consideredBatchCount} replayed=${view.replayedBatchCount} `
  + `unreplayed=${view.unreplayedBatchCount} adopted=${view.adoptedReplayCount} `
  + `gained=${view.gainedReplayCount} unchanged=${view.unchangedReplayCount} `
  + `regressed=${view.regressedReplayCount} mismatch=${view.comparatorMismatchReplayCount} `
  + `attributed=${view.attributedReplayCount} validated=${view.validatedReplayCount} `
  + `downstreamGains=${view.downstreamGainCount} `
  + `adoptionRate=${view.adoptionRate.toFixed(2)} gainRate=${view.gainRate.toFixed(2)} `
  + `outcomes=${view.outcomes.map((outcome) => outcome.outcome).join(',')} `
  + `firstOutcome=${firstView.outcomes[0].outcome} ledgerEntries=${ledger.length} `
  + `verify=${ledger.verify()}`
);
