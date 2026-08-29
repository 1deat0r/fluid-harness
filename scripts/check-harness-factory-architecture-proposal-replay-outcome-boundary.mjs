import assert from 'node:assert/strict';

import {
  HarnessFactory,
  HarnessFactoryArchitectureProposalReplayOutcomeReport,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_ENTRIES,
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-outcome-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const emptyView = factory.architectureProposalReplayOutcomes();
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(emptyView),
  true
);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport({
    ...emptyView,
    authorityTransferred: true
  }),
  false
);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(
    Object.create(Object.getPrototypeOf(emptyView))
  ),
  false
);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport(null),
  false
);
assert.throws(
  () => {
    const mutated = factory.architectureProposalReplayOutcomes();
    mutated.consideredBatchCount = 99;
  },
  TypeError
);
assert.equal(
  Object.isFrozen(factory.architectureProposalReplayOutcomes()),
  true
);
assert.throws(
  () => new Proxy(factory, {}).architectureProposalReplayOutcomes(),
  /exact trusted factory/
);
const accessorFactory = Object.create(Object.getPrototypeOf(factory));
Object.defineProperty(accessorFactory, 'factoryId', {
  enumerable: true,
  get() {
    return factory.factoryId;
  }
});
assert.throws(
  () => factory.architectureProposalReplayOutcomes.call(accessorFactory),
  /exact trusted factory/
);

const archived = factory.proposeArchitectures({
  goal: 'archive one batch before probing replay outcome boundaries',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const beforeLedger = ledger.serialize();
assert.deepEqual(
  JSON.parse(JSON.stringify(factory.architectureProposalReplayOutcomes())),
  JSON.parse(JSON.stringify(factory.architectureProposalReplayOutcomes()))
);
assert.deepEqual(ledger.serialize(), beforeLedger);

const tampered = JSON.parse(beforeLedger);
tampered.records[0].payload.proposalCount = 7;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|invalid shape|counts are inconsistent/
);

const forgedItem = {
  ...JSON.parse(JSON.stringify(factory.architectureProposalReplayOutcomes().outcomes[0])),
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
};
assert.throws(
  () => new HarnessFactoryArchitectureProposalReplayOutcomeReport({
    factory,
    consideredBatchCount: 1,
    unreplayedBatchCount: 0,
    replayedBatchCount: 1,
    adoptedReplayCount: 1,
    rejectedReplayCount: 0,
    gainedReplayCount: 1,
    unchangedReplayCount: 0,
    regressedReplayCount: 0,
    noComparatorReplayCount: 0,
    comparatorMismatchReplayCount: 0,
    attributedReplayCount: 0,
    validatedReplayCount: 0,
    pendingValidationReplayCount: 1,
    downstreamImprovementCount: 0,
    downstreamGainCount: 0,
    adoptionRate: 1,
    gainRate: 1,
    outcomes: [forgedItem],
    truncated: false
  }),
  TypeError
);
assert.throws(
  () => new HarnessFactoryArchitectureProposalReplayOutcomeReport({
    factory,
    consideredBatchCount: 2,
    unreplayedBatchCount: 1,
    replayedBatchCount: 1,
    adoptedReplayCount: 1,
    rejectedReplayCount: 0,
    gainedReplayCount: 0,
    unchangedReplayCount: 1,
    regressedReplayCount: 0,
    noComparatorReplayCount: 0,
    comparatorMismatchReplayCount: 0,
    attributedReplayCount: 0,
    validatedReplayCount: 0,
    pendingValidationReplayCount: 1,
    downstreamImprovementCount: 0,
    downstreamGainCount: 0,
    adoptionRate: 1,
    gainRate: 0,
    outcomes: [],
    truncated: false,
    token: 'stolen-token'
  }),
  TypeError
);

const sibling = new HarnessFactory({
  factoryId: 'harness-factory-proposal-replay-outcome-boundary-sibling',
  discoveryRunner: fixture.discoveryRunner,
  ledger
});
sibling.proposeArchitectures({
  goal: 'archive a sibling-factory batch that must stay out of scope',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(ledger.verify(), true);
const scopedView = factory.architectureProposalReplayOutcomes();
assert.equal(scopedView.consideredBatchCount, 1);
assert.equal(scopedView.factoryId, factory.factoryId);
assert.deepEqual(scopedView.outcomes[0].archive, archived.archive);
const siblingView = sibling.architectureProposalReplayOutcomes();
assert.equal(siblingView.consideredBatchCount, 1);
assert.equal(siblingView.factoryId, sibling.factoryId);
assert.notEqual(
  siblingView.outcomes[0].archive.hash,
  scopedView.outcomes[0].archive.hash
);

const replayed = factory.manufactureFromArchivedProposals(archived, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(replayed.generation, 1);
const afterReplay = factory.architectureProposalReplayOutcomes();
assert.equal(afterReplay.replayedBatchCount, 1);
assert.equal(afterReplay.outcomes[0].outcome, 'NO_COMPARATOR');
assert.equal(afterReplay.outcomes[0].adopted, true);
assert.equal(ledger.verify(), true);

for (let index = 0; index < MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_ENTRIES; index += 1) {
  factory.proposeArchitectures({
    goal: `overflow the replay outcome view with archived batch ${index + 1}`,
    plannerCandidates: [plannerCandidate],
    archive: true
  });
}
const overflow = factory.architectureProposalReplayOutcomes();
assert.equal(
  overflow.consideredBatchCount,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_ENTRIES + 1
);
assert.equal(
  overflow.returnedOutcomeCount,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_ENTRIES
);
assert.equal(overflow.truncated, true);
assert.equal(overflow.complete, false);
assert.equal(
  overflow.unreplayedBatchCount + overflow.replayedBatchCount,
  overflow.consideredBatchCount
);
assert.equal(
  overflow.outcomes.every(
    (outcome, index) => index === 0
      || outcome.archive.sequence > overflow.outcomes[index - 1].archive.sequence
  ),
  true
);
assert.equal(overflow.replayedBatchCount, 1);
assert.equal(ledger.verify(), true);
assert.notEqual(ledger.serialize(), beforeLedger);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME_BOUNDARY_OK `
  + `forged=${isTrustedHarnessFactoryArchitectureProposalReplayOutcomeReport({ ...emptyView, authorityTransferred: true })} `
  + `prototypeRejected=true proxyRejected=true accessorRejected=true `
  + `classRejected=true tamperedRejected=true frozen=${Object.isFrozen(overflow)} `
  + `siblingExcluded=${scopedView.consideredBatchCount === 1} `
  + `considered=${overflow.consideredBatchCount} returned=${overflow.returnedOutcomeCount} `
  + `replayed=${overflow.replayedBatchCount} truncated=${overflow.truncated} `
  + `viewReadOnly=true ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
