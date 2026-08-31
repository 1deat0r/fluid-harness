import assert from 'node:assert/strict';

import {
  HarnessFactory,
  HarnessFactoryArchitectureProposalReplayAttemptOutcomeReport,
  isTrustedHarnessFactoryArchitectureProposalReplayAttemptOutcomeReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-attempt-outcome-authority-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect',
  includeFailingPlanner: true
});
const { factory, ledger, failingPlannerCandidate, evaluationCase, budgets } = fixture;
const batch = factory.proposeArchitectures({
  goal: 'archive attempt outcomes without transferring replay authority',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
factory.manufactureFromArchivedProposals(batch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
factory.manufactureFromArchivedProposals(batch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
const report = factory.architectureProposalReplayAttemptOutcomes();
assert.equal(isTrustedHarnessFactoryArchitectureProposalReplayAttemptOutcomeReport(report), true);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayAttemptOutcomeReport(
    JSON.parse(JSON.stringify(report))
  ),
  false
);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalReplayAttemptOutcomeReport({
    ...report,
    authorityTransferred: true
  }),
  false
);
assert.throws(() => {
  report.attempts[0].attempt = 2;
}, TypeError);
assert.throws(
  () => new Proxy(factory, {}).architectureProposalReplayAttemptOutcomes(),
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
  () => factory.architectureProposalReplayAttemptOutcomes.call(accessorFactory),
  /exact trusted factory/
);
assert.throws(
  () => new HarnessFactoryArchitectureProposalReplayAttemptOutcomeReport({
    factory,
    consideredAttemptCount: 2,
    attemptedBatchCount: 1,
    adoptedAttemptCount: 0,
    rejectedAttemptCount: 2,
    gainedAttemptCount: 0,
    unchangedAttemptCount: 0,
    regressedAttemptCount: 0,
    noComparatorAttemptCount: 2,
    comparatorMismatchAttemptCount: 0,
    attributedAttemptCount: 0,
    validatedAttemptCount: 0,
    pendingValidationAttemptCount: 0,
    downstreamImprovementCount: 0,
    downstreamGainCount: 0,
    adoptionRate: 0,
    gainRate: 0,
    attempts: [{ ...report.attempts[0], attempt: 2 }],
    truncated: false,
    token: 'forged'
  }),
  /trusted lifecycle evidence/
);

const sibling = new HarnessFactory({
  factoryId: 'harness-factory-proposal-replay-attempt-outcome-authority-boundary-sibling',
  discoveryRunner: fixture.discoveryRunner,
  ledger
});
const siblingBatch = sibling.proposeArchitectures({
  goal: 'archive a foreign replay attempt',
  plannerCandidates: [failingPlannerCandidate],
  archive: true
});
sibling.manufactureFromArchivedProposals(siblingBatch, {
  plannerCandidates: [failingPlannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(factory.architectureProposalReplayAttemptOutcomes().consideredAttemptCount, 2);
assert.equal(sibling.architectureProposalReplayAttemptOutcomes().consideredAttemptCount, 1);
assert.equal(
  factory.architectureProposalReplayAttemptOutcomes().attempts.some(
    ({ archive }) => archive.sequence === siblingBatch.archive.sequence
  ),
  false
);
const beforeRead = ledger.serialize();
factory.architectureProposalReplayAttemptOutcomes();
assert.equal(ledger.serialize(), beforeRead);
const tampered = JSON.parse(beforeRead);
tampered.records[1].payload.factory.proposalArchive.hash = 'forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|fingerprint verification failed|invalid shape|is invalid/
);
assert.equal(ledger.serialize(), beforeRead);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_ATTEMPT_OUTCOME_AUTHORITY_BOUNDARY_OK `
  + `forgedRejected=true ordinalRejected=true aggregateRejected=true foreignScoped=true `
  + `proxyRejected=true accessorRejected=true tamperedRejected=true ledgerAtomic=true `
  + `dataOnly=${report.dataOnly} authorityTransferred=${report.authorityTransferred} `
  + `verify=${ledger.verify()}`
);
