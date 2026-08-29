import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES,
  MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS,
  isTrustedHarnessFactoryArchitectureProposalConversionReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const REPLAY = HARNESS_FACTORY_RESEARCH_TARGETS.REPLAY_ARCHIVED_PROPOSALS;
const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempts-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  failingPlannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const itemFor = (locator) => factory.researchAgenda().items.find(
  (item) => item.target === REPLAY
    && item.archive.kind === locator.kind
    && item.archive.sequence === locator.sequence
    && item.archive.hash === locator.hash
);
const throwsWith = (pattern, body) => {
  try {
    body();
  } catch (error) {
    assert.match(error.message, pattern);
    return true;
  }
  return false;
};

const emptyConversion = factory.architectureProposalConversion();
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport(emptyConversion),
  true
);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport({
    ...emptyConversion,
    authorityTransferred: true
  }),
  false
);
assert.equal(
  throwsWith(/exact trusted factory/, () => {
    new Proxy(factory, {}).architectureProposalConversion();
  }),
  true
);
const accessorFactory = Object.create(Object.getPrototypeOf(factory));
Object.defineProperty(accessorFactory, 'factoryId', {
  enumerable: true,
  get() {
    return factory.factoryId;
  }
});
assert.equal(
  throwsWith(/exact trusted factory/, () => {
    factory.architectureProposalReplayOutcomes.call(accessorFactory);
  }),
  true
);
assert.throws(() => {
  const mutated = factory.architectureProposalConversion();
  mutated.batches[0].replayCount = 9;
}, TypeError);
assert.equal(Object.isFrozen(factory.architectureProposalConversion().batches), true);

const batch = factory.proposeArchitectures({
  goal: 'archive a batch for replay attempt boundary checks',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const queuedItem = itemFor(batch.archive);
assert.equal(queuedItem.benchmark.replayAttemptCount, 0);
assert.equal(queuedItem.benchmark.conversionStatus, 'UNTESTED');
const beforeAnyAttempt = ledger.serialize();

assert.equal(
  throwsWith(/exact agenda item from this factory|stale|invalid shape/, () => {
    factory.executeArchivedProposalReplayResearch({
      ...queuedItem,
      benchmark: { ...queuedItem.benchmark, replayAttemptCount: 7 },
      fitness: { ...queuedItem.fitness, replayed: true }
    }, {
      proposalReport: batch,
      plannerCandidates: [failingPlannerCandidate],
      cases: [evaluationCase],
      ...budgets
    });
  }),
  true
);
assert.deepEqual(ledger.serialize(), beforeAnyAttempt);

const tampered = JSON.parse(beforeAnyAttempt);
tampered.records[0].payload.proposals[0].architectureFingerprint = 'forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|invalid shape|is invalid/
);

const first = factory.executeResearchPlanReceipt(
  factory.researchPlan().plans.find((plan) => plan.target === REPLAY),
  {
    proposalReport: batch,
    plannerCandidates: [failingPlannerCandidate],
    cases: [evaluationCase],
    ...budgets
  }
);
assert.equal(first.targetResolved, false);
assert.equal(itemFor(batch.archive).benchmark.replayAttemptCount, 1);
assert.equal(itemFor(batch.archive).benchmark.conversionStatus, 'REPLAYED');
assert.equal(ledger.length, 3);

const otherBatch = factory.proposeArchitectures({
  goal: 'archive a second batch that must not satisfy the first target',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const stableLedger = ledger.serialize();

const foreignFactory = new HarnessFactory({
  factoryId: 'harness-factory-proposal-replay-attempts-boundary-foreign',
  discoveryRunner: fixture.discoveryRunner,
  ledger
});
assert.equal(
  throwsWith(/exact agenda item from this factory|requires an exact/, () => {
    foreignFactory.executeArchivedProposalReplayResearch(itemFor(batch.archive), {
      proposalReport: batch,
      plannerCandidates: [failingPlannerCandidate],
      cases: [evaluationCase],
      ...budgets
    });
  }),
  true
);
assert.equal(
  throwsWith(/does not match the target|inconsistent/, () => {
    factory.executeArchivedProposalReplayResearch(itemFor(batch.archive), {
      proposalReport: otherBatch,
      plannerCandidates: [failingPlannerCandidate],
      cases: [evaluationCase],
      ...budgets
    });
  }),
  true
);
assert.equal(
  throwsWith(/enumerable data properties/, () => {
    factory.executeResearchPlanReceipt(
      factory.researchPlan().plans.find(
        (plan) => plan.target === REPLAY && plan.archive.sequence === batch.archive.sequence
      ),
      {
        proposalReport: batch,
        plannerCandidates: [failingPlannerCandidate],
        cases: [evaluationCase],
        ...budgets,
        unexpectedOption: true
      }
    );
  }),
  true
);
assert.equal(
  throwsWith(/requires an exact archived report|exact archived proposal report/, () => {
    factory.executeArchivedProposalReplayResearch(itemFor(batch.archive), {
      proposalReport: { ...batch, archived: false, archive: null },
      plannerCandidates: [failingPlannerCandidate],
      cases: [evaluationCase],
      ...budgets
    });
  }),
  true
);
assert.deepEqual(ledger.serialize(), stableLedger);
assert.equal(itemFor(batch.archive).benchmark.replayAttemptCount, 1);
assert.equal(
  factory.architectureProposalConversion().batches[0].replayCount,
  1
);

for (let index = 0; index < 3; index += 1) {
  factory.proposeArchitectures({
    goal: `queue another never-tested archived batch ${index + 1}`,
    plannerCandidates: [failingPlannerCandidate],
    archive: true
  });
}
const queued = factory.researchAgenda().items.filter((item) => item.target === REPLAY);
assert.equal(queued.length, 5);
assert.equal(itemFor(batch.archive).benchmark.replayAttemptCount, 1);
assert.equal(itemFor(otherBatch.archive).benchmark.replayAttemptCount, 0);
assert.equal(queued.every((item) => item.priority === 190), true);
assert.equal(
  queued.every(
    (item) => item.priority < factory.researchAgenda().items[0].priority
      || factory.researchAgenda().items[0].target === REPLAY
  ),
  true,
  'a replay target never outranks the head of the backlog'
);
assert.equal(
  queued.filter((item) => item.benchmark.replayAttemptCount === 1).length,
  1,
  'only the batch with a real archived attempt reports one'
);
const conversion = factory.architectureProposalConversion();
assert.equal(conversion.consideredBatchCount, 5);
assert.equal(conversion.truncated, false);
assert.equal(
  conversion.batches.reduce((total, candidate) => total + candidate.replayCount, 0),
  1
);
assert.equal(
  conversion.batches.filter((candidate) => candidate.status === 'REPLAYED').length,
  1
);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPTS_BOUNDARY_OK `
  + `forgedAttemptRejected=true accessorRejected=true proxyRejected=true `
  + `mutationRejected=true tamperedRejected=true foreignRejected=true `
  + `mismatchRejected=true unknownOptionRejected=true pendingReportRejected=true `
  + `attempts=${itemFor(batch.archive).benchmark.replayAttemptCount} `
  + `queueStatus=${itemFor(batch.archive).benchmark.conversionStatus} `
  + `resolved=${first.targetResolved} queued=${queued.length} `
  + `considered=${conversion.consideredBatchCount} replayed=${conversion.batches.filter((candidate) => candidate.status === 'REPLAYED').length} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
