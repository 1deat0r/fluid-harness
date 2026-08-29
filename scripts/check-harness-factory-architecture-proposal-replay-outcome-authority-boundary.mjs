import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-outcome-authority-boundary',
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
  goal: 'archive the failing batch that becomes the first generation',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const failingReplay = factory.manufactureFromArchivedProposals(failingBatch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(failingReplay), true);
assert.equal(failingReplay.status, 'REJECTED');
assert.equal(failingReplay.deployed, false);
assert.equal(failingReplay.authorityTransferred, false);

const recovered = factory.improve({
  goal: 'turn the rejected replay into a measured strict gain',
  baselineGeneration: failingReplay.generation,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(recovered.improvement.accepted, true);
const view = factory.architectureProposalReplayOutcomes();
assert.equal(view.consideredBatchCount, 1);
assert.equal(view.replayedBatchCount, 1);
assert.equal(view.adoptedReplayCount, 0);
assert.equal(view.rejectedReplayCount, 1);
assert.equal(view.attributedReplayCount, 0);
assert.equal(view.outcomes[0].outcome, 'NO_COMPARATOR');
assert.equal(view.outcomes[0].adopted, false);
assert.equal(view.outcomes[0].downstreamImprovementCount, 1);
assert.equal(view.outcomes[0].downstreamGainCount, 1);

const sourceBatch = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(sourceBatch.length, 1);
assert.equal(sourceBatch[0].evaluated, false);
assert.equal(sourceBatch[0].adopted, false);
assert.equal(sourceBatch[0].deployed, false);
assert.equal(sourceBatch[0].dataOnly, true);
assert.equal(sourceBatch[0].authorityTransferred, false);
assert.equal(
  sourceBatch[0].proposals.every(
    (proposal) => Object.hasOwn(proposal, 'candidate') === false
      && Object.hasOwn(proposal, 'runner') === false
  ),
  true
);

const beforeLedger = ledger.serialize();
const reread = factory.architectureProposalReplayOutcomes();
assert.deepEqual(JSON.parse(JSON.stringify(reread)), JSON.parse(JSON.stringify(view)));
assert.deepEqual(ledger.serialize(), beforeLedger);
const conversion = factory.architectureProposalConversion();
assert.equal(conversion.replayedBatchCount, 1);
assert.equal(conversion.batches[0].status, 'REPLAYED');
assert.equal(conversion.batches[0].replayed, true);
assert.deepEqual(ledger.serialize(), beforeLedger);

assert.throws(
  () => factory.manufactureFromArchivedProposals(view, {
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }),
  /requires an exact archived report from this factory/
);
const forged = {
  ...JSON.parse(JSON.stringify(view)),
  outcomes: [{
    ...JSON.parse(JSON.stringify(view.outcomes[0])),
    adopted: true,
    attributed: true,
    outcome: 'GAINED',
    deltas: {
      productionProvenRate: 1,
      productionSuccessRate: 1,
      researchProvenRate: 1,
      researchSuccessRate: 1,
      skepticSuccessRate: 1,
      skepticWeaknessesExposed: 1,
      transferSuccessRate: 1
    }
  }],
  adoptedReplayCount: 1,
  rejectedReplayCount: 0,
  gainedReplayCount: 1,
  noComparatorReplayCount: 0,
  attributedReplayCount: 1,
  adoptionRate: 1,
  gainRate: 1
};
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(forged),
  false
);
const accessorBearing = Object.create(Object.getPrototypeOf(view));
Object.defineProperty(accessorBearing, 'consideredBatchCount', {
  enumerable: true,
  get() {
    return 99;
  }
});
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(accessorBearing),
  false
);
assert.throws(
  () => factory.executeArchivedProposalReplayResearch(
    factory.researchAgenda().items[0],
    {
      proposalReport: forged,
      plannerCandidates: [plannerCandidate],
      cases: [evaluationCase],
      ...budgets
    }
  ),
  /REPLAY_ARCHIVED_PROPOSALS|requires an exact archived proposal report|not executable/
);
assert.deepEqual(ledger.serialize(), beforeLedger);

const generationsBefore = factory.history().generations.length;
assert.throws(
  () => factory.improve({
    goal: 'replay outcome memory must not substitute for a measured strict gain',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME,
      keywords: ['harness-factory-proposal-replay-outcome']
    }
  }),
  /did not strictly improve/
);
assert.equal(factory.history().generations.length, generationsBefore);
assert.equal(ledger.verify(), true);
const rejections = factory.improvementRejections();
assert.equal(rejections.rejections.length, 1);
assert.equal(rejections.rejections[0].improvement.accepted, false);
assert.equal(rejections.rejections[0].dataOnly, true);
assert.equal(rejections.rejections[0].authorityTransferred, false);
const afterAttempt = factory.architectureProposalReplayOutcomes();
assert.equal(
  afterAttempt.outcomes[0].downstreamImprovementCount,
  1,
  'a rejection against a later baseline never counts as this replay\'s lineage'
);
assert.equal(afterAttempt.outcomes[0].downstreamGainCount, 1);
assert.equal(
  afterAttempt.outcomes[0].outcome,
  'NO_COMPARATOR',
  'a failed later attempt cannot rewrite the earlier replay comparison'
);
assert.equal(afterAttempt.gainedReplayCount, 0);
assert.equal(afterAttempt.adoptedReplayCount, 0);

const freshReplay = factory.proposeArchitectures({
  goal: 'archive a good batch and replay it for fresh adoption only',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const adopted = factory.manufactureFromArchivedProposals(freshReplay, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(adopted.status, 'ADOPTED');
assert.equal(adopted.freshAdoption, true);
assert.equal(adopted.deployed, false);
assert.equal(adopted.authorityTransferred, false);
const finalView = factory.architectureProposalReplayOutcomes();
assert.equal(finalView.outcomes[1].outcome, 'UNCHANGED');
assert.equal(finalView.outcomes[1].adopted, true);
assert.equal(finalView.outcomes[1].attributed, true);
assert.equal(finalView.validatedReplayCount, 0);
assert.equal(finalView.pendingValidationReplayCount, 1);
const restoredBatch = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(restoredBatch[1].evaluated, false);
assert.equal(restoredBatch[1].adopted, false);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_AUTHORITY_BOUNDARY_OK `
  + `sourceEvaluated=${restoredBatch[1].evaluated} sourceAdopted=${restoredBatch[1].adopted} `
  + `sourceDeployed=${restoredBatch[1].deployed} sourceDataOnly=${restoredBatch[1].dataOnly} `
  + `forgedRejected=${!isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(forged)} `
  + `accessorRejected=${!isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(accessorBearing)} `
  + `bridgeRejected=true strictGainRequired=true freshAdopted=${adopted.status} `
  + `freshDeployed=${adopted.deployed} downstreamAttempts=${finalView.downstreamImprovementCount} `
  + `downstreamGains=${finalView.downstreamGainCount} generations=${factory.history().generations.length} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
