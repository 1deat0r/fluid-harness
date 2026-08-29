import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactory
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-replay-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const REPLAY = HARNESS_FACTORY_RESEARCH_TARGETS.REPLAY_ARCHIVED_PROPOSALS;

const batch = factory.proposeArchitectures({
  goal: 'reject unsafe archived proposal replay dispatches',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const otherBatch = factory.proposeArchitectures({
  goal: 'provide a second batch for target-binding checks',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const foreignBatch = foreignFixture.factory.proposeArchitectures({
  goal: 'foreign archived proposal batch',
  plannerCandidates: [foreignFixture.plannerCandidate],
  archive: true
});
const pendingBatch = factory.proposeArchitectures({
  goal: 'provide a pending proposal report',
  plannerCandidates: [plannerCandidate]
});
const forgedBatch = { ...batch };
const agenda = factory.researchAgenda();
const named = (locator) => (candidate) => candidate.target === REPLAY
  && candidate.archive.kind === locator.kind
  && candidate.archive.sequence === locator.sequence
  && candidate.archive.hash === locator.hash;
const item = agenda.items.find(named(otherBatch.archive));
const planItem = factory.researchPlan().plans.find(named(otherBatch.archive));
assert.notEqual(item, undefined);
assert.notEqual(planItem, undefined);
assert.equal(item.archive.sequence, otherBatch.archive.sequence);
assert.equal(
  agenda.items.filter((candidate) => candidate.target === REPLAY)[0].archive.sequence,
  batch.archive.sequence,
  'the replay backlog waits first-in-first-out'
);
const validOptions = {
  proposalReport: otherBatch,
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
};
const beforeLedger = ledger.serialize();

function rejects(label, callback) {
  const before = ledger.serialize();
  assert.throws(callback, undefined, label);
  assert.equal(ledger.serialize() === before, true, `${label} mutated the ledger`);
  assert.equal(ledger.verify(), true);
}

rejects('forged proposal report', () => {
  factory.executeResearchPlan(planItem, { ...validOptions, proposalReport: forgedBatch });
});
rejects('pending proposal report', () => {
  factory.executeResearchPlan(planItem, { ...validOptions, proposalReport: pendingBatch });
});
rejects('foreign proposal report', () => {
  factory.executeResearchPlan(planItem, { ...validOptions, proposalReport: foreignBatch });
});
rejects('missing proposal report', () => {
  factory.executeResearchPlan(planItem, {
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets
  });
});
rejects('proposal batch that does not match the target', () => {
  factory.executeResearchPlan(planItem, { ...validOptions, proposalReport: batch });
});
rejects('unknown planner candidate', () => {
  factory.executeResearchPlan(planItem, {
    ...validOptions,
    plannerCandidates: [foreignFixture.plannerCandidate]
  });
});
rejects('mismatched goal', () => {
  factory.executeResearchPlan(planItem, { ...validOptions, goal: 'a different goal' });
});
rejects('foreign factory agenda item', () => {
  foreignFixture.factory.executeArchivedProposalReplayResearch(item, validOptions);
});
const accessorOptions = {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  productionBudget: budgets.productionBudget,
  researchBudget: budgets.researchBudget,
  skepticBudget: budgets.skepticBudget
};
Object.defineProperty(accessorOptions, 'proposalReport', {
  enumerable: true,
  get() {
    return otherBatch;
  }
});
rejects('accessor-bearing options', () => {
  factory.executeResearchPlan(planItem, accessorOptions);
});
rejects('unknown option', () => {
  factory.executeResearchPlan(planItem, { ...validOptions, archive: false });
});
rejects('stale plan', () => {
  factory.executeResearchPlan({ ...planItem, rank: planItem.rank + 5 }, validOptions);
});

const receipt = factory.executeResearchPlanReceipt(planItem, validOptions);
assert.equal(isTrustedHarnessFactory(factory), true);
assert.equal(receipt.targetResolved, true);
rejects('non-replay agenda item', () => {
  const holdoutItem = factory.researchAgenda().items.find(
    (candidate) => candidate.target === HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT
  );
  assert.notEqual(holdoutItem, undefined);
  factory.executeArchivedProposalReplayResearch(holdoutItem, validOptions);
});
rejects('replay of an already resolved plan', () => {
  factory.executeResearchPlan(planItem, validOptions);
});
assert.equal(ledger.verify(), true);
assert.equal(ledger.serialize() === beforeLedger, false);

const remaining = factory.researchAgenda().items.filter(
  (candidate) => candidate.target === REPLAY
);
assert.equal(remaining.length, 0);
const statuses = factory.architectureProposalConversion().batches.map(
  (converted) => converted.archive.sequence + ':' + converted.status
);
assert.equal(statuses[0], batch.archive.sequence + ':CONVERTED');
assert.equal(statuses[1], otherBatch.archive.sequence + ':REPLAYED');

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_EXECUTION_BOUNDARY_OK `
  + `forged=true pending=true foreign=true missing=true targetMismatch=true unknownCandidate=true `
  + `goalMismatch=true foreignItem=true accessor=true unknownOption=true stale=true `
  + `notExecutableRejected=true replayOnceOnly=true remainingTargets=${remaining.length} statuses=${statuses.join('|')} ledgerPreserved=${ledger.verify()}`
);
