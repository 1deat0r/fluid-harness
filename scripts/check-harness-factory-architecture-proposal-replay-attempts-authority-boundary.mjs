import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  HarnessFactoryArchitectureProposalConversionReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const REPLAY = HARNESS_FACTORY_RESEARCH_TARGETS.REPLAY_ARCHIVED_PROPOSALS;
const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempts-authority-boundary',
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
  goal: 'archive a design that repeated replays will keep refusing',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const refusedPlan = () => factory.researchPlan().plans.find((plan) => plan.target === REPLAY);
const attemptReceipts = [
  factory.executeResearchPlanReceipt(refusedPlan(), {
    proposalReport: refusedBatch,
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  factory.executeResearchPlanReceipt(refusedPlan(), {
    proposalReport: refusedBatch,
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  })
];
assert.deepEqual(
  attemptReceipts.map((receipt) => receipt.targetResolved),
  [false, false]
);
assert.equal(
  attemptReceipts.every((receipt) => receipt.dataOnly === true
    && receipt.authorityTransferred === false),
  true
);
assert.deepEqual(
  attemptReceipts.map((receipt) => receipt.agendaItemId),
  [attemptReceipts[0].agendaItemId, attemptReceipts[0].agendaItemId]
);
assert.notEqual(
  attemptReceipts[0].resultArchiveSequences[0],
  attemptReceipts[1].resultArchiveSequences[0]
);

const conversion = factory.architectureProposalConversion();
assert.equal(conversion.batches[0].replayCount, 2);
assert.equal(conversion.batches[0].replayed, true);
assert.equal(conversion.batches[0].status, 'REPLAYED');
assert.equal(conversion.batches[0].convertedFingerprintCount, 0);
assert.equal(conversion.batches[0].untestedFingerprintCount, 1);
assert.equal(conversion.convertedFingerprintCount, 0);
assert.equal(conversion.conversionRate, 0);
const outcomes = factory.architectureProposalReplayOutcomes();
assert.equal(outcomes.outcomes[0].replayCount, 2);
assert.equal(outcomes.outcomes[0].adopted, false);
assert.equal(outcomes.outcomes[0].attributed, false);
assert.equal(outcomes.adoptedReplayCount, 0);
assert.equal(outcomes.adoptionRate, 0);
assert.equal(outcomes.gainRate, 0);
const queuedItem = factory.researchAgenda().items.find((item) => item.target === REPLAY);
assert.equal(queuedItem.benchmark.replayAttemptCount, 2);
assert.equal(queuedItem.fitness.evaluatedArchitectureCount, 0);
assert.equal(queuedItem.fitness.measured, false);
assert.equal(queuedItem.dataOnly, true);
assert.equal(queuedItem.authorityTransferred, false);

const archivedBatches = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(archivedBatches[0].evaluated, false);
assert.equal(archivedBatches[0].adopted, false);
assert.equal(archivedBatches[0].deployed, false);
assert.equal(archivedBatches[0].dataOnly, true);
assert.equal(archivedBatches[0].authorityTransferred, false);

assert.throws(
  () => factory.manufactureFromArchivedProposals(conversion, {
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /requires an exact archived report from this factory/
);
assert.throws(
  () => factory.manufactureFromArchivedProposals(outcomes, {
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /requires an exact archived report from this factory/
);
assert.throws(
  () => factory.executeArchivedProposalReplayResearch(queuedItem, {
    proposalReport: queuedItem,
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /exact archived proposal report|requires an exact/
);
assert.equal(
  factory.researchAgenda().items.find((item) => item.target === REPLAY)
    .benchmark.replayAttemptCount,
  2,
  'rejected dispatch attempts never retire the backlog item'
);

assert.throws(
  () => new HarnessFactoryArchitectureProposalConversionReport({
    factory,
    consideredBatchCount: 1,
    archivedProposalCount: 1,
    archivedFingerprintCount: 1,
    evaluatedFingerprintCount: 1,
    convertedFingerprintCount: 1,
    untestedFingerprintCount: 0,
    conversionRate: 1,
    replayedBatchCount: 1,
    convertedBatchCount: 0,
    untestedBatchCount: 0,
    batches: [{
      ...JSON.parse(JSON.stringify(conversion.batches[0])),
      convertedFingerprintCount: 1,
      untestedFingerprintCount: 0,
      status: 'REPLAYED',
      replayCount: 2,
      replayed: true
    }],
    truncated: false,
    token: 'stolen-token'
  }),
  TypeError
);
const forgedBatches = JSON.parse(JSON.stringify(conversion.batches));
forgedBatches[0].replayCount = 0;
assert.throws(
  () => {
    const mutated = factory.architectureProposalConversion();
    mutated.batches[0].replayCount = -1;
  },
  TypeError
);

const recommendation = factory.recommend();
assert.equal(recommendation.status, 'VALIDATE_LATEST_HOLDOUT');
assert.equal(recommendation.dataOnly, true);
assert.equal(recommendation.authorityTransferred, false);
const generationsBefore = factory.history().generations.length;
const adoptedBatch = factory.proposeArchitectures({
  goal: 'archive a design the lifecycle will actually adopt',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const adopted = factory.manufactureFromArchivedProposals(adoptedBatch, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(adopted), true);
assert.equal(adopted.status, 'ADOPTED');
assert.equal(adopted.deployed, false);
assert.equal(adopted.freshAdoption, true);
assert.equal(adopted.improvement, null);
assert.equal(factory.history().generations.length, generationsBefore + 1);
const cleared = factory.researchAgenda().items.find((item) => item.target === REPLAY);
assert.equal(cleared.benchmark.conversionStatus, 'REPLAYED');
assert.equal(cleared.archive.sequence, refusedBatch.archive.sequence);
const finalOutcomes = factory.architectureProposalReplayOutcomes();
assert.equal(finalOutcomes.adoptedReplayCount, 1);
assert.equal(finalOutcomes.rejectedReplayCount, 1);
assert.equal(finalOutcomes.attributedReplayCount, 1);
assert.equal(finalOutcomes.adoptionRate, 1 / 2);

const attemptsBefore = ledger.length;
factory.architectureProposalReplayOutcomes();
factory.architectureProposalConversion();
factory.researchAgenda();
factory.researchPlan();
assert.equal(ledger.length, attemptsBefore);
assert.equal(ledger.verify(), true);

const memoryView = factory.architectureProposalReplayOutcomes();
assert.equal(memoryView.dataOnly, true);
assert.equal(memoryView.authorityTransferred, false);
assert.equal(MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME
  , 'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME');

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPTS_AUTHORITY_BOUNDARY_OK `
  + `attempts=${conversion.batches[0].replayCount} credit=${conversion.batches[0].convertedFingerprintCount} `
  + `sourceEvaluated=${archivedBatches[0].evaluated} sourceAdopted=${archivedBatches[0].adopted} `
  + `sourceDeployed=${archivedBatches[0].deployed} resolved=${attemptReceipts[0].targetResolved} `
  + `forgedRejected=true bridgeRejected=true queueRetained=${queuedItem.benchmark.replayAttemptCount} `
  + `freshAdopted=${adopted.status} freshDeployed=${adopted.deployed} freshImprovement=${adopted.improvement === null} `
  + `adoptionRate=${finalOutcomes.adoptionRate.toFixed(2)} generations=${factory.history().generations.length} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
