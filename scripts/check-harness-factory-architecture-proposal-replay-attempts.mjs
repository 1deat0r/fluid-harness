import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const REPLAY = 'REPLAY_ARCHIVED_PROPOSALS';
const REPLAY_PRIORITY = 190;
const replayItems = (factory) => factory.researchAgenda().items.filter(
  (item) => item.target === REPLAY
);

const variants = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempts-variants',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureTwoVariants'
});
const variantBatch = variants.factory.proposeArchitectures({
  goal: 'archive two distinct designs so both must be credited when evaluated',
  plannerCandidates: [variants.plannerCandidate],
  archive: true
});
assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(variantBatch), true);
assert.equal(variantBatch.proposalCount, 2);
assert.equal(
  new Set(variantBatch.proposals.map((proposal) => proposal.architectureFingerprint)).size,
  2
);
const variantConversion = variants.factory.architectureProposalConversion();
assert.equal(variantConversion.batches[0].status, 'UNTESTED');
assert.equal(variantConversion.batches[0].convertedFingerprintCount, 0);
assert.equal(variantConversion.batches[0].untestedFingerprintCount, 2);
assert.equal(variantConversion.batches[0].replayCount, 0);
const variantItem = replayItems(variants.factory)[0];
assert.equal(variantItem.benchmark.replayAttemptCount, 0);
assert.equal(variantItem.fitness.replayed, false);

const variantGeneration = variants.factory.manufacture({
  goal: 'evaluate both archived designs and adopt only one',
  plannerCandidates: [variants.plannerCandidate],
  cases: [variants.evaluationCase],
  productionBudget: variants.budgets.productionBudget,
  researchBudget: variants.budgets.researchBudget,
  skepticBudget: variants.budgets.skepticBudget
});
assert.equal(isTrustedHarnessFactoryReport(variantGeneration), true);
assert.equal(variantGeneration.status, 'ADOPTED');
const credited = variants.factory.architectureProposalConversion();
assert.equal(
  credited.evaluatedFingerprintCount,
  2,
  'a design that was evaluated and lost still counts as tested'
);
assert.equal(credited.batches[0].convertedFingerprintCount, 2);
assert.equal(credited.batches[0].untestedFingerprintCount, 0);
assert.equal(credited.batches[0].status, 'CONVERTED');
assert.equal(credited.batches[0].replayCount, 0);
assert.equal(replayItems(variants.factory).length, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempts',
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

const failingBatch = factory.proposeArchitectures({
  goal: 'archive a design the fresh lifecycle will refuse to adopt',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const firstAttempt = replayItems(factory)[0];
assert.equal(firstAttempt.benchmark.conversionStatus, 'UNTESTED');
assert.equal(firstAttempt.benchmark.replayAttemptCount, 0);

const firstReplay = factory.manufactureFromArchivedProposals(failingBatch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(firstReplay.status, 'REJECTED');
const afterFirst = factory.architectureProposalConversion();
assert.equal(afterFirst.batches[0].status, 'REPLAYED');
assert.equal(afterFirst.batches[0].replayCount, 1);
assert.equal(
  afterFirst.batches[0].convertedFingerprintCount,
  0,
  'a replay that archived no evaluated design earns no tested credit'
);
assert.equal(afterFirst.batches[0].untestedFingerprintCount, 1);
const requeued = replayItems(factory);
assert.equal(requeued.length, 1);
assert.equal(requeued[0].benchmark.conversionStatus, 'REPLAYED');
assert.equal(requeued[0].benchmark.replayAttemptCount, 1);
assert.equal(requeued[0].fitness.replayed, true);
assert.equal(requeued[0].fitness.evaluatedArchitectureCount, 0);
assert.equal(requeued[0].fitness.measured, false);
assert.match(requeued[0].reason, /earlier replay/);

const secondReplay = factory.manufactureFromArchivedProposals(failingBatch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(secondReplay.status, 'REJECTED');
const afterSecond = factory.architectureProposalConversion();
assert.equal(afterSecond.batches[0].replayCount, 2);
assert.equal(afterSecond.batches[0].convertedFingerprintCount, 0);
const secondItem = replayItems(factory)[0];
assert.equal(secondItem.benchmark.replayAttemptCount, 2);
assert.equal(
  secondItem.id,
  firstAttempt.id,
  'the same batch keeps one backlog identity across attempts'
);

const outcomes = factory.architectureProposalReplayOutcomes();
assert.equal(outcomes.replayedBatchCount, 1);
assert.equal(outcomes.adoptedReplayCount, 0);
assert.equal(outcomes.rejectedReplayCount, 1);
assert.equal(outcomes.attributedReplayCount, 0);
assert.equal(outcomes.adoptionRate, 0);
assert.equal(outcomes.outcomes[0].replayCount, 2);
assert.equal(outcomes.outcomes[0].adopted, false);
assert.equal(outcomes.outcomes[0].winnerArchitectureFingerprint, null);

const goodBatch = factory.proposeArchitectures({
  goal: 'archive a design the fresh lifecycle will adopt',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(replayItems(factory).length, 2);
const goodReplay = factory.manufactureFromArchivedProposals(goodBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(goodReplay.status, 'ADOPTED');
const afterGood = factory.architectureProposalConversion();
assert.deepEqual(
  afterGood.batches.map((batch) => batch.status),
  ['REPLAYED', 'REPLAYED']
);
assert.deepEqual(afterGood.batches.map((batch) => batch.replayCount), [2, 1]);
assert.deepEqual(afterGood.batches.map((batch) => batch.untestedFingerprintCount), [1, 0]);
const remaining = replayItems(factory);
assert.equal(remaining.length, 1);
assert.deepEqual(remaining[0].archive, failingBatch.archive);
assert.equal(remaining[0].benchmark.replayAttemptCount, 2);

const ranked = factory.researchAgenda().items;
assert.equal(
  ranked.filter((item) => item.target === REPLAY).every(
    (item) => item.priority === REPLAY_PRIORITY
  ),
  true
);
assert.equal(
  ranked.filter((item) => item.target !== REPLAY).every(
    (item) => item.priority > REPLAY_PRIORITY
  ),
  true,
  'replay work never outranks an open factory obligation'
);
const plan = factory.researchPlan().plans.find((candidate) => candidate.target === REPLAY);
assert.deepEqual(plan.archive, failingBatch.archive);
assert.equal(plan.bridge, 'ARCHIVED_PROPOSAL_REPLAY');

const youngerBatch = factory.proposeArchitectures({
  goal: 'archive a newer batch that must not starve the waiting one',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const backlog = factory.researchAgenda().items.filter((item) => item.target === REPLAY);
assert.equal(backlog.length, 2);
assert.deepEqual(
  backlog.map((item) => item.archive.sequence),
  [youngerBatch.archive.sequence, failingBatch.archive.sequence]
);
assert.equal(
  backlog[0].benchmark.replayAttemptCount,
  0,
  'never-attempted exploration gets a turn before a retry'
);
assert.equal(backlog[1].benchmark.replayAttemptCount, 2);
const youngerPlan = factory.researchPlan().plans.filter(
  (candidate) => candidate.target === REPLAY
);
assert.equal(youngerPlan.length, 2);
assert.deepEqual(youngerPlan.map((candidate) => candidate.archive.sequence), [
  youngerBatch.archive.sequence,
  failingBatch.archive.sequence
]);

assert.equal(Object.isFrozen(requeued[0]), true);
assert.equal(
  replayItems(factory).every(
    (item) => Object.hasOwn(item.benchmark, 'proposals') === false
      && Object.hasOwn(item.benchmark, 'candidate') === false
      && Object.hasOwn(item.fitness, 'deltas') === false
  ),
  true
);
const beforeRead = ledger.serialize();
factory.architectureProposalReplayOutcomes();
factory.researchAgenda();
factory.researchPlan();
assert.deepEqual(ledger.serialize(), beforeRead);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPTS_OK `
  + `credit=${credited.batches[0].convertedFingerprintCount}of${credited.batches[0].distinctFingerprintCount} `
  + `failingAttempts=${afterSecond.batches[0].replayCount} failingUntested=${afterSecond.batches[0].untestedFingerprintCount} `
  + `goodAttempts=${afterGood.batches[1].replayCount} goodUntested=${afterGood.batches[1].untestedFingerprintCount} `
  + `queued=${remaining.length} queuePriority=${remaining[0].priority} `
  + `adoptedOutcomes=${outcomes.adoptedReplayCount} rejectedOutcomes=${outcomes.rejectedReplayCount} `
  + `waitingBacklog=${backlog.map((item) => item.benchmark.replayAttemptCount).join('+')} `
  + `generations=${factory.history().generations.length} ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
