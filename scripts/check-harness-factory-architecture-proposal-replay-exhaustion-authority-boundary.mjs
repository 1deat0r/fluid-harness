import assert from 'node:assert/strict';

import {
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS,
  isTrustedHarnessFactoryArchitectureProposalConversionReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-exhaustion-authority-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const { factory, ledger, failingPlannerCandidate, evaluationCase, budgets } = fixture;
const batch = factory.proposeArchitectures({
  goal: 'archive a design that must exhaust without gaining authority',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
const manufactureOptions = {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
};
factory.manufactureFromArchivedProposals(batch, manufactureOptions);
factory.manufactureFromArchivedProposals(batch, manufactureOptions);
const stalePlan = factory.researchPlan().plans.find(
  (plan) => plan.archive?.sequence === batch.archive.sequence
);
factory.manufactureFromArchivedProposals(batch, manufactureOptions);

const conversion = factory.architectureProposalConversion();
const exhausted = conversion.batches[0];
assert.equal(exhausted.status, 'EXHAUSTED');
assert.equal(exhausted.replayCount, MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS);
assert.equal(exhausted.convertedFingerprintCount, 0);
assert.equal(exhausted.untestedFingerprintCount, 1);
assert.equal(conversion.convertedFingerprintCount, 0);
assert.equal(conversion.conversionRate, 0);
assert.equal(conversion.dataOnly, true);
assert.equal(conversion.authorityTransferred, false);

const archived = ledger.restoreHarnessFactoryArchitectureProposals()[0];
assert.equal(archived.evaluated, false);
assert.equal(archived.adopted, false);
assert.equal(archived.deployed, false);
assert.equal(archived.dataOnly, true);
assert.equal(archived.authorityTransferred, false);
const beforeRejected = ledger.serialize();
assert.throws(
  () => factory.manufactureFromArchivedProposals(batch, manufactureOptions),
  /replay attempt limit is exhausted/
);
assert.throws(
  () => factory.executeResearchPlan(stalePlan, {
    proposalReport: batch,
    ...manufactureOptions
  }),
  /research plan is stale/
);
assert.equal(ledger.serialize(), beforeRejected);

const forgedLimit = { ...conversion, replayAttemptLimit: 99 };
const forgedCount = {
  ...conversion,
  batches: [{ ...exhausted, replayCount: 99 }]
};
const forgedStatus = {
  ...conversion,
  batches: [{ ...exhausted, status: 'REPLAYED', replayExhausted: false }]
};
assert.equal(isTrustedHarnessFactoryArchitectureProposalConversionReport(forgedLimit), false);
assert.equal(isTrustedHarnessFactoryArchitectureProposalConversionReport(forgedCount), false);
assert.equal(isTrustedHarnessFactoryArchitectureProposalConversionReport(forgedStatus), false);
assert.throws(() => {
  exhausted.replayAttemptsRemaining = 1;
}, TypeError);

const sibling = new HarnessFactory({
  factoryId: 'harness-factory-proposal-replay-exhaustion-authority-boundary-sibling',
  discoveryRunner: fixture.discoveryRunner,
  ledger
});
assert.throws(
  () => sibling.manufactureFromArchivedProposals(batch, manufactureOptions),
  /exact archived report from this factory/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'plannerCandidates', {
  enumerable: true,
  get() {
    return [failingPlannerCandidate];
  }
});
assert.throws(
  () => factory.manufactureFromArchivedProposals(batch, accessorOptions),
  /enumerable data properties|accessor/
);

const tampered = JSON.parse(beforeRejected);
tampered.records[0].payload.proposals[0].architectureFingerprint = 'forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|invalid shape|is invalid/
);
assert.equal(ledger.serialize(), beforeRejected);
assert.equal(
  factory.researchAgenda().items.some((item) => item.archive?.sequence === batch.archive.sequence),
  false
);
assert.equal(factory.architectureProposalReplayOutcomes().adoptedReplayCount, 0);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXHAUSTION_AUTHORITY_BOUNDARY_OK `
  + `forgedLimitRejected=true forgedCountRejected=true forgedStatusRejected=true `
  + `stalePlanRejected=true foreignRejected=true accessorRejected=true tamperedRejected=true `
  + `sourceEvaluated=${archived.evaluated} sourceAdopted=${archived.adopted} `
  + `sourceDeployed=${archived.deployed} converted=${conversion.convertedFingerprintCount} `
  + `authorityTransferred=${conversion.authorityTransferred} ledgerAtomic=true verify=${ledger.verify()}`
);
